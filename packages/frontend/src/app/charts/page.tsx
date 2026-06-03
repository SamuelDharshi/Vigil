"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";

// ─── Asset Config ──────────────────────────────────────────────────────────────
const ASSETS = [
  {
    key: "NVDAx",
    label: "NVDAx",
    name: "NVIDIA",
    tvSymbol: "NASDAQ:NVDA",
    color: "#8b5cf6",
    icon: "▲",
    type: "xStock",
  },
  {
    key: "AAPLx",
    label: "AAPLx",
    name: "Apple",
    tvSymbol: "NASDAQ:AAPL",
    color: "#f59e0b",
    icon: "◆",
    type: "xStock",
  },
  {
    key: "TSLAx",
    label: "TSLAx",
    name: "Tesla",
    tvSymbol: "NASDAQ:TSLA",
    color: "#ef4444",
    icon: "◉",
    type: "xStock",
  },
  {
    key: "mETH",
    label: "mETH",
    name: "Mantle ETH",
    tvSymbol: "COINBASE:ETHUSD",
    color: "#00d097",
    icon: "⟠",
    type: "Yield",
  },
  {
    key: "USDY",
    label: "USDY",
    name: "Ondo USDY",
    tvSymbol: "COINBASE:USDCUSD",
    color: "#3b82f6",
    icon: "◈",
    type: "Yield",
  },
  {
    key: "MNT",
    label: "MNT",
    name: "Mantle",
    tvSymbol: "KRAKEN:MNTUSD",
    color: "#06b6d4",
    icon: "⬡",
    type: "Gas",
  },
];

const TIMEFRAMES = [
  { label: "5m",  value: "5"   },
  { label: "15m", value: "15"  },
  { label: "30m", value: "30"  },
  { label: "1h",  value: "60"  },
  { label: "4h",  value: "240" },
  { label: "1D",  value: "D"   },
];

// ─── TradingView Widget ────────────────────────────────────────────────────────
function TradingViewWidget({
  symbol,
  interval,
  showIndicators,
}: {
  symbol: string;
  interval: string;
  showIndicators: boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    containerRef.current.innerHTML = "";

    const script = document.createElement("script");
    script.src =
      "https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js";
    script.async = true;
    script.innerHTML = JSON.stringify({
      autosize: true,
      symbol,
      interval,
      timezone: "Asia/Kolkata",
      theme: "dark",
      style: "1",
      locale: "en",
      backgroundColor: "rgba(10, 11, 13, 1)",
      gridColor: "rgba(255, 255, 255, 0.04)",
      hide_top_toolbar: false,
      hide_legend: false,
      save_image: true,
      hide_volume: false,
      support_host: "https://www.tradingview.com",
      studies: showIndicators
        ? ["RSI@tv-basicstudies", "MACD@tv-basicstudies"]
        : [],
      container_id: `tv_${symbol.replace(/[^a-zA-Z0-9]/g, "_")}_${interval}`,
    });

    containerRef.current.appendChild(script);

    return () => {
      if (containerRef.current) containerRef.current.innerHTML = "";
    };
  }, [symbol, interval, showIndicators]);

  return (
    <div
      ref={containerRef}
      className="tradingview-widget-container"
      style={{ width: "100%", height: "100%" }}
    />
  );
}

