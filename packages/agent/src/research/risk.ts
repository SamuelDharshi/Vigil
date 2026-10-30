import { EvidenceSnapshot } from "./evidence";
import { Assessment } from "./strategy";
import { PaperPosition, PortfolioState } from "./paper";

/** Enforced in code. No LLM output is read anywhere in this file. */
export interface RiskPolicy {
  killSwitch: boolean;
  startingEquityUsd: number;
  maxPositionUsd: number;
  maxPortfolioExposurePct: number;
  maxTokenExposurePct: number;
  maxOpenPositions: number;
  maxDailyLossPct: number;
  maxDrawdownPct: number;
  minLiquidityUsd: number;
  maxSlippageBps: number;
  minConfidence: number;
  minSafetyScore: number;
  stopLossPct: number;
  takeProfitPct: number;
  cooldownSeconds: number;
  maxDataAgeSeconds: number;
  feeBps: number;
}

export const DEFAULT_POLICY: RiskPolicy = {
  killSwitch: false,
  startingEquityUsd: 100_000,
  maxPositionUsd: 5_000,
  maxPortfolioExposurePct: 30,
  maxTokenExposurePct: 10,
  maxOpenPositions: 5,
  maxDailyLossPct: 3,
  maxDrawdownPct: 10,
  minLiquidityUsd: 1_000_000,
  maxSlippageBps: 50,
  minConfidence: 0.2,
  minSafetyScore: 70,
  stopLossPct: 5,
  takeProfitPct: 10,
  cooldownSeconds: 3_600,
  maxDataAgeSeconds: 900,
  feeBps: 30,
};

export const loadPolicy = (env = process.env): RiskPolicy => ({
  ...DEFAULT_POLICY,
  killSwitch: env.VIGIL_KILL_SWITCH === "true",
  ...(env.VIGIL_RISK_POLICY ? JSON.parse(env.VIGIL_RISK_POLICY) : {}),
});

/** Slippage estimate: half the order's share of pool liquidity, in bps. A model, not a fill. */
export const estimateSlippageBps = (sizeUsd: number, liquidityUsd: number) => (sizeUsd / liquidityUsd) * 5_000;

export interface RiskResult {
  allowed: boolean;
  violations: string[];
  sizeUsd: number;
  slippageBps: number | null;
}

export function checkEntry(
  p: RiskPolicy, s: EvidenceSnapshot, a: Assessment, pf: PortfolioState, now: number
): RiskResult {
  const v: string[] = [];
  const o = s.observations;
  const open = pf.positions.filter(x => x.status === "OPEN");
  const exposure = (list: PaperPosition[]) => list.reduce((t, x) => t + x.sizeUsd, 0);

  if (p.killSwitch) v.push("KILL_SWITCH active");
  v.push(...s.rejected.map(r => `EVIDENCE: ${r}`));
  if (o.honeypot === true) v.push("SAFETY: honeypot flagged");
  if (o.safe === false) v.push("SAFETY: provider marked token unsafe");
  if (o.safetyScore === null) v.push("SAFETY: score unavailable");
  else if (o.safetyScore < p.minSafetyScore) v.push(`SAFETY: score ${o.safetyScore} < ${p.minSafetyScore}`);
  if (a.confidence < p.minConfidence) v.push(`CONFIDENCE: ${a.confidence} < ${p.minConfidence}`);
  if (o.liquidityUsd === null) v.push("LIQUIDITY: unavailable");
  else if (o.liquidityUsd < p.minLiquidityUsd) v.push(`LIQUIDITY: ${o.liquidityUsd} < ${p.minLiquidityUsd}`);
  if (open.length >= p.maxOpenPositions) v.push("LIMIT: max open positions");

  const equity = p.startingEquityUsd + pf.realizedPnlUsd;
  const drawdownPct = (pf.peakEquityUsd - equity) / pf.peakEquityUsd * 100;
  if (drawdownPct >= p.maxDrawdownPct) v.push(`LIMIT: drawdown ${drawdownPct.toFixed(2)}%`);
  const dayStart = now - 86_400_000;
  const dayPnl = pf.positions.reduce((t, x) => t + (x.exitTime && x.exitTime >= dayStart ? x.netPnlUsd ?? 0 : 0), 0);
  if (-dayPnl / p.startingEquityUsd * 100 >= p.maxDailyLossPct) v.push("LIMIT: daily simulated loss");

  const last = pf.positions.filter(x => x.token === s.token).reduce((t, x) => Math.max(t, x.exitTime ?? x.entryTime), 0);
  if (last && now - last < p.cooldownSeconds * 1000) v.push("COOLDOWN: token traded recently");

  const size = Math.min(p.maxPositionUsd, equity * a.confidence * 0.1);
  if (exposure(open) + size > equity * p.maxPortfolioExposurePct / 100) v.push("LIMIT: portfolio exposure");
  if (exposure(open.filter(x => x.token === s.token)) + size > equity * p.maxTokenExposurePct / 100) v.push("LIMIT: token exposure");

  const slippageBps = o.liquidityUsd ? estimateSlippageBps(size, o.liquidityUsd) : null;
  if (slippageBps !== null && slippageBps > p.maxSlippageBps) v.push(`SLIPPAGE: ${slippageBps.toFixed(1)}bps`);

  return { allowed: v.length === 0, violations: v, sizeUsd: Number(size.toFixed(2)), slippageBps };
}
