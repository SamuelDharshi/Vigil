import test from "node:test";
import assert from "node:assert/strict";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { Caller, ToolName } from "./ryochan";
import { DecisionLog, decide, metrics, replay, selectTokens, verifyChain } from "./agent";
import { checkEntry, DEFAULT_POLICY, RiskPolicy } from "./risk";
import { buildSnapshot } from "./evidence";
import { assess } from "./strategy";
import { PaperPosition, PortfolioState } from "./paper";

const NOW = Date.parse("2026-10-31T00:00:00Z");
const tmpLog = () => new DecisionLog(path.join(fs.mkdtempSync(path.join(os.tmpdir(), "vigil-")), "d.jsonl"));

const token = (over: any = {}) => ({
  symbol: "ETH", contract: "0xabc", chain: "ethereum", verdict: "constructive", price_usd: "100",
  changes: { h24: 2 },
  market: { volume_24h_usd: "5000000", liquidity_usd: "10000000" },
  technicals: { trend: "uptrend", rsi_14: 60, momentum_30d_pct: 25, atr_14_pct: 4 },
  intelligence: { narrative: "test fixture" },
  safety: { score: 90, safe: true, honeypot: false },
  generated_at: new Date(NOW).toISOString(),
  ...over,
});

const fixture = (analysis: unknown, overview: unknown = { regime: "risk_on", fear_greed: { value: 60, label: "Greed" }, generated_at: new Date(NOW).toISOString() }): Caller =>
  (async (tool: ToolName) => {
    const body = tool === "analyze_token" ? analysis : overview;
    if (body === null) return { ok: false, tool, source: "fixture", fetchedAt: NOW, error: "503: down", rateLimited: false };
    return { ok: true, tool, source: "fixture", fetchedAt: NOW, data: body };
  }) as Caller;

test("A: verified bullish signal with liquidity produces a practice BUY", async () => {
  const r = await decide("ETH", tmpLog(), DEFAULT_POLICY, fixture(token()), NOW);
  assert.equal(r.action, "BUY");
  assert.ok(r.trade && r.trade.entryPrice > 100, "entry includes estimated slippage");
  assert.equal(r.trade.snapshotId, r.snapshot.snapshotId);
});

test("B: strong sentiment with poor safety is NO_TRADE", async () => {
  const over = { regime: "risk_on", fear_greed: { value: 95, label: "Extreme Greed" }, generated_at: new Date(NOW).toISOString() };
  const r = await decide("ETH", tmpLog(), DEFAULT_POLICY, fixture(token({ safety: { score: 20, safe: false, honeypot: true } }), over), NOW);
  assert.equal(r.action, "NO_TRADE");
  assert.match(r.reason, /SAFETY/);
});

test("C: conflicting trend and momentum is NO_TRADE", async () => {
  const t = token({ technicals: { trend: "uptrend", rsi_14: 55, momentum_30d_pct: -20, atr_14_pct: 4 } });
  const r = await decide("ETH", tmpLog(), DEFAULT_POLICY, fixture(t), NOW);
  assert.equal(r.action, "NO_TRADE");
  assert.match(r.reason, /disagree/);
});

test("D: stale market data is rejected", async () => {
  const t = token({ generated_at: new Date(NOW - 3_600_000).toISOString() });
  const r = await decide("ETH", tmpLog(), DEFAULT_POLICY, fixture(t), NOW);
  assert.equal(r.action, "NO_TRADE");
  assert.match(r.reason, /stale/);
});

test("E: a trade breaching portfolio risk limit is rejected", async () => {
  const p: RiskPolicy = { ...DEFAULT_POLICY, maxPortfolioExposurePct: 0.1 };
  const r = await decide("ETH", tmpLog(), p, fixture(token()), NOW);
  assert.equal(r.action, "NO_TRADE");
  assert.match(r.reason, /portfolio exposure/);
});

test("F: stop-loss closes the position with a recorded reason and net of costs", async () => {
  const log = tmpLog();
  const buy = await decide("ETH", log, DEFAULT_POLICY, fixture(token()), NOW);
  const r = await decide("ETH", log, DEFAULT_POLICY, fixture(token({ price_usd: "90", generated_at: new Date(NOW + 1000).toISOString() })), NOW + 1000);
  assert.equal(r.action, "EXIT");
  assert.equal(r.trade?.exitReason, "STOP_LOSS");
  assert.ok((r.trade?.netPnlUsd ?? 0) < -(buy.trade!.sizeUsd * 0.1), "loss includes fees and slippage");
  assert.equal(replay(log.read(), buy.decisionId)?.thesis, "contradicted");
});

test("take-profit closes the position", async () => {
  const log = tmpLog();
  await decide("ETH", log, DEFAULT_POLICY, fixture(token()), NOW);
  const r = await decide("ETH", log, DEFAULT_POLICY, fixture(token({ price_usd: "120", generated_at: new Date(NOW + 1000).toISOString() })), NOW + 1000);
  assert.equal(r.trade?.exitReason, "TAKE_PROFIT");
  assert.ok((r.trade?.netPnlUsd ?? 0) > 0);
});

test("G: provider failure records missing evidence and fabricates nothing", async () => {
  const r = await decide("ETH", tmpLog(), DEFAULT_POLICY, fixture(null, null), NOW);
  assert.equal(r.action, "NO_TRADE");
  assert.equal(r.snapshot.observations.priceUsd, null);
  assert.ok(r.snapshot.unavailable.some(u => u.includes("market_overview")));
  assert.ok(r.snapshot.sources.every(s => !s.ok));
});

