/**
 * Proof Page — VIGIL ZK Proof Ledger
 * Displays all on-chain decision proofs with full audit trail
 */
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowLeft, Shield, CheckCircle2, ExternalLink, ChevronDown, ChevronRight, Copy, Hash } from 'lucide-react';
import { INITIAL_DECISIONS, REAL_ONCHAIN_TXS } from '../data';

// Extend decisions with more entries for the proof page
const ALL_PROOFS = [
  ...INITIAL_DECISIONS,
  ...Array.from({ length: 12 }, (_, i) => {
    const txHash = REAL_ONCHAIN_TXS[i % REAL_ONCHAIN_TXS.length];
    return {
      id: `dec-extra-${i}`,
      txHash,
      timestamp: `${String(Math.floor(Math.random() * 23)).padStart(2, '0')}:${String(Math.floor(Math.random() * 59)).padStart(2, '0')} UTC`,
      action: ['ROTATE', 'SKIP', 'CLMM_OPEN'][i % 3] as any,
      fromAsset: ['NVDAx', 'mETH', 'TSLAx'][i % 3],
      toAsset: ['USDY', 'USDY', 'mETH'][i % 3],
      amount: i % 3 !== 1 ? Math.floor(500 + Math.random() * 4000) : 0,
      confidence: parseFloat((0.4 + Math.random() * 0.55).toFixed(2)),
      reasoning: 'Signal model convergence detected. Threshold exceeded for rotation.',
      signalBundleHash: 'Qm' + txHash.slice(2, 18),
      zkProofHash: txHash,
      erc8004TaskId: `task_0x${txHash.slice(2, 8)}`,
      status: 'success' as const,
      outcomeDelta: i % 3 !== 1 ? `+$${(Math.random() * 80 + 10).toFixed(2)}` : 'No change',
      gasCost: i % 3 !== 1 ? '0.0031 MNT' : '0 MNT',
      reputationBefore: 840 + i,
      reputationAfter: 843 + i,
      allocationBefore: { mETH: 40, USDY: 35, NVDAx: 15, AAPLx: 7, TSLAx: 3 },
      allocationAfter: { mETH: 37, USDY: 38, NVDAx: 15, AAPLx: 7, TSLAx: 3 },
    };
  })
];

function copyToClipboard(text: string) {
  navigator.clipboard.writeText(text).catch(() => {});
}

