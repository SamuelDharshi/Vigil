/**
 * 3D Page — VIGIL Full-Screen Interactive Three.js Market Visualization
 * Left panel: Agent status + portfolio allocation + recent signals
 * Right panel: Live market prices with change + volume + allocation weight
 */
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Sliders, Activity, Shield, TrendingUp, TrendingDown, Zap, Clock, Database, BarChart2 } from 'lucide-react';
import ThreeBackground from '../components/ThreeBackground';

// ── Live ticking market data ──────────────────────────────────────────────────
const BASE_MARKETS = [
  { label: 'ETH/USD',  base: 1883,   color: '#00f0ff', change: +1.84,  vol: '$2.4B',  weight: 0,    icon: '⟠' },
  { label: 'MNT/USD',  base: 0.61,   color: '#00FF7F', change: +4.81,  vol: '$250M',  weight: 0,    icon: '◈' },
  { label: 'mETH/USD', base: 1922,   color: '#00FF7F', change: +1.21,  vol: '$124M',  weight: 40,   icon: '⟠' },
  { label: 'USDY',     base: 1.0003, color: '#f59e0b', change: +0.02,  vol: '$45M',   weight: 35,   icon: '$' },
  { label: 'NVDAx',    base: 222.88, color: '#d000ff', change: -3.42,  vol: '$84M',   weight: 15,   icon: '▣' },
  { label: 'AAPLx',    base: 184.20, color: '#7c3aed', change: +0.72,  vol: '$19M',   weight: 7,    icon: '⊕' },
  { label: 'TSLAx',    base: 312.20, color: '#ef4444', change: -2.15,  vol: '$31M',   weight: 3,    icon: '⊗' },
];

// Recent signal feed
const SIGNALS = [
  { src: 'PYTH',    msg: 'mETH APR: 3.84% (+0.08% dev)',      status: 'WATCHING', color: '#00f0ff', ago: '2m' },
  { src: 'ELFA',    msg: 'NVDAx sentiment −18.2% (4h spike)',  status: 'ACTED',    color: '#00FF7F', ago: '8m' },
  { src: 'NANSEN',  msg: 'Smart wallet exit NVDAx −$1.2M',    status: 'ACTED',    color: '#00FF7F', ago: '12m' },
  { src: 'MANTLE',  msg: 'USDY 7d yield stable 5.05%',        status: 'SKIPPED',  color: '#4b5563', ago: '23m' },
  { src: 'BYREAL',  msg: 'CLMM MNT-USDC APR 89.30% spike',   status: 'WATCHING', color: '#f59e0b', ago: '31m' },
  { src: 'PYTH',    msg: 'AAPLx oracle: compliance milestone', status: 'WATCHING', color: '#00f0ff', ago: '45m' },
];

const PORTFOLIO = [
  { asset: 'mETH',  pct: 40, color: '#00FF7F' },
  { asset: 'USDY',  pct: 35, color: '#f59e0b' },
  { asset: 'NVDAx', pct: 15, color: '#d000ff' },
  { asset: 'AAPLx', pct: 7,  color: '#7c3aed' },
  { asset: 'TSLAx', pct: 3,  color: '#ef4444' },
];

function useTick(intervalMs: number) {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return tick;
}

