import { ethers } from "ethers";
import * as sqlite3 from "sqlite3";
import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";

dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

/**
 * VIGIL Indexer — VIGILLedger Event Listener (SQLite Edition)
 * Subscribes to EntryLogged and ExecutionLogged events from VIGILLedger on Mantle.
 * Stores every event in a local SQLite file (vigil.db) and broadcasts to WebSockets.
 */

const VIGIL_LEDGER_ADDRESS = process.env.VIGIL_LEDGER_ADDRESS || "";
const MANTLE_RPC_URL = process.env.MANTLE_RPC_URL || "https://rpc.sepolia.mantle.xyz";

const VIGIL_LEDGER_ABI = [
  "event EntryLogged(uint256 indexed entryId, uint256 indexed agentId, uint8 indexed entryType, uint256 confidence, bytes32 zkProofHash, uint256 timestamp)",
  "event ExecutionLogged(uint256 indexed entryId, address fromToken, address toToken, uint256 amount, uint256 slippageBps, bytes32 txHash)",
  `function getEntry(uint256 entryId) view returns (
    uint256 timestamp,
    uint256 agentId,
    uint8 entryType,
    address fromToken,
    address toToken,
    uint256 amount,
    uint256 confidence,
    uint256 slippageBps,
    bytes32 txHash,
    bytes32 zkProofHash,
    bytes32 signalBundleHash,
    string skipReason,
    string reasoning
  )`,
];

// WebSocket broadcast function — set by the WebSocket server module
let broadcastFn: ((event: object) => void) | null = null;

export function setBroadcastFunction(fn: (event: object) => void) {
  broadcastFn = fn;
}

// ─── SQLite Database Connection ───────────────────────────────────────────────
const dbPath = path.resolve(__dirname, "../vigil.db");
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error("[Database] ❌ Error opening SQLite database:", err.message);
  } else {
    console.log("[Database] 🔌 Connected to SQLite database at:", dbPath);
  }
});

// ─── Automatic Schema Initialization ─────────────────────────────────────────
async function initSqliteDb(): Promise<void> {
  return new Promise((resolve, reject) => {
    const schema = `
      CREATE TABLE IF NOT EXISTS decisions (
          id                  TEXT PRIMARY KEY,
          timestamp_ms        INTEGER NOT NULL,
          action              TEXT NOT NULL,
          from_asset          TEXT,
          from_token          TEXT,
          to_asset            TEXT,
          to_token            TEXT,
          amount_usd_6dp      INTEGER,
          confidence          REAL,
          reasoning           TEXT,
          signal_bundle_id    TEXT,
          signal_bundle_cid   TEXT,
          skip_reason         TEXT,
          zk_proof_hash       TEXT,
          tx_hash             TEXT,
          slippage_bps        INTEGER,
          erc8004_task_id     TEXT,
          ledger_entry_id     INTEGER,
          outcome_6h          REAL,
          outcome_24h         REAL,
          public_proof_url    TEXT,
          share_text          TEXT,
          created_at          DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS ledger_entries (
          entry_id            INTEGER PRIMARY KEY,
          agent_id            INTEGER NOT NULL,
          entry_type          INTEGER NOT NULL,
          from_token          TEXT,
          to_token            TEXT,
          amount              INTEGER,
          confidence          INTEGER,
          slippage_bps        INTEGER,
          tx_hash             TEXT,
          zk_proof_hash       TEXT,
          signal_bundle_hash  TEXT,
          skip_reason         TEXT,
          reasoning           TEXT,
          block_number        INTEGER,
          block_timestamp     INTEGER,
          log_timestamp       INTEGER,
          created_at          DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS signal_bundles (
          id                  TEXT PRIMARY KEY,
          timestamp_ms        INTEGER NOT NULL,
          ipfs_cid            TEXT,
          meth_apr            REAL,
          usdy_yield          REAL,
          nvdax_price         REAL,
          aaplx_price         REAL,
          tslax_price         REAL,
          mnt_price_usd       REAL,
          smart_money_flows   TEXT,
          sentiment_deltas    TEXT,
          created_at          DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS agent_state (
          id                  INTEGER PRIMARY KEY DEFAULT 1,
          agent_id            INTEGER,
          agent_wallet        TEXT,
          reputation_score    REAL DEFAULT 0,
          total_decisions     INTEGER DEFAULT 0,
          total_executed      INTEGER DEFAULT 0,
          total_skipped       INTEGER DEFAULT 0,
          uptime_started_at   INTEGER,
          active_clmm_pos     TEXT,
          gas_reservoir_mnt   REAL DEFAULT 0,
          last_cycle_at       INTEGER,
          updated_at          DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      DROP VIEW IF EXISTS recent_executions;
      CREATE VIEW recent_executions AS
      SELECT d.*, le.block_number, le.block_timestamp
      FROM decisions d
      LEFT JOIN ledger_entries le ON d.tx_hash = le.tx_hash
      WHERE d.action != 'SKIP'
      ORDER BY d.timestamp_ms DESC
      LIMIT 50;

      DROP VIEW IF EXISTS agent_accuracy;
      CREATE VIEW agent_accuracy AS
      SELECT
          COUNT(CASE WHEN action != 'SKIP' THEN 1 END) as total_executed,
          COUNT(CASE WHEN outcome_6h > 0 THEN 1 END) as positive_outcomes,
          ROUND(
              100.0 * COUNT(CASE WHEN outcome_6h > 0 THEN 1 END) /
              MAX(1, COUNT(CASE WHEN action != 'SKIP' AND outcome_6h IS NOT NULL THEN 1 END)),
              1
          ) as accuracy_pct
      FROM decisions;
    `;

    db.exec(schema, (err) => {
      if (err) {
        console.error("[Database] ❌ Schema initialization failed:", err.message);
        reject(err);
      } else {
        console.log("[Database] ✅ SQLite database and views initialized successfully!");

        // Seed default agent state singleton row
        db.run("INSERT OR IGNORE INTO agent_state (id) VALUES (1)", (seedErr) => {
          if (seedErr) {
            console.error("[Database] ❌ Failed to seed agent_state:", seedErr.message);
          }
          resolve();
        });
      }
    });
  });
}

