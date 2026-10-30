import { RiskPolicy } from "./risk";

/** Practice positions only. Nothing in this module can reach a wallet or an exchange. */
export interface PaperPosition {
  tradeId: string;
  status: "OPEN" | "CLOSED";
  token: string;
  contract: string | null;
  chain: string | null;
  direction: "LONG";
  entryPrice: number;      // observed price, adjusted by estimated slippage in the fill model
  exitPrice?: number;
  sizeUsd: number;
  entryTime: number;
  exitTime?: number;
  stopLoss: number;
  takeProfit: number;
  feesUsd: number;
  slippageBps: number;
  netPnlUsd?: number;
  strategyId: string;
  decisionId: string;
  snapshotId: string;
  exitReason?: "STOP_LOSS" | "TAKE_PROFIT" | "AGENT_EXIT";
}

export interface PortfolioState {
  positions: PaperPosition[];
  realizedPnlUsd: number;
  peakEquityUsd: number;
}

export function openPosition(
  p: RiskPolicy, base: Pick<PaperPosition, "tradeId" | "token" | "contract" | "chain" | "strategyId" | "decisionId" | "snapshotId">,
  price: number, sizeUsd: number, slippageBps: number, now: number
): PaperPosition {
  const entryPrice = price * (1 + slippageBps / 10_000);
  return {
    ...base, status: "OPEN", direction: "LONG", entryPrice, sizeUsd, entryTime: now, slippageBps,
    stopLoss: entryPrice * (1 - p.stopLossPct / 100),
    takeProfit: entryPrice * (1 + p.takeProfitPct / 100),
    feesUsd: sizeUsd * p.feeBps / 10_000,
  };
}

export function exitReasonFor(pos: PaperPosition, price: number): PaperPosition["exitReason"] | null {
  if (price <= pos.stopLoss) return "STOP_LOSS";
  if (price >= pos.takeProfit) return "TAKE_PROFIT";
  return null;
}

/** Closes at the price actually observed. A gap through the stop is recorded at the gapped price. */
export function closePosition(
  p: RiskPolicy, pos: PaperPosition, price: number, reason: NonNullable<PaperPosition["exitReason"]>, now: number
): PaperPosition {
  const exitPrice = price * (1 - pos.slippageBps / 10_000);
  const gross = pos.sizeUsd * (exitPrice - pos.entryPrice) / pos.entryPrice;
  const exitFee = pos.sizeUsd * p.feeBps / 10_000;
  const feesUsd = pos.feesUsd + exitFee;
  return { ...pos, status: "CLOSED", exitPrice, exitTime: now, exitReason: reason, feesUsd, netPnlUsd: gross - feesUsd };
}
