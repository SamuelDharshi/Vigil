"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";

const MANTLE_EXPLORER =
  process.env.NEXT_PUBLIC_MANTLE_EXPLORER || "https://sepolia.mantlescan.xyz";

const ENTRY_TYPE_LABELS = ["SKIP", "EXECUTE", "CROSS-CHAIN", "CLMM"];
const ENTRY_TYPE_COLORS: Record<number, string> = {
  0: "#ef4444",  // SKIP
  1: "#00d097",  // EXECUTE
  2: "#06b6d4",  // CROSS-CHAIN
  3: "#8b5cf6",  // CLMM
};

interface ProofEntry {
  entryId: number;
  agentId: number;
  entryType: number;
  label: string;
  fromToken: string;
  toToken: string;
  amount: number;
  slippageBps: number;
  txHash: string | null;
  zkProofHash: string | null;
  skipReason: string | null;
  reasoning: string | null;
  timestamp: number;
  mantlescanUrl: string | null;
}

function hexToRgb(hex: string) {
  return `${parseInt(hex.slice(1,3),16)},${parseInt(hex.slice(3,5),16)},${parseInt(hex.slice(5,7),16)}`;
}

function timeAgo(ms: number) {
  const diff = Date.now() - ms;
  const m = Math.floor(diff / 60000);
  const h = Math.floor(m / 60);
  const d = Math.floor(h / 24);
  if (d > 0) return `${d}d ago`;
  if (h > 0) return `${h}h ago`;
  if (m > 0) return `${m}m ago`;
  return "just now";
}

