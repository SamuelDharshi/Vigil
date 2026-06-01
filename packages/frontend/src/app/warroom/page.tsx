"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { getWebSocket } from "@/lib/ws";
import Link from "next/link";

// ─── Types ─────────────────────────────────────────────────────────────────────
interface LedgerEntry {
  entry_id: number;
  agent_id: number;
  entry_type: number;
  from_token?: string;
  to_token?: string;
  amount?: string;
  confidence: number;
  slippage_bps?: number;
  tx_hash?: string;
  zk_proof_hash?: string;
  skip_reason?: string;
  reasoning?: string;
  block_timestamp: number;
}

interface AgentStats {
  agent_id?: number | null;
  reputation_score: number;
  total_decisions: number;
  total_executed: number;
  total_skipped: number;
  gas_reservoir_mnt: number;
  vault_address?: string;
  error?: string;
}

interface AllocationEntry { symbol: string; address: string; bps: number; pct: string; color: string; }
interface AllocationData  { allocations: AllocationEntry[]; total_value_usd: number; error?: string; }

interface ActivityLog {
  id: string; ts: number;
  level: "info" | "success" | "warn" | "skip";
  step: string; detail?: string;
}

const ENTRY_TYPE_LABELS = ["SKIP", "EXECUTE", "CROSS-CHAIN", "CLMM"];
const MANTLE_EXPLORER = process.env.NEXT_PUBLIC_MANTLE_EXPLORER || "https://sepolia.mantlescan.xyz";

function makeActivityLog(entry: LedgerEntry): ActivityLog[] {
  const base = entry.block_timestamp * 1000;
  const logs: ActivityLog[] = [
    { id: `${entry.entry_id}-1`, ts: base - 120000, level: "info",  step: "Signal Intake",    detail: "Chainlink prices · Nansen wallet flows · Elfa AI sentiment" },
    { id: `${entry.entry_id}-2`, ts: base - 90000,  level: "info",  step: "Scoring Engine",   detail: "35% yield · 40% smart money · 25% sentiment" },
    { id: `${entry.entry_id}-3`, ts: base - 60000,  level: entry.entry_type === 0 ? "warn" : "info", step: "Guardrail Check", detail: "VIGILVault.validateDecision() on Mantle Sepolia" },
    {
      id: `${entry.entry_id}-4`, ts: base,
      level: entry.entry_type === 0 ? "skip" : "success",
      step: entry.entry_type === 0 ? `SKIP — ${entry.skip_reason || "Confidence too low"}` : `EXECUTE — ${ENTRY_TYPE_LABELS[entry.entry_type]}`,
      detail: entry.reasoning || entry.skip_reason || "",
    },
  ];
  if (entry.entry_type !== 0 && entry.tx_hash) {
    logs.push({ id: `${entry.entry_id}-5`, ts: base + 5000, level: "success", step: "ERC-8004 Logged", detail: `ZK proof · Reputation updated · TX: ${entry.tx_hash.slice(0, 16)}...` });
  }
  return logs;
}

// ─── Confidence Gauge ──────────────────────────────────────────────────────────
function ConfidenceGauge({ confidence }: { confidence: number }) {
  const pct = Math.min(100, Math.max(0, confidence));
  const color = pct >= 30 ? "#00d097" : pct >= 15 ? "#f59e0b" : "#ef4444";
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
      <div style={{ position: "relative", width: 120, height: 80 }}>
        <svg width="120" height="80" viewBox="0 0 120 80">
          <path d="M 10 75 A 50 50 0 1 1 110 75" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="8" strokeLinecap="round" />
          <path d="M 10 75 A 50 50 0 1 1 110 75" fill="none" stroke={color} strokeWidth="8" strokeLinecap="round"
            strokeDasharray={`${(pct / 100) * 220} 220`}
            style={{ transition: "stroke-dasharray 0.8s ease, stroke 0.4s ease", filter: `drop-shadow(0 0 6px ${color})` }} />
          <g transform={`rotate(${-135 + (pct / 100) * 270}, 60, 75)`}>
            <line x1="60" y1="75" x2="60" y2="34" stroke={color} strokeWidth="2" strokeLinecap="round" style={{ transition: "all 0.8s ease" }} />
            <circle cx="60" cy="75" r="4" fill={color} />
          </g>
        </svg>
        <div style={{ position: "absolute", bottom: 0, width: "100%", textAlign: "center" }}>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 22, fontWeight: 700, color, filter: `drop-shadow(0 0 8px ${color})` }}>
            {pct.toFixed(1)}%
          </span>
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <div className="live-dot" style={{ width: 6, height: 6 }} />
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.1em" }}>Confidence</span>
      </div>
      <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: pct >= 30 ? "#00d097" : "#f59e0b" }}>
        {pct >= 30 ? "✓ THRESHOLD MET — WILL EXECUTE" : `${(30 - pct).toFixed(1)}% below 30% threshold`}
      </span>
    </div>
  );
}

