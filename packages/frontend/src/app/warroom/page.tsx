"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { getWebSocket } from "@/lib/ws";
import Link from "next/link";

// ─── Types ────────────────────────────────────────────────────────────────────
interface LedgerEntry {
  entry_id: number; agent_id: number; entry_type: number;
  from_token?: string; to_token?: string; amount?: string;
  confidence: number; slippage_bps?: number; tx_hash?: string;
  zk_proof_hash?: string; skip_reason?: string; reasoning?: string;
  block_timestamp: number;
}
interface AgentStats {
  agent_id?: number | null; reputation_score: number;
  total_decisions: number; total_executed: number; total_skipped: number;
  gas_reservoir_mnt: number; vault_address?: string; error?: string;
}
interface AllocationEntry { symbol: string; address: string; bps: number; pct: string; color: string; }
interface AllocationData { allocations: AllocationEntry[]; total_value_usd: number; error?: string; }

const ENTRY_TYPE_LABELS = ["SKIP", "EXECUTE", "CROSS-CHAIN", "CLMM"];

// ─── Node Positions (initial layout) ──────────────────────────────────────────
type NodePos = { x: number; y: number };
const INITIAL_POSITIONS: Record<string, NodePos> = {
  trigger:   { x: 380, y: 60  },
  pyth:      { x: 60,  y: 230 },
  nansen:    { x: 290, y: 230 },
  elfa:      { x: 520, y: 230 },
  onchain:   { x: 750, y: 230 },
  engine:    { x: 300, y: 410 },
  guardrail: { x: 300, y: 550 },
  decision:  { x: 300, y: 695 },
  ipfs:      { x: 100, y: 860 },
  ledger:    { x: 310, y: 860 },
  byreal:    { x: 520, y: 860 },
};

const NODE_SIZES: Record<string, { w: number; h: number }> = {
  trigger:   { w: 190, h: 110 },
  pyth:      { w: 168, h: 100 },
  nansen:    { w: 168, h: 90  },
  elfa:      { w: 168, h: 100 },
  onchain:   { w: 168, h: 90  },
  engine:    { w: 330, h: 100 },
  guardrail: { w: 330, h: 100 },
  decision:  { w: 330, h: 100 },
  ipfs:      { w: 168, h: 80  },
  ledger:    { w: 168, h: 80  },
  byreal:    { w: 168, h: 80  },
};

type NodeStatus = "idle" | "running" | "done" | "error" | "skip";

// ─── Animated Edge ─────────────────────────────────────────────────────────────
function FlowEdge({
  x1, y1, x2, y2, animated, color = "#00d097", label,
}: { x1: number; y1: number; x2: number; y2: number; animated: boolean; color?: string; label?: string }) {
  const mx = (x1 + x2) / 2;
  const d = `M ${x1} ${y1} C ${x1} ${mx}, ${x2} ${mx}, ${x2} ${y2}`;
  const lx = (x1 + x2) / 2;
  const ly = (y1 + y2) / 2;

  return (
    <g>
      {/* base track */}
      <path d={d} fill="none" stroke={color} strokeWidth={1.5} strokeOpacity={0.15} />
      {/* animated flow */}
      {animated && (
        <path d={d} fill="none" stroke={color} strokeWidth={2} strokeOpacity={0.85}
          strokeDasharray="6 18" strokeLinecap="round">
          <animate attributeName="stroke-dashoffset" from="0" to="-24" dur="0.8s" repeatCount="indefinite" />
        </path>
      )}
      {/* arrowhead */}
      <polygon
        points={`${x2},${y2} ${x2 - 5},${y2 - 9} ${x2 + 5},${y2 - 9}`}
        fill={color} opacity={animated ? 0.8 : 0.3}
      />
      {/* label */}
      {label && (
        <text x={lx} y={ly - 5} textAnchor="middle" fill={color}
          fontSize={8} fontFamily="monospace" opacity={0.6}>{label}</text>
      )}
    </g>
  );
}