function formatPrice(base: number, tick: number, label: string): string {
  // Micro-jitter based on tick
  const jitter = (Math.sin(tick * 0.7 + label.charCodeAt(0)) * 0.0012);
  const price = base * (1 + jitter);
  if (price > 100) return `$${price.toLocaleString('en', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  if (price > 1)   return `$${price.toFixed(4)}`;
  return `$${price.toFixed(4)}`;
}

export default function ThreePage() {
  const navigate = useNavigate();
  const [volatility, setVolatility] = useState(1.0);
  const [showControls, setShowControls] = useState(true);
  const [uptime, setUptime] = useState(0);
  const tick = useTick(2000);

  useEffect(() => {
    const id = setInterval(() => setUptime(u => u + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const uptimeStr = `${String(Math.floor(uptime / 3600)).padStart(2,'0')}:${String(Math.floor((uptime % 3600) / 60)).padStart(2,'0')}:${String(uptime % 60).padStart(2,'0')}`;

  return (
    <div className="fixed inset-0 bg-[#020202] text-white overflow-hidden font-sans">
      <ThreeBackground scrollProgress={0.3} volatility={volatility} enableOrbit />

      {/* ── HEADER ── */}
      <div className="absolute top-0 left-0 right-0 z-20 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-1.5 text-gray-400 hover:text-white transition-colors text-xs font-mono bg-black/60 border border-white/10 px-3 py-1.5 rounded-lg backdrop-blur-md cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back
          </button>
          <div className="bg-black/60 border border-white/10 rounded-lg px-3 py-1.5 backdrop-blur-md flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-[#00FF7F] animate-pulse" />
            <span className="font-black tracking-tighter text-sm">VIGIL <span className="text-[#00FF7F]">Market Analysis</span></span>
          </div>
          <div className="bg-black/40 border border-white/5 rounded-lg px-3 py-1.5 backdrop-blur-md text-[10px] font-mono text-gray-500 flex items-center gap-1.5">
            <Clock className="w-3 h-3" /> Uptime: <span className="text-[#00FF7F]">{uptimeStr}</span>
          </div>
        </div>
        <button
          onClick={() => setShowControls(c => !c)}
          className="bg-black/60 border border-white/10 rounded-lg p-2 backdrop-blur-md text-gray-400 hover:text-white transition-colors cursor-pointer"
        >
          <Sliders className="w-4 h-4" />
        </button>
      </div>

      {/* ── LEFT PANEL: Agent status + portfolio + signals ── */}
      <div className="absolute top-20 left-4 z-20 w-56 space-y-3">

        {/* Agent status card */}
        <div className="bg-black/70 border border-white/8 rounded-xl p-3 backdrop-blur-xl">
          <div className="flex items-center gap-2 mb-2.5">
            <Shield className="w-3.5 h-3.5 text-[#00FF7F]" />
            <span className="text-[10px] font-mono uppercase tracking-widest text-gray-400">Agent Status</span>
          </div>
          <div className="space-y-1.5">
            {[
              { label: 'Agent ID',     val: '#34058440',   color: '#00FF7F' },
              { label: 'ERC-8004',     val: 'Active',       color: '#00FF7F' },
              { label: 'Network',      val: 'Mantle Sep.',  color: '#00f0ff' },
              { label: 'Reputation',   val: '851 pts',      color: '#f59e0b' },
              { label: 'Total Skips',  val: '34 on-chain',  color: '#d000ff' },
              { label: 'Gas Reservoir',val: '10.00 MNT',    color: '#4b5563' },
            ].map(({ label, val, color }) => (
              <div key={label} className="flex justify-between items-center">
                <span className="text-[9px] font-mono text-gray-600">{label}</span>
                <span className="text-[9px] font-mono font-black" style={{ color }}>{val}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Portfolio Allocation */}
        <div className="bg-black/70 border border-white/8 rounded-xl p-3 backdrop-blur-xl">
          <div className="flex items-center gap-2 mb-2.5">
            <BarChart2 className="w-3.5 h-3.5 text-[#00f0ff]" />
            <span className="text-[10px] font-mono uppercase tracking-widest text-gray-400">Allocation</span>
          </div>
          {/* Stacked bar */}
          <div className="flex h-2 rounded-full overflow-hidden mb-2.5">
            {PORTFOLIO.map(p => (
              <div key={p.asset} style={{ width: `${p.pct}%`, backgroundColor: p.color }} />
            ))}
          </div>
          <div className="space-y-1">
            {PORTFOLIO.map(p => (
              <div key={p.asset} className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: p.color }} />
                  <span className="text-[9px] font-mono text-gray-400">{p.asset}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-14 h-1 bg-white/5 rounded-full overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${p.pct * 2.5}%`, backgroundColor: p.color }} />
                  </div>
                  <span className="text-[9px] font-mono font-black" style={{ color: p.color }}>{p.pct}%</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Signal Feed */}
        <div className="bg-black/70 border border-white/8 rounded-xl p-3 backdrop-blur-xl">
          <div className="flex items-center gap-2 mb-2.5">
            <Activity className="w-3.5 h-3.5 text-[#d000ff]" />
            <span className="text-[10px] font-mono uppercase tracking-widest text-gray-400">Signal Feed</span>
          </div>
          <div className="space-y-2">
            {SIGNALS.map((s, i) => (
              <div key={i} className="border-b border-white/4 pb-1.5 last:border-0 last:pb-0">
                <div className="flex items-center justify-between mb-0.5">
                  <span className="text-[8px] font-mono font-black" style={{ color: s.color }}>{s.src}</span>
                  <div className="flex items-center gap-1">
                    <span className={`text-[7px] font-mono px-1 rounded-sm ${
                      s.status === 'ACTED' ? 'bg-[#00FF7F]/10 text-[#00FF7F]' :
                      s.status === 'SKIPPED' ? 'bg-white/5 text-gray-600' :
                      'bg-[#f59e0b]/10 text-[#f59e0b]'
                    }`}>{s.status}</span>
                    <span className="text-[7px] font-mono text-gray-700">{s.ago}</span>
                  </div>
                </div>
                <p className="text-[8px] font-mono text-gray-500 leading-tight">{s.msg}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── RIGHT PANEL: Market prices with change + volume ── */}
      <div className="absolute top-20 right-4 z-20 w-52 space-y-2">

        {/* Market header */}
        <div className="bg-black/70 border border-white/8 rounded-xl p-2.5 backdrop-blur-xl">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-3.5 h-3.5 text-[#00FF7F]" />
            <span className="text-[10px] font-mono uppercase tracking-widest text-gray-400">Live Markets</span>
            <span className="text-[7px] font-mono text-gray-700 ml-auto">Pyth Oracle</span>
          </div>
        </div>

        {/* Each market */}
        {BASE_MARKETS.map(m => {
          const price = formatPrice(m.base, tick, m.label);
          const isPos = m.change >= 0;
          return (
            <div key={m.label} className="bg-black/70 border border-white/8 hover:border-white/15 rounded-xl p-2.5 backdrop-blur-xl transition-colors">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px]" style={{ color: m.color }}>{m.icon}</span>
                  <span className="text-[10px] font-mono font-black text-white">{m.label}</span>
                  {m.weight > 0 && (
                    <span className="text-[7px] font-mono px-1 py-0.5 rounded-sm bg-white/5 text-gray-600">{m.weight}%</span>
                  )}
                </div>
                <div className={`flex items-center gap-0.5 text-[9px] font-mono font-black ${isPos ? 'text-[#00FF7F]' : 'text-red-500'}`}>
                  {isPos ? <TrendingUp className="w-2.5 h-2.5" /> : <TrendingDown className="w-2.5 h-2.5" />}
                  {isPos ? '+' : ''}{m.change.toFixed(2)}%
                </div>
              </div>
              <div className="flex items-end justify-between">
                <span className="text-sm font-mono font-black" style={{ color: m.color }}>{price}</span>
                <div className="text-right">
                  <span className="text-[7px] font-mono text-gray-700 block">Vol 24h</span>
                  <span className="text-[8px] font-mono text-gray-500">{m.vol}</span>
                </div>
              </div>
              {/* Mini sparkline bar */}
              <div className="mt-1.5 h-0.5 bg-white/5 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-1000"
                  style={{
                    width: `${50 + Math.sin(tick * 0.5 + m.label.charCodeAt(0)) * 30}%`,
                    backgroundColor: m.color,
                    opacity: 0.6,
                  }}
                />
              </div>
            </div>
          );
        })}

        {/* Session stats */}
        <div className="bg-black/70 border border-white/8 rounded-xl p-2.5 backdrop-blur-xl">
          <div className="flex items-center gap-2 mb-2">
            <Database className="w-3 h-3 text-gray-600" />
            <span className="text-[9px] font-mono uppercase tracking-widest text-gray-600">Session</span>
          </div>
          {[
            { label: 'Cycles run',   val: '34', color: '#00FF7F' },
            { label: 'Executed',     val: '0',  color: '#f59e0b' },
            { label: 'Skipped',      val: '34', color: '#4b5563' },
            { label: 'Vault TVL',    val: '$142,851', color: '#00f0ff' },
          ].map(({ label, val, color }) => (
            <div key={label} className="flex justify-between items-center py-0.5">
              <span className="text-[8px] font-mono text-gray-600">{label}</span>
              <span className="text-[8px] font-mono font-black" style={{ color }}>{val}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── VOLATILITY CONTROLS (bottom center) ── */}
      {showControls && (
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-20 bg-black/75 border border-white/10 rounded-xl p-4 backdrop-blur-xl w-80 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Zap className="w-3.5 h-3.5 text-[#00FF7F]" />
              <span className="text-[10px] font-mono uppercase tracking-widest text-gray-400">Market Volatility</span>
            </div>
            <span className={`text-xs font-mono font-black ${volatility > 1.5 ? 'text-red-500' : volatility > 1.0 ? 'text-yellow-500' : 'text-[#00FF7F]'}`}>
              {volatility.toFixed(1)}x &nbsp;{volatility > 1.5 ? '⚠ HIGH' : volatility > 1.0 ? 'ELEVATED' : 'STABLE'}
            </span>
          </div>
          <input
            type="range" min="0.2" max="2.5" step="0.1" value={volatility}
            onChange={e => setVolatility(parseFloat(e.target.value))}
            className="w-full accent-[#00FF7F] cursor-pointer"
          />
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: 'Candlesticks', desc: '28 bars',   color: '#00FF7F' },
              { label: 'Data Nodes',   desc: '15 icosa',  color: '#00f0ff' },
              { label: 'Packets',      desc: '12 flying', color: '#d000ff' },
            ].map(({ label, desc, color }) => (
              <div key={label} className="text-center">
                <div className="w-2 h-2 rounded-full mx-auto mb-1" style={{ backgroundColor: color }} />
                <span className="text-[8px] font-mono text-gray-400 block">{label}</span>
                <span className="text-[8px] font-mono text-gray-600">{desc}</span>
              </div>
            ))}
          </div>
          <div className="text-[8px] font-mono text-gray-700 text-center border-t border-white/5 pt-2">
            Scroll ← → to tilt camera • Drag to pan
          </div>
        </div>
      )}

      {/* Watermark */}
      <div className="absolute bottom-4 right-4 z-20 text-right">
        <div className="text-[9px] font-mono text-gray-800 uppercase tracking-widest">VIGIL Market Engine</div>
        <div className="text-[8px] font-mono text-gray-900">Three.js • WebGL 2.0</div>
      </div>
    </div>
  );
}
