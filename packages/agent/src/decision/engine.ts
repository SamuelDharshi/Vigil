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
 * Character:
 * - Conservative on xStocks: requires 65% confidence (vs 55% for yield assets)
 * - Yield-first: prefers higher-yielding stable as default hold
 * - Cross-chain assertive: routes to Byreal when APR differential > 0.8%
 *
 * This character emerges from the weights — not from explicit rules.
 */

/**
 * Score a single asset using the three-factor weighted model.
 * Returns a score from 0 to 100 (50 = neutral baseline).
 */
export function scoreAsset(asset: string, bundle: SignalBundle): number {
  let score = 50; // neutral baseline

  // ─── Factor 1: Yield Differential (weight: 0.35) ─────────────────────────
  // Only relevant for yield-bearing stable assets
  if (asset === "USDY" || asset === "mETH") {
    const yieldSpread = bundle.chainlink.usdyYield - bundle.chainlink.mEthApr;
    if (asset === "USDY") {
      // USDY benefits from higher yield spread
      score += yieldSpread * SIGNAL_WEIGHTS.YIELD_DIFFERENTIAL * 10;
    } else {
      // mETH benefits from lower spread (i.e., mETH yield relatively better)
      score -= yieldSpread * SIGNAL_WEIGHTS.YIELD_DIFFERENTIAL * 10;
    }
  }

  // ─── Factor 2: Smart Money Flows (weight: 0.40) ───────────────────────────
  const smFlows = bundle.nansen.smartMoneyFlows.filter(
    f => f.token === asset || f.token.toLowerCase().startsWith(asset.toLowerCase())
  );

  const netSmFlowUSD = smFlows.reduce((acc, f) => {
    return acc + (f.direction === "IN" ? f.usdValue : -f.usdValue);
  }, 0);

  // Normalize: $1M net flow = full weight, $100k = 10% weight
  const smNormalized = Math.sign(netSmFlowUSD) * Math.min(Math.abs(netSmFlowUSD) / 1_000_000, 1);
  score += smNormalized * SIGNAL_WEIGHTS.SMART_MONEY * 20;

  // ─── Factor 3: Social Sentiment Delta (weight: 0.25) ─────────────────────
  const sentDelta = bundle.elfa.sentimentDeltas[asset] ?? 0;
  score += sentDelta * SIGNAL_WEIGHTS.SOCIAL_SENTIMENT * 15;

  return Math.max(0, Math.min(100, score));
}

/**
 * Generate human-readable reasoning text for a decision.
 * This text appears in the War Room UI in Instrument Serif font.
 */
export function generateReasoning(
  fromAsset: string,
  toAsset: string,
  scores: AssetScores,
  bundle: SignalBundle
): string {
  const parts: string[] = [];

  // Yield context
  const yieldDiff = (bundle.chainlink.usdyYield - bundle.chainlink.mEthApr).toFixed(2);
  if (Math.abs(parseFloat(yieldDiff)) > 0.2) {
    const higher = parseFloat(yieldDiff) > 0 ? "USDY" : "mETH";
    parts.push(`${higher} yield leads by ${Math.abs(parseFloat(yieldDiff)).toFixed(2)}%`);
  }

  // Smart money context for the source asset
  const smFlows = bundle.nansen.smartMoneyFlows.filter(f => f.token === fromAsset);
  if (smFlows.length > 0) {
    const totalOut = smFlows.filter(f => f.direction === "OUT").reduce((a, f) => a + f.usdValue, 0);
    if (totalOut > 50_000) {
      parts.push(`${smFlows.filter(f => f.direction === "OUT").length} smart wallet(s) exited $${(totalOut / 1000).toFixed(0)}k ${fromAsset}`);
    }
  }

  // Sentiment context
  const fromSentiment = bundle.elfa.sentimentDeltas[fromAsset];
  if (fromSentiment !== undefined && Math.abs(fromSentiment) > 0.1) {
    const direction = fromSentiment < 0 ? "dropped" : "rose";
    parts.push(`${fromAsset} sentiment ${direction} ${Math.abs(fromSentiment * 100).toFixed(0)}% vs 7d baseline`);
  }

  // Asset score context
  parts.push(
    `Signal model: ${fromAsset} scored ${scores[fromAsset as keyof AssetScores]?.toFixed(0) ?? "–"}/100, ${toAsset} scored ${scores[toAsset as keyof AssetScores]?.toFixed(0) ?? "–"}/100`
  );

  return parts.join(". ") + ".";
}

/**
 * Core decision engine: transforms SignalBundle into a Decision or null (skip).
 * This is the cognitive heart of VIGIL.
 */