test("malformed response is rejected", async () => {
  const r = await decide("ETH", tmpLog(), DEFAULT_POLICY, fixture({ symbol: "ETH" }), NOW);
  assert.equal(r.action, "NO_TRADE");
  assert.match(r.reason, /schema/);
});

test("kill switch blocks entries", async () => {
  const r = await decide("ETH", tmpLog(), { ...DEFAULT_POLICY, killSwitch: true }, fixture(token()), NOW);
  assert.equal(r.action, "NO_TRADE");
  assert.match(r.reason, /KILL_SWITCH/);
});

test("low liquidity and excess slippage are rejected", async () => {
  const t = token({ market: { volume_24h_usd: "5000000", liquidity_usd: "50000" } });
  const r = await decide("ETH", tmpLog(), DEFAULT_POLICY, fixture(t), NOW);
  assert.equal(r.action, "NO_TRADE");
  assert.match(r.reason, /LIQUIDITY/);
  assert.match(r.reason, /SLIPPAGE/);
});

test("cooldown blocks re-entry after an exit", async () => {
  const log = tmpLog();
  await decide("ETH", log, DEFAULT_POLICY, fixture(token()), NOW);
  await decide("ETH", log, DEFAULT_POLICY, fixture(token({ price_usd: "120", generated_at: new Date(NOW + 1000).toISOString() })), NOW + 1000);
  const r = await decide("ETH", log, DEFAULT_POLICY, fixture(token({ generated_at: new Date(NOW + 2000).toISOString() })), NOW + 2000);
  assert.equal(r.action, "NO_TRADE");
  assert.match(r.reason, /COOLDOWN/);
});

test("unusable data while a position is open holds instead of inventing a mark", async () => {
  const log = tmpLog();
  await decide("ETH", log, DEFAULT_POLICY, fixture(token()), NOW);
  const r = await decide("ETH", log, DEFAULT_POLICY, fixture(null), NOW + 1000);
  assert.equal(r.action, "HOLD");
  assert.match(r.reason, /cannot mark/);
});

test("hash chain detects tampering, and duplicates are refused", async () => {
  const log = tmpLog();
  const a = await decide("ETH", log, DEFAULT_POLICY, fixture(token()), NOW);
  await decide("ETH", log, DEFAULT_POLICY, fixture(token()), NOW + 1000);
  assert.deepEqual(verifyChain(log.read()), { ok: true, brokenAt: null });
  const edited = log.read();
  edited[0].reason = "rewritten";
  assert.equal(verifyChain(edited).brokenAt, 0);
  const { prevHash, hash, ...dup } = a;
  assert.throws(() => log.append(dup), /duplicate/);
});

test("replay recomputes scores from the stored snapshot", async () => {
  const log = tmpLog();
  const a = await decide("ETH", log, DEFAULT_POLICY, fixture(token()), NOW);
  const rep = replay(log.read(), a.decisionId);
  assert.equal(rep?.snapshotIntact, true);
  assert.equal(rep?.rescored, true);
  assert.equal(metrics(log.read()).label, "simulated practice trades");
});

const closedLoss = (pnl: number, at: number): PaperPosition => ({
  tradeId: `t${at}`, status: "CLOSED", token: "OLD", contract: null, chain: null, direction: "LONG",
  entryPrice: 1, sizeUsd: 1000, entryTime: at, exitTime: at, stopLoss: 1, takeProfit: 1, feesUsd: 0,
  slippageBps: 0, netPnlUsd: pnl, strategyId: "s", decisionId: "d", snapshotId: "x",
});
const entryCheck = (pf: PortfolioState, p: RiskPolicy = DEFAULT_POLICY) => {
  const ok = (data: unknown, tool: ToolName) => ({ ok: true as const, tool, source: "fixture", fetchedAt: NOW, data });
  const snap = buildSnapshot("ETH", ok(token(), "analyze_token") as any, ok({ fear_greed: { value: 60, label: "G" }, generated_at: "x" }, "market_overview") as any, 900, NOW);
  return checkEntry(p, snap, assess(snap), pf, NOW).violations.join("; ");
};

test("daily simulated loss limit blocks entries", () => {
  const pf = { positions: [closedLoss(-4000, NOW - 1000)], realizedPnlUsd: -4000, peakEquityUsd: 100_000 };
  assert.match(entryCheck(pf), /daily simulated loss/);
});

test("drawdown limit blocks entries", () => {
  const pf = { positions: [closedLoss(-11000, NOW - 172_800_000)], realizedPnlUsd: -11000, peakEquityUsd: 100_000 };
  assert.match(entryCheck(pf), /drawdown/);
});

test("token exposure limit blocks entries", () => {
  const pf = { positions: [], realizedPnlUsd: 0, peakEquityUsd: 100_000 };
  assert.match(entryCheck(pf, { ...DEFAULT_POLICY, maxTokenExposurePct: 0.1 }), /token exposure/);
});

test("token selection uses scan_market and falls back without inventing candidates", async () => {
  const hit = (async (tool: ToolName) => ({ ok: true, tool, source: "f", fetchedAt: NOW, data: { candidates: [{ symbol: "AAA" }] } })) as Caller;
  const miss = (async (tool: ToolName) => ({ ok: false, tool, source: "f", fetchedAt: NOW, error: "x", rateLimited: false })) as Caller;
  assert.deepEqual(await selectTokens(hit, {}), ["AAA"]);
  assert.deepEqual(await selectTokens(miss, {}), ["BTC", "ETH", "SOL"]);
  assert.deepEqual(await selectTokens(miss, { VIGIL_TOKENS: "X,Y" }), ["X", "Y"]);
});