// ─── Node Card ─────────────────────────────────────────────────────────────────
function NodeCard({
  nodeId, pos, size, label, sublabel, icon, color, status, data,
  selected, onMouseDown,
}: {
  nodeId: string; pos: NodePos; size: { w: number; h: number };
  label: string; sublabel?: string; icon: string; color: string;
  status: NodeStatus; data?: Record<string, string | number>;
  selected: boolean; onMouseDown: (e: React.MouseEvent) => void;
}) {
  const sc = status === "running" ? "#f59e0b"
           : status === "done"    ? "#00d097"
           : status === "skip"    ? "#6b7280"
           : status === "error"   ? "#ef4444"
           : "rgba(255,255,255,0.12)";
  const isRunning = status === "running";
  const r = hexToRgb(color);

  return (
    <div
      onMouseDown={onMouseDown}
      style={{
        position: "absolute",
        left: pos.x,
        top: pos.y,
        width: size.w,
        background: selected ? `rgba(${r},0.09)` : "rgba(13,14,17,0.97)",
        border: `1px solid ${selected ? color : "rgba(255,255,255,0.08)"}`,
        borderRadius: 12,
        cursor: "grab",
        boxShadow: selected
          ? `0 0 0 1px ${color}33, 0 8px 32px rgba(0,0,0,0.5)`
          : "0 4px 20px rgba(0,0,0,0.4)",
        transition: "border-color 0.15s, box-shadow 0.15s",
        userSelect: "none",
        touchAction: "none",
      }}
    >
      {/* Top accent + running bar */}
      <div style={{ height: 2, borderRadius: "12px 12px 0 0", background: color, opacity: status === "idle" ? 0.2 : 1, overflow: "hidden" }}>
        {isRunning && (
          <div style={{ height: "100%", width: "35%", background: "rgba(255,255,255,0.6)", animation: "slideBar 1.3s ease-in-out infinite" }} />
        )}
      </div>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 12px 6px" }}>
        <div style={{
          width: 28, height: 28, borderRadius: 8, flexShrink: 0,
          background: `rgba(${r},0.12)`, border: `0.5px solid ${color}44`,
          display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14,
        }}>{icon}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: "monospace", fontSize: 10, fontWeight: 700, color: "#e4e4e7", textTransform: "uppercase", letterSpacing: "0.07em", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {label}
          </div>
          {sublabel && <div style={{ fontFamily: "monospace", fontSize: 8.5, color: "rgba(255,255,255,0.28)", marginTop: 1 }}>{sublabel}</div>}
        </div>
        <div style={{ width: 7, height: 7, borderRadius: "50%", background: sc, flexShrink: 0, boxShadow: isRunning ? `0 0 7px ${sc}` : "none", animation: isRunning ? "pulse 1s infinite" : "none" }} />
      </div>

      {/* Data */}
      {data && Object.keys(data).length > 0 && (
        <div style={{ padding: "2px 12px 10px" }}>
          <div style={{ height: "0.5px", background: "rgba(255,255,255,0.05)", marginBottom: 6 }} />
          {Object.entries(data).map(([k, v]) => (
            <div key={k} style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
              <span style={{ fontFamily: "monospace", fontSize: 9, color: "rgba(255,255,255,0.3)" }}>{k}</span>
              <span style={{ fontFamily: "monospace", fontSize: 9.5, color: color, fontWeight: 600 }}>{v}</span>
            </div>
          ))}
        </div>
      )}

      {/* Port dots */}
      <div style={{ position: "absolute", top: -5, left: "50%", transform: "translateX(-50%)", width: 10, height: 10, borderRadius: "50%", background: "#0d0e11", border: `1.5px solid ${color}55` }} />
      <div style={{ position: "absolute", bottom: -5, left: "50%", transform: "translateX(-50%)", width: 10, height: 10, borderRadius: "50%", background: "#0d0e11", border: `1.5px solid ${color}55` }} />
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function WarRoomPage() {
  const [entries, setEntries] = useState<LedgerEntry[]>([]);
  const [agentStats, setAgentStats] = useState<AgentStats>({ reputation_score: 0, total_decisions: 0, total_executed: 0, total_skipped: 0, gas_reservoir_mnt: 0 });
  const [allocation, setAllocation] = useState<AllocationData>({ allocations: [], total_value_usd: 0 });
  const [wsConnected, setWsConnected] = useState(false);
  const [confidence, setConfidence] = useState(0);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(1800);
  const [activeStage, setActiveStage] = useState(0);
  const [livePrices, setLivePrices] = useState<Record<string,{price:number;change:number}>>({});

  // Canvas pan/zoom
  const [pan, setPan] = useState({ x: 60, y: 40 });
  const [zoom, setZoom] = useState(0.85);
  const canvasPanning = useRef(false);
  const panStart = useRef({ x: 0, y: 0 });

  // Individual node positions (draggable)
  const [nodePositions, setNodePositions] = useState<Record<string, NodePos>>({ ...INITIAL_POSITIONS });
  const draggingNode = useRef<string | null>(null);
  const dragStart = useRef({ mouseX: 0, mouseY: 0, nodeX: 0, nodeY: 0 });

  const canvasRef = useRef<HTMLDivElement>(null);
  const lastEntry = entries[0];

  // ── Node drag ────────────────────────────────────────────────────────────────
  const startNodeDrag = (nodeId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    draggingNode.current = nodeId;
    setSelectedNode(nodeId);
    const pos = nodePositions[nodeId];
    dragStart.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      nodeX: pos.x,
      nodeY: pos.y,
    };
    window.addEventListener("mousemove", handleGlobalMouseMove);
    window.addEventListener("mouseup", handleGlobalMouseUp);
  };

  const handleGlobalMouseMove = useCallback((e: MouseEvent) => {
    if (draggingNode.current) {
      const dx = (e.clientX - dragStart.current.mouseX) / zoom;
      const dy = (e.clientY - dragStart.current.mouseY) / zoom;
      setNodePositions(prev => ({
        ...prev,
        [draggingNode.current!]: {
          x: dragStart.current.nodeX + dx,
          y: dragStart.current.nodeY + dy,
        },
      }));
    } else if (canvasPanning.current) {
      setPan({
        x: e.clientX - panStart.current.x,
        y: e.clientY - panStart.current.y,
      });
    }
  }, [zoom]);

  const handleGlobalMouseUp = useCallback(() => {
    draggingNode.current = null;
    canvasPanning.current = false;
    window.removeEventListener("mousemove", handleGlobalMouseMove);
    window.removeEventListener("mouseup", handleGlobalMouseUp);
  }, [handleGlobalMouseMove]);

  // ── Canvas pan ───────────────────────────────────────────────────────────────
  const handleCanvasMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest("[data-node]")) return;
    setSelectedNode(null);
    canvasPanning.current = true;
    panStart.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
    window.addEventListener("mousemove", handleGlobalMouseMove);
    window.addEventListener("mouseup", handleGlobalMouseUp);
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.08 : 0.08;
    setZoom(z => Math.max(0.3, Math.min(2.5, z + delta)));
  };

  // ── Pipeline animation ───────────────────────────────────────────────────────
  useEffect(() => {
    const t = setInterval(() => setActiveStage(s => (s + 1) % 5), 7000);
    return () => clearInterval(t);
  }, []);

  // ── Countdown ────────────────────────────────────────────────────────────────
  useEffect(() => {
    const updateCountdown = () => {
      const secondsLeft = 1800 - (Math.floor(Date.now() / 1000) % 1800);
      setCountdown(secondsLeft);
    };
    updateCountdown();
    const t = setInterval(updateCountdown, 1000);
    return () => clearInterval(t);
  }, []);

  // ── Data fetch ────────────────────────────────────────────────────────────────
  const fetchLiveData = useCallback(async () => {
    const [sRes, aRes] = await Promise.allSettled([
      fetch("/api/agent").then(r => r.json()),
      fetch("/api/allocation").then(r => r.json()),
    ]);
    if (sRes.status === "fulfilled" && !sRes.value.error) setAgentStats(sRes.value);
    if (aRes.status === "fulfilled" && !aRes.value.error) setAllocation(aRes.value);
  }, []);

  useEffect(() => { fetchLiveData(); const i = setInterval(fetchLiveData, 60_000); return () => clearInterval(i); }, [fetchLiveData]);

  // ── Live Pyth prices (30s refresh) ────────────────────────────────────────────
  useEffect(() => {
    const fetchPrices = async () => {
      try {
        const FEEDS = [
          { sym: "ETH",  id: "0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace" },
          { sym: "NVDA", id: "0x67aed5a24fdad045475e7195c98a98aea119c763f272d4523f5bac93a4f33c2b" },
          { sym: "AAPL", id: "0x49f6b65cb1de6b10eaf75e7c03ca029c306d0357e91b5311b175084a5ad55688" },
          { sym: "TSLA", id: "0x16dad506d7db8da01c87581c87ca897a012a153557d4d578c3b9c9e1bc0632f1" },
          { sym: "MNT",  id: "0x4e3037c822d852d79af3ac80e35eb420ee3b37bf4a1efa8b4c4c4c47e8c9fdab" },
        ];
        const ids = FEEDS.map(f => `ids[]=${f.id}`).join("&");
        const r = await fetch(`https://hermes.pyth.network/v2/updates/price/latest?${ids}&parsed=true`, { signal: AbortSignal.timeout(8000) });
        if (!r.ok) return;
        const data = await r.json();
        const prices: Record<string,{price:number;change:number}> = {};
        for (const p of (data.parsed || [])) {
          const feed = FEEDS.find(f => f.id.toLowerCase() === "0x" + p.id.toLowerCase());
          if (!feed) continue;
          const price = parseFloat(p.price.price) * Math.pow(10, p.price.expo);
          const emaPrice = parseFloat(p.ema_price.price) * Math.pow(10, p.ema_price.expo);
          prices[feed.sym] = { price, change: ((price - emaPrice) / emaPrice) * 100 };
        }
        setLivePrices(prices);
      } catch { /* silently ignore — prices are supplemental */ }
    };
    fetchPrices();
    const t = setInterval(fetchPrices, 30_000);
    return () => clearInterval(t);
  }, []);

  // ── WebSocket ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    const ws = getWebSocket(); ws.connect();
    const u1 = ws.on("INITIAL_STATE", (msg) => {
      if (msg.entries) { const e = msg.entries as LedgerEntry[]; setEntries(e); if (e.length > 0) setConfidence((e[0].confidence / 10000) * 100); }
      if (msg.agentStats) setAgentStats(p => ({ ...p, ...msg.agentStats }));
      setWsConnected(true);
    });
    const u2 = ws.on("LEDGER_ENTRY", (msg) => { const e = msg as unknown as LedgerEntry; setEntries(p => [e, ...p.slice(0, 99)]); setConfidence((e.confidence / 10000) * 100); setActiveStage(4); });
    const u3 = ws.on("AGENT_STATS", (msg) => { if (msg.stats) setAgentStats(p => ({ ...p, ...msg.stats })); });
    const u4 = ws.on("HEARTBEAT", () => setWsConnected(true));
    return () => { u1(); u2(); u3(); u4(); };
  }, []);

  // ── Status helpers ────────────────────────────────────────────────────────────
  const isRecent = lastEntry ? (Date.now() / 1000 - lastEntry.block_timestamp) < 35 * 60 : false;
  const stageStatus = (idx: number): NodeStatus => {
    if (!isRecent && idx === 0) return "running";
    if (!isRecent) return "idle";
    return idx <= activeStage ? "done" : idx === activeStage + 1 ? "running" : "idle";
  };

  // ── Node definitions ─────────────────────────────────────────────────────────
  type NodeDef = {
    id: string; label: string; sublabel?: string; icon: string; color: string;
    status: NodeStatus; data?: Record<string, string | number>;
  };

  const nodeDefs: NodeDef[] = [
    {
      id: "trigger", icon: "⬡", color: "#00d097", status: "running",
      label: "VIGIL Agent", sublabel: `#${agentStats.agent_id || "spawning..."} · Mantle Sepolia`,
      data: { Decisions: agentStats.total_decisions ?? 0, Executed: agentStats.total_executed ?? 0, Gas: `${(agentStats.gas_reservoir_mnt || 0).toFixed(1)} MNT` },
    },
    { id: "pyth",    icon: "◎", color: "#06b6d4", status: stageStatus(0), label: "Pyth Oracle",  sublabel: "Price feeds · Hermes",    data: { ETH: "$1,865", NVDA: "$222", MNT: "$0.61" } },
    { id: "nansen",  icon: "◈", color: "#8b5cf6", status: stageStatus(0), label: "Nansen",       sublabel: "Smart money flows",        data: { Flows: "Live", Weight: "40%" } },
    { id: "elfa",    icon: "◉", color: "#f59e0b", status: stageStatus(0), label: "Elfa AI",      sublabel: "Social sentiment",         data: { NVDA: "Bullish ↑", Window: "4h", Weight: "25%" } },
    { id: "onchain", icon: "⟠", color: "#00d097", status: stageStatus(0), label: "On-Chain",     sublabel: "ERC-20 transfers",         data: { Chain: "Mantle", Weight: "35%" } },
    {
      id: "engine", icon: "⚙", color: "#a78bfa", status: stageStatus(1),
      label: "Scoring Engine", sublabel: "Composite signal → confidence",
      data: { mETH: "49.1", USDY: "51.0", NVDAx: "53.8", Best: "NVDAx" },
    },
    {
      id: "guardrail", icon: "🛡", color: "#f59e0b", status: stageStatus(2),
      label: "Guardrail Check", sublabel: "VIGILVault.validateDecision()",
      data: { Confidence: `${confidence.toFixed(1)}%`, Threshold: "45%", SlippageCap: "0.40%", ZKProof: lastEntry?.zk_proof_hash ? "✓" : "Pending" },
    },
    {
      id: "decision", icon: lastEntry?.entry_type === 0 ? "⊘" : lastEntry ? "✓" : "◷",
      color: lastEntry?.entry_type === 0 ? "#ef4444" : lastEntry ? "#00d097" : "#6b7280",
      status: lastEntry ? (lastEntry.entry_type === 0 ? "skip" : "done") : "idle",
      label: lastEntry?.entry_type === 0 ? "SKIP" : lastEntry ? "EXECUTE" : "Awaiting",
      sublabel: lastEntry?.skip_reason || lastEntry?.reasoning || "Next cycle in ~30 min",
      data: lastEntry ? { Type: ENTRY_TYPE_LABELS[lastEntry.entry_type], Conf: `${(lastEntry.confidence / 10000 * 100).toFixed(1)}%`, Time: new Date(lastEntry.block_timestamp * 1000).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }) } : { Status: "Watching..." },
    },
    { id: "ipfs",   icon: "📌", color: "#06b6d4", status: lastEntry ? "done" : "idle", label: "IPFS",         sublabel: "Proof pinned · Pinata",    data: { CID: lastEntry?.zk_proof_hash ? `${lastEntry.zk_proof_hash.slice(0, 8)}...` : "–" } },
    { id: "ledger", icon: "📒", color: "#8b5cf6", status: lastEntry ? "done" : "idle", label: "VIGILLedger",  sublabel: "On-chain record",           data: { Entry: lastEntry ? `#${lastEntry.entry_id}` : "–" } },
    { id: "byreal", icon: "💧", color: "#00d097", status: lastEntry?.entry_type === 3 ? "done" : "idle", label: "Byreal CLMM", sublabel: "Solana liquidity", data: { Pool: "PENGUIN/USDC", APR: "90%+" } },
  ];

  // ── Edge definitions ──────────────────────────────────────────────────────────
  const edgeDefs = [
    { from: "trigger", to: "pyth",      color: "#00d097", animated: true },
    { from: "trigger", to: "nansen",    color: "#00d097", animated: true },
    { from: "trigger", to: "elfa",      color: "#00d097", animated: true },
    { from: "trigger", to: "onchain",   color: "#00d097", animated: true },
    { from: "pyth",    to: "engine",    color: "#06b6d4", animated: activeStage >= 1, label: "price" },
    { from: "nansen",  to: "engine",    color: "#8b5cf6", animated: activeStage >= 1, label: "flows" },
    { from: "elfa",    to: "engine",    color: "#f59e0b", animated: activeStage >= 1, label: "sentiment" },
    { from: "onchain", to: "engine",    color: "#00d097", animated: activeStage >= 1, label: "xfer" },
    { from: "engine",    to: "guardrail", color: "#a78bfa", animated: activeStage >= 2, label: "score" },
    { from: "guardrail", to: "decision",  color: "#f59e0b", animated: activeStage >= 3, label: "validated" },
    { from: "decision",  to: "ipfs",      color: "#06b6d4", animated: !!lastEntry },
    { from: "decision",  to: "ledger",    color: "#8b5cf6", animated: !!lastEntry },
    { from: "decision",  to: "byreal",    color: "#00d097", animated: !!lastEntry && lastEntry.entry_type === 3 },
  ];

  // Port center helpers
  const portBottom = (id: string) => {
    const p = nodePositions[id] || { x: 0, y: 0 };
    const s = NODE_SIZES[id] || { w: 168, h: 90 };
    return { x: p.x + s.w / 2, y: p.y + s.h };
  };
  const portTop = (id: string) => {
    const p = nodePositions[id] || { x: 0, y: 0 };
    const s = NODE_SIZES[id] || { w: 168, h: 90 };
    return { x: p.x + s.w / 2, y: p.y };
  };

  const selectedDef = nodeDefs.find(n => n.id === selectedNode);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", background: "#09090b", color: "#e4e4e7", overflow: "hidden" }}>
      <style>{`
        @keyframes pulse   { 0%,100%{opacity:1} 50%{opacity:0.25} }
        @keyframes slideBar{ 0%{transform:translateX(-100%)} 100%{transform:translateX(400%)} }
        @keyframes fadeIn  { from{opacity:0;transform:translateY(5px)} to{opacity:1;transform:translateY(0)} }
      `}</style>

      {/* ── Nav ── */}
      <div style={{ height: 48, display: "flex", alignItems: "center", padding: "0 16px", gap: 12, borderBottom: "0.5px solid rgba(255,255,255,0.07)", background: "rgba(9,9,11,0.98)", flexShrink: 0, zIndex: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 28, height: 28, borderRadius: 8, background: "rgba(0,208,151,0.12)", border: "0.5px solid rgba(0,208,151,0.3)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 }}>⬡</div>
          <span style={{ fontFamily: "monospace", fontSize: 13, fontWeight: 700, color: "#00d097", letterSpacing: "0.1em" }}>VIGIL</span>
          <span style={{ fontFamily: "monospace", fontSize: 10, color: "rgba(255,255,255,0.2)" }}>|</span>
          <span style={{ fontFamily: "monospace", fontSize: 10, color: "rgba(255,255,255,0.3)" }}>Agent Flow · Mantle Sepolia</span>
        </div>

        <div style={{ display: "flex", gap: 2, marginLeft: 8 }}>
          {[{ label: "Home", href: "/" }, { label: "War Room", href: "/warroom" }, { label: "Charts", href: "/charts" }, { label: "Proofs", href: "/proof" }].map(l => (
            <Link key={l.href} href={l.href} style={{ padding: "3px 10px", borderRadius: 5, fontFamily: "monospace", fontSize: 10, textDecoration: "none", color: l.href === "/warroom" ? "#00d097" : "rgba(255,255,255,0.35)", background: l.href === "/warroom" ? "rgba(0,208,151,0.08)" : "transparent", border: l.href === "/warroom" ? "0.5px solid rgba(0,208,151,0.2)" : "0.5px solid transparent" }}>{l.label}</Link>
          ))}
        </div>

        <div style={{ flex: 1 }} />

        {/* Countdown */}
        <div style={{ fontFamily: "monospace", fontSize: 10, color: "rgba(255,255,255,0.3)", background: "rgba(255,255,255,0.04)", border: "0.5px solid rgba(255,255,255,0.08)", borderRadius: 6, padding: "3px 10px" }}>
          Next cycle {String(Math.floor(countdown / 60)).padStart(2,"0")}:{String(countdown % 60).padStart(2,"0")}
        </div>

        {/* Zoom */}
        <div style={{ display: "flex", gap: 2 }}>
          {[["−", () => setZoom(z => Math.max(0.3, z - 0.12))], ["⊡", () => { setZoom(0.85); setPan({ x: 60, y: 40 }); }], ["+", () => setZoom(z => Math.min(2.5, z + 0.12))]].map(([l, fn]) => (
            <button key={l as string} onClick={fn as () => void} style={{ width: 28, height: 28, background: "rgba(255,255,255,0.04)", border: "0.5px solid rgba(255,255,255,0.1)", borderRadius: 6, color: "rgba(255,255,255,0.5)", cursor: "pointer", fontFamily: "monospace", fontSize: 13, display: "flex", alignItems: "center", justifyContent: "center" }}>{l as string}</button>
          ))}
        </div>

        {/* Live */}
        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <div style={{ width: 6, height: 6, borderRadius: "50%", background: wsConnected ? "#00d097" : "#ef4444", boxShadow: `0 0 6px ${wsConnected ? "#00d097" : "#ef4444"}`, animation: "pulse 2s infinite" }} />
          <span style={{ fontFamily: "monospace", fontSize: 10, color: wsConnected ? "#00d097" : "#ef4444" }}>{wsConnected ? "LIVE" : "CONNECTING"}</span>
        </div>

        <Link href="/dashboard" style={{ display: "flex", alignItems: "center", gap: 5, padding: "4px 12px", borderRadius: 6, border: "0.5px solid rgba(139,92,246,0.4)", background: "rgba(139,92,246,0.08)", color: "#a78bfa", fontFamily: "monospace", fontSize: 10, textDecoration: "none" }}>✦ 3D Dashboard</Link>
      </div>

      {/* Indexer Offline Banner */}
      {!wsConnected && (
        <div style={{
          background: "rgba(239, 68, 68, 0.15)",
          borderBottom: "1.5px solid rgba(239, 68, 68, 0.3)",
          color: "#f87171",
          fontFamily: "monospace",
          fontSize: "11px",
          textAlign: "center",
          padding: "8px 16px",
          zIndex: 100,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "8px",
          animation: "fadeIn 0.25s ease",
        }}>
          <span>⚠ WARNING: VIGIL Indexer Daemon is offline. War Room real-time updates are suspended. Run <code style={{background:"rgba(0,0,0,0.3)", padding:"2px 6px", borderRadius:4, border:"0.5px solid rgba(239, 68, 68, 0.4)"}}>pm2 start ecosystem.config.js</code> or check system status.</span>
        </div>
      )}

      {/* ── Canvas + Panel ── */}
      <div style={{ flex: 1, display: "flex", minHeight: 0, overflow: "hidden" }}>

        {/* Infinite Canvas */}
        <div
          ref={canvasRef}
          onMouseDown={handleCanvasMouseDown}
          onWheel={handleWheel}
          style={{ flex: 1, position: "relative", overflow: "hidden", cursor: "default", background: "#09090b" }}
        >
          {/* Dot grid — infinite, not clipped */}
          <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }}>
            <defs>
              <pattern id="dots" x={pan.x % (24 * zoom)} y={pan.y % (24 * zoom)} width={24 * zoom} height={24 * zoom} patternUnits="userSpaceOnUse">
                <circle cx={0.5 * zoom} cy={0.5 * zoom} r={0.7 * zoom} fill="rgba(255,255,255,0.07)" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#dots)" />
          </svg>

          {/* Transform group — NO fixed width/height = no white boundary */}
          <div style={{ position: "absolute", top: 0, left: 0, transform: `translate(${pan.x}px,${pan.y}px) scale(${zoom})`, transformOrigin: "0 0" }}>

            {/* SVG edges — also unbounded */}
            <svg style={{ position: "absolute", top: 0, left: 0, width: "4000px", height: "3000px", pointerEvents: "none", overflow: "visible" }}>
              {edgeDefs.map((e, i) => {
                const from = portBottom(e.from);
                const to   = portTop(e.to);
                return <FlowEdge key={i} x1={from.x} y1={from.y} x2={to.x} y2={to.y} animated={e.animated} color={e.color} label={e.label} />;
              })}
            </svg>

            {/* Nodes — individually draggable */}
            {nodeDefs.map(nd => (
              <div key={nd.id} data-node="true">
                <NodeCard
                  nodeId={nd.id}
                  pos={nodePositions[nd.id] || { x: 0, y: 0 }}
                  size={NODE_SIZES[nd.id] || { w: 168, h: 90 }}
                  label={nd.label}
                  sublabel={nd.sublabel}
                  icon={nd.icon}
                  color={nd.color}
                  status={nd.status}
                  data={nd.data}
                  selected={selectedNode === nd.id}
                  onMouseDown={(e) => startNodeDrag(nd.id, e)}
                />
              </div>
            ))}
          </div>

          {/* Minimap */}
          <div style={{ position: "absolute", bottom: 16, right: 16, width: 140, height: 96, background: "rgba(9,9,11,0.92)", border: "0.5px solid rgba(255,255,255,0.1)", borderRadius: 8, overflow: "hidden" }}>
            <div style={{ fontFamily: "monospace", fontSize: 8, color: "rgba(255,255,255,0.25)", padding: "4px 6px 2px" }}>MINIMAP</div>
            <svg style={{ width: "100%", height: 76 }} viewBox="0 0 1000 900">
              {nodeDefs.map(nd => {
                const p = nodePositions[nd.id] || { x: 0, y: 0 };
                const s = NODE_SIZES[nd.id] || { w: 168, h: 90 };
                return <rect key={nd.id} x={p.x} y={p.y} width={s.w} height={s.h} rx={4} fill={nd.color} opacity={0.3} />;
              })}
            </svg>
          </div>

          {/* Zoom % */}
          <div style={{ position: "absolute", bottom: 16, left: 16, fontFamily: "monospace", fontSize: 9, color: "rgba(255,255,255,0.2)", background: "rgba(0,0,0,0.5)", border: "0.5px solid rgba(255,255,255,0.07)", borderRadius: 4, padding: "2px 7px" }}>
            {Math.round(zoom * 100)}% · Drag nodes to rearrange · Scroll to zoom
          </div>
        </div>

        {/* ── Right Panel ── */}
        <div style={{ width: 248, background: "rgba(11,12,14,0.98)", borderLeft: "0.5px solid rgba(255,255,255,0.07)", display: "flex", flexDirection: "column", flexShrink: 0, overflowY: "auto" }}>
          {selectedDef ? (
            <div style={{ animation: "fadeIn 0.18s ease" }}>
              <div style={{ padding: 14, borderBottom: "0.5px solid rgba(255,255,255,0.06)", background: `rgba(${hexToRgb(selectedDef.color)},0.04)` }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                  <div style={{ width: 34, height: 34, borderRadius: 9, background: `rgba(${hexToRgb(selectedDef.color)},0.12)`, border: `0.5px solid ${selectedDef.color}44`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 17 }}>{selectedDef.icon}</div>
                  <div>
                    <div style={{ fontFamily: "monospace", fontSize: 11, fontWeight: 700, color: "#e4e4e7", textTransform: "uppercase", letterSpacing: "0.07em" }}>{selectedDef.label}</div>
                    <div style={{ fontFamily: "monospace", fontSize: 8.5, color: "rgba(255,255,255,0.28)", marginTop: 1 }}>{selectedDef.sublabel}</div>
                  </div>
                </div>
                <div style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "2px 8px", borderRadius: 4, background: `rgba(${hexToRgb(selectedDef.color)},0.1)`, border: `0.5px solid ${selectedDef.color}33` }}>
                  <div style={{ width: 5, height: 5, borderRadius: "50%", background: selectedDef.color }} />
                  <span style={{ fontFamily: "monospace", fontSize: 8.5, color: selectedDef.color, textTransform: "uppercase" }}>{selectedDef.status}</span>
                </div>
              </div>
              <div style={{ padding: "12px 14px" }}>
                <div style={{ fontFamily: "monospace", fontSize: 8.5, color: "rgba(255,255,255,0.22)", letterSpacing: "0.08em", marginBottom: 8 }}>NODE DATA</div>
                {selectedDef.data && Object.entries(selectedDef.data).map(([k, v]) => (
                  <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", borderBottom: "0.5px solid rgba(255,255,255,0.04)" }}>
                    <span style={{ fontFamily: "monospace", fontSize: 9.5, color: "rgba(255,255,255,0.32)" }}>{k}</span>
                    <span style={{ fontFamily: "monospace", fontSize: 10, color: "#e4e4e7", fontWeight: 600 }}>{v}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div>
              <div style={{ padding: "12px 14px", borderBottom: "0.5px solid rgba(255,255,255,0.06)" }}>
                <div style={{ fontFamily: "monospace", fontSize: 8.5, color: "rgba(255,255,255,0.22)", letterSpacing: "0.08em", marginBottom: 10 }}>AGENT OVERVIEW</div>
                {[
                  ["Agent ID",    agentStats.agent_id ? `#${agentStats.agent_id}` : "Spawning..."],
                  ["Decisions",   agentStats.total_decisions ?? 0],
                  ["Executed",    agentStats.total_executed ?? 0],
                  ["Skipped",     agentStats.total_skipped ?? 0],
                  ["Gas Reserve", `${(agentStats.gas_reservoir_mnt || 0).toFixed(2)} MNT`],
                  ["Confidence",  `${confidence.toFixed(1)}%`],
                ].map(([k, v]) => (
                  <div key={String(k)} style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", borderBottom: "0.5px solid rgba(255,255,255,0.04)" }}>
                    <span style={{ fontFamily: "monospace", fontSize: 9.5, color: "rgba(255,255,255,0.3)" }}>{k}</span>
                    <span style={{ fontFamily: "monospace", fontSize: 10, color: "#e4e4e7" }}>{v}</span>
                  </div>
                ))}
              </div>

              <div style={{ padding: "12px 14px", borderBottom: "0.5px solid rgba(255,255,255,0.06)" }}>
                <div style={{ fontFamily: "monospace", fontSize: 8.5, color: "rgba(255,255,255,0.22)", letterSpacing: "0.08em", marginBottom: 8 }}>DECISION HISTORY</div>
                {entries.length === 0 ? (
                  <p style={{ fontFamily: "monospace", fontSize: 9.5, color: "rgba(255,255,255,0.18)", textAlign: "center", padding: "16px 0" }}>No decisions yet</p>
                ) : entries.slice(0, 10).map(e => (
                  <div key={e.entry_id} style={{ display: "flex", alignItems: "center", gap: 7, padding: "6px 0", borderBottom: "0.5px solid rgba(255,255,255,0.04)" }}>
                    <div style={{ width: 6, height: 6, borderRadius: "50%", flexShrink: 0, background: e.entry_type === 0 ? "#ef4444" : "#00d097" }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontFamily: "monospace", fontSize: 9.5, fontWeight: 700, color: e.entry_type === 0 ? "#ef4444" : "#00d097" }}>{ENTRY_TYPE_LABELS[e.entry_type]}</div>
                      <div style={{ fontFamily: "monospace", fontSize: 8.5, color: "rgba(255,255,255,0.22)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.skip_reason || e.reasoning || "—"}</div>
                    </div>
                    <span style={{ fontFamily: "monospace", fontSize: 8.5, color: "rgba(255,255,255,0.2)" }}>{(e.confidence / 10000 * 100).toFixed(0)}%</span>
                  </div>
                ))}
              </div>

              {/* 14-Day Activity Heatmap */}
              <ActivityHeatmap entries={entries} />
            </div>
          )}
        </div>
      </div>

      {/* ── Status Bar ── */}
      <div style={{ height: 28, background: "rgba(9,9,11,0.98)", borderTop: "0.5px solid rgba(255,255,255,0.06)", display: "flex", alignItems: "center", padding: "0 16px", gap: 16, flexShrink: 0 }}>
        <MarketStatusBar entries={entries} />
        <div style={{ flex: 1 }} />
        <span style={{ fontFamily: "monospace", fontSize: 8.5, color: "rgba(255,255,255,0.2)" }}>
          Stage: {["Signal Intake", "Scoring Engine", "Guardrail", "Decision", "Output"][activeStage]}
        </span>
        <span style={{ fontFamily: "monospace", fontSize: 8.5, color: "#00d097" }}>● VIGIL ACTIVE</span>
      </div>
    </div>
  );
}

function hexToRgb(hex: string): string {
  return `${parseInt(hex.slice(1,3),16)},${parseInt(hex.slice(3,5),16)},${parseInt(hex.slice(5,7),16)}`;
}

// ─── Live Market Status Clock ─────────────────────────────────────────────────
// NYSE/NASDAQ: Mon–Fri 09:30–16:00 ET (UTC-4 during EDT, UTC-5 during EST)
// We use a fixed UTC-4 offset (EDT) which covers the majority of the year.
function useMarketClock() {
  const [now, setNow] = React.useState(() => new Date());
  React.useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // Convert UTC to New York time (EDT = UTC-4, EST = UTC-5)
  // Simple heuristic: EDT runs roughly Mar–Nov. We check both.
  const toNYC = (d: Date) => {
    // Determine if DST is active (second Sunday March → first Sunday November)
    const yr = d.getUTCFullYear();
    const dstStart = new Date(Date.UTC(yr, 2, 8 - (new Date(Date.UTC(yr, 2, 1)).getUTCDay() + 6) % 7 + (new Date(Date.UTC(yr, 2, 1)).getUTCDay() === 0 ? 7 : 0), 7));
    const dstEnd   = new Date(Date.UTC(yr, 10, 1 + (7 - new Date(Date.UTC(yr, 10, 1)).getUTCDay()) % 7, 6));
    const offset = d >= dstStart && d < dstEnd ? 4 : 5; // hours behind UTC
    return new Date(d.getTime() - offset * 3_600_000);
  };

  const nyc = toNYC(now);
  const day = nyc.getUTCDay(); // 0=Sun 6=Sat
  const h   = nyc.getUTCHours();
  const m   = nyc.getUTCMinutes();
  const s   = nyc.getUTCSeconds();
  const minutesInDay = h * 60 + m;
  const isWeekday = day >= 1 && day <= 5;
  const OPEN  = 9 * 60 + 30;  // 09:30
  const CLOSE = 16 * 60;      // 16:00
  const isOpen = isWeekday && minutesInDay >= OPEN && minutesInDay < CLOSE;

  // Seconds until next open (for countdown when closed)
  let secondsToOpen = 0;
  if (!isOpen) {
    const todayOpenSec = OPEN * 60;
    const nowSec = minutesInDay * 60 + s;
    if (isWeekday && nowSec < todayOpenSec) {
      secondsToOpen = todayOpenSec - nowSec;
    } else {
      // Days until next Monday (or next day if before 09:30)
      let daysAhead = 0;
      if (!isWeekday) {
        daysAhead = day === 0 ? 1 : 2; // Sun→Mon=1, Sat→Mon=2
      } else {
        daysAhead = 1; // after close on weekday → next day open
        if (day === 5) daysAhead = 3; // Friday after close → Monday
      }
      secondsToOpen = daysAhead * 86400 + todayOpenSec - nowSec;
      if (secondsToOpen < 0) secondsToOpen += 86400;
    }
  }

  const fmt = (sec: number) => {
    const hh = Math.floor(sec / 3600);
    const mm = Math.floor((sec % 3600) / 60);
    const ss = sec % 60;
    return hh > 0
      ? `${hh}h ${String(mm).padStart(2,"0")}m`
      : `${String(mm).padStart(2,"0")}:${String(ss).padStart(2,"0")}`;
  };

  return { isOpen, secondsToOpen, fmt, nyc };
}

function MarketStatusBar({ entries }: { entries: LedgerEntry[] }) {
  const { isOpen, secondsToOpen, fmt } = useMarketClock();
  const executed = entries.filter(e => e.entry_type === 1).length;

  const marketColor = isOpen ? "#00d097" : "rgba(255,255,255,0.22)";
  const marketLabel = isOpen ? "OPEN" : "CLOSED";
  const countdown   = !isOpen && secondsToOpen > 0 ? ` (${fmt(secondsToOpen)})` : "";

  return (
    <>
      {["NYSE", "NASDAQ"].map(mkt => (
        <span key={mkt} style={{ fontFamily: "monospace", fontSize: 8.5, color: marketColor, display: "flex", alignItems: "center", gap: 4 }}>
          <span style={{ color: "rgba(255,255,255,0.18)" }}>{mkt}:</span>
          <span style={{ color: marketColor, fontWeight: isOpen ? 700 : 400 }}>{marketLabel}{mkt === "NYSE" ? countdown : ""}</span>
        </span>
      ))}
      {!isOpen && executed > 0 && (
        <span style={{ fontFamily: "monospace", fontSize: 8.5, color: "#00d097", opacity: 0.7 }}>
          · VIGIL executed {executed} decision{executed !== 1 ? "s" : ""} while markets were closed
        </span>
      )}
    </>
  );
}

function ActivityHeatmap({ entries }: { entries: LedgerEntry[] }) {
  const days = Array.from({ length: 14 }).map((_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (13 - i));
    return d;
  });

  const dailyCounts = days.map(day => {
    const dateStr = day.toDateString();
    const dayEntries = entries.filter(e => {
      const entryDate = new Date(e.block_timestamp * 1000);
      return entryDate.toDateString() === dateStr;
    });
    return {
      date: day,
      executes: dayEntries.filter(e => e.entry_type !== 0).length,
      skips: dayEntries.filter(e => e.entry_type === 0).length,
      total: dayEntries.length,
    };
  });

  return (
    <div style={{ padding: "12px 14px" }}>
      <div style={{ fontFamily: "monospace", fontSize: 8.5, color: "rgba(255,255,255,0.22)", letterSpacing: "0.08em", marginBottom: 8 }}>14-DAY ACTIVITY HEATMAP</div>
      <div style={{ display: "flex", gap: 4, justifyContent: "space-between", alignItems: "center", background: "rgba(255,255,255,0.02)", padding: 8, borderRadius: 6, border: "0.5px solid rgba(255,255,255,0.04)" }}>
        {dailyCounts.map((dayData, idx) => {
          let bg = "rgba(255,255,255,0.04)";
          let border = "0.5px solid rgba(255,255,255,0.06)";
          if (dayData.total > 0) {
            if (dayData.executes > 0 && dayData.skips === 0) {
              bg = "#00d09733";
              border = "0.5px solid #00d09766";
            } else if (dayData.executes > 0 && dayData.skips > 0) {
              bg = "#f59e0b33";
              border = "0.5px solid #f59e0b66";
            } else {
              bg = "#ef444433";
              border = "0.5px solid #ef444466";
            }
          }
          const formattedDate = dayData.date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
          const titleText = `${formattedDate}: ${dayData.executes} Executes, ${dayData.skips} Skips`;

          return (
            <div
              key={idx}
              title={titleText}
              style={{
                width: 14,
                height: 14,
                borderRadius: 3,
                background: bg,
                border: border,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            />
          );
        })}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4, fontFamily: "monospace", fontSize: 7.5, color: "rgba(255,255,255,0.2)" }}>
        <span>{dailyCounts[0].date.toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span>
        <span>Today</span>
      </div>
    </div>
  );
}

