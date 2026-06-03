import { v4 as uuidv4 } from "uuid";
import { SignalBundle, Decision, AssetScores, DecisionAction, SkipReason } from "../types";
import {
  SIGNAL_WEIGHTS,
  DECISION_THRESHOLDS,
  GUARDRAILS,
  TOKEN_ADDRESSES,
} from "../config";

/**
 * VIGIL Decision Engine
 * Transforms a SignalBundle into a typed Decision using a weighted scoring model.
 *
 * Scoring model:
 * - Yield differential signal (weight: 0.35) — mETH APR vs USDY yield
 * - Smart money flows (weight: 0.40) — Nansen flagged wallet movements
 * - Social sentiment delta (weight: 0.25) — Elfa AI 4h vs 7d baseline
 *
 * When xStock prices are stale (market closed), automatically falls back to
 * yield-only mode: only mETH vs USDY, using the lower 30% yield threshold.
 * This means the agent always finds a valid trade from yield spread.
 */

const XSTOCK_SYMBOLS = ["NVDAx", "AAPLx", "TSLAx"];
const STALE_THRESHOLD_SECONDS = 600; // 10 min — stocks update every minute when open

/**
 * Score a single asset using the three-factor weighted model.
 * Returns a score from 0 to 100 (50 = neutral baseline).
 *
 * Yield multiplier is calibrated so that:
 *   0.29% spread (USDY 4.09% vs mETH 3.80%) → ~10 point gap → 10% confidence
 *   0.50% spread → ~18 point gap → 18% confidence
 *   1.00% spread → ~35 point gap → 35% confidence → triggers EXECUTE
 */
export function scoreAsset(asset: string, bundle: SignalBundle): number {
  let score = 50; // neutral baseline

  // ─── Factor 1: Yield Differential (weight: 0.35, ×100 amplifier) ─────────
  // Real APR differences are small percentages (e.g. 0.29%).
  // We amplify them so a meaningful spread produces a tradeable signal gap.
  if (asset === "USDY" || asset === "mETH") {
    const yieldSpread = bundle.chainlink.usdyYield - bundle.chainlink.mEthApr;
    // ×100 amplifier: 0.29% spread → 0.29 × 0.35 × 100 = 10.15 points per side
    const yieldScore = yieldSpread * SIGNAL_WEIGHTS.YIELD_DIFFERENTIAL * 100;
    if (asset === "USDY") {
      score += yieldScore;
    } else {
      score -= yieldScore;
    }
  }

  // ─── Factor 2: Smart Money Flows (weight: 0.40) ───────────────────────────
  const smFlows = bundle.nansen.smartMoneyFlows.filter(
    f => f.token === asset || f.token.toLowerCase().startsWith(asset.toLowerCase())
  );
  const netSmFlowUSD = smFlows.reduce((acc, f) => {
    return acc + (f.direction === "IN" ? f.usdValue : -f.usdValue);
  }, 0);
  const smNormalized = Math.sign(netSmFlowUSD) * Math.min(Math.abs(netSmFlowUSD) / 1_000_000, 1);
  score += smNormalized * SIGNAL_WEIGHTS.SMART_MONEY * 20;

  // ─── Factor 3: Social Sentiment Delta (weight: 0.25) ─────────────────────
  const sentDelta = bundle.elfa.sentimentDeltas[asset] ?? 0;
  score += sentDelta * SIGNAL_WEIGHTS.SOCIAL_SENTIMENT * 15;

  return Math.max(0, Math.min(100, score));
}

/**
 * Generate human-readable reasoning text for a decision.
 */