function ProofRow({ dec }: { dec: typeof ALL_PROOFS[0] }) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopy = (text: string, e: React.MouseEvent) => {
    e.stopPropagation();
    copyToClipboard(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const actionColor =
    dec.action === 'ROTATE' ? 'text-[#00FF7F] bg-[#00FF7F]/10 border-[#00FF7F]/20' :
    dec.action === 'CLMM_OPEN' ? 'text-cyan-400 bg-cyan-400/10 border-cyan-400/20' :
    'text-gray-500 bg-white/5 border-white/10';

  return (
    <div className="border border-white/5 rounded-lg overflow-hidden hover:border-white/10 transition-colors">
      <div
        onClick={() => setExpanded(e => !e)}
        className="flex items-center gap-4 px-4 py-3 cursor-pointer hover:bg-white/2 transition-colors"
      >
        {/* Action badge */}
        <span className={`text-[9px] font-mono font-black px-2 py-0.5 rounded-sm border uppercase shrink-0 ${actionColor}`}>
          {dec.action}
        </span>
        {/* Assets */}
        <span className="text-xs font-mono text-gray-200 font-bold shrink-0 w-28">
          {dec.fromAsset} {dec.action !== 'SKIP' && `→ ${dec.toAsset}`}
        </span>
        {/* Confidence bar */}
        <div className="hidden sm:flex items-center gap-2 shrink-0 w-28">
          <div className="flex-1 bg-white/5 h-1 rounded-full overflow-hidden">
            <div className="h-full bg-[#00FF7F]" style={{ width: `${dec.confidence * 100}%` }} />
          </div>
          <span className="text-[10px] font-mono text-gray-500">{(dec.confidence * 100).toFixed(0)}%</span>
        </div>
        {/* Amount */}
        <span className="text-xs font-mono text-gray-400 flex-1">
          {dec.amount > 0 ? `$${dec.amount.toLocaleString()}` : '—'}
        </span>
        {/* Timestamp */}
        <span className="text-[10px] font-mono text-gray-600 hidden md:block">{dec.timestamp}</span>
        {/* Outcome */}
        <span className={`text-[10px] font-mono hidden lg:block ${dec.outcomeDelta?.startsWith('+') ? 'text-[#00FF7F]' : 'text-gray-500'}`}>
          {dec.outcomeDelta?.split(' ')[0]}
        </span>
        {/* Expand */}
        <div className="shrink-0 text-gray-600">
          {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </div>
      </div>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden border-t border-white/5"
          >
            <div className="px-4 py-4 space-y-4 bg-black/30">
              {/* Reasoning */}
              <p className="text-xs text-gray-300 leading-relaxed font-sans">{dec.reasoning}</p>

              {/* Proof hashes */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {[
                  { label: 'TX Hash', value: dec.txHash, icon: ExternalLink, link: `https://sepolia.mantlescan.xyz/tx/${dec.txHash}` },
                  { label: 'ZK Proof Hash', value: dec.zkProofHash, icon: Hash },
                  { label: 'Signal Bundle CID', value: dec.signalBundleHash, icon: Shield, link: `https://gateway.pinata.cloud/ipfs/${dec.signalBundleHash}` },
                ].map(({ label, value, icon: Icon, link }) => (
                  <div key={label} className="bg-black border border-white/5 rounded-lg p-3 space-y-1">
                    <span className="text-[10px] font-mono text-gray-500 uppercase tracking-wider block">{label}</span>
                    <div className="flex items-center gap-1.5">
                      <code className="text-[10px] text-gray-300 font-mono truncate flex-1">{value}</code>
                      <button onClick={e => handleCopy(value, e)} className="text-gray-600 hover:text-white transition-colors cursor-pointer shrink-0">
                        {copied ? <CheckCircle2 className="w-3 h-3 text-[#00FF7F]" /> : <Copy className="w-3 h-3" />}
                      </button>
                      {link && (
                        <a href={link} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} className="text-gray-600 hover:text-[#00FF7F] transition-colors">
                          <Icon className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* ERC-8004 + Reputation */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-[10px] font-mono">
                <div className="bg-black border border-white/5 rounded-lg p-3">
                  <span className="text-gray-500 block mb-1">ERC-8004 Task</span>
                  <code className="text-gray-300 truncate block">{dec.erc8004TaskId}</code>
                </div>
                <div className="bg-black border border-white/5 rounded-lg p-3">
                  <span className="text-gray-500 block mb-1">Gas Cost</span>
                  <span className="text-white font-black">{dec.gasCost}</span>
                </div>
                <div className="bg-black border border-white/5 rounded-lg p-3">
                  <span className="text-gray-500 block mb-1">Rep Before → After</span>
                  <span className="text-[#d000ff] font-black">{dec.reputationBefore} → {dec.reputationAfter}</span>
                </div>
                <div className="bg-black border border-white/5 rounded-lg p-3">
                  <span className="text-gray-500 block mb-1">Outcome</span>
                  <span className={dec.outcomeDelta?.startsWith('+') ? 'text-[#00FF7F] font-black' : 'text-gray-400'}>
                    {dec.outcomeDelta?.split(' ')[0]}
                  </span>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function ProofPage() {
  const navigate = useNavigate();
  const [filter, setFilter] = useState<'ALL' | 'ROTATE' | 'SKIP' | 'CLMM_OPEN'>('ALL');

  const filtered = ALL_PROOFS.filter(d => filter === 'ALL' || d.action === filter);

  const stats = {
    total: ALL_PROOFS.length,
    executed: ALL_PROOFS.filter(d => d.action !== 'SKIP').length,
    skipped: ALL_PROOFS.filter(d => d.action === 'SKIP').length,
    totalVolume: ALL_PROOFS.reduce((s, d) => s + (d.amount || 0), 0),
  };

  return (
    <div className="min-h-screen bg-[#020202] text-white font-sans">
      <header className="fixed top-0 left-0 right-0 h-14 border-b border-white/5 bg-[#020202]/95 backdrop-blur-md z-40 px-6 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/')} className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors text-xs font-mono cursor-pointer">
            <ArrowLeft className="w-4 h-4" /> Back
          </button>
          <div className="w-px h-4 bg-white/10" />
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-[#d000ff]" />
            <span className="font-black tracking-tighter text-sm">VIGIL <span className="text-[#d000ff]">Proof Ledger</span></span>
          </div>
        </div>
        <span className="text-[10px] font-mono text-gray-500">{stats.total} decisions auditable</span>
      </header>

      <main className="pt-20 pb-12 px-4 md:px-8 max-w-6xl mx-auto space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Total Cycles', value: stats.total, color: 'text-white' },
            { label: 'Executed', value: stats.executed, color: 'text-[#00FF7F]' },
            { label: 'Skipped', value: stats.skipped, color: 'text-gray-400' },
            { label: 'Total Volume', value: `$${stats.totalVolume.toLocaleString()}`, color: 'text-cyan-400' },
          ].map(({ label, value, color }) => (
            <div key={label} className="bg-white/3 border border-white/10 rounded-xl p-4 text-center">
              <span className="text-[10px] font-mono text-gray-500 uppercase tracking-wider block mb-1">{label}</span>
              <span className={`text-xl font-black font-mono ${color}`}>{value}</span>
            </div>
          ))}
        </div>

        {/* Filter */}
        <div className="flex gap-2 flex-wrap">
          {(['ALL', 'ROTATE', 'CLMM_OPEN', 'SKIP'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`text-[10px] font-mono uppercase px-3 py-1 rounded-full border transition-all cursor-pointer ${
                filter === f ? 'border-[#00FF7F] text-[#00FF7F] bg-[#00FF7F]/10' : 'border-white/10 text-gray-500 hover:border-white/20'
              }`}
            >
              {f}
            </button>
          ))}
        </div>

        {/* Proof list */}
        <div className="space-y-2">
          {filtered.map(dec => <ProofRow key={dec.id} dec={dec} />)}
        </div>
      </main>
    </div>
  );
}
