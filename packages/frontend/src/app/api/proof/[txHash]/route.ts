import { ethers } from "ethers";
import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/proof/[txHash]
 * Returns full decision data for a given transaction hash.
 * Reads from VIGILLedger.sol on Mantle Sepolia — no database required.
 * Also falls back to the Postgres indexer if available.
 */

const MANTLE_RPC    = process.env.MANTLE_RPC_URL || "https://rpc.sepolia.mantle.xyz";
const LEDGER_ADDR   = process.env.VIGIL_LEDGER_ADDRESS || "";
const VAULT_ADDR    = process.env.VIGIL_VAULT_ADDRESS || "";
const EXPLORER_BASE = "https://sepolia.mantlescan.xyz";
const ERC8004_REP   = process.env.ERC8004_REPUTATION_REGISTRY || "";

const LEDGER_ABI = [
  `function getEntryByTxHash(bytes32 txHash) view returns (
    uint256 entryId,
    uint256 timestamp,
    uint256 agentId,
    uint8 entryType,
    address fromToken,
    address toToken,
    uint256 amount,
    uint256 confidence,
    uint256 slippageBps,
    bytes32 txHashStored,
    bytes32 zkProofHash,
    bytes32 signalBundleHash,
    string skipReason,
    string reasoning
  )`,
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
  "function totalEntries() view returns (uint256)",
];

const TOKEN_SYMBOLS: Record<string, string> = {
  [process.env.METH_ADDRESS  || ""]: "mETH",
  [process.env.USDY_ADDRESS  || ""]: "USDY",
  [process.env.NVDAX_ADDRESS || ""]: "NVDAx",
  [process.env.AAPLX_ADDRESS || ""]: "AAPLx",
  [process.env.TSLAX_ADDRESS || ""]: "TSLAx",
  [process.env.MNT_ADDRESS || "0x78c1b0c915c4faa5fffa6cabf0219da63d7f4cb8"]: "MNT",
};

// Try to read from local SQLite indexer database
async function tryReadFromSqlite(txHash: string): Promise<any | null> {
  try {
    const sqlite3 = await import("sqlite3");
    const path = await import("path");
    const dbPath = path.resolve(process.cwd(), "../indexer/vigil.db");

    return new Promise((resolve) => {
      const db = new sqlite3.default.Database(dbPath, sqlite3.default.OPEN_READONLY, (err) => {
        if (err) return resolve(null);
      });

      db.get(
        "SELECT * FROM ledger_entries WHERE tx_hash = ? LIMIT 1",
        [txHash],
        (err, row) => {
          db.close();
          if (err) resolve(null);
          else resolve(row || null);
        }
      );
    });
  } catch {
    return null;
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ txHash: string }> }
) {
  const { txHash } = await params;

  if (!txHash || !/^0x[0-9a-fA-F]{64}$/.test(txHash)) {
    return NextResponse.json({ error: "Invalid transaction hash format" }, { status: 400 });
  }

  if (!LEDGER_ADDR) {
    return NextResponse.json(
      { error: "VIGIL_LEDGER_ADDRESS not configured — deploy contracts first" },
      { status: 503 }
    );
  }

  // Try SQLite first (faster)
  const pgRow = await tryReadFromSqlite(txHash);

  if (pgRow) {
    // Build response from Postgres indexer data
    return NextResponse.json(buildResponseFromDb(pgRow, txHash));
  }

  // Fall back to reading directly from Mantle Sepolia chain
  try {
    const provider = new ethers.JsonRpcProvider(MANTLE_RPC, undefined, { batchMaxCount: 1 });
    const ledger   = new ethers.Contract(LEDGER_ADDR, LEDGER_ABI, provider);

    // Try getEntryByTxHash (if that function exists in deployed contract)
    let entry: any;
    try {
      const txHashBytes32 = txHash.length === 66 ? txHash : ethers.zeroPadValue(txHash, 32);
      entry = await ledger.getEntryByTxHash(txHashBytes32);
    } catch {
      // Function doesn't exist — scan recent entries for this txHash
      const total = Number(await ledger.totalEntries());
      const scanCount = Math.min(total, 200); // scan last 200 entries

      for (let i = total - 1; i >= Math.max(0, total - scanCount); i--) {
        const e = await ledger.getEntry(i);
        if (e.txHash === txHash || e.txHash === txHash.toLowerCase()) {
          entry = { entryId: i, ...e };
          break;
        }
      }
    }

    if (!entry || !entry.timestamp) {
      return NextResponse.json(
        { error: `No ledger entry found for tx: ${txHash}` },
        { status: 404 }
      );
    }

    return NextResponse.json(buildResponseFromChain(entry, txHash));
  } catch (err: any) {
    return NextResponse.json(
      { error: `Failed to read from Mantle Sepolia: ${err.message}` },
      { status: 500 }
    );
  }
}

function buildResponseFromChain(entry: any, txHash: string) {
  const fromToken = entry.fromToken?.toLowerCase() || "";
  const toToken   = entry.toToken?.toLowerCase() || "";

  return {
    txHash,
    agentId:        Number(entry.agentId),
    entryId:        Number(entry.entryId || 0),
    timestamp:      Number(entry.timestamp) * 1000,
    fromAsset:      TOKEN_SYMBOLS[fromToken] || fromToken.slice(0, 8),
    toAsset:        TOKEN_SYMBOLS[toToken]   || toToken.slice(0, 8),
    fromToken,
    toToken,
    amountUSD:      Number(entry.amount) / 1e6,
    slippageBps:    Number(entry.slippageBps),
    confidence:     Number(entry.confidence) / 10000,
    reasoning:      entry.reasoning || "",
    zkProofHash:    entry.zkProofHash !== ethers.ZeroHash ? entry.zkProofHash : null,
    signalBundleHash: entry.signalBundleHash !== ethers.ZeroHash ? entry.signalBundleHash : null,
    mantlescanUrl:  `https://sepolia.mantlescan.xyz/tx/${txHash}`,
    erc8004Url:     ERC8004_REP || "https://erc8004.quicknode.com",
    network:        "Mantle Sepolia",
    fetchedFrom:    "chain",
  };
}

function buildResponseFromDb(row: any, txHash: string) {
  return {
    txHash,
    agentId:        row.agent_id,
    entryId:        row.entry_id,
    timestamp:      row.block_timestamp * 1000,
    fromAsset:      TOKEN_SYMBOLS[row.from_token?.toLowerCase() || ""] || row.from_token?.slice(0, 8),
    toAsset:        TOKEN_SYMBOLS[row.to_token?.toLowerCase() || ""]   || row.to_token?.slice(0, 8),
    fromToken:      row.from_token,
    toToken:        row.to_token,
    amountUSD:      Number(row.amount || 0) / 1e6,
    slippageBps:    row.slippage_bps,
    confidence:     (row.confidence || 0) / 10000,
    reasoning:      row.reasoning || "",
    zkProofHash:    row.zk_proof_hash,
    signalBundleHash: row.signal_bundle_hash,
    mantlescanUrl:  `https://sepolia.mantlescan.xyz/tx/${txHash}`,
    erc8004Url:     ERC8004_REP || "https://erc8004.quicknode.com",
    network:        "Mantle Sepolia",
    fetchedFrom:    "indexer",
  };
}
