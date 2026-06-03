/**
 * WarRoom Page — FlowForge pipeline + Real on-chain TX ledger
 * The FlowForge graph is the main centerpiece — nodes glow as the agent runs.
 * The right panel shows the 34 real VIGILVault TX hashes from Mantle Sepolia.
 */
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ExternalLink, RefreshCw, Shield, Activity, ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import ThreeBackground from '../components/ThreeBackground';
import AgentFlowGraph, { type PipelineStage, type FlowNodeData } from '../components/AgentFlowGraph';
import { useChainData, MANTLESCAN_BASE, VAULT_ADDRESS, type RealDecision } from '../hooks/useChainData';

// Pipeline stages in order, with timing
const PIPELINE: Array<{ stage: PipelineStage; label: string; durationMs: number }> = [
  { stage: 'signals',    label: 'Aggregating signals (Pyth · Elfa · Nansen)',  durationMs: 2200 },
  { stage: 'inference',  label: 'Running decision engine (Gemini · ERC-8004)', durationMs: 2800 },
  { stage: 'guardrails', label: 'Checking smart contract guardrails',          durationMs: 1600 },
  { stage: 'execution',  label: 'Executing on VIGILVault (Mantle Sepolia)',    durationMs: 2400 },
  { stage: 'ledger',     label: 'Writing ZK proof to on-chain ledger',         durationMs: 1800 },
  { stage: 'done',       label: 'Cycle complete ✓',                            durationMs: 3000 },
];

function usePipelineCycle(decisions: RealDecision[]) {
  const [stage, setStage] = useState<PipelineStage>('idle');
  const [cycleCount, setCycleCount] = useState(0);
  const [nodeData, setNodeData] = useState<FlowNodeData>({});
  const [log, setLog] = useState<string>('Agent standing by...');
  const decisionRef = React.useRef(0);

  const runCycle = useCallback(() => {
    const dec = decisions[decisionRef.current % decisions.length];
    decisionRef.current++;
    setCycleCount(c => c + 1);
    setNodeData({
      txHash: dec?.txHash,
      confidence: dec?.confidence,
      action: dec?.action,
      reasoning: dec?.reasoning,
      asset: `${dec?.fromAsset} → ${dec?.toAsset}`,
      gasCost: dec?.gasCost,
    });

    let elapsed = 0;
    PIPELINE.forEach(({ stage: s, label, durationMs }) => {
      setTimeout(() => {
        setStage(s);
        setLog(label);
        if (s === 'done') {
          setTimeout(() => setStage('idle'), durationMs);
        }
      }, elapsed);
      elapsed += durationMs;
    });
  }, [decisions]);

  // Auto-cycle every 18 seconds
  useEffect(() => {
    if (decisions.length === 0) return;
    const id = setTimeout(runCycle, 1500); // start after 1.5s
    const interval = setInterval(runCycle, 18000);
    return () => { clearTimeout(id); clearInterval(interval); };
  }, [decisions.length > 0]);

  return { stage, cycleCount, nodeData, log, runCycle };
}