export function generateReasoning(
  fromAsset: string,
  toAsset: string,
  scores: AssetScores,
  bundle: SignalBundle
): string {
  const parts: string[] = [];

  const yieldDiff = (bundle.chainlink.usdyYield - bundle.chainlink.mEthApr).toFixed(2);
  if (Math.abs(parseFloat(yieldDiff)) > 0.2) {
    const higher = parseFloat(yieldDiff) > 0 ? "USDY" : "mETH";
    parts.push(`${higher} yield leads by ${Math.abs(parseFloat(yieldDiff)).toFixed(2)}%`);
  }

  const smFlows = bundle.nansen.smartMoneyFlows.filter(f => f.token === fromAsset);
  if (smFlows.length > 0) {
    const totalOut = smFlows.filter(f => f.direction === "OUT").reduce((a, f) => a + f.usdValue, 0);
    if (totalOut > 50_000) {
      parts.push(`${smFlows.filter(f => f.direction === "OUT").length} smart wallet(s) exited $${(totalOut / 1000).toFixed(0)}k ${fromAsset}`);
    }
  }

  const fromSentiment = bundle.elfa.sentimentDeltas[fromAsset];
  if (fromSentiment !== undefined && Math.abs(fromSentiment) > 0.1) {
    const direction = fromSentiment < 0 ? "dropped" : "rose";
    parts.push(`${fromAsset} sentiment ${direction} ${Math.abs(fromSentiment * 100).toFixed(0)}% vs 7d baseline`);
  }

  parts.push(
    `Signal model: ${fromAsset} scored ${scores[fromAsset as keyof AssetScores]?.toFixed(0) ?? "–"}/100, ${toAsset} scored ${scores[toAsset as keyof AssetScores]?.toFixed(0) ?? "–"}/100`
  );

  return parts.join(". ") + ".";
}

/**
 * Detect whether xStock Pyth prices are stale (stock market closed).
 */
function areXStocksStale(bundle: SignalBundle): boolean {
  const now = Math.floor(Date.now() / 1000);
  const staleCount = XSTOCK_SYMBOLS.filter(sym => {
    const key = sym === "NVDAx" ? "NVDA/USD" : sym === "AAPLx" ? "AAPL/USD" : "TSLA/USD";
    const publishTime = bundle.pyth.publishTimes?.[key] || 0;
    return (now - publishTime) > STALE_THRESHOLD_SECONDS;
  }).length;
  return staleCount === XSTOCK_SYMBOLS.length;
}

/**
 * Core decision engine: transforms SignalBundle into a Decision or skip.
 *
 * When xStock prices are stale (market closed), automatically switches to
 * yield-only mode (mETH vs USDY) with the lower 30% confidence threshold.
 * This ensures the agent always acts on yield spread even when equities are closed.
 */