// ─── Mini Sparkline (comparison charts) ──────────────────────────────────────
function MiniChart({ tvSymbol, color }: { tvSymbol: string; color: string }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    ref.current.innerHTML = "";

    const script = document.createElement("script");
    script.src =
      "https://s3.tradingview.com/external-embedding/embed-widget-mini-symbol-overview.js";
    script.async = true;
    script.innerHTML = JSON.stringify({
      symbol: tvSymbol,
      width: "100%",
      height: "100%",
      locale: "en",
      dateRange: "1D",
      colorTheme: "dark",
      isTransparent: true,
      autosize: true,
      largeChartUrl: "",
      trendLineColor: color,
      underLineColor: color + "22",
      underLineBottomColor: "rgba(0,0,0,0)",
      noTimeScale: true,
    });
    ref.current.appendChild(script);

    return () => { if (ref.current) ref.current.innerHTML = ""; };
  }, [tvSymbol, color]);

  return (
    <div ref={ref} style={{ width: "100%", height: "100%" }} />
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function ChartsPage() {
  const [selectedAsset, setSelectedAsset] = useState(ASSETS[0]);
  const [timeframe, setTimeframe] = useState("30");
  const [showIndicators, setShowIndicators] = useState(false);
  const [compareMode, setCompareMode] = useState(false);

  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      height: "100vh",
      background: "var(--bg-void)",
      color: "var(--text-primary)",
      fontFamily: "var(--font-body)",
      overflow: "hidden",
    }}>

      {/* ── Nav Bar ── */}
      <nav style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 20px",
        height: 48,
        borderBottom: "0.5px solid var(--border-subtle)",
        background: "var(--bg-surface)",
        flexShrink: 0,
        gap: 16,
      }}>
        {/* Left: Logo + Nav Links */}
        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          <Link href="/" style={{ textDecoration: "none" }}>
            <span style={{
              fontFamily: "var(--font-mono)",
              fontSize: 13,
              fontWeight: 600,
              color: "var(--accent-green)",
              letterSpacing: "0.12em",
            }}>VIGIL</span>
          </Link>
          <div style={{ display: "flex", gap: 4 }}>
            {[
              { label: "Home",     href: "/" },
              { label: "War Room", href: "/warroom" },
              { label: "Charts",   href: "/charts" },
              { label: "Proofs",   href: "/proof" },
            ].map(link => (
              <Link key={link.href} href={link.href} style={{
                padding: "4px 10px",
                borderRadius: 6,
                fontFamily: "var(--font-mono)",
                fontSize: 11,
                textDecoration: "none",
                color: link.href === "/charts" ? "var(--accent-green)" : "var(--text-secondary)",
                background: link.href === "/charts" ? "rgba(0,208,151,0.08)" : "transparent",
                border: link.href === "/charts" ? "0.5px solid rgba(0,208,151,0.2)" : "0.5px solid transparent",
                transition: "all 0.15s",
              }}>
                {link.label}
              </Link>
            ))}
          </div>
        </div>

        {/* Center: Asset Name */}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 14, color: selectedAsset.color }}>{selectedAsset.icon}</span>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 13, color: "var(--text-primary)", fontWeight: 500 }}>
            {selectedAsset.label}
          </span>
          <span style={{
            fontSize: 10,
            fontFamily: "var(--font-mono)",
            color: "var(--text-tertiary)",
            background: "var(--bg-raised)",
            border: "0.5px solid var(--border-subtle)",
            borderRadius: 4,
            padding: "2px 6px",
          }}>{selectedAsset.type}</span>
        </div>

        {/* Right: Controls */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {/* Indicators toggle */}
          <button
            onClick={() => setShowIndicators(p => !p)}
            style={{
              background: showIndicators ? "rgba(0,208,151,0.1)" : "transparent",
              border: `0.5px solid ${showIndicators ? "rgba(0,208,151,0.3)" : "var(--border-dim)"}`,
              borderRadius: 6,
              padding: "4px 10px",
              cursor: "pointer",
              fontFamily: "var(--font-mono)",
              fontSize: 10,
              color: showIndicators ? "var(--accent-green)" : "var(--text-secondary)",
              transition: "all 0.15s",
            }}
          >
            {showIndicators ? "RSI+MACD ✓" : "RSI+MACD"}
          </button>

          {/* Compare mode toggle */}
          <button
            onClick={() => setCompareMode(p => !p)}
            style={{
              background: compareMode ? "rgba(139,92,246,0.1)" : "transparent",
              border: `0.5px solid ${compareMode ? "rgba(139,92,246,0.3)" : "var(--border-dim)"}`,
              borderRadius: 6,
              padding: "4px 10px",
              cursor: "pointer",
              fontFamily: "var(--font-mono)",
              fontSize: 10,
              color: compareMode ? "#8b5cf6" : "var(--text-secondary)",
              transition: "all 0.15s",
            }}
          >
            {compareMode ? "Compare ✓" : "Compare"}
          </button>

          {/* Live dot */}
          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <div style={{
              width: 6, height: 6, borderRadius: "50%",
              background: "var(--accent-green)",
              boxShadow: "0 0 6px var(--accent-green)",
              animation: "pulse 2s infinite",
            }} />
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-tertiary)" }}>LIVE</span>
          </div>
        </div>
      </nav>

      {/* ── Main Layout ── */}
      <div style={{ display: "flex", flex: 1, minHeight: 0, overflow: "hidden" }}>

        {/* Left Sidebar: Asset Tabs */}
        <div style={{
          width: 72,
          background: "var(--bg-surface)",
          borderRight: "0.5px solid var(--border-subtle)",
          display: "flex",
          flexDirection: "column",
          gap: 4,
          padding: "12px 6px",
          flexShrink: 0,
          overflowY: "auto",
        }}>
          {ASSETS.map(asset => (
            <button
              key={asset.key}
              onClick={() => setSelectedAsset(asset)}
              title={asset.name}
              style={{
                background: selectedAsset.key === asset.key
                  ? `rgba(${hexToRgb(asset.color)}, 0.12)`
                  : "transparent",
                border: `0.5px solid ${selectedAsset.key === asset.key ? asset.color : "var(--border-subtle)"}`,
                borderRadius: 8,
                padding: "10px 4px",
                cursor: "pointer",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 4,
                transition: "all 0.15s",
              }}
            >
              <span style={{ fontSize: 16, color: asset.color }}>{asset.icon}</span>
              <span style={{
                fontFamily: "var(--font-mono)",
                fontSize: 9,
                color: selectedAsset.key === asset.key ? asset.color : "var(--text-tertiary)",
                fontWeight: 600,
              }}>{asset.key}</span>
              <div style={{
                width: 24,
                height: 2,
                borderRadius: 1,
                background: selectedAsset.key === asset.key
                  ? asset.color
                  : "var(--border-dim)",
                transition: "background 0.15s",
              }} />
            </button>
          ))}

          {/* Separator */}
          <div style={{ height: "0.5px", background: "var(--border-subtle)", margin: "8px 0" }} />

          {/* Type legend */}
          <div style={{ padding: "4px 6px" }}>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 8, color: "var(--text-tertiary)", marginBottom: 6 }}>TYPE</div>
            {["xStock", "Yield", "Gas"].map(t => (
              <div key={t} style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 4 }}>
                <div style={{
                  width: 4, height: 4, borderRadius: "50%",
                  background: t === "xStock" ? "#8b5cf6" : t === "Yield" ? "#00d097" : "#06b6d4",
                }} />
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 8, color: "var(--text-tertiary)" }}>{t}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Center: Chart Area */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, overflow: "hidden" }}>

          {/* Timeframe Bar */}
          <div style={{
            display: "flex",
            alignItems: "center",
            gap: 4,
            padding: "8px 16px",
            borderBottom: "0.5px solid var(--border-subtle)",
            background: "var(--bg-surface)",
            flexShrink: 0,
          }}>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-tertiary)", marginRight: 8 }}>
              TIMEFRAME
            </span>
            {TIMEFRAMES.map(tf => (
              <button
                key={tf.value}
                onClick={() => setTimeframe(tf.value)}
                style={{
                  background: timeframe === tf.value ? "rgba(0,208,151,0.12)" : "transparent",
                  border: `0.5px solid ${timeframe === tf.value ? "rgba(0,208,151,0.3)" : "var(--border-dim)"}`,
                  borderRadius: 5,
                  padding: "3px 10px",
                  cursor: "pointer",
                  fontFamily: "var(--font-mono)",
                  fontSize: 11,
                  color: timeframe === tf.value ? "var(--accent-green)" : "var(--text-secondary)",
                  transition: "all 0.15s",
                }}
              >
                {tf.label}
              </button>
            ))}

            <div style={{ flex: 1 }} />

            {/* Asset info pill */}
            <div style={{
              fontFamily: "var(--font-mono)",
              fontSize: 10,
              color: "var(--text-tertiary)",
              background: "var(--bg-raised)",
              border: "0.5px solid var(--border-subtle)",
              borderRadius: 4,
              padding: "3px 8px",
            }}>
              {selectedAsset.tvSymbol}
            </div>

            <div style={{
              fontFamily: "var(--font-mono)",
              fontSize: 10,
              color: "var(--text-tertiary)",
              background: "var(--bg-raised)",
              border: "0.5px solid var(--border-subtle)",
              borderRadius: 4,
              padding: "3px 8px",
            }}>
              VIGIL 30m cycle
            </div>
          </div>

          {/* Main Chart */}
          <div style={{ flex: compareMode ? "0 0 60%" : 1, minHeight: 0, position: "relative" }}>
            <TradingViewWidget
              symbol={selectedAsset.tvSymbol}
              interval={timeframe}
              showIndicators={showIndicators}
            />
          </div>

          {/* Compare Panel: mini charts for all other assets */}
          {compareMode && (
            <div style={{
              flex: 1,
              minHeight: 0,
              display: "grid",
              gridTemplateColumns: "repeat(5, 1fr)",
              gap: 0,
              borderTop: "0.5px solid var(--border-subtle)",
              background: "var(--bg-surface)",
            }}>
              {ASSETS.filter(a => a.key !== selectedAsset.key).map(asset => (
                <div
                  key={asset.key}
                  onClick={() => setSelectedAsset(asset)}
                  style={{
                    borderRight: "0.5px solid var(--border-subtle)",
                    cursor: "pointer",
                    display: "flex",
                    flexDirection: "column",
                    overflow: "hidden",
                  }}
                >
                  <div style={{
                    padding: "6px 10px",
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    borderBottom: "0.5px solid var(--border-subtle)",
                    background: "var(--bg-raised)",
                  }}>
                    <span style={{ color: asset.color, fontSize: 12 }}>{asset.icon}</span>
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-secondary)" }}>
                      {asset.label}
                    </span>
                  </div>
                  <div style={{ flex: 1, minHeight: 0 }}>
                    <MiniChart tvSymbol={asset.tvSymbol} color={asset.color} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right Sidebar: Signal Info */}
        <div style={{
          width: 220,
          background: "var(--bg-surface)",
          borderLeft: "0.5px solid var(--border-subtle)",
          display: "flex",
          flexDirection: "column",
          flexShrink: 0,
          overflowY: "auto",
        }}>
          {/* Asset Header */}
          <div style={{
            padding: "16px",
            borderBottom: "0.5px solid var(--border-subtle)",
            background: `rgba(${hexToRgb(selectedAsset.color)}, 0.04)`,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
              <div style={{
                width: 36, height: 36,
                borderRadius: 10,
                background: `rgba(${hexToRgb(selectedAsset.color)}, 0.15)`,
                border: `0.5px solid ${selectedAsset.color}44`,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 18, color: selectedAsset.color,
              }}>{selectedAsset.icon}</div>
              <div>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>
                  {selectedAsset.label}
                </div>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-tertiary)" }}>
                  {selectedAsset.name}
                </div>
              </div>
            </div>

            <div style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 6,
            }}>
              {[
                { label: "TYPE",   value: selectedAsset.type },
                { label: "CHART",  value: selectedAsset.tvSymbol.split(":")[0] },
                { label: "CYCLE",  value: "30 min" },
                { label: "STATUS", value: "LIVE" },
              ].map(item => (
                <div key={item.label} style={{
                  background: "var(--bg-raised)",
                  border: "0.5px solid var(--border-subtle)",
                  borderRadius: 6,
                  padding: "6px 8px",
                }}>
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: 8, color: "var(--text-tertiary)", marginBottom: 2 }}>
                    {item.label}
                  </div>
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: item.label === "STATUS" ? "var(--accent-green)" : "var(--text-secondary)" }}>
                    {item.value}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Signal Weights */}
          <div style={{ padding: "16px", borderBottom: "0.5px solid var(--border-subtle)" }}>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--text-tertiary)", letterSpacing: "0.08em", marginBottom: 12 }}>
              SIGNAL WEIGHTS
            </div>
            {[
              { label: "Pyth Oracle",   pct: 35, color: "#00d097" },
              { label: "Nansen Smart $", pct: 40, color: "#8b5cf6" },
              { label: "Elfa Sentiment", pct: 25, color: "#f59e0b" },
            ].map(sig => (
              <div key={sig.label} style={{ marginBottom: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-secondary)" }}>{sig.label}</span>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: sig.color }}>{sig.pct}%</span>
                </div>
                <div style={{ height: 3, background: "rgba(255,255,255,0.06)", borderRadius: 2 }}>
                  <div style={{
                    height: "100%",
                    width: `${sig.pct}%`,
                    background: sig.color,
                    borderRadius: 2,
                    boxShadow: `0 0 6px ${sig.color}66`,
                  }} />
                </div>
              </div>
            ))}
          </div>

          {/* Thresholds */}
          <div style={{ padding: "16px", borderBottom: "0.5px solid var(--border-subtle)" }}>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--text-tertiary)", letterSpacing: "0.08em", marginBottom: 12 }}>
              TRADE THRESHOLDS
            </div>
            {[
              { label: selectedAsset.type === "xStock" ? "xStock Min" : "Yield Min", value: selectedAsset.type === "xStock" ? "45%" : "30%", color: "#f59e0b" },
              { label: "Slippage Cap", value: "0.40%", color: "#ef4444" },
              { label: "Gas Reserve",  value: "10 MNT", color: "#06b6d4" },
            ].map(t => (
              <div key={t.label} style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 8,
                padding: "6px 8px",
                background: "var(--bg-raised)",
                border: "0.5px solid var(--border-subtle)",
                borderRadius: 6,
              }}>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-secondary)" }}>{t.label}</span>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: t.color, fontWeight: 600 }}>{t.value}</span>
              </div>
            ))}
          </div>

          {/* Quick nav to all assets */}
          <div style={{ padding: "16px" }}>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--text-tertiary)", letterSpacing: "0.08em", marginBottom: 10 }}>
              ALL ASSETS
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {ASSETS.map(asset => (
                <button
                  key={asset.key}
                  onClick={() => setSelectedAsset(asset)}
                  style={{
                    background: selectedAsset.key === asset.key
                      ? `rgba(${hexToRgb(asset.color)}, 0.1)`
                      : "transparent",
                    border: `0.5px solid ${selectedAsset.key === asset.key ? asset.color + "55" : "var(--border-subtle)"}`,
                    borderRadius: 6,
                    padding: "6px 10px",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    transition: "all 0.15s",
                    textAlign: "left",
                  }}
                >
                  <span style={{ color: asset.color, fontSize: 12, width: 16 }}>{asset.icon}</span>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: selectedAsset.key === asset.key ? asset.color : "var(--text-secondary)", flex: 1 }}>
                    {asset.label}
                  </span>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--text-tertiary)" }}>
                    {asset.tvSymbol.split(":")[1]}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Status Footer ── */}
      <div style={{
        height: 28,
        background: "var(--bg-surface)",
        borderTop: "0.5px solid var(--border-subtle)",
        display: "flex",
        alignItems: "center",
        padding: "0 20px",
        gap: 24,
        flexShrink: 0,
      }}>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--text-tertiary)" }}>
          VIGIL Charts · TradingView Data
        </span>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--text-tertiary)" }}>
          Powered by: Pyth Network · Nansen · Elfa AI
        </span>
        <div style={{ flex: 1 }} />
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--accent-green)" }}>
          ● Agent Active · 30m cycle
        </span>
        <Link href="/warroom" style={{
          fontFamily: "var(--font-mono)",
          fontSize: 9,
          color: "var(--text-tertiary)",
          textDecoration: "none",
          padding: "2px 8px",
          border: "0.5px solid var(--border-dim)",
          borderRadius: 4,
          transition: "color 0.15s",
        }}>
          → War Room
        </Link>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
        a:hover { color: var(--accent-green) !important; }
        button:hover { opacity: 0.85; }
      `}</style>
    </div>
  );
}

// ─── Helper ───────────────────────────────────────────────────────────────────
function hexToRgb(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `${r},${g},${b}`;
}