export default function ProofsPage() {
  const [entries, setEntries]   = useState<ProofEntry[]>([]);
  const [total, setTotal]       = useState(0);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);
  const [filter, setFilter]     = useState<"ALL" | "EXECUTE" | "SKIP">("ALL");
  const [selected, setSelected] = useState<ProofEntry | null>(null);
  const [fetchedAt, setFetchedAt] = useState<number | null>(null);

  useEffect(() => {
    fetch("/api/proof")
      .then(r => r.json())
      .then(d => {
        setEntries(d.entries || []);
        setTotal(d.total || 0);
        setFetchedAt(d.fetchedAt || null);
        if (d.error) setError(d.error);
        setLoading(false);
      })
      .catch(e => { setError(e.message); setLoading(false); });
  }, []);

  const filtered = entries.filter(e =>
    filter === "ALL" ? true :
    filter === "EXECUTE" ? e.entryType !== 0 :
    e.entryType === 0
  );

  const executed = entries.filter(e => e.entryType !== 0).length;
  const skipped  = entries.filter(e => e.entryType === 0).length;

  return (
    <div style={{
      display: "flex", flexDirection: "column", height: "100vh",
      background: "#09090b", color: "#e4e4e7", overflow: "hidden",
      fontFamily: "monospace",
    }}>
      <style>{`
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.25} }
        @keyframes fadeIn { from{opacity:0;transform:translateY(4px)} to{opacity:1;transform:translateY(0)} }
        @keyframes shimmer { 0%{background-position:-200px 0} 100%{background-position:200px 0} }
        .entry-row:hover { background: rgba(255,255,255,0.03) !important; }
        .copy-btn:hover { background: rgba(255,255,255,0.08) !important; }
        .filter-btn:hover { opacity: 0.8; }
      `}</style>

      {/* ── Nav ── */}
      <div style={{
        height: 48, display: "flex", alignItems: "center",
        padding: "0 20px", gap: 14,
        borderBottom: "0.5px solid rgba(255,255,255,0.07)",
        background: "rgba(9,9,11,0.98)", flexShrink: 0, zIndex: 10,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{
            width: 28, height: 28, borderRadius: 8,
            background: "rgba(0,208,151,0.12)", border: "0.5px solid rgba(0,208,151,0.3)",
            display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14,
          }}>⬡</div>
          <span style={{ fontSize: 13, fontWeight: 700, color: "#00d097", letterSpacing: "0.1em" }}>VIGIL</span>
          <span style={{ fontSize: 10, color: "rgba(255,255,255,0.18)" }}>|</span>
          <span style={{ fontSize: 10, color: "rgba(255,255,255,0.28)" }}>On-Chain Proofs · VIGILLedger.sol</span>
        </div>

        <div style={{ display: "flex", gap: 2, marginLeft: 8 }}>
          {[
            { label: "Home",     href: "/"         },
            { label: "War Room", href: "/warroom"  },
            { label: "Charts",   href: "/charts"   },
            { label: "Proofs",   href: "/proof"    },
          ].map(l => (
            <Link key={l.href} href={l.href} style={{
              padding: "3px 10px", borderRadius: 5, fontSize: 10,
              textDecoration: "none",
              color: l.href === "/proof" ? "#00d097" : "rgba(255,255,255,0.33)",
              background: l.href === "/proof" ? "rgba(0,208,151,0.08)" : "transparent",
              border: l.href === "/proof" ? "0.5px solid rgba(0,208,151,0.2)" : "0.5px solid transparent",
            }}>{l.label}</Link>
          ))}
        </div>

        <div style={{ flex: 1 }} />

        {fetchedAt && (
          <span style={{ fontSize: 9, color: "rgba(255,255,255,0.2)" }}>
            Fetched from Mantle Sepolia · {timeAgo(fetchedAt)}
          </span>
        )}
        <Link href="/dashboard" style={{
          display: "flex", alignItems: "center", gap: 5,
          padding: "4px 12px", borderRadius: 6,
          border: "0.5px solid rgba(139,92,246,0.4)", background: "rgba(139,92,246,0.08)",
          color: "#a78bfa", fontSize: 10, textDecoration: "none",
        }}>✦ 3D Dashboard</Link>
      </div>

      {/* ── Body: List + Detail ── */}
      <div style={{ flex: 1, display: "flex", minHeight: 0, overflow: "hidden" }}>

        {/* ── Left: Proof List ── */}
        <div style={{
          display: "flex", flexDirection: "column", flex: "0 0 520px",
          borderRight: "0.5px solid rgba(255,255,255,0.07)",
          overflow: "hidden",
        }}>

          {/* Stats header */}
          <div style={{
            padding: "14px 20px 10px",
            borderBottom: "0.5px solid rgba(255,255,255,0.06)",
            background: "rgba(12,13,15,0.8)",
            flexShrink: 0,
          }}>
            <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 12 }}>
              <div>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.28)", marginBottom: 4 }}>
                  TOTAL DECISIONS ON-CHAIN
                </div>
                <div style={{ fontSize: 28, fontWeight: 700, color: "#e4e4e7", letterSpacing: "-0.02em" }}>
                  {total}
                  <span style={{ fontSize: 11, color: "rgba(255,255,255,0.25)", fontWeight: 400, marginLeft: 8 }}>
                    decisions recorded
                  </span>
                </div>
              </div>
              <div style={{ display: "flex", gap: 12 }}>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 9, color: "rgba(255,255,255,0.22)", marginBottom: 2 }}>EXECUTED</div>
                  <div style={{ fontSize: 18, color: "#00d097", fontWeight: 700 }}>{executed}</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 9, color: "rgba(255,255,255,0.22)", marginBottom: 2 }}>SKIPPED</div>
                  <div style={{ fontSize: 18, color: "#ef4444", fontWeight: 700 }}>{skipped}</div>
                </div>
              </div>
            </div>

            {/* Filter tabs */}
            <div style={{ display: "flex", gap: 4 }}>
              {(["ALL", "EXECUTE", "SKIP"] as const).map(f => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className="filter-btn"
                  style={{
                    padding: "4px 12px", borderRadius: 6, cursor: "pointer", fontSize: 10,
                    fontFamily: "monospace",
                    background: filter === f ? (f === "EXECUTE" ? "rgba(0,208,151,0.12)" : f === "SKIP" ? "rgba(239,68,68,0.12)" : "rgba(255,255,255,0.08)") : "transparent",
                    color: filter === f ? (f === "EXECUTE" ? "#00d097" : f === "SKIP" ? "#ef4444" : "#e4e4e7") : "rgba(255,255,255,0.3)",
                    border: `0.5px solid ${filter === f ? (f === "EXECUTE" ? "rgba(0,208,151,0.3)" : f === "SKIP" ? "rgba(239,68,68,0.3)" : "rgba(255,255,255,0.2)") : "rgba(255,255,255,0.07)"}`,
                    transition: "all 0.15s",
                  }}
                >{f} {f === "ALL" ? `(${entries.length})` : f === "EXECUTE" ? `(${executed})` : `(${skipped})`}</button>
              ))}
            </div>
          </div>

          {/* Entries */}
          <div style={{ flex: 1, overflowY: "auto" }}>
            {loading ? (
              <div style={{ padding: 40, textAlign: "center" }}>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.25)", marginBottom: 8 }}>
                  Reading VIGILLedger on Mantle Sepolia...
                </div>
                <div style={{ fontSize: 9, color: "rgba(255,255,255,0.15)" }}>
                  Fetching from VIGILLedger.sol
                </div>
              </div>
            ) : error ? (
              <div style={{ padding: 32, textAlign: "center" }}>
                <div style={{ fontSize: 11, color: "#f59e0b", marginBottom: 6 }}>⚠ {error}</div>
                <div style={{ fontSize: 9, color: "rgba(255,255,255,0.2)" }}>
                  Check indexer is running and VIGIL_LEDGER_ADDRESS is set
                </div>
              </div>
            ) : filtered.length === 0 ? (
              <div style={{ padding: 40, textAlign: "center" }}>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.2)" }}>No decisions yet</div>
                <div style={{ fontSize: 9, color: "rgba(255,255,255,0.12)", marginTop: 6 }}>
                  Agent cycles every 30 min · First trade when confidence &gt; 30%
                </div>
              </div>
            ) : (
              filtered.map((entry, i) => {
                const color = ENTRY_TYPE_COLORS[entry.entryType] || "#6b7280";
                const isSelected = selected?.entryId === entry.entryId;
                const date = new Date(entry.timestamp);
                const isExec = entry.entryType !== 0;

                return (
                  <div
                    key={entry.entryId}
                    className="entry-row"
                    onClick={() => setSelected(isSelected ? null : entry)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 14,
                      padding: "12px 20px",
                      borderBottom: "0.5px solid rgba(255,255,255,0.04)",
                      background: isSelected ? `rgba(${hexToRgb(color)},0.06)` : "transparent",
                      cursor: "pointer",
                      borderLeft: `2px solid ${isSelected ? color : "transparent"}`,
                      transition: "all 0.15s",
                      animation: `fadeIn 0.2s ease ${i * 0.02}s both`,
                    }}
                  >
                    {/* Type badge */}
                    <div style={{
                      width: 60, flexShrink: 0,
                      padding: "3px 0",
                      textAlign: "center",
                      background: `rgba(${hexToRgb(color)},0.1)`,
                      border: `0.5px solid ${color}44`,
                      borderRadius: 5,
                      fontSize: 9, fontWeight: 700, color,
                      textTransform: "uppercase",
                    }}>
                      {entry.label}
                    </div>

                    {/* Middle */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
                        <span style={{ fontSize: 10, fontWeight: 700, color: "#e4e4e7" }}>
                          Entry #{entry.entryId}
                        </span>
                        {entry.zkProofHash && (
                          <span style={{
                            fontSize: 8, color: "#8b5cf6",
                            background: "rgba(139,92,246,0.1)",
                            border: "0.5px solid rgba(139,92,246,0.3)",
                            borderRadius: 3, padding: "1px 5px",
                          }}>ZK ✓</span>
                        )}
                        {isExec && (
                          <span style={{
                            fontSize: 8, color: "#00d097",
                            background: "rgba(0,208,151,0.08)",
                            border: "0.5px solid rgba(0,208,151,0.25)",
                            borderRadius: 3, padding: "1px 5px",
                          }}>ON-CHAIN ✓</span>
                        )}
                      </div>
                      <div style={{ fontSize: 9, color: "rgba(255,255,255,0.3)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {entry.skipReason || entry.reasoning || "—"}
                      </div>
                    </div>

                    {/* Right: time + tx */}
                    <div style={{ textAlign: "right", flexShrink: 0 }}>
                      <div style={{ fontSize: 9, color: "rgba(255,255,255,0.35)", marginBottom: 3 }}>
                        {timeAgo(entry.timestamp)}
                      </div>
                      {entry.txHash && (
                        <a
                          href={entry.mantlescanUrl || "#"}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={e => e.stopPropagation()}
                          style={{ fontSize: 8, color: "#06b6d4", textDecoration: "none" }}
                        >
                          {entry.txHash.slice(0, 8)}... ↗
                        </a>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* ── Right: Detail Panel ── */}
        <div style={{
          flex: 1, overflowY: "auto",
          background: "rgba(10,11,13,0.6)",
        }}>
          {!selected ? (
            // Empty state
            <div style={{
              display: "flex", flexDirection: "column",
              alignItems: "center", justifyContent: "center",
              height: "100%", gap: 12,
            }}>
              <div style={{ fontSize: 32, opacity: 0.15 }}>📋</div>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.2)", textAlign: "center" }}>
                Select a decision to view<br />its on-chain proof
              </div>
            </div>
          ) : (
            <div style={{ padding: 28, maxWidth: 560, animation: "fadeIn 0.2s ease" }}>
              {/* Header */}
              <div style={{
                display: "flex", alignItems: "center",
                justifyContent: "space-between", marginBottom: 24,
              }}>
                <div>
                  <div style={{ fontSize: 10, color: "rgba(255,255,255,0.25)", marginBottom: 4 }}>
                    DECISION PROOF · ENTRY #{selected.entryId}
                  </div>
                  <div style={{
                    fontSize: 22, fontWeight: 700, color: "#e4e4e7", letterSpacing: "-0.01em",
                  }}>
                    <span style={{ color: ENTRY_TYPE_COLORS[selected.entryType] }}>
                      {selected.label}
                    </span>
                    {" "}· Agent #{selected.agentId}
                  </div>
                  <div style={{ fontSize: 10, color: "rgba(255,255,255,0.25)", marginTop: 4 }}>
                    {new Date(selected.timestamp).toLocaleString("en-US", {
                      timeZone: "UTC", month: "long", day: "numeric",
                      year: "numeric", hour: "2-digit", minute: "2-digit",
                    })} UTC · {timeAgo(selected.timestamp)}
                  </div>
                </div>

                {/* Badges */}
                <div style={{ display: "flex", flexDirection: "column", gap: 5, alignItems: "flex-end" }}>
                  {selected.zkProofHash && (
                    <div style={{ display: "flex", alignItems: "center", gap: 5, padding: "4px 10px", borderRadius: 5, background: "rgba(139,92,246,0.1)", border: "0.5px solid rgba(139,92,246,0.3)" }}>
                      <div style={{ width: 5, height: 5, borderRadius: "50%", background: "#8b5cf6" }} />
                      <span style={{ fontSize: 9, color: "#8b5cf6" }}>ZK PROOF VERIFIED</span>
                    </div>
                  )}
                  {selected.entryType !== 0 && (
                    <div style={{ display: "flex", alignItems: "center", gap: 5, padding: "4px 10px", borderRadius: 5, background: "rgba(0,208,151,0.08)", border: "0.5px solid rgba(0,208,151,0.25)" }}>
                      <div style={{ width: 5, height: 5, borderRadius: "50%", background: "#00d097" }} />
                      <span style={{ fontSize: 9, color: "#00d097" }}>ERC-8004 LOGGED</span>
                    </div>
                  )}
                  <div style={{ display: "flex", alignItems: "center", gap: 5, padding: "4px 10px", borderRadius: 5, background: "rgba(6,182,212,0.08)", border: "0.5px solid rgba(6,182,212,0.25)" }}>
                    <div style={{ width: 5, height: 5, borderRadius: "50%", background: "#06b6d4" }} />
                    <span style={{ fontSize: 9, color: "#06b6d4" }}>MANTLE SEPOLIA</span>
                  </div>
                </div>
              </div>

              {/* Separator */}
              <div style={{ height: "0.5px", background: "rgba(255,255,255,0.06)", marginBottom: 24 }} />

              {/* Reasoning */}
              {(selected.reasoning || selected.skipReason) && (
                <>
                  <div style={{ marginBottom: 20 }}>
                    <div style={{ fontSize: 9, color: "rgba(255,255,255,0.22)", letterSpacing: "0.08em", marginBottom: 10 }}>
                      {selected.entryType === 0 ? "SKIP REASON" : "AGENT REASONING"}
                    </div>
                    <div style={{
                      padding: "14px 16px",
                      background: "rgba(255,255,255,0.03)",
                      border: "0.5px solid rgba(255,255,255,0.07)",
                      borderRadius: 8,
                      fontSize: 12, lineHeight: 1.65,
                      color: "rgba(255,255,255,0.6)",
                      fontStyle: "italic",
                    }}>
                      "{selected.skipReason || selected.reasoning}"
                    </div>
                  </div>
                  <div style={{ height: "0.5px", background: "rgba(255,255,255,0.06)", marginBottom: 20 }} />
                </>
              )}

              {/* Data grid */}
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 9, color: "rgba(255,255,255,0.22)", letterSpacing: "0.08em", marginBottom: 10 }}>
                  EXECUTION DATA
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  {[
                    { label: "Entry Type",   value: selected.label, color: ENTRY_TYPE_COLORS[selected.entryType] },
                    { label: "Slippage",     value: selected.slippageBps > 0 ? `${(selected.slippageBps / 100).toFixed(2)}%` : "N/A" },
                    { label: "Amount",       value: selected.amount > 0 ? selected.amount.toLocaleString() : "—" },
                    { label: "From Token",   value: selected.fromToken ? `${selected.fromToken.slice(0, 6)}...${selected.fromToken.slice(-4)}` : "—" },
                    { label: "To Token",     value: selected.toToken ? `${selected.toToken.slice(0, 6)}...${selected.toToken.slice(-4)}` : "—" },
                    { label: "Network",      value: "Mantle Sepolia" },
                  ].map(row => (
                    <div key={row.label} style={{
                      padding: "10px 12px",
                      background: "rgba(255,255,255,0.02)",
                      border: "0.5px solid rgba(255,255,255,0.06)",
                      borderRadius: 7,
                    }}>
                      <div style={{ fontSize: 8.5, color: "rgba(255,255,255,0.22)", marginBottom: 4 }}>{row.label}</div>
                      <div style={{ fontSize: 11, fontWeight: 600, color: row.color || "#e4e4e7" }}>{row.value}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ height: "0.5px", background: "rgba(255,255,255,0.06)", marginBottom: 20 }} />

              {/* On-chain links */}
              <div>
                <div style={{ fontSize: 9, color: "rgba(255,255,255,0.22)", letterSpacing: "0.08em", marginBottom: 12 }}>
                  ON-CHAIN PROOF LINKS
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {selected.txHash && selected.mantlescanUrl && (
                    <a
                      href={selected.mantlescanUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        display: "flex", alignItems: "center", justifyContent: "space-between",
                        padding: "10px 14px", borderRadius: 8,
                        background: "rgba(6,182,212,0.06)", border: "0.5px solid rgba(6,182,212,0.25)",
                        color: "#06b6d4", textDecoration: "none", fontSize: 10,
                        transition: "background 0.15s",
                      }}
                    >
                      <span>📋 View on Mantlescan</span>
                      <span style={{ fontSize: 9, color: "rgba(255,255,255,0.3)" }}>
                        {selected.txHash.slice(0, 14)}... ↗
                      </span>
                    </a>
                  )}
                  {selected.zkProofHash && (
                    <div
                      style={{
                        display: "flex", alignItems: "center", justifyContent: "space-between",
                        padding: "10px 14px", borderRadius: 8,
                        background: "rgba(139,92,246,0.06)", border: "0.5px solid rgba(139,92,246,0.2)",
                        fontSize: 10,
                      }}
                    >
                      <span style={{ color: "#8b5cf6" }}>🔐 ZK Proof Hash</span>
                      <span
                        className="copy-btn"
                        onClick={() => navigator.clipboard.writeText(selected.zkProofHash!)}
                        style={{
                          fontSize: 9, color: "rgba(255,255,255,0.35)",
                          cursor: "pointer", padding: "2px 6px", borderRadius: 3,
                          background: "transparent", transition: "background 0.15s",
                        }}
                      >
                        {selected.zkProofHash.slice(0, 16)}... 📋
                      </span>
                    </div>
                  )}
                  {/* Full tx hash */}
                  {selected.txHash && (
                    <div
                      className="copy-btn"
                      onClick={() => navigator.clipboard.writeText(selected.txHash!)}
                      style={{
                        display: "flex", alignItems: "center", justifyContent: "space-between",
                        padding: "10px 14px", borderRadius: 8,
                        background: "rgba(255,255,255,0.02)", border: "0.5px solid rgba(255,255,255,0.07)",
                        cursor: "pointer", fontSize: 9, color: "rgba(255,255,255,0.25)",
                        transition: "background 0.15s", wordBreak: "break-all",
                      }}
                    >
                      <span>TX: {selected.txHash}</span>
                      <span style={{ flexShrink: 0, marginLeft: 8 }}>📋</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Footer ── */}
      <div style={{
        height: 26, background: "rgba(9,9,11,0.98)",
        borderTop: "0.5px solid rgba(255,255,255,0.06)",
        display: "flex", alignItems: "center",
        padding: "0 20px", gap: 20, flexShrink: 0,
      }}>
        <span style={{ fontSize: 9, color: "rgba(255,255,255,0.18)" }}>
          All proofs recorded on-chain · VIGILLedger.sol · Mantle Sepolia
        </span>
        <div style={{ flex: 1 }} />
        <a
          href={`https://sepolia.mantlescan.xyz/address/${process.env.NEXT_PUBLIC_VIGIL_LEDGER_ADDRESS || ""}`}
          target="_blank" rel="noopener noreferrer"
          style={{ fontSize: 9, color: "rgba(0,208,151,0.5)", textDecoration: "none" }}
        >
          VIGILLedger.sol ↗
        </a>
        <span style={{ fontSize: 9, color: "#00d097" }}>● VIGIL ACTIVE</span>
      </div>
    </div>
  );
}
