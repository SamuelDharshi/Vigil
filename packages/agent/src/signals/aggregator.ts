import { ethers } from "ethers";
import { v4 as uuidv4 } from "uuid";
import { fetchPythBundle, fetchVaultAllocation } from "./chainlink";
import { fetchNansenBundle } from "./nansen";
import { fetchElfaBundle } from "./elfa";
import { provider, VIGIL_VAULT_ADDRESS } from "../config";
import { SignalBundle, PythBundle, MantleOnChainState } from "../types";

/**
 * VIGIL Signal Aggregator
 * Runs all three signal sources in parallel and assembles the complete SignalBundle.
 * This is the single data ingestion point for every 30-minute decision cycle.
 *
 * Sources (all LIVE — no mocks):
 * 1. Pyth Network  — real-time prices on Mantle Sepolia (contract: 0xA2aa501b...)
 *    NOTE: Chainlink is NOT deployed on Mantle Sepolia — Pyth IS.
 * 2. Nansen        — smart money wallet flows ($50k+ threshold, DoraHacks key)
 * 3. Elfa AI       — social sentiment delta (4h vs 7d baseline, DoraHacks key)
 * 4. Mantle RPC    — live VIGILVault state (allocation, gas, epoch, decisions)
 */

const VAULT_FULL_ABI = [
  "function gasReservoir() view returns (uint256)",
  "function epochAllocationUsed() view returns (uint256)",
  "function epochAllocationRemaining() view returns (uint256)",
  "function totalDecisions() view returns (uint256)",
  "function totalSkipped() view returns (uint256)",
  "function allocation(address token) view returns (uint256)",
];

/**
 * Read the current state of VIGILVault from Mantle Sepolia.
 * Returns a zero state if vault is not deployed — never throws.
 */
async function fetchMantleOnChainState(): Promise<MantleOnChainState> {
  if (!VIGIL_VAULT_ADDRESS) {
    console.warn("[Aggregator] VIGIL_VAULT_ADDRESS not set — deploy contracts first");
    return {
      currentAllocation: {},
      gasReservoir: 0n,
      epochAllocationUsed: 0,
      epochAllocationRemaining: 0,
      totalDecisions: 0,
      totalSkipped: 0,
    };
  }

  try {
    const vault = new ethers.Contract(VIGIL_VAULT_ADDRESS, VAULT_FULL_ABI, provider);

    // Sequential reads to avoid triggering RPC batch rate-limits on public endpoints
    const gasReservoir    = await vault.gasReservoir();
    const epochUsed       = await vault.epochAllocationUsed();
    const epochRemaining  = await vault.epochAllocationRemaining();
    const totalDecisions  = await vault.totalDecisions();
    const totalSkipped    = await vault.totalSkipped();

    const currentAllocation = await fetchVaultAllocation();

    return {
      currentAllocation,
      gasReservoir: gasReservoir as bigint,
      epochAllocationUsed:    Number(epochUsed),
      epochAllocationRemaining: Number(epochRemaining),
      totalDecisions:         Number(totalDecisions),
      totalSkipped:           Number(totalSkipped),
    };
  } catch (err) {
    console.error("[Aggregator] Failed to fetch Mantle vault state:", err);
    return {
      currentAllocation: {},
      gasReservoir: 0n,
      epochAllocationUsed: 0,
      epochAllocationRemaining: 0,
      totalDecisions: 0,
      totalSkipped: 0,
    };
  }
}

const EMPTY_PYTH_BUNDLE: PythBundle = {
  mEthPriceUsd: 0,
  mEthApr: 0,
  usdyYield: 0,
  xstockPrices: { NVDAx: 0, AAPLx: 0, TSLAx: 0 },
  mntPriceUsd: 0,
  updateData: [],
  publishTimes: {},
  fetchedAt: Date.now(),
};

/**
 * Assemble the complete SignalBundle by running all data sources in parallel.
 * Called at the start of every 30-minute decision cycle.
 * Target latency: <3 seconds (all sources fetched in parallel).
 */
export async function aggregateSignals(): Promise<SignalBundle> {
  console.log("\n═══════════════════════════════════════");
  console.log("  VIGIL — Signal Aggregation Starting");
  console.log("═══════════════════════════════════════");
  const start = Date.now();

  const [pythResult, nansenResult, elfaResult, mantleResult] = await Promise.allSettled([
    fetchPythBundle(),             // Pyth Network: real prices on Mantle Sepolia
    fetchNansenBundle(6),          // 6-hour smart money flow window
    fetchElfaBundle(4),            // 4-hour sentiment delta window
    fetchMantleOnChainState(),     // Live VIGILVault state from Mantle RPC
  ]);

  // Extract results — log failures clearly, return empty bundles (no fabricated values)
  const pyth = pythResult.status === "fulfilled"
    ? pythResult.value
    : (() => {
        console.error("[Aggregator] Pyth fetch failed:", (pythResult as PromiseRejectedResult).reason);
        return EMPTY_PYTH_BUNDLE;
      })();

  const nansen = nansenResult.status === "fulfilled"
    ? nansenResult.value
    : { smartMoneyFlows: [], fetchedAt: Date.now() };

  const elfa = elfaResult.status === "fulfilled"
    ? elfaResult.value
    : { sentimentDeltas: {}, rawScores: {}, fetchedAt: Date.now() };

  const mantle = mantleResult.status === "fulfilled"
    ? mantleResult.value
    : {
        currentAllocation: {},
        gasReservoir: 0n,
        epochAllocationUsed: 0,
        epochAllocationRemaining: 0,
        totalDecisions: 0,
        totalSkipped: 0,
      };

  const bundle: SignalBundle = {
    pyth,
    chainlink: pyth,   // backwards-compat alias — decision engine can reference either
    nansen,
    elfa,
    mantle,
    bundleId: uuidv4(),
    timestamp: Date.now(),
  };

  const elapsed = Date.now() - start;
  console.log(`\n  ✅ Signal bundle assembled in ${elapsed}ms`);
  console.log(`  Bundle ID:      ${bundle.bundleId}`);
  console.log(`  Gas reservoir:  ${ethers.formatEther(bundle.mantle.gasReservoir)} MNT`);
  console.log(`  mETH APR:       ${pyth.mEthApr.toFixed(3)}%`);
  console.log(`  ETH/USD (Pyth): $${pyth.mEthPriceUsd.toFixed(2)}`);
  console.log(`  MNT/USD (Pyth): $${pyth.mntPriceUsd.toFixed(4)}`);
  console.log(`  NVDAx (Pyth):   $${pyth.xstockPrices.NVDAx?.toFixed(2) ?? "N/A"}`);
  console.log(`  Smart money flows: ${bundle.nansen.smartMoneyFlows.length}`);
  console.log(`  Sentiment signals >15%: ${
    Object.values(bundle.elfa.sentimentDeltas).filter(d => Math.abs(d) > 0.15).length
  }`);
  console.log("═══════════════════════════════════════\n");

  return bundle;
}
