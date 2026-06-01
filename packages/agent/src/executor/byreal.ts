import { execSync } from "child_process";
import * as path from "path";
import * as os from "os";
import { ByrealPoolAnalysis, ByrealPosition } from "../types";

/**
 * VIGIL Executor — Byreal CLI CLMM Manager
 * Wraps @byreal-io/byreal-cli in a secure Node.js subprocess.
 * Manages live CLMM positions on Byreal DEX (Solana).
 *
 * Prerequisite:
 *   npm install -g @byreal-io/byreal-cli
 *   byreal-cli wallet set --private-key "..."
 *
 * Security: CLI never transmits private keys over network.
 * Keys are stored in an isolated directory with restrictive permissions.
 *
 * Docs: https://github.com/byreal-git/byreal-agent-skills
 */

// Isolated keypair directory — separate from user's own Byreal config
const BYREAL_HOME = process.env.BYREAL_AGENT_HOME
  || path.join(os.homedir(), ".config", "byreal", "vigil-agent");

/**
 * Execute a byreal-cli command in a secure subprocess.
 * Throws on CLI not found. Returns parsed JSON or throws on parse error.
 */
function byrealCli<T = Record<string, unknown>>(args: string): T {
  try {
    const output = execSync(`byreal-cli ${args} --output json`, {
      env: {
        ...process.env,
        HOME: BYREAL_HOME,
        BYREAL_HOME,
      },
      timeout: 30_000,
      maxBuffer: 1024 * 1024,
    });

    return JSON.parse(output.toString()) as T;
  } catch (err: any) {
    if (err.status === 127) {
      throw new Error(
        "[Byreal] byreal-cli not found. Install with: npm install -g @byreal-io/byreal-cli"
      );
    }
    // Include stderr in the thrown error for debugging
    const stderr = err.stderr?.toString() || "";
    const stdout = err.stdout?.toString() || "";
    throw new Error(`[Byreal] CLI error for '${args}': ${err.message}\nstderr: ${stderr}\nstdout: ${stdout}`);
  }
}

/**
 * Check if byreal-cli is installed and configured.
 * Throws a descriptive error if not — used at agent startup.
 */
export function assertByrealAvailable(): void {
  try {
    execSync("byreal-cli --version", {
      stdio: "ignore",
      env: { ...process.env, HOME: BYREAL_HOME },
    });
  } catch {
    throw new Error(
      "[Byreal] byreal-cli is not installed.\n" +
      "Run: npm install -g @byreal-io/byreal-cli"
    );
  }
}

/**
 * Check if byreal-cli is installed (non-throwing version for optional usage).
 */