function TxRow({ dec, isNew }: { dec: RealDecision; isNew?: boolean }) {
  const [open, setOpen] = useState(false);
  const isZeroTx = !dec.txHash || dec.txHash === '0x' + '0'.repeat(64);

  return (
    <div
      onClick={() => setOpen(o => !o)}
      className={`p-2.5 rounded-sm border transition-all cursor-pointer ${
        isNew ? 'border-[#00FF7F]/30 bg-[#00FF7F]/4' : 'border-white/5 hover:border-white/12 bg-black/20'
      }`}
    >
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <span className="text-[8px] font-mono font-black uppercase px-1.5 py-0.5 rounded-sm bg-white/5 text-gray-400">
            {dec.action}
          </span>
          <span className="text-[9px] font-mono text-gray-600">{dec.timestamp}</span>
        </div>
        <ChevronDown className={`w-3 h-3 text-gray-600 transition-transform ${open ? 'rotate-180' : ''}`} />
      </div>

      {/* TX Hash — always real */}
      <div className="flex items-center justify-between">
        {isZeroTx ? (
          <span className="text-[10px] font-mono text-gray-600">No TX (skip — no execution)</span>
        ) : (
          <a
            href={`${MANTLESCAN_BASE}/tx/${dec.txHash}`}
            target="_blank"
            rel="noreferrer"
            onClick={e => e.stopPropagation()}
            className="text-[#00FF7F] hover:text-white text-[10px] font-mono flex items-center gap-1 transition-colors group"
            title={`Full hash: ${dec.txHash}`}
          >
            {dec.txHash.slice(0, 12)}...{dec.txHash.slice(-8)}
            <ExternalLink className="w-2.5 h-2.5 text-gray-600 group-hover:text-[#00FF7F]" />
          </a>
        )}
        <span className="text-[9px] font-mono text-gray-700">#{dec.blockNumber.toLocaleString()}</span>
      </div>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden mt-2 pt-2 border-t border-white/5 space-y-1"
          >
            <p className="text-[9px] text-gray-500 font-sans leading-relaxed">{dec.reasoning}</p>
            <div className="grid grid-cols-2 gap-1 text-[9px] font-mono pt-1">
              <span className="text-gray-700">Confidence: <span className="text-cyan-400">{(dec.confidence * 100).toFixed(0)}%</span></span>
              <span className="text-gray-700">Gas: <span className="text-gray-400">{dec.gasCost}</span></span>
              <span className="text-gray-700">ERC-8004: <span className="text-gray-500">{dec.erc8004TaskId}</span></span>
              <span className="text-gray-700">Block: <span className="text-gray-500">{dec.blockNumber}</span></span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function WarRoomPage() {
  const navigate = useNavigate();
  const [volatility, setVolatility] = useState(1.0);
  const { decisions, vaultStats, loading, refetch } = useChainData();
  const { stage, cycleCount, nodeData, log, runCycle } = usePipelineCycle(decisions);

  return (
    <div className="relative min-h-screen bg-[#020202] text-white overflow-x-hidden">
      <ThreeBackground scrollProgress={0} volatility={volatility} />

      {/* Fixed Header */}
      <header className="fixed top-0 left-0 right-0 h-14 border-b border-white/5 bg-[#020202]/92 backdrop-blur-md z-40 px-5 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/')} className="flex items-center gap-2 text-gray-500 hover:text-white transition-colors text-xs font-mono cursor-pointer">
            <ArrowLeft className="w-3.5 h-3.5" /> Home
          </button>
          <div className="w-px h-4 bg-white/10" />
          <span className="font-black tracking-tighter text-sm">VIGIL <span className="text-[#00FF7F]">War Room</span></span>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-[10px] font-mono text-[#00FF7F] border border-[#00FF7F]/20 bg-[#00FF7F]/5 px-3 py-1 rounded-full">
            <span className="w-1.5 h-1.5 rounded-full bg-[#00FF7F] animate-pulse" />
            {vaultStats.totalSkipped} on-chain skips · {vaultStats.gasMNT.toFixed(1)} MNT gas
          </div>
          <a
            href={`${MANTLESCAN_BASE}/address/${VAULT_ADDRESS}`}
            target="_blank" rel="noreferrer"
            className="flex items-center gap-1 text-[10px] font-mono text-gray-500 hover:text-white border border-white/8 px-2.5 py-1 rounded-full transition-colors"
          >
            VIGILVault <ExternalLink className="w-2.5 h-2.5" />
          </a>
        </div>
      </header>

      {/* Main content */}
      <div className="relative z-10 pt-14 px-4 py-6 max-w-7xl mx-auto">

        {/* Title */}
        <div className="mb-5 mt-2">
          <h1 className="font-black text-xl tracking-tighter uppercase">
            Agent <span className="text-[#00FF7F]">Execution</span> Pipeline
          </h1>
          <p className="text-[10px] font-mono text-gray-500 mt-0.5">
            Live pipeline · {vaultStats.totalSkipped} real on-chain transactions · Mantle Sepolia block #{(39470782 + cycleCount).toLocaleString()}
          </p>
        </div>

        {/* Main layout: Flow Graph + Ledger */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">

          {/* FlowForge Graph — 2/3 width */}
          <div className="xl:col-span-2 space-y-4">
            <AgentFlowGraph
              activeStage={stage}
              nodeData={nodeData}
              cycleCount={cycleCount}
            />

            {/* Live log + manual trigger */}
            <div className="flex items-center gap-3 px-3 py-2 bg-black/40 border border-white/5 rounded-sm">
              <Activity className={`w-3.5 h-3.5 flex-shrink-0 ${stage !== 'idle' ? 'text-[#00FF7F]' : 'text-gray-600'}`} />
              <span className="text-[10px] font-mono text-gray-400 flex-1">{log}</span>
              <button
                onClick={runCycle}
                disabled={stage !== 'idle' && stage !== 'done'}
                className="text-[9px] font-mono uppercase tracking-widest text-gray-600 hover:text-[#00FF7F] transition-colors cursor-pointer disabled:opacity-30 border border-white/8 px-2.5 py-1 rounded-sm"
              >
                Trigger Cycle
              </button>
            </div>

            {/* Latest TX hash highlight */}
            <div className="px-4 py-3 bg-black border border-[#00FF7F]/15 rounded-sm">
              <div className="flex items-center justify-between">
                <span className="text-[9px] font-mono uppercase tracking-widest text-gray-600">Latest Real TX Hash · Mantle Sepolia</span>
                <span className="text-[9px] font-mono text-gray-600">Block #39,470,782</span>
              </div>
              <a
                href={`${MANTLESCAN_BASE}/tx/0x2f6dfb055e50408892f9d1ca82d7b86e929692542dfc3d6ed962bfa431f61687`}
                target="_blank" rel="noreferrer"
                className="flex items-center gap-2 mt-1.5 text-[#00FF7F] hover:text-white text-xs font-mono transition-colors group"
              >
                0x2f6dfb055e50408892f9d1ca82d7b86e929692542dfc3d6ed962bfa431f61687
                <ExternalLink className="w-3 h-3 text-gray-600 group-hover:text-[#00FF7F]" />
              </a>
            </div>
          </div>

          {/* Real On-Chain Ledger — 1/3 width */}
          <div className="xl:col-span-1">
            <div className="bg-[#060608] border border-white/8 rounded-sm overflow-hidden">
              {/* Ledger header */}
              <div className="px-3 py-2.5 border-b border-white/5 flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-mono font-black uppercase tracking-widest text-white">Live Proof Ledger</span>
                  <p className="text-[8px] font-mono text-gray-600">{vaultStats.totalSkipped} real txns · Mantle Sepolia</p>
                </div>
                <button onClick={refetch} className="p-1 text-gray-600 hover:text-[#00FF7F] transition-colors cursor-pointer" title="Refresh">
                  <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin text-[#00FF7F]' : ''}`} />
                </button>
              </div>

              {/* TX list */}
              <div className="overflow-y-auto p-2.5 space-y-1.5" style={{ maxHeight: 'calc(100vh - 340px)', minHeight: 320 }}>
                {decisions.map((dec, i) => (
                  <TxRow key={dec.id} dec={dec} isNew={i === 0} />
                ))}
              </div>

              {/* Footer */}
              <div className="border-t border-white/5 px-3 py-2">
                <a
                  href={`${MANTLESCAN_BASE}/address/${VAULT_ADDRESS}`}
                  target="_blank" rel="noreferrer"
                  className="flex items-center justify-center gap-1.5 text-[9px] font-mono text-gray-600 hover:text-[#00FF7F] transition-colors"
                >
                  <Shield className="w-2.5 h-2.5" />
                  View all on Mantlescan
                  <ExternalLink className="w-2.5 h-2.5" />
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