// ─── Signal Pings ─────────────────────────────────────────────────────────────
function SignalPing({ label, color, delay }: { label: string; color: string; delay: number }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <div style={{ position: "relative", width: 10, height: 10 }}>
        <div style={{ width: 10, height: 10, borderRadius: "50%", background: color, boxShadow: `0 0 6px ${color}`, animation: `livePulse 2s ease-in-out ${delay}s infinite` }} />
        <div style={{ width: 10, height: 10, borderRadius: "50%", border: `1px solid ${color}`, position: "absolute", top: 0, left: 0, animation: `pingRing 2s ease-out ${delay}s infinite`, opacity: 0 }} />
      </div>
      <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-secondary)" }}>{label}</span>
    </div>
  );
}

// ─── Live Activity Feed ────────────────────────────────────────────────────────
function LiveActivityFeed({ logs, currentStep }: { logs: ActivityLog[]; currentStep: string }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => { if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight; }, [logs]);

  const lc = (l: ActivityLog["level"]) => l === "success" ? "#00d097" : l === "warn" ? "#f59e0b" : l === "skip" ? "#ef4444" : "rgba(255,255,255,0.45)";
  const li = (l: ActivityLog["level"]) => l === "success" ? "✓" : l === "warn" ? "⚠" : l === "skip" ? "✕" : "→";

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div className="column-header">
        <span>Live Agent Activity</span>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div className="live-dot" style={{ width: 6, height: 6 }} />
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-tertiary)" }}>STREAMING</span>
        </div>
      </div>

      {/* Current action */}
      <div style={{ margin: "12px 16px", padding: "12px 16px", background: "linear-gradient(135deg, rgba(0,208,151,0.08), rgba(0,208,151,0.02))", border: "0.5px solid rgba(0,208,151,0.25)", borderRadius: 8, display: "flex", alignItems: "center", gap: 10 }}>
        <div className="live-dot" />
        <div>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.1em" }}>Current Action</div>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 13, color: "#00d097", marginTop: 2 }}>{currentStep}</div>
        </div>
      </div>

      {/* Signal sources */}
      <div style={{ padding: "8px 16px", display: "flex", gap: 20, borderBottom: "0.5px solid var(--border-subtle)" }}>
        <SignalPing label="Chainlink" color="#3b82f6" delay={0} />
        <SignalPing label="Nansen"    color="#8b5cf6" delay={0.6} />
        <SignalPing label="Elfa AI"   color="#f59e0b" delay={1.2} />
        <SignalPing label="Mantle RPC" color="#00d097" delay={1.8} />
      </div>

      {/* Log stream */}
      <div ref={scrollRef} className="scroll-area" style={{ flex: 1 }}>
        {logs.length === 0 ? (
          <div style={{ padding: 24, textAlign: "center" }}>
            <p style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-tertiary)" }}>Waiting for first agent cycle...</p>
          </div>
        ) : (
          <div style={{ padding: "8px 0" }}>
            {logs.map((log, i) => (
              <div key={log.id} style={{ display: "flex", gap: 10, padding: "6px 16px", background: i === logs.length - 1 ? "rgba(0,208,151,0.04)" : "transparent", borderLeft: i === logs.length - 1 ? "2px solid rgba(0,208,151,0.4)" : "2px solid transparent", animation: i === logs.length - 1 ? "fadeInUp 0.3s ease" : "none" }}>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-tertiary)", flexShrink: 0, paddingTop: 1 }}>
                  {new Date(log.ts).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false })}
                </span>
                <span style={{ color: lc(log.level), fontSize: 11, flexShrink: 0, paddingTop: 1 }}>{li(log.level)}</span>
                <div>
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: lc(log.level) }}>{log.step}</div>
                  {log.detail && <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-tertiary)", marginTop: 2 }}>{log.detail}</div>}
                </div>
              </div>
            ))}
            <div style={{ padding: "4px 16px", display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-tertiary)", opacity: 0.4 }}>
                {new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false })}
              </span>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "rgba(0,208,151,0.6)", animation: "blink 1s step-end infinite" }}>█</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Decision Pipeline ─────────────────────────────────────────────────────────
