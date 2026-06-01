import { ethers } from "ethers";
import axios from "axios";
import {
  provider,
  PYTH_CONTRACT_ADDRESS,
  PYTH_HERMES_URL,
  PYTH_PRICE_IDS,
  PYTH_ABI,
  METH_BASELINE_APR,
  USDY_BASELINE_YIELD,
  TOKEN_ADDRESSES,
  VIGIL_VAULT_ADDRESS,
} from "../config";
import { PythBundle } from "../types";

/**
 * VIGIL Signal Layer — Pyth Network Price Oracle (Mantle Sepolia)
 *
 * Chainlink does NOT have price feeds on Mantle Sepolia.
 * Pyth Network IS deployed on Mantle Sepolia at:
 *   0xA2aa501b19aff244D90cc15a4Cf739D2725B5729
 *
 * Pyth uses a "push" model:
 *   1. Off-chain: fetch signed priceUpdate from Hermes API
 *   2. On-chain: call updatePriceFeeds(priceUpdate) to publish latest prices
 *   3. On-chain: call getPrice(feedId) to read the latest price
 *
 * VIGIL fetches prices off-chain via Hermes REST API (cheaper, no gas cost),
 * and on-chain via updatePriceFeeds + getPrice only when executing trades
 * (to guarantee prices are fresh at execution time).
 *
 * mETH APR is calculated from the mETH staking contract's exchange rate, not Pyth.
 *
 * Price Feed IDs: https://pyth.network/developers/price-feed-ids
 * Contract addresses: https://docs.pyth.network/price-feeds/contract-addresses/evm
 */

const VAULT_ABI_MINIMAL = [
  "function gasReservoir() view returns (uint256)",
  "function epochAllocationUsed() view returns (uint256)",
  "function epochAllocationRemaining() view returns (uint256)",
  "function totalDecisions() view returns (uint256)",
  "function totalSkipped() view returns (uint256)",
  "function allocation(address token) view returns (uint256)",
];

interface HermesPriceResponse {
  parsed: Array<{
    id: string;
    price: {
      price: string;
      conf: string;
      expo: number;
      publish_time: number;
    };
    ema_price: {
      price: string;
      conf: string;
      expo: number;
    };
  }>;
  binary: {
    encoding: string;
    data: string[];
  };
}

/**
 * Fetch the latest prices from Pyth Hermes REST API.
 * Returns signed price update data + parsed prices.
 * Much cheaper than on-chain calls for signal ingestion.
 */
async function fetchHermesPrices(priceIds: string[]): Promise<HermesPriceResponse> {
  const cleanIds = priceIds.map(id => id.startsWith("0x") ? id.slice(2) : id);
  const ids = cleanIds.join("&ids[]=");
  const url = `${PYTH_HERMES_URL}/v2/updates/price/latest?ids[]=${ids}&encoding=hex&parsed=true`;

  const response = await axios.get<HermesPriceResponse>(url, {
    timeout: 15_000,
    headers: { Accept: "application/json" },
  });

  return response.data;
}

/**
 * Convert a Pyth raw price to a human-readable USD value.
 * Pyth uses: price × 10^expo
 * e.g., price=500000000, expo=-5 → $5000.00000
 */
function pythPriceToUsd(priceStr: string, expo: number): number {
  const rawPrice = parseFloat(priceStr);
  return rawPrice * Math.pow(10, expo);
}


/**
 * Fetch all live price data from Pyth Hermes in a single batched call.
 * This is the primary signal source for VIGIL's decision engine.
 */