export function generateDecision(
  bundle: SignalBundle
): Decision | { action: "SKIP"; skipReason: SkipReason; reasoning: string } {

  // ─── Detect market closure via Pyth staleness ─────────────────────────────
  const xStocksStale = areXStocksStale(bundle);
  if (xStocksStale) {
    console.log("[Engine] xStock prices stale — switching to YIELD-ONLY mode (mETH vs USDY)");
  }

  // ─── Score assets ─────────────────────────────────────────────────────────
  const scores: AssetScores = {
    mETH:  scoreAsset("mETH",  bundle),
    USDY:  scoreAsset("USDY",  bundle),
    NVDAx: xStocksStale ? 50 : scoreAsset("NVDAx", bundle),
    AAPLx: xStocksStale ? 50 : scoreAsset("AAPLx", bundle),
    TSLAx: xStocksStale ? 50 : scoreAsset("TSLAx", bundle),
  };

  console.log("[Engine] Asset scores:", scores);

  // ─── Active assets (exclude stale xStocks from decision) ─────────────────
  const activeAssets = xStocksStale
    ? ["mETH", "USDY"]
    : ["mETH", "USDY", "NVDAx", "AAPLx", "TSLAx"];

  const sorted = activeAssets
    .map(a => [a, scores[a as keyof AssetScores]] as [string, number])
    .sort(([, a], [, b]) => b - a);

  const [bestAsset,  bestScore]  = sorted[0];
  const [worstAsset, worstScore] = sorted[sorted.length - 1];

  // ─── Confidence ───────────────────────────────────────────────────────────
  // ─── Confidence threshold ─────────────────────────────────────────────────
  const isXStockTrade = !xStocksStale && (
    XSTOCK_SYMBOLS.includes(bestAsset) || XSTOCK_SYMBOLS.includes(worstAsset)
  );
  // Yield-only mode uses lower threshold — USDY vs mETH is safe yield rotation
  const threshold = isXStockTrade
    ? DECISION_THRESHOLDS.XSTOCK_MIN_CONFIDENCE  // 45% — equity risk
    : xStocksStale
      ? 0.15                                       // 15% — safe yield rotation when market closed
      : DECISION_THRESHOLDS.YIELD_MIN_CONFIDENCE;  // 30% — normal yield mode

  const confidence = (bestScore - worstScore) / 100;

  console.log(
    `[Engine] Best: ${bestAsset} (${bestScore.toFixed(1)}), Worst: ${worstAsset} (${worstScore.toFixed(1)}), ` +
    `Confidence: ${(confidence * 100).toFixed(1)}%, Threshold: ${(threshold * 100).toFixed(0)}%` +
    (xStocksStale ? " [YIELD-ONLY MODE]" : "")
  );

  // ─── Gas check ────────────────────────────────────────────────────────────
  const gasReservoirMNT = Number(bundle.mantle.gasReservoir) / 1e18;
  if (gasReservoirMNT < GUARDRAILS.GAS_RESERVOIR_MIN_MNT) {
    return {
      action: "SKIP",
      skipReason: "GAS_LOW",
      reasoning: `Gas reservoir at ${gasReservoirMNT.toFixed(3)} MNT — below 0.5 MNT minimum.`,
    };
  }

  // ─── Confidence gate ──────────────────────────────────────────────────────
  if (confidence < threshold) {
    const pct = (confidence * 100).toFixed(1);
    const req = (threshold * 100).toFixed(0);
    return {
      action: "SKIP",
      skipReason: "CONFIDENCE_TOO_LOW",
      reasoning: `Signal confidence ${pct}% below ${req}% threshold for ${
        isXStockTrade ? "xStocks" : "yield"
      } trade. ${xStocksStale ? "Market closed — monitoring yield spread." : "Watching for stronger signal."}`,
    };
  }

  if (bestAsset === worstAsset) {
    return {
      action: "SKIP",
      skipReason: "NO_OPPORTUNITY",
      reasoning: "No clear directional opportunity in current signal set.",
    };
  }

  // ─── Trade size ───────────────────────────────────────────────────────────
  const epochRemaining = bundle.mantle.epochAllocationRemaining;
  const raw = epochRemaining > 0
    ? epochRemaining * confidence * 0.5
    : 5_000 * 1e6;
  const amount    = Math.min(raw, GUARDRAILS.MAX_SINGLE_TX_USD * 1e6);
  const amountUSD = amount / 1e6;
  const reasoning = generateReasoning(worstAsset, bestAsset, scores, bundle);

  console.log(`[Engine] EXECUTE: ${worstAsset} → ${bestAsset}, $${amountUSD.toFixed(0)}, confidence ${(confidence * 100).toFixed(1)}%`);

  return {
    id:             uuidv4(),
    timestamp:      Date.now(),
    action:         "ROTATE" as DecisionAction,
    fromAsset:      worstAsset,
    fromToken:      TOKEN_ADDRESSES[worstAsset as keyof typeof TOKEN_ADDRESSES] || "",
    toAsset:        bestAsset,
    toToken:        TOKEN_ADDRESSES[bestAsset  as keyof typeof TOKEN_ADDRESSES] || "",
    amount,
    confidence,
    reasoning,
    signalBundleId: bundle.bundleId,
    assetScores:    scores,
  };
}

/**
 * Check whether to open a Byreal CLMM position.
 * Returns true if Byreal APR > mETH APR + 0.8% premium.
 */
export async function checkByRealOpportunity(
  bundle: SignalBundle,
  byrealApr: number
): Promise<boolean> {
  const threshold = bundle.chainlink.mEthApr + DECISION_THRESHOLDS.BYREAL_APR_PREMIUM;
  const isOpportunity = byrealApr > threshold;
  if (isOpportunity) {
    console.log(`[Engine] 🌉 Byreal opportunity: ${byrealApr.toFixed(2)}% APR > ${threshold.toFixed(2)}% threshold`);
  }
  return isOpportunity;
}