const PIPELINE_STAGES = [
  { id: "intake",    label: "Signal Intake",   icon: "📡", detail: "Chainlink · Nansen · Elfa AI · Mantle RPC" },
  { id: "model",     label: "Scoring Engine",  icon: "⚖️", detail: "35% yield · 40% smart money · 25% sentiment" },
  { id: "guardrail", label: "Guardrail Check", icon: "🛡️", detail: "VIGILVault.validateDecision() on-chain" },
  { id: "execution", label: "Fluxion RFQ",     icon: "⚡", detail: "Atomic RFQ · 0.40% slippage cap" },
  { id: "logged",    label: "ERC-8004 Logged", icon: "✓",  detail: "ZK proof · Reputation · Validation registry" },
] as const;

function DecisionPipeline({ lastEntry, agentStats, confidence }: { lastEntry?: LedgerEntry; agentStats: AgentStats; confidence: number }) {
  const [countdown, setCountdown] = useState(0);
  useEffect(() => {
    const tick = () => { const now = Date.now(); const next = Math.ceil(now / (30*60*1000))*(30*60*1000); setCountdown(Math.round((next-now)/1000)); };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  const lastEntryAge = lastEntry ? (Date.now() / 1000 - lastEntry.block_timestamp) : Infinity;
  const isRecentCycle = lastEntryAge < 35 * 60;

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <div className="column-header">
        <span>Decision Pipeline</span>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-tertiary)" }}>
          {Math.floor(countdown / 60).toString().padStart(2, "0")}:{(countdown % 60).toString().padStart(2, "0")} to next cycle
        </span>
      </div>
      <div className="scroll-area" style={{ flex: 1, padding: 16 }}>
        {/* Agent identity */}
        <div style={{ padding: 16, background: "var(--bg-raised)", borderRadius: 8, border: "0.5px solid var(--border-dim)", marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <div className="live-dot" />
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--text-primary)" }}>
              VIGIL Agent {agentStats.agent_id ? `#${agentStats.agent_id}` : "(spawning...)"}
            </span>
            <span className="badge badge-acted" style={{ marginLeft: "auto" }}>ACTIVE</span>
          </div>
          <p style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-tertiary)" }}>
            {agentStats.vault_address ? `${agentStats.vault_address.slice(0, 10)}... on Mantle Sepolia` : "Deploy contracts to connect"}
          </p>
          {agentStats.error && <p style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--accent-amber)", marginTop: 4 }}>⚠ {agentStats.error}</p>}
          <p style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-secondary)", marginTop: 8 }}>
            {agentStats.total_decisions ?? 0} decisions · {agentStats.total_skipped ?? 0} skipped · {agentStats.total_executed ?? 0} executed
          </p>
        </div>

        {/* Confidence gauge */}
        <div style={{ padding: 16, background: "var(--bg-raised)", borderRadius: 8, border: "0.5px solid var(--border-dim)", marginBottom: 16, display: "flex", justifyContent: "center" }}>
          <ConfidenceGauge confidence={confidence} />
        </div>

        {/* Pipeline stages */}
        <div style={{ display: "flex", flexDirection: "column" }}>
          {PIPELINE_STAGES.map((stage, i) => (
            <React.Fragment key={stage.id}>
              <div className={`pipeline-stage ${isRecentCycle ? "completed" : ""}`}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 14 }}>{stage.icon}</span>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: isRecentCycle ? "rgba(0,208,151,0.6)" : "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                    {stage.label}
                  </span>
                  {isRecentCycle && <span style={{ marginLeft: "auto", color: "#00d097", fontSize: 11 }}>✓</span>}
                </div>
                <p style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-tertiary)", marginTop: 4 }}>{stage.detail}</p>
                {stage.id === "execution" && lastEntry?.tx_hash && (
                  <a href={`${MANTLE_EXPLORER}/tx/${lastEntry.tx_hash}`} target="_blank" rel="noopener noreferrer" style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "#00d097", display: "block", marginTop: 4 }}>
                    {lastEntry.tx_hash.slice(0, 16)}... ↗
                  </a>
                )}
              </div>
              {i < PIPELINE_STAGES.length - 1 && <div className={`pipeline-connector ${isRecentCycle ? "active" : ""}`} />}
            </React.Fragment>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Agent Ledger ──────────────────────────────────────────────────────────────