export function isByrealAvailable(): boolean {
  try {
    execSync("byreal-cli --version", {
      stdio: "ignore",
      env: { ...process.env, HOME: BYREAL_HOME },
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Fetch live APR and TVL data for a Byreal CLMM pool.
 */
export async function analyzeByrealPool(pool = "H1ByEjzUbD2xBoqhGnqFQr8WeumXBor6hTtB6f4NjjW"): Promise<ByrealPoolAnalysis> {
  console.log(`[Byreal] Fetching live pool data: ${pool}`);

  const result = byrealCli<{
    success: boolean;
    data: {
      pool: { pair: string; feeRate: string };
      metrics: { tvl: string; volume24h: string; totalApr: string };
    };
  }>(`pools analyze ${pool}`);

  if (!result.success || !result.data) {
    throw new Error(`[Byreal] Pool analysis failed: ${JSON.stringify(result)}`);
  }

  // Parse APR string (e.g. "59.23%")
  const aprStr = result.data.metrics.totalApr;
  const apr = parseFloat(aprStr.replace("%", "")) || 0;
  const tvl = parseFloat(result.data.metrics.tvl) || 0;
  const volume24h = parseFloat(result.data.metrics.volume24h) || 0;

  console.log(`[Byreal] ${result.data.pool.pair}: APR=${apr.toFixed(2)}%, TVL=$${(tvl / 1000).toFixed(0)}k`);

  return {
    pool,
    apr,
    tvl,
    volume24h,
    feeTier: result.data.pool.feeRate,
  };
}

/**
 * Open a new live CLMM position.
 * Returns the live position ID from Byreal CLI.
 */
export async function openClmmPosition(
  amountMNT: number,
  rangeType: "balanced" | "narrow" | "wide" = "balanced"
): Promise<string> {
  console.log(`[Byreal] Opening CLMM position: ${amountMNT} MNT, range: ${rangeType}`);

  // Using real PENGUIN/USDC pool as example or pool set in config
  const pool = "H1ByEjzUbD2xBoqhGnqFQr8WeumXBor6hTtB6f4NjjW"; 

  const result = byrealCli<{
    success: boolean;
    data: { positionId: string; txSignature: string; status: string };
    error?: { message: string };
  }>(
    `positions open --pool ${pool} --amount ${amountMNT} --auto-swap --confirm`
  );

  if (!result.success || !result.data?.positionId) {
    throw new Error(`[Byreal] Position open failed: ${result.error?.message || JSON.stringify(result)}`);
  }

  console.log(`[Byreal] ✅ Position opened: ${result.data.positionId} (tx: ${result.data.txSignature})`);
  return result.data.positionId;
}

/**
 * Fetch live data for an existing CLMM position.
 * Returns null if position is not found (may have been closed externally).
 */
export async function analyzePosition(positionId: string): Promise<ByrealPosition | null> {
  console.log(`[Byreal] Fetching live position data: ${positionId}`);

  try {
    const result = byrealCli<{
      success: boolean;
      data: {
        positionId: string;
        pool: string;
        amountMNT: number;
        amountUSDC: number;
        currentApr: number;
        inRange: boolean;
        accruedFees: number;
        openedAtUnixMs: number;
      };
    }>(`positions analyze --id ${positionId}`);

    if (!result.success || !result.data) return null;

    return {
      positionId: result.data.positionId,
      pool: result.data.pool,
      amountMNT: result.data.amountMNT,
      amountUSDC: result.data.amountUSDC,
      currentApr: result.data.currentApr,
      inRange: result.data.inRange,
      accruedFees: result.data.accruedFees,
      openedAt: result.data.openedAtUnixMs || Date.now(),
    };
  } catch (err: any) {
    if (err.message.includes("not found") || err.message.includes("does not exist")) {
      console.warn(`[Byreal] Position ${positionId} not found — may have been closed`);
      return null;
    }
    throw err;
  }
}

/**
 * Close a live CLMM position and return all funds.
 */
export async function closeClmmPosition(positionId: string): Promise<boolean> {
  console.log(`[Byreal] Closing live position: ${positionId}`);

  const result = byrealCli<{
    success: boolean;
    data: { status: string; returnedMNT: number; returnedUSDC: number; txSignature: string };
    error?: { message: string };
  }>(`positions close --id ${positionId} --confirm`);

  if (!result.success || result.data?.status !== "closed") {
    throw new Error(`[Byreal] Close failed: ${result.error?.message || JSON.stringify(result)}`);
  }

  console.log(
    `[Byreal] ✅ Position closed: ${result.data.returnedMNT.toFixed(2)} MNT + ${result.data.returnedUSDC.toFixed(2)} USDC returned (tx: ${result.data.txSignature})`
  );
  return true;
}

/**
 * Claim accumulated fees from a live CLMM position.
 */
export async function claimPositionFees(positionId: string): Promise<number> {
  console.log(`[Byreal] Claiming live fees for: ${positionId}`);

  const result = byrealCli<{
    success: boolean;
    data: { feesClaimedUSD: number; txSignature: string; status: string };
    error?: { message: string };
  }>(`positions claim --id ${positionId} --confirm`);

  if (!result.success) {
    throw new Error(`[Byreal] Claim failed: ${result.error?.message || JSON.stringify(result)}`);
  }

  const fees = result.data?.feesClaimedUSD || 0;
  console.log(`[Byreal] ✅ Fees claimed: $${fees.toFixed(2)} (tx: ${result.data?.txSignature})`);
  return fees;
}
