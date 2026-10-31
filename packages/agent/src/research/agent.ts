import * as fs from "fs";
import * as path from "path";
import { v4 as uuidv4 } from "uuid";
import { Caller, callTool, MarketOverview, TokenAnalysis } from "./ryochan";
import { buildSnapshot, canonical, EvidenceSnapshot, sha256 } from "./evidence";
import { publicCall, PUBLIC_TOKENS } from "./public";
import { assess, Assessment, STRATEGY_ID } from "./strategy";
import { checkEntry, DEFAULT_POLICY, loadPolicy, RiskPolicy, RiskResult } from "./risk";
import { closePosition, exitReasonFor, openPosition, PaperPosition, PortfolioState } from "./paper";

export type Action = "BUY" | "EXIT" | "HOLD" | "NO_TRADE";

export interface DecisionRecord {
  decisionId: string;
  timestamp: number;
  token: string;
  action: Action;
  reason: string;
  strategyId: string;
  snapshot: EvidenceSnapshot;
  assessment: Assessment;
  risk: RiskResult | null;
  tradeId: string | null;
  trade: PaperPosition | null;
  prevHash: string;
  hash: string;            // sha256 of this record plus prevHash; anchor this value on-chain
}

/** Append-only JSONL log. Each record commits to the previous one, so edits break the chain. */
export class DecisionLog {
  constructor(readonly file: string) {}

  read(): DecisionRecord[] {
    if (!fs.existsSync(this.file)) return [];
    return fs.readFileSync(this.file, "utf8").split("\n").filter(Boolean).map(l => JSON.parse(l));
  }

  append(rec: Omit<DecisionRecord, "prevHash" | "hash">): DecisionRecord {
    const all = this.read();
    if (all.some(r => r.decisionId === rec.decisionId)) throw new Error(`duplicate decision ${rec.decisionId}`);
    const prevHash = all.at(-1)?.hash ?? "genesis";
    const out = { ...rec, prevHash, hash: sha256(canonical({ ...rec, prevHash })) };
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    fs.appendFileSync(this.file, JSON.stringify(out) + "\n");
    return out;
  }
}

export function verifyChain(records: DecisionRecord[]): { ok: boolean; brokenAt: number | null } {
  let prev = "genesis";
  for (let i = 0; i < records.length; i++) {
    const { hash, ...rest } = records[i];
    if (rest.prevHash !== prev || sha256(canonical(rest)) !== hash) return { ok: false, brokenAt: i };
    prev = hash;
  }
  return { ok: true, brokenAt: null };
}

/** Rebuild portfolio state from the log, so it is always derived and never stored separately. */
export function portfolioFrom(records: DecisionRecord[], p: RiskPolicy): PortfolioState {
  const byId = new Map<string, PaperPosition>();
  for (const r of records) if (r.trade) byId.set(r.trade.tradeId, r.trade);
  const positions = [...byId.values()];
  let equity = p.startingEquityUsd;
  let peak = equity;
  for (const x of positions.filter(t => t.status === "CLOSED").sort((a, b) => a.exitTime! - b.exitTime!)) {
    equity += x.netPnlUsd ?? 0;
    peak = Math.max(peak, equity);
  }
  return { positions, realizedPnlUsd: equity - p.startingEquityUsd, peakEquityUsd: peak };
}

/** One decision for one token. An LLM has no path into this function. */
export async function decide(
  token: string, log: DecisionLog, p: RiskPolicy = DEFAULT_POLICY, call: Caller = callTool, now = Date.now()
): Promise<DecisionRecord> {
  const [analysis, overview] = await Promise.all([
    call<TokenAnalysis>("analyze_token", { symbol: token }),
    call<MarketOverview>("market_overview", {}),
  ]);
  const snapshot = buildSnapshot(token, analysis, overview, p.maxDataAgeSeconds, now);
  const assessment = assess(snapshot);
  const pf = portfolioFrom(log.read(), p);
  const open = pf.positions.find(x => x.status === "OPEN" && x.token === token);
  const price = snapshot.observations.priceUsd;
  const base = { decisionId: uuidv4(), timestamp: now, token, strategyId: STRATEGY_ID, snapshot, assessment };

  if (open) {
    const usable = snapshot.rejected.length === 0 && price !== null;
    const reason = usable ? exitReasonFor(open, price) : null;
    if (usable && reason) {
      const trade = closePosition(p, open, price, reason, now);
      return log.append({ ...base, action: "EXIT", reason, risk: null, tradeId: trade.tradeId, trade });
    }
    const why = usable ? "open position inside stop and target" : `cannot mark position: ${snapshot.rejected.join("; ")}`;
    return log.append({ ...base, action: "HOLD", reason: why, risk: null, tradeId: open.tradeId, trade: null });
  }

  const risk = checkEntry(p, snapshot, assessment, pf, now);
  if (assessment.signal !== "LONG" || !risk.allowed || price === null || risk.slippageBps === null) {
    const reasons = [...assessment.conflicts, ...risk.violations];
    if (assessment.signal !== "LONG" && !reasons.length) reasons.push("no qualifying long signal");
    return log.append({ ...base, action: "NO_TRADE", reason: reasons.join("; "), risk, tradeId: null, trade: null });
  }
  const trade = openPosition(p, {
    tradeId: uuidv4(), token, contract: snapshot.contract, chain: snapshot.chain,
    strategyId: STRATEGY_ID, decisionId: base.decisionId, snapshotId: snapshot.snapshotId,
  }, price, risk.sizeUsd, risk.slippageBps, now);
  return log.append({ ...base, action: "BUY", reason: "signal qualified and all risk checks passed", risk, tradeId: trade.tradeId, trade });
}