function AgentLedger({ entries, agentStats, allocation }: { entries: LedgerEntry[]; agentStats: AgentStats; allocation: AllocationData | null }) {
  const allEntries = entries.slice(0, 8);
  const reputationPct = Math.min(100, ((agentStats.reputation_score ?? 0) / 1000) * 100);

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <div className="column-header">
        <span>Agent Identity</span>
        <span style={{ color: "var(--text-tertiary)" }}>ERC-8004</span>
      </div>
      <div className="scroll-area" style={{ flex: 1 }}>
        <div style={{ padding: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
            <div className="live-dot" />
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-secondary)" }}>
              Agent {agentStats.agent_id ? `#${agentStats.agent_id}` : "—"} · VIGIL
            </span>
          </div>
          <div className="reputation-label">On-Chain Reputation Score</div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8, margin: "8px 0 12px" }}>
            <span className="reputation-score">{(agentStats.reputation_score ?? 0) > 0 ? Math.round(agentStats.reputation_score!) : "—"}</span>
            {(agentStats.reputation_score ?? 0) > 0 && <span style={{ fontFamily: "var(--font-mono)", fontSize: 14, color: "var(--text-tertiary)" }}>/ 1000</span>}
          </div>
          {(agentStats.reputation_score ?? 0) > 0 && (
            <div className="progress-bar"><div className="progress-fill" style={{ width: `${reputationPct}%` }} /></div>
          )}
          <p style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-tertiary)", marginTop: 8 }}>
            Gas reservoir: {(agentStats.gas_reservoir_mnt ?? 0).toFixed(3)} MNT
          </p>
        </div>

        <div style={{ height: "0.5px", background: "var(--border-subtle)" }} />

        <div>
          <div style={{ padding: "12px 20px", borderBottom: "0.5px solid var(--border-subtle)" }}>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Decision History</span>
          </div>
          {allEntries.length === 0 ? (
            <p style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-tertiary)", padding: 20, textAlign: "center" }}>No decisions yet</p>
          ) : (
            allEntries.map((entry, i) => (
              <div key={entry.entry_id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 20px", borderBottom: "0.5px solid var(--border-subtle)", background: i === 0 ? "rgba(0,208,151,0.03)" : "transparent", gap: 8 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: 500, color: entry.entry_type === 0 ? "#ef4444" : "#00d097", textTransform: "uppercase" }}>
                      {ENTRY_TYPE_LABELS[entry.entry_type]}
                    </span>
                    {entry.tx_hash && (
                      <a href={`${MANTLE_EXPLORER}/tx/${entry.tx_hash}`} target="_blank" rel="noopener noreferrer" style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--text-tertiary)" }}>
                        {entry.tx_hash.slice(0, 8)}... ↗
                      </a>
                    )}
                  </div>
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--text-tertiary)", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {entry.skip_reason || entry.reasoning || "—"}
                  </div>
                </div>
                <div style={{ textAlign: "right", flexShrink: 0 }}>
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-secondary)" }}>
                    {(entry.confidence / 10000 * 100).toFixed(1)}%
                  </div>
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--text-tertiary)" }}>
                    {new Date(entry.block_timestamp * 1000).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false })}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        <div style={{ height: "0.5px", background: "var(--border-subtle)" }} />

        <div style={{ padding: "16px 20px" }}>
          <p style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>
            Live Allocation — VIGILVault
          </p>
          {allocation?.total_value_usd != null && allocation.total_value_usd > 0 && (
            <p style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-tertiary)", marginBottom: 12 }}>
              AUM: ${allocation.total_value_usd.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </p>
          )}
          {!allocation || allocation.error ? (
            <p style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-tertiary)" }}>{allocation?.error || "Deploy contracts to see allocation"}</p>
          ) : allocation.allocations.length === 0 ? (
            <p style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-tertiary)" }}>No allocation set</p>
          ) : (
            allocation.allocations.map(a => (
              <div key={a.symbol} className="alloc-row">
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-secondary)", width: 44, flexShrink: 0 }}>{a.symbol}</span>
                <div className="alloc-bar-track">
                  <div className="alloc-bar-fill" style={{ width: `${a.bps / 100}%`, background: a.color, opacity: 0.8 }} />
                </div>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-tertiary)", width: 36, textAlign: "right" }}>{a.pct}%</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Market Clock ──────────────────────────────────────────────────────────────
const MARKETS = [
  { name: "NYSE",   tz: "America/New_York", openH: 9.5,  closeH: 16,   days: [1,2,3,4,5] },
  { name: "NASDAQ", tz: "America/New_York", openH: 9.5,  closeH: 16,   days: [1,2,3,4,5] },
  { name: "LSE",    tz: "Europe/London",    openH: 8,    closeH: 16.5, days: [1,2,3,4,5] },
  { name: "TSE",    tz: "Asia/Tokyo",       openH: 9,    closeH: 15.5, days: [1,2,3,4,5] },
];

function getMarketStatus(m: typeof MARKETS[0]) {
  const local = new Date(new Date().toLocaleString("en-US", { timeZone: m.tz }));
  const day = local.getDay(), hour = local.getHours() + local.getMinutes() / 60;
  const isOpen = m.days.includes(day) && hour >= m.openH && hour < m.closeH;
  const minsUntil = isOpen ? (m.closeH - hour) * 60 : (() => {
    const nextDay = m.days.find(d => d > day) ?? m.days[0];
    const daysAway = nextDay > day ? nextDay - day : 7 - day + nextDay;
    return daysAway * 24 * 60 - hour * 60 + m.openH * 60;
  })();
  const h = Math.floor(minsUntil / 60), min = Math.round(minsUntil % 60);
  return { isOpen, label: isOpen ? `${h}h ${min}m until close` : `${h}h ${min}m until open` };
}

function MarketGapClock({ agentStats }: { agentStats: AgentStats }) {
  const [, setTick] = useState(0);
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); const id = setInterval(() => setTick(t => t + 1), 60_000); return () => clearInterval(id); }, []);
  if (!mounted) return <div className="market-gap-clock"><span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-tertiary)" }}>Loading...</span></div>;
  return (
    <div className="market-gap-clock">
      <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Traditional Markets</span>
      {MARKETS.map((m, i) => {
        const { isOpen, label } = getMarketStatus(m);
        return (
          <React.Fragment key={m.name}>
            <div className="market-entry">
              <span style={{ color: "var(--text-tertiary)" }}>{m.name}:</span>
              <span className={isOpen ? "market-open" : "market-closed"}>{isOpen ? `OPEN · ${label}` : `CLOSED · ${label}`}</span>
            </div>
            {i < MARKETS.length - 1 && <div className="market-divider" />}
          </React.Fragment>
        );
      })}
      <div className="market-divider" />
      <div className="vigil-active-label">
        <div className="live-dot" />VIGIL: ACTIVE
        {(agentStats.total_executed ?? 0) > 0 && <span style={{ color: "var(--text-secondary)", fontWeight: 400, marginLeft: 8 }}>· {agentStats.total_executed} on-chain executions</span>}
      </div>
    </div>
  );
}