export async function fetchPythBundle(): Promise<PythBundle> {
  console.log("[Pyth] Fetching live price feeds from Hermes...");
  const start = Date.now();

  const priceIds = Object.values(PYTH_PRICE_IDS);
  const symbols  = Object.keys(PYTH_PRICE_IDS);

  let prices: Record<string, number> = {};
  let updateData: string[] = [];
  let publishTimes: Record<string, number> = {};

  try {
    const hermes = await fetchHermesPrices(priceIds);

    // Map parsed prices back to symbols
    for (const parsed of hermes.parsed) {
      const feedId = "0x" + parsed.id;
      const symbol = symbols.find(s => PYTH_PRICE_IDS[s].toLowerCase() === feedId.toLowerCase());
      if (!symbol) continue;

      const usdPrice = pythPriceToUsd(parsed.price.price, parsed.price.expo);
      prices[symbol] = usdPrice;
      publishTimes[symbol] = parsed.price.publish_time;

      // Staleness check: Pyth prices should be < 5 minutes old
      const ageSeconds = Math.floor(Date.now() / 1000) - parsed.price.publish_time;
      if (ageSeconds > 300) {
        console.warn(`[Pyth] ⚠ ${symbol} price is ${ageSeconds}s stale — confidence reduced`);
      }
    }

    // Store update data for on-chain use at execution time
    updateData = hermes.binary.data;

    console.log(`[Pyth] Live prices fetched in ${Date.now() - start}ms:`);
    for (const [symbol, price] of Object.entries(prices)) {
      if (price > 0) console.log(`[Pyth]   ${symbol}: $${price.toFixed(2)}`);
    }
  } catch (err: any) {
    console.error(`[Pyth] Hermes fetch failed: ${err.message}`);
    console.error("[Pyth] Verify PYTH_HERMES_URL is reachable and price IDs are correct");
    // Return empty bundle — engine will reduce confidence on missing prices
  }

  // Fetch mETH APR: use real mETH protocol mainnet APR as the baseline signal.
  // The mETH staking contract on Mantle Sepolia does not expose stakingRate().
  // METH_BASELINE_APR is set in .env (default 3.8% — real Mantle mETH protocol rate).
  const mEthApr = METH_BASELINE_APR;
  // USDY yield: use Ondo's real published yield as the signal baseline.
  // USDY_BASELINE_YIELD is set in .env (default 4.09% annualized).
  const usdyYield = USDY_BASELINE_YIELD;
  console.log(`[Oracle] mETH APR baseline: ${mEthApr.toFixed(2)}% | USDY yield baseline: ${usdyYield.toFixed(2)}%`);

  return {
    // mETH price in USD (from Pyth ETH/USD feed — mETH tracks ETH closely)
    mEthPriceUsd: prices["ETH/USD"] || 0,
    // mETH APR from real protocol baseline
    mEthApr,
    // USDY yield from Ondo real yield baseline
    usdyYield,
    // xStocks equity prices
    xstockPrices: {
      NVDAx: prices["NVDA/USD"] || 0,
      AAPLx: prices["AAPL/USD"] || 0,
      TSLAx: prices["TSLA/USD"] || 0,
    },
    mntPriceUsd: prices["MNT/USD"] || 0,
    // Raw Hermes update bytes for on-chain usage at execution time
    updateData,
    publishTimes,
    fetchedAt: Date.now(),
  };
}

/**
 * Push Pyth price updates on-chain before executing a trade.
 * This guarantees prices are fresh at execution time (not stale cache).
 * Called by the executor immediately before submitting a swap.
 *
 * @param updateData The binary price update from Hermes (stored in PythBundle)
 */
export async function pushPythPricesOnChain(updateData: string[]): Promise<void> {
  if (!updateData.length) {
    console.warn("[Pyth] No update data to push on-chain");
    return;
  }

  try {
    const { agentWallet } = await import("../config");
    const pyth = new ethers.Contract(PYTH_CONTRACT_ADDRESS, PYTH_ABI, agentWallet);

    // Convert hex strings to bytes arrays
    const encodedUpdateData = updateData.map(d => "0x" + d);

    // Calculate fee
    const fee = await pyth.getUpdateFee(encodedUpdateData);
    console.log(`[Pyth] Pushing price updates on-chain (fee: ${ethers.formatEther(fee)} MNT)...`);

    const tx = await pyth.updatePriceFeeds(encodedUpdateData, {
      value: fee,
      gasLimit: 500_000,
    });
    await tx.wait();

    console.log(`[Pyth] ✅ Prices updated on-chain: ${tx.hash}`);
  } catch (err: any) {
    console.error(`[Pyth] On-chain price push failed: ${err.message}`);
    throw err;
  }
}

/**
 * Read the current on-chain allocation from VIGILVault.
 */
export async function fetchVaultAllocation(): Promise<Record<string, number>> {
  if (!VIGIL_VAULT_ADDRESS) return {};

  try {
    const vault = new ethers.Contract(VIGIL_VAULT_ADDRESS, VAULT_ABI_MINIMAL, provider);
    const allocation: Record<string, number> = {};

    // Sequential reads to avoid batch rate-limits on public endpoints
    for (const [symbol, address] of Object.entries(TOKEN_ADDRESSES)) {
      if (!address) continue;
      try {
        const bps: bigint = await vault.allocation(address);
        allocation[symbol] = Number(bps);
      } catch {
        allocation[symbol] = 0;
      }
    }

    return allocation;
  } catch (err) {
    console.error("[Vault] Failed to read allocation:", err);
    return {};
  }
}