export function metrics(records: DecisionRecord[], p: RiskPolicy = DEFAULT_POLICY) {
  const pf = portfolioFrom(records, p);
  const closed = pf.positions.filter(x => x.status === "CLOSED");
  const wins = closed.filter(x => (x.netPnlUsd ?? 0) > 0).length;
  const count = (a: Action) => records.filter(r => r.action === a).length;
  return {
    label: "simulated practice trades",
    decisions: records.length,
    buys: count("BUY"), exits: count("EXIT"), holds: count("HOLD"), noTrades: count("NO_TRADE"),
    noTradeRate: records.length ? count("NO_TRADE") / records.length : 0,
    openPositions: pf.positions.length - closed.length,
    closedTrades: closed.length,
    wins, losses: closed.length - wins,
    netSimulatedPnlUsd: Number(pf.realizedPnlUsd.toFixed(2)),
    avgNetPnlUsd: closed.length ? Number((pf.realizedPnlUsd / closed.length).toFixed(2)) : null,
    drawdownPct: Number(((pf.peakEquityUsd - p.startingEquityUsd - pf.realizedPnlUsd) / pf.peakEquityUsd * 100).toFixed(2)),
  };
}

/** Everything a reviewer needs for one decision, including what later happened to its trade. */
export function replay(records: DecisionRecord[], decisionId: string) {
  const r = records.find(x => x.decisionId === decisionId);
  if (!r) return null;
  const outcome = r.tradeId ? records.filter(x => x.tradeId === r.tradeId && x.trade?.status === "CLOSED").at(-1)?.trade ?? null : null;
  const { raw, ...market } = r.snapshot;
  return {
    decisionId, at: new Date(r.timestamp).toISOString(), token: r.token, action: r.action, reason: r.reason,
    market, snapshotIntact: verifySnapshot(r.snapshot),
    bullish: r.assessment.bullish, bearish: r.assessment.bearish, conflicts: r.assessment.conflicts,
    scores: r.assessment.scores, confidence: r.assessment.confidence, rescored: canonical(assess(r.snapshot)) === canonical(r.assessment),
    risk: r.risk, trade: r.trade, outcome,
    thesis: outcome ? ((outcome.netPnlUsd ?? 0) > 0 ? "supported" : "contradicted") : "no closed outcome",
  };
}

const verifySnapshot = (s: EvidenceSnapshot) => {
  const { snapshotId, ...body } = s;
  return sha256(canonical(body)) === snapshotId;
};

/** Explicit VIGIL_TOKENS wins. Otherwise use scan_market candidates, falling back to majors. */
export async function selectTokens(call: Caller = callTool, env = process.env): Promise<string[]> {
  if (env.VIGIL_TOKENS) return env.VIGIL_TOKENS.split(",");
  const scan = await call<{ candidates?: { symbol: string }[] }>("scan_market", {});
  const found = scan.ok ? (scan.data.candidates ?? []).slice(0, 5).map(c => c.symbol) : [];
  return found.length ? found : ["BTC", "ETH", "SOL"];
}

async function main() {
  const live = !!process.env.RYOCHAN_API_KEY;
  const call = live ? callTool : publicCall;
  console.log(`[Research] data source: ${live ? "RYO-CHAN" : "public APIs (no RYO-CHAN key)"}`);
  const tokens = live ? await selectTokens() : Object.keys(PUBLIC_TOKENS);
  const log =new DecisionLog(process.env.VIGIL_DECISION_LOG || path.resolve(__dirname, "../../data/decisions.jsonl"));
  const policy = loadPolicy();
  for (const t of tokens) {
    const r = await decide(t, log, policy, call);
    console.log(`[Research] ${t}: ${r.action} — ${r.reason} (${r.hash})`);
  }
  console.log(metrics(log.read(), policy));
}

if (require.main === module) main().catch(e => { console.error(e); process.exit(1); });