// ─── WAR ROOM PAGE ─────────────────────────────────────────────────────────────
export default function WarRoom() {
  const [entries, setEntries]       = useState<LedgerEntry[]>([]);
  const [agentStats, setAgentStats] = useState<AgentStats>({ agent_id: null, reputation_score: 0, total_decisions: 0, total_executed: 0, total_skipped: 0, gas_reservoir_mnt: 0 });
  const [allocation, setAllocation] = useState<AllocationData | null>(null);
  const [wsConnected, setWsConnected] = useState(false);
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [currentStep, setCurrentStep] = useState("Waiting for next 30-min cycle...");
  const [confidence, setConfidence] = useState(2.0);

  const fetchLiveData = useCallback(async () => {
    const [statsRes, allocRes] = await Promise.allSettled([
      fetch("/api/agent").then(r => r.json()),
      fetch("/api/allocation").then(r => r.json()),
    ]);
    if (statsRes.status === "fulfilled" && !statsRes.value.error) setAgentStats(statsRes.value);
    if (allocRes.status === "fulfilled" && !allocRes.value.error) setAllocation(allocRes.value);
  }, []);

  useEffect(() => {
    fetchLiveData();
    const interval = setInterval(fetchLiveData, 60_000);
    return () => clearInterval(interval);
  }, [fetchLiveData]);

  useEffect(() => {
    const ws = getWebSocket();
    ws.connect();

    const unsubInitial = ws.on("INITIAL_STATE", (msg) => {
      if (msg.entries) {
        const e = msg.entries as LedgerEntry[];
        setEntries(e);
        if (e.length > 0) {
          setActivityLogs(e.slice(0, 5).reverse().flatMap(x => makeActivityLog(x)));
          const last = e[0];
          setConfidence((last.confidence / 10000) * 100);
          setCurrentStep(last.entry_type === 0 ? `SKIP — ${last.skip_reason || "Confidence too low"}` : `EXECUTED — ${ENTRY_TYPE_LABELS[last.entry_type]}`);
        }
      }
      if (msg.agentStats) setAgentStats(prev => ({ ...prev, ...msg.agentStats }));
      setWsConnected(true);
    });

    const unsubEntry = ws.on("LEDGER_ENTRY", (msg) => {
      const entry = msg as unknown as LedgerEntry;
      setEntries(prev => [entry, ...prev.slice(0, 99)]);
      setActivityLogs(prev => [...prev, ...makeActivityLog(entry)].slice(-100));
      const conf = (entry.confidence / 10000) * 100;
      setConfidence(conf);
      setCurrentStep(entry.entry_type === 0 ? `SKIP — ${entry.skip_reason || "Confidence too low"}` : `EXECUTED — ${ENTRY_TYPE_LABELS[entry.entry_type]}`);
    });

    const unsubStats = ws.on("AGENT_STATS", (msg) => { if (msg.stats) setAgentStats(prev => ({ ...prev, ...msg.stats })); });
    const unsubHb    = ws.on("HEARTBEAT", () => {
      setWsConnected(true);
      setActivityLogs(prev => [...prev, { id: `hb-${Date.now()}`, ts: Date.now(), level: "info", step: "Heartbeat", detail: "Indexer WebSocket alive · Next cycle in ~30 min" }].slice(-100));
    });

    return () => { unsubInitial(); unsubEntry(); unsubStats(); unsubHb(); };
  }, []);

  const lastEntry = entries[0];

  return (
    <>
      <style>{`
        @keyframes pingRing { 0%{transform:scale(1);opacity:0.8} 100%{transform:scale(3);opacity:0} }
        @keyframes fadeInUp { from{opacity:0;transform:translateY(4px)} to{opacity:1;transform:translateY(0)} }
        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0} }
        @keyframes livePulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
      `}</style>

      {/* Top nav */}
      <div style={{ height: 44, display: "flex", alignItems: "center", padding: "0 20px", gap: 16, borderBottom: "0.5px solid var(--border-subtle)", background: "var(--bg-void)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div className="live-dot" />
          <span style={{ fontFamily: "var(--font-serif)", fontSize: 20, color: "var(--text-primary)", letterSpacing: "-0.02em" }}>VIGIL</span>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.06em" }}>War Room</span>
        </div>
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-tertiary)" }}>Mantle Sepolia</span>
          <span className={`badge ${wsConnected ? "badge-acted" : "badge-skipped"}`}>{wsConnected ? "LIVE" : "CONNECTING..."}</span>
          <Link
            href="/dashboard"
            style={{ display: "flex", alignItems: "center", gap: 6, padding: "4px 12px", borderRadius: 6, border: "0.5px solid rgba(139,92,246,0.5)", background: "rgba(139,92,246,0.1)", color: "#a78bfa", fontFamily: "var(--font-mono)", fontSize: 11, textDecoration: "none", transition: "all 0.2s ease" }}
            onMouseEnter={e => (e.currentTarget.style.background = "rgba(139,92,246,0.2)")}
            onMouseLeave={e => (e.currentTarget.style.background = "rgba(139,92,246,0.1)")}
          >
            ✦ 3D Dashboard
          </Link>
        </div>
      </div>

      {/* Three-column layout */}
      <div className="war-room-layout">
        <div className="war-room-column"><LiveActivityFeed logs={activityLogs} currentStep={currentStep} /></div>
        <div className="war-room-column"><DecisionPipeline lastEntry={lastEntry} agentStats={agentStats} confidence={confidence} /></div>
        <div className="war-room-column"><AgentLedger entries={entries} agentStats={agentStats} allocation={allocation} /></div>
      </div>
      <MarketGapClock agentStats={agentStats} />
    </>
  );
}