// ─── Event Listener Setup ──────────────────────────────────────────────────────
let globalProvider: ethers.JsonRpcProvider | null = null;

export async function startEventListeners(): Promise<void> {
  // Initialize local DB schema on boot
  await initSqliteDb();

  if (!VIGIL_LEDGER_ADDRESS) {
    console.warn("[Indexer] VIGIL_LEDGER_ADDRESS not set — listener not started");
    return;
  }

  // Mantle Sepolia public RPC does not support WebSocket subscriptions.
  // Use HTTP polling mode (every 12s) which works reliably.
  console.log(`[Indexer] Using HTTP polling mode for Mantle Sepolia`);
  const httpProvider = new ethers.JsonRpcProvider(MANTLE_RPC_URL, undefined, { batchMaxCount: 1 });
  globalProvider = httpProvider;

  try {
    const block = await httpProvider.getBlockNumber();
    console.log(`[Indexer] ✅ Connected to Mantle Sepolia RPC. Block #${block}`);
  } catch (err: any) {
    console.error(`[Indexer] ❌ Failed to connect to Mantle Sepolia RPC on startup: ${err.message}. Indexer will retry polling automatically.`);
  }

  startPollingListener(httpProvider);
}



// ─── HTTP Polling Fallback ─────────────────────────────────────────────────────

async function startPollingListener(provider: ethers.JsonRpcProvider): Promise<void> {
  if (!VIGIL_LEDGER_ADDRESS) return;

  const ledger = new ethers.Contract(VIGIL_LEDGER_ADDRESS, VIGIL_LEDGER_ABI, provider);

  let lastProcessedBlock = await provider.getBlockNumber() - 100;

  console.log(`[Indexer] Polling from block ${lastProcessedBlock}`);

  const MAX_BLOCK_RANGE = 9_900; // Mantle Sepolia getLogs cap is 10,000

  setInterval(async () => {
    try {
      const currentBlock = await provider.getBlockNumber();
      if (currentBlock <= lastProcessedBlock) return;

      // Cap block range to avoid RPC limit — process in chunks if needed
      const toBlock = Math.min(currentBlock, lastProcessedBlock + MAX_BLOCK_RANGE);

      const events = await ledger.queryFilter("EntryLogged", lastProcessedBlock + 1, toBlock);

      for (const event of events) {
        if (!("args" in event)) continue;
        const { entryId, agentId, entryType, confidence, zkProofHash, timestamp } = event.args;
        console.log(`[Indexer] Polled EntryLogged: #${entryId}`);

        const entry = await ledger.getEntry(entryId);
        await upsertLedgerEntry({
          entry_id: Number(entryId),
          agent_id: Number(agentId),
          entry_type: Number(entryType),
          from_token: entry.fromToken,
          to_token: entry.toToken,
          amount: entry.amount.toString(),
          confidence: Number(confidence),
          slippage_bps: Number(entry.slippageBps),
          tx_hash: entry.txHash !== ethers.ZeroHash ? entry.txHash : null,
          zk_proof_hash: entry.zkProofHash !== ethers.ZeroHash ? entry.zkProofHash : null,
          signal_bundle_hash: null,
          skip_reason: entry.skipReason || null,
          reasoning: entry.reasoning || null,
          block_number: event.blockNumber,
          block_timestamp: Number(timestamp),
          log_timestamp: Date.now(),
        });

        if (broadcastFn) {
          broadcastFn({
            type: "LEDGER_ENTRY",
            entryId: Number(entryId),
            entryType: Number(entryType),
            confidence: Number(confidence) / 10000,
            reasoning: entry.reasoning,
            timestamp: Number(timestamp),
          });
        }
      }

      lastProcessedBlock = toBlock;
    } catch (err) {
      console.error("[Indexer] Polling error:", err);
    }
  }, 12_000);
}