export function generateDecision(bundle: SignalBundle): Decision | { action: "SKIP"; skipReason: SkipReason; reasoning: string } {
  // ─── Score all tracked assets ──────────────────────────────────────────────
  const scores: AssetScores = {
    mETH: scoreAsset("mETH", bundle),
    USDY: scoreAsset("USDY", bundle),
    NVDAx: scoreAsset("NVDAx", bundle),
    AAPLx: scoreAsset("AAPLx", bundle),
    TSLAx: scoreAsset("TSLAx", bundle),
  };

  console.log("[Engine] Asset scores:", scores);

  // ─── Find best and worst scoring assets ───────────────────────────────────
  const sorted = Object.entries(scores).sort(([, a], [, b]) => b - a);
  const [bestAsset, bestScore] = sorted[0];
  const [worstAsset, worstScore] = sorted[sorted.length - 1];

  // ─── Compute confidence ───────────────────────────────────────────────────
  // Confidence = normalized score gap between best and worst
  const confidence = (bestScore - worstScore) / 100;

  console.log(`[Engine] Best: ${bestAsset} (${bestScore.toFixed(1)}), Worst: ${worstAsset} (${worstScore.toFixed(1)}), Confidence: ${(confidence * 100).toFixed(1)}%`);

  // ─── Check gas reservoir ──────────────────────────────────────────────────
  const gasReservoirMNT = Number(bundle.mantle.gasReservoir) / 1e18;
  if (gasReservoirMNT < GUARDRAILS.GAS_RESERVOIR_MIN_MNT) {
    console.log(`[Engine] SKIP: Gas reservoir low (${gasReservoirMNT.toFixed(3)} MNT)`);
    return {
      action: "SKIP",
      skipReason: "GAS_LOW",
      reasoning: `Gas reservoir at ${gasReservoirMNT.toFixed(3)} MNT — below 0.5 MNT minimum. Waiting for yield claim to refill.`,
    };
  }

  // ─── Determine confidence threshold based on asset types ─────────────────
  const isXStockTrade = ["NVDAx", "AAPLx", "TSLAx"].includes(bestAsset) ||
                        ["NVDAx", "AAPLx", "TSLAx"].includes(worstAsset);
  const threshold = isXStockTrade
    ? DECISION_THRESHOLDS.XSTOCK_MIN_CONFIDENCE
    : DECISION_THRESHOLDS.YIELD_MIN_CONFIDENCE;

  if (confidence < threshold) {
    const pct = (confidence * 100).toFixed(1);
    const req = (threshold * 100).toFixed(0);
    console.log(`[Engine] SKIP: Confidence too low (${pct}% < ${req}% required)`);
    return {
      action: "SKIP",
      skipReason: "CONFIDENCE_TOO_LOW",
      reasoning: `Combined signal confidence ${pct}% below ${req}% threshold for ${isXStockTrade ? "xStocks" : "yield"} trade. Watching for stronger signal.`,
    };
  }

  // ─── If best === worst we have no trade ───────────────────────────────────
  if (bestAsset === worstAsset) {
    return {
      action: "SKIP",
      skipReason: "NO_OPPORTUNITY",
      reasoning: "No clear directional opportunity in current signal set.",
    };
  }

  // ─── Calculate trade size ─────────────────────────────────────────────────
  // Proportional to confidence, capped at epoch remaining and $10k single-tx limit
  const epochRemaining = bundle.mantle.epochAllocationRemaining;
  const confidenceSizedAmount = epochRemaining > 0
    ? epochRemaining * confidence * 0.5 // Use up to 50% of epoch remaining per decision
    : 5_000 * 1e6; // $5,000 default if vault is fresh

  const amount = Math.min(confidenceSizedAmount, GUARDRAILS.MAX_SINGLE_TX_USD * 1e6);
  const amountUSD = amount / 1e6;

  const reasoning = generateReasoning(worstAsset, bestAsset, scores, bundle);

  console.log(`[Engine] EXECUTE: ${worstAsset} → ${bestAsset}, $${amountUSD.toFixed(0)}, confidence ${(confidence * 100).toFixed(1)}%`);
  console.log(`[Engine] Reasoning: ${reasoning}`);

  return {
    id: uuidv4(),
    timestamp: Date.now(),
    action: "ROTATE" as DecisionAction,
    fromAsset: worstAsset,
    fromToken: TOKEN_ADDRESSES[worstAsset as keyof typeof TOKEN_ADDRESSES] || "",
    toAsset: bestAsset,
    toToken: TOKEN_ADDRESSES[bestAsset as keyof typeof TOKEN_ADDRESSES] || "",
    amount,
    confidence,
    reasoning,
    signalBundleId: bundle.bundleId,
    assetScores: scores,
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
    console.log(
      `[Engine] 🌉 Byreal opportunity: ${byrealApr.toFixed(2)}% APR > ${threshold.toFixed(2)}% threshold`
    );
  }

  return isOpportunity;
}
