import { EvidenceSnapshot } from "./evidence";

export const STRATEGY_ID = "momentum-confirmation-v1";

export interface Assessment {
  bullish: string[];
  bearish: string[];
  conflicts: string[];
  scores: { technical: number | null; momentum: number | null; volume: number | null; sentiment: number | null; safety: number | null; overall: number };
  confidence: number;      // 0..1: share of signal weight that is both present and agreeing
  signal: "LONG" | "NONE";
}

/**
 * Deterministic evidence scoring. Each factor is -1..1, or null when its data is missing.
 * Missing factors lower confidence; they are never filled in. Sentiment (fear & greed) has
 * the smallest weight, so popularity alone can never reach a qualifying score.
 */
const WEIGHTS = { technical: 0.35, momentum: 0.3, volume: 0.2, sentiment: 0.15 };
const clamp = (x: number) => Math.max(-1, Math.min(1, x));

export function assess(s: EvidenceSnapshot): Assessment {
  const o = s.observations;
  const bullish: string[] = [];
  const bearish: string[] = [];
  const conflicts: string[] = [];

  let technical: number | null = null;
  const trend = o.trend?.toLowerCase() ?? null;
  if (trend !== null) {
    const dir = /bull|up/.test(trend) ? 1 : /bear|down/.test(trend) ? -1 : 0;
    const overbought = o.rsi14 !== null && o.rsi14 >= 75;
    technical = overbought && dir > 0 ? 0.2 : dir * 0.8;
    if (dir > 0) bullish.push(`trend ${o.trend}`);
    if (dir < 0) bearish.push(`trend ${o.trend}`);
    if (overbought) bearish.push(`RSI ${o.rsi14} overbought`);
  }

  const momentum = o.momentum30dPct === null ? null : clamp(o.momentum30dPct / 30);
  if (momentum !== null) (momentum >= 0 ? bullish : bearish).push(`30d momentum ${o.momentum30dPct}%`);

  let volume: number | null = null;
  if (o.volume24hUsd !== null && o.liquidityUsd !== null && o.liquidityUsd > 0 && o.change24hPct !== null) {
    const turnover = o.volume24hUsd / o.liquidityUsd;
    volume = clamp(Math.sign(o.change24hPct) * Math.min(turnover, 1));
    (volume >= 0 ? bullish : bearish).push(`24h move ${o.change24hPct}% on ${turnover.toFixed(2)}x turnover`);
  }

  const sentiment = o.fearGreed === null ? null : clamp((o.fearGreed - 50) / 50);
  if (sentiment !== null) (sentiment >= 0 ? bullish : bearish).push(`fear & greed ${o.fearGreed}`);

  const safety = o.safetyScore;
  if (technical !== null && momentum !== null && Math.sign(technical) * Math.sign(momentum) < 0) {
    conflicts.push("trend and 30d momentum disagree");
  }
  if (momentum !== null && o.change24hPct !== null && momentum > 0.2 && o.change24hPct < -3) {
    conflicts.push("24h price falling against 30d momentum");
  }

  let overall = 0;
  let present = 0;
  for (const [k, v] of Object.entries({ technical, momentum, volume, sentiment })) {
    if (v === null) continue;
    overall += v * WEIGHTS[k as keyof typeof WEIGHTS];
    present += WEIGHTS[k as keyof typeof WEIGHTS];
  }
  const confidence = Math.max(0, overall) * present * (conflicts.length ? 0.5 : 1);
  const signal = overall > 0 && technical !== null && technical > 0 && !conflicts.length ? "LONG" : "NONE";

  return {
    bullish, bearish, conflicts,
    scores: { technical, momentum, volume, sentiment, safety, overall: Number(overall.toFixed(4)) },
    confidence: Number(confidence.toFixed(4)),
    signal,
  };
}