// ─── Database Helpers (SQLite Edition) ────────────────────────────────────────

async function upsertLedgerEntry(entry: Record<string, any>): Promise<void> {
  return new Promise((resolve, reject) => {
    db.run(
      `INSERT INTO ledger_entries (
        entry_id, agent_id, entry_type, from_token, to_token,
        amount, confidence, slippage_bps, tx_hash, zk_proof_hash,
        signal_bundle_hash, skip_reason, reasoning,
        block_number, block_timestamp, log_timestamp
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT (entry_id) DO UPDATE SET
        reasoning = excluded.reasoning,
        log_timestamp = excluded.log_timestamp`,
      [
        entry.entry_id, entry.agent_id, entry.entry_type,
        entry.from_token, entry.to_token, entry.amount,
        entry.confidence, entry.slippage_bps, entry.tx_hash,
        entry.zk_proof_hash, entry.signal_bundle_hash,
        entry.skip_reason, entry.reasoning,
        entry.block_number, entry.block_timestamp, entry.log_timestamp,
      ],
      (err) => {
        if (err) {
          console.error("[Database] ❌ Upsert ledger entry failed:", err.message);
          reject(err);
        } else {
          resolve();
        }
      }
    );
  });
}

export async function getRecentLedgerEntries(limit = 50): Promise<any[]> {
  return new Promise((resolve, reject) => {
    db.all(
      `SELECT * FROM ledger_entries ORDER BY block_timestamp DESC LIMIT ?`,
      [limit],
      (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      }
    );
  });
}

export async function getLedgerEntryByTxHash(txHash: string): Promise<any | null> {
  return new Promise((resolve, reject) => {
    db.get(
      `SELECT * FROM ledger_entries WHERE tx_hash = ? LIMIT 1`,
      [txHash],
      (err, row) => {
        if (err) reject(err);
        else resolve(row || null);
      }
    );
  });
}

export async function getAgentStats(): Promise<any> {
  return new Promise((resolve, reject) => {
    db.get(`SELECT * FROM agent_state WHERE id = 1`, (err, row) => {
      if (err) reject(err);
      else resolve(row || {});
    });
  });
}

export async function updateAgentStats(stats: Partial<{
  reputation_score: number;
  total_decisions: number;
  total_executed: number;
  total_skipped: number;
  gas_reservoir_mnt: number;
  last_cycle_at: number;
}>): Promise<void> {
  const entries = Object.entries(stats).filter(([, v]) => v !== undefined);
  if (entries.length === 0) return;

  const setClause = entries.map(([k]) => `${k} = ?`).join(", ");
  const values = entries.map(([, v]) => v);

  return new Promise((resolve, reject) => {
    db.run(
      `UPDATE agent_state SET ${setClause}, updated_at = datetime('now') WHERE id = 1`,
      values,
      (err) => {
        if (err) {
          console.error("[Database] ❌ Failed to update agent stats:", err.message);
          reject(err);
        } else {
          resolve();
        }
      }
    );
  });
}

export async function checkHealth(): Promise<{ database: boolean; provider: boolean; blockNumber: number | null }> {
  const health = { database: false, provider: false, blockNumber: null as number | null };

  try {
    await new Promise<void>((resolve, reject) => {
      db.get("SELECT 1", (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
    health.database = true;
  } catch (err) {
    console.error("[Health] Database check failed:", err);
  }

  if (globalProvider) {
    try {
      const block = await globalProvider.getBlockNumber();
      health.blockNumber = block;
      health.provider = true;
    } catch (err) {
      console.error("[Health] Provider block check failed:", err);
    }
  }

  return health;
}
