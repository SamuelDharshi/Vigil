/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Activity, Sparkles, Shield, Compass, Key, Cpu, RotateCw, AlertTriangle, ArrowRightLeft,
  ChevronRight, Database, ExternalLink, Calendar, PlusCircle, CheckCircle, Flame
} from 'lucide-react';
import { SignalItem, DecisionItem, MarketPrice } from '../types';
import {
  INITIAL_SIGNALS, INITIAL_DECISIONS, INITIAL_ALLOCATION,
  INITIAL_PRICES, TEMPLATE_PHRASES, generateRandomHash
} from '../data';
import ProofModal from './ProofModal';

interface WarRoomProps {
  walletAddress: string;
  agentId: string;
  volatility: number;
  onVolatilityChange: (vol: number) => void;
}

export default function WarRoom({ walletAddress, agentId, volatility, onVolatilityChange }: WarRoomProps) {
  // States
  const [signals, setSignals] = useState<SignalItem[]>(INITIAL_SIGNALS);
  const [decisions, setDecisions] = useState<DecisionItem[]>(INITIAL_DECISIONS);
  const [allocation, setAllocation] = useState<Record<string, number>>(INITIAL_ALLOCATION);
  const [prices, setPrices] = useState<MarketPrice[]>(INITIAL_PRICES);

  // Active decision pipeline status
  const [pipelineActive, setPipelineActive] = useState(false);
  const [pipelineStage, setPipelineStage] = useState<number>(0);
  const [pipelineDetail, setPipelineDetail] = useState<string>('');
  const [countdown, setCountdown] = useState(20);
  const [selectedDecision, setSelectedDecision] = useState<DecisionItem | null>(null);

  // Stats
  const [reputationScore, setReputationScore] = useState(851);
  const [uptime, setUptime] = useState('14d 06h 12m');

  // Sparkline/ticks simulation
  useEffect(() => {
    const priceInterval = setInterval(() => {
      setPrices((prev) =>
        prev.map((itm) => {
          // Increase fluctuation amplitude under high volatility
          const shiftPercent = (Math.random() - 0.5) * 0.015 * volatility;
          const currentPrice = itm.price * (1 + shiftPercent);
          const historyCp = [...itm.sparkline];
          historyCp.shift();
          historyCp.push(currentPrice);

          return {
            ...itm,
            price: Number(currentPrice.toFixed(itm.symbol === 'USDY' ? 4 : 2)),
            change24h: Number((itm.change24h + shiftPercent * 100).toFixed(2)),
            sparkline: historyCp,
          };
        })
      );
    }, 3000);

    return () => clearInterval(priceInterval);
  }, [volatility]);

  // Main automated 30-min evaluation cycle simulator (20-second ticks)
  useEffect(() => {
    if (pipelineActive) return;

    const tick = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          triggerInferenceCycle();
          return 20;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(tick);
  }, [pipelineActive, signals, allocation, reputationScore]);

  // Uptime ticker
  useEffect(() => {
    const upInterval = setInterval(() => {
      const now = new Date();
      // Mock duration ticker based on baseline
      setUptime(`14d 06h 12m ${now.getUTCSeconds().toString().padStart(2, '0')}s`);
    }, 1000);
    return () => clearInterval(upInterval);
  }, []);

  // Trigger an intelligence loop
  const triggerInferenceCycle = async () => {
    if (pipelineActive) return;
    setPipelineActive(true);
    setPipelineStage(1);
    setPipelineDetail('Aggregating Chainlink + Nansen + Elfa signal data sets...');

    // Stage 1: Intake (approx 1.5s)
    await delay(1500);
    const sourceOptions: Array<'CHAINLINK' | 'NANSEN' | 'ELFA' | 'MANTLE'> = ['NANSEN', 'ELFA', 'CHAINLINK', 'MANTLE'];
    const chosenSys = sourceOptions[Math.floor(Math.random() * sourceOptions.length)];
    const timestampStr = new Date().toISOString().substring(11, 19) + ' UTC';
    const wt = Number((0.4 + Math.random() * 0.5).toFixed(2));

    // Construct a beautiful mock signal
    let descriptionText = '';
    let details: any = {};
    if (chosenSys === 'NANSEN') {
      const volNum = Math.floor(400000 + Math.random() * 800000);
      descriptionText = `Smart money wallet monitoring shows aggregated flows of +$${volNum.toLocaleString()} index shifting into mETH.`;
      details = { addresses: 3, rawVolume: `$${volNum.toLocaleString()}` };
    } else if (chosenSys === 'ELFA') {
      const sent = Math.floor(15 + Math.random() * 30);
      const isUp = Math.random() > 0.4;
      descriptionText = `Elfa sentiment API reports macro keyword TSLAx positive engagement delta of ${isUp ? '+' : '-'}${sent}% over 6 hours.`;
      details = { volumeMetric: 'High', sentimentDelta: `${isUp ? '+' : '-'}${sent}%` };
    } else {
      const yieldDiff = (3.5 + Math.random() * 2).toFixed(2);
      descriptionText = `Chainlink functions confirm USDY treasury premium of ${yieldDiff}% is stable compared to ETH volatility.`;
      details = { stabilityCoefficient: '0.85', currentYield: `${yieldDiff}%` };
    }

    const newSignal: SignalItem = {
      id: `sig-${Math.floor(100 + Math.random() * 900)}`,
      timestamp: timestampStr,
      source: chosenSys,
      description: descriptionText,
      status: 'WATCHING',
      weight: wt,
      details,
    };

    setSignals((prev) => [newSignal, ...prev.slice(0, 15)]);

    // Stage 2: Weighted model (approx 2s)
    setPipelineStage(2);
    setPipelineDetail(`Evaluating weights: ${chosenSys} weight is ${wt}. Computing Groth16 mathematical validity proof...`);
    await delay(2000);

    // Stage 3: Guardrails check (approx 1.5s)
    setPipelineStage(3);
    setPipelineDetail('Executing target validations. Whitelist... OK; Epoch Caps... OK; Slippage... OK.');
    await delay(1500);

    // Stage 4: Router execution (approx 1.8s)
    setPipelineStage(4);
    const actionDecided = wt > 0.58 ? 'ROTATE' : 'SKIP';
    const isMntSol = Math.random() > 0.6;
    const actionName = actionDecided === 'ROTATE' ? (isMntSol ? 'CLMM_OPEN' : 'ROTATE') : 'SKIP';
    setPipelineDetail(
      actionName === 'SKIP'
        ? 'Signals do not exceed score threshold. Skipping rotation with neutral configuration.'
        : actionName === 'CLMM_OPEN'
        ? 'Rotational opportunity flagged. Super Portal cross-chain routing initiated to Solana Byreal MNT-USDC CLMM.'
        : 'Atomic quote accepted. Directing RFQ swap via Fluxion xChange pipeline...'
    );
    await delay(1800);

    // Stage 5: ERC-8004 Registry validation (approx 1.5s)
    setPipelineStage(5);
    setPipelineDetail('Handshaking with validation registry contract. Emitting reputation scorecard update...');
    await delay(1500);

    // Apply outcome adjustments and update lists
    if (actionDecided === 'ROTATE') {
      const fromOptions = ['NVDAx', 'AAPLx', 'TSLAx', 'mETH'];
      const toOptions = ['USDY', 'mETH', 'MNT-USDC (Byreal)'];
      const fSelected = fromOptions[Math.floor(Math.random() * fromOptions.length)];
      const tSelected = toOptions.filter((e) => e !== fSelected)[0] || 'USDY';

      const tradeAmt = Math.floor(1000 + Math.random() * 4000);
      const repIncrement = Math.floor(2 + Math.random() * 4);
      const prevRep = reputationScore;

      const newAllocationCp = { ...allocation };
      // Simulate micro shift
      if (newAllocationCp[fSelected] && newAllocationCp[fSelected] > 3) {
        newAllocationCp[fSelected] -= 3;
        if (newAllocationCp[tSelected]) {
          newAllocationCp[tSelected] += 3;
        } else {
          newAllocationCp[tSelected] = 3;
        }
        setAllocation(newAllocationCp);
      }

      const txHash = generateRandomHash(32);
      const newDItem: DecisionItem = {
        id: `dec-${Math.floor(100 + Math.random() * 900)}`,
        txHash,
        timestamp: timestampStr,
        action: actionName,
        fromAsset: fSelected,
        toAsset: tSelected,
        amount: tradeAmt,
        confidence: wt,
        reasoning: `${TEMPLATE_PHRASES.narratives[Math.floor(Math.random() * TEMPLATE_PHRASES.narratives.length)]} Reallocated $${tradeAmt.toLocaleString()} out of ${fSelected} into yields to achieve optimal risk parity.`,
        signalBundleHash: 'Qm' + generateRandomHash(16),
        zkProofHash: '0x' + generateRandomHash(24),
        erc8004TaskId: `task_0x${Math.floor(100000 + Math.random() * 900000).toString(16)}`,
        status: 'success',
        outcomeDelta: `+$${(Math.random() * 80 + 10).toFixed(2)} (Captured +${(Math.random() * 1.5 + 0.2).toFixed(2)}% benefit)`,
        gasCost: '0.0031 MNT',
        reputationBefore: prevRep,
        reputationAfter: prevRep + repIncrement,
        allocationBefore: allocation,
        allocationAfter: newAllocationCp,
      };

      setDecisions((prev) => [newDItem, ...prev]);
      setReputationScore((prev) => prev + repIncrement);

      // Mutate signal acted state
      setSignals((prev) =>
        prev.map((s, idx) => (idx === 0 ? { ...s, status: 'ACTED' } : s))
      );
    } else {
      // Skipped
      const txHash = '0x0000000000000000000000000000000000000000000000000000000000000000';
      const newDItem: DecisionItem = {
        id: `dec-${Math.floor(100 + Math.random() * 900)}`,
        txHash,
        timestamp: timestampStr,
        action: 'SKIP',
        fromAsset: 'TSLAx',
        toAsset: 'USDY',
        amount: 0,
        confidence: wt,
        reasoning: `${newSignal.description} Model threshold assessment indicates insufficient combined weight to override strict safe-harbor baseline ratios. Position maintained neutral continuous monitoring state.`,
        signalBundleHash: 'Qm' + generateRandomHash(16),
        zkProofHash: '0x0000000000000000000000000000000000000000000000000000000000000000',
        erc8004TaskId: `task_0x${Math.floor(100000 + Math.random() * 900000).toString(16)}`,
        status: 'success',
        outcomeDelta: 'No loss (Position stabilized)',
        gasCost: '0 MNT',
        reputationBefore: reputationScore,
        reputationAfter: reputationScore,
        allocationBefore: allocation,
        allocationAfter: allocation,
      };
      setDecisions((prev) => [newDItem, ...prev]);

      // Mutate signal acted state
      setSignals((prev) =>
        prev.map((s, idx) => (idx === 0 ? { ...s, status: 'SKIPPED' } : s))
      );
    }

    // Done!
    setPipelineActive(false);
    setCountdown(20);
  };

  const delay = (ms: number) => new Promise((res) => setTimeout(res, ms));

  return (
    <div className="w-full max-w-7xl mx-auto px-4 md:px-6 py-6 font-sans text-gray-200 min-h-screen relative z-10">
      
      {/* Dynamic Upper Controls Section */}
      <div id="deck-stats-control" className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8 mt-20">
        
        {/* Ticker rates block */}
        <div className="md:col-span-2 bg-[#020202]/95 border border-white/10 rounded-sm p-4 flex flex-col justify-between backdrop-blur-md">
          <div className="flex justify-between items-center mb-3">
            <span className="text-[10px] font-mono text-gray-400 uppercase tracking-wider font-bold">Mantle 24/7 Asset Oracles</span>
            <span className="flex items-center gap-1.5 text-[10px] bg-[#00FF7F]/10 text-[#00FF7F] font-mono px-2 py-0.5 rounded-sm border border-[#00FF7F]/20">
              <span className="w-1.5 h-1.5 rounded-full bg-[#00FF7F] animate-pulse" />
              Live Feed
            </span>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {prices.slice(0, 6).map((itm) => (
              <div key={itm.symbol} className="bg-black border border-white/5 rounded-sm p-2.5 transition-all text-center">
                <span className="text-[10px] font-mono text-gray-500 uppercase font-medium">{itm.symbol}</span>
                <span className="block text-sm font-black font-mono text-white mt-0.5">
                  {itm.symbol === 'USDY' ? `$${itm.price.toFixed(4)}` : itm.symbol === 'MNT' ? `$${itm.price.toFixed(2)}` : `$${itm.price.toLocaleString()}`}
                </span>
                <span className={`text-[10px] font-mono block mt-0.5 font-bold ${itm.change24h >= 0 ? 'text-[#00FF7F]' : 'text-red-500'}`}>
                  {itm.change24h >= 0 ? '+' : ''}{itm.change24h}%
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Evaluation status block */}
        <div className="bg-[#020202]/95 border border-white/10 rounded-sm p-4 flex flex-col justify-between backdrop-blur-md">
          <div className="flex justify-between items-center mb-2">
            <span className="text-[10px] font-mono text-gray-400 uppercase tracking-wider font-bold">Evaluation Horizon</span>
            <Compass className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="space-y-1">
            <span className="block text-center text-3xl font-mono font-black text-white neon-text">
              {pipelineActive ? 'PROCESSING' : `00:${countdown.toString().padStart(2, '0')}`}
            </span>
            <span className="block text-center text-[10px] font-mono text-gray-500 uppercase tracking-widest">
              {pipelineActive ? 'Agent in mid-inference cycle' : `Time remaining until next pass`}
            </span>
          </div>
          <button
            id="force-eval-btn"
            onClick={triggerInferenceCycle}
            disabled={pipelineActive}
            className="w-full py-2 bg-white/5 border border-white/10 hover:border-white/20 disabled:opacity-50 text-xs font-mono rounded-sm font-black uppercase tracking-wider flex items-center justify-center gap-2 transition-colors text-white transform -skew-x-12 cursor-pointer"
          >
            <div className="skew-x-12 flex items-center gap-2">
              <RotateCw className={`w-3.5 h-3.5 text-cyan-400 ${pipelineActive ? 'animate-spin' : ''}`} />
              Fast-Forward Evaluation
            </div>
          </button>
        </div>

        {/* Volatility selection block */}
        <div className="bg-[#020202]/95 border border-white/10 rounded-sm p-4 flex flex-col justify-between backdrop-blur-md">
          <div className="flex justify-between items-center mb-1">
            <span className="text-[10px] font-mono text-gray-400 uppercase tracking-wider font-bold">Simulated Volatility Core</span>
            <Flame className={`w-4 h-4 ${volatility > 1.2 ? 'text-red-500 animate-bounce' : 'text-yellow-500'}`} />
          </div>
          <div className="space-y-2">
            <div className="flex justify-between text-xs font-mono">
              <span className="text-gray-500">Scale:</span>
              <span className={`font-bold ${volatility > 1.2 ? 'text-red-500' : 'text-[#00FF7F]'}`}>
                {volatility.toFixed(1)}x {volatility > 1.2 ? '(HIGH TURBULENCE)' : '(STABLE CAP)'}
              </span>
            </div>
            <input
              id="volatility-slider"
              type="range"
              min="0.4"
              max="2.0"
              step="0.2"
              value={volatility}
              onChange={(e) => onVolatilityChange(parseFloat(e.target.value))}
              className="w-full accent-[#00FF7F] bg-white/10 rounded-sm cursor-pointer h-1.5 focus:outline-none"
            />
          </div>
          <p className="text-[9px] font-mono text-gray-500 leading-relaxed uppercase mt-2">
            Adjusting volatility immediately shifts WebGL background matrix acceleration speed & price spreads.
          </p>
        </div>

      </div>

      {/* CORE 3-COLUMN WAR ROOM LAYOUT */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start pb-20">
        
        {/* COLUMN 1: Macro Event Stream (Width: 3/12 -> 25%) */}
        <div className="lg:col-span-3 bg-[#020202]/95 border border-white/10 rounded-sm p-4 flex flex-col h-[750px] overflow-hidden backdrop-blur-md">
          <div className="flex justify-between items-center border-b border-white/5 pb-3 mb-4">
            <div>
              <h3 className="font-sans text-lg text-white font-black uppercase tracking-tighter">Event Stream</h3>
              <p className="text-[10px] font-mono text-gray-500 uppercase tracking-widest">Feed • Updated Real-Time</p>
            </div>
            <Activity className="w-4 h-4 text-[#00FF7F]" />
          </div>

          <div className="flex-1 overflow-y-auto space-y-3.5 pr-1 scrollbar-thin">
            {signals.map((sig) => (
              <div
                key={sig.id}
                className="p-3.5 bg-black border border-white/5 hover:border-white/15 rounded-sm transition-all"
              >
                <div className="flex justify-between items-center mb-1.5">
                  <span className={`text-[9px] font-mono font-bold px-2 py-0.5 rounded-sm border ${
                    sig.source === 'CHAINLINK' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' :
                    sig.source === 'NANSEN' ? 'bg-purple-500/10 text-purple-400 border-purple-500/20' :
                    sig.source === 'ELFA' ? 'bg-pink-500/10 text-pink-400 border-pink-500/20' :
                    'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                  }`}>
                    {sig.source}
                  </span>
                  <span className="text-[10px] font-mono text-gray-500">{sig.timestamp}</span>
                </div>
                
                <p className="font-sans text-xs text-gray-200 leading-relaxed mb-2 font-light">
                  {sig.description}
                </p>

                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-mono text-gray-500">Weight: {(sig.weight).toFixed(2)}</span>
                  <span className={`text-[9px] font-mono font-bold uppercase rounded-sm px-2.5 py-0.5 inline-block ${
                    sig.status === 'ACTED' ? 'bg-[#00FF7F]/10 text-[#00FF7F] border border-[#00FF7F]/20 font-bold' :
                    sig.status === 'SKIPPED' ? 'bg-white/5 text-gray-500 border border-white/5' :
                    'bg-yellow-500/10 text-yellow-500 border border-yellow-500/20 animate-pulse'
                  }`}>
                    {sig.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* COLUMN 2: Decision Pipeline (Width: 5/12 -> 41.6%) */}
        <div className="lg:col-span-5 bg-[#020202]/95 border border-white/10 rounded-sm p-5 flex flex-col h-[750px] justify-between backdrop-blur-md overflow-hidden">
          
          <div>
            <div className="flex justify-between items-center border-b border-white/5 pb-3 mb-4">
              <div>
                <h3 className="font-sans text-lg text-white font-black uppercase tracking-tighter">Decision Pipeline</h3>
                <p className="text-[10px] font-mono text-gray-500 uppercase tracking-widest">Dynamic Node Graph Process</p>
              </div>
              <Cpu className="w-5 h-5 text-cyan-400 animate-pulse" />
            </div>

            {/* STAGE PIPELINE STACK */}
            <div className="space-y-3.5">
              
              {/* STAGE 1 */}
              <div className={`p-3.5 rounded-sm border transition-all ${
                pipelineActive && pipelineStage === 1 ? 'bg-[#00FF7F]/5 border-[#00FF7F] shadow-lg shadow-[#00FF7F]/5 scale-[1.01]' :
                pipelineActive && pipelineStage > 1 ? 'bg-black/20 border-white/5 opacity-60' : 'bg-black border border-white/5'
              }`}>
                <div className="flex justify-between items-center mb-1">
                  <span className="text-xs font-mono font-bold text-gray-300">Phase 01: Signal Intake & Influx</span>
                  {pipelineActive && pipelineStage === 1 && <span className="text-[10px] font-mono text-[#00FF7F] animate-pulse">Running...</span>}
                  {pipelineActive && pipelineStage > 1 && <span className="text-[10px] text-[#00FF7F] font-mono">Completed ✓</span>}
                </div>
                <p className="text-xs text-gray-400">Aggregates multi-source feeds from Oracle, social, onchain channels into state bundle.</p>
              </div>

              {/* STAGE 2 */}
              <div className={`p-3.5 rounded-sm border transition-all ${
                pipelineActive && pipelineStage === 2 ? 'bg-[#00f0ff]/5 border-[#00f0ff] shadow-lg shadow-[#00f0ff]/5 scale-[1.01]' :
                pipelineActive && pipelineStage > 2 ? 'bg-black/20 border-white/5 opacity-60' : 'bg-black border border-white/5'
              }`}>
                <div className="flex justify-between items-center mb-1">
                  <span className="text-xs font-mono font-bold text-gray-300">Phase 02: Model Weighting & ZK Compute</span>
                  {pipelineActive && pipelineStage === 2 && <span className="text-[10px] font-mono text-[#00f0ff] animate-pulse">Running...</span>}
                  {pipelineActive && pipelineStage > 2 && <span className="text-[10px] text-[#00f0ff] font-mono">Completed ✓</span>}
                </div>
                <p className="text-xs text-gray-400">Computes asset affinity vector weights and compiles Groth16 mathematical validity proof.</p>
              </div>

              {/* STAGE 3 */}
              <div className={`p-3.5 rounded-sm border transition-all ${
                pipelineActive && pipelineStage === 3 ? 'bg-yellow-500/5 border-yellow-500 shadow-lg shadow-yellow-500/5 scale-[1.01]' :
                pipelineActive && pipelineStage > 3 ? 'bg-black/20 border-white/5 opacity-60' : 'bg-black border border-white/5'
              }`}>
                <div className="flex justify-between items-center mb-1">
                  <span className="text-xs font-mono font-bold text-gray-300">Phase 03: Decentralized Guardrail Checks</span>
                  {pipelineActive && pipelineStage === 3 && <span className="text-[10px] font-mono text-yellow-400 animate-pulse">Checking...</span>}
                  {pipelineActive && pipelineStage > 3 && <span className="text-[10px] text-yellow-400 font-mono">Verifier Passed ✓</span>}
                </div>
                <p className="text-xs text-gray-400">Queries Solidity contract constraints: Whitelist verification, Slippage parameters, Epoch maximums.</p>
              </div>

              {/* STAGE 4 */}
              <div className={`p-3.5 rounded-sm border transition-all ${
                pipelineActive && pipelineStage === 4 ? 'bg-[#d000ff]/5 border-[#d000ff] shadow-lg shadow-[#d000ff]/5 scale-[1.01]' :
                pipelineActive && pipelineStage > 4 ? 'bg-black/20 border-white/5 opacity-60' : 'bg-black border border-white/5'
              }`}>
                <div className="flex justify-between items-center mb-1">
                  <span className="text-xs font-mono font-bold text-gray-300">Phase 04: Execution & Route dispatch</span>
                  {pipelineActive && pipelineStage === 4 && <span className="text-[10px] font-mono text-[#d000ff] animate-pulse">Routing...</span>}
                  {pipelineActive && pipelineStage > 4 && <span className="text-[10px] text-[#d000ff] font-mono">Dispatched ✓</span>}
                </div>
                <p className="text-xs text-gray-400">Dispatches execution parameters to Fluxion RFQ (EVM) or Super Portal routing pipeline.</p>
              </div>

              {/* STAGE 5 */}
              <div className={`p-3.5 rounded-sm border transition-all ${
                pipelineActive && pipelineStage === 5 ? 'bg-cyan-500/5 border-cyan-500 shadow-lg shadow-cyan-500/5 scale-[1.01]' :
                'bg-black border border-white/5'
              }`}>
                <div className="flex justify-between items-center mb-1">
                  <span className="text-xs font-mono font-bold text-gray-300">Phase 05: ERC-8004 Registry Log</span>
                  {pipelineActive && pipelineStage === 5 && <span className="text-[10px] font-mono text-cyan-400 animate-pulse">Verifying...</span>}
                </div>
                <p className="text-xs text-gray-400">Logs performance telemetry data and submits Groth16 execution proofs to Validation Registry.</p>
              </div>

            </div>
          </div>

          {/* LOWER PIPELINE STATUS DRAWER */}
          <div className="bg-black border border-white/10 p-4 rounded-sm mt-4">
            <span className="block text-[10px] font-mono text-gray-500 uppercase tracking-widest mb-1.5">Active Telemetry Info</span>
            <div className="p-2.5 bg-black/60 border border-gray-900 rounded-lg min-h-16 flex items-start gap-2.5 text-xs font-mono">
              <span className="relative flex h-2 w-2 mt-1.5">
                <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${pipelineActive ? 'bg-[#ff0055]' : 'bg-[#00D097]'}`} />
                <span className={`relative inline-flex rounded-full h-2 w-2 ${pipelineActive ? 'bg-[#ff0055]' : 'bg-[#00D097]'}`} />
              </span>
              <p className="text-gray-300 flex-1 leading-relaxed">
                {pipelineActive ? pipelineDetail : 'Awaiting scheduled block confirmation tick. Model idle in monitoring state...'}
              </p>
            </div>
          </div>

        </div>

        {/* COLUMN 3: Identity & Ledger (Width: 4/12 -> 33.3%) */}
        <div className="lg:col-span-4 space-y-6">
          
          {/* USER AGENT CARD */}
          <div className="bg-[#020202]/95 border border-white/10 rounded-sm p-4 backdrop-blur-md">
            <div className="flex items-center gap-3 border-b border-white/5 pb-3 mb-4">
              <div className="w-11 h-11 bg-[#00FF7F] rounded-sm flex items-center justify-center font-sans text-lg text-black font-black">
                V
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <h4 className="font-sans text-sm text-white font-black uppercase tracking-tighter">Agent #{agentId} • VIGIL</h4>
                  <span className="text-[10px] font-mono text-[#00FF7F] bg-[#00FF7F]/10 border border-[#00FF7F]/25 px-2 py-0.5 rounded-sm uppercase font-bold text-[9px]">Mantle L2</span>
                </div>
                <p className="text-xs text-gray-500 font-mono mt-0.5 whitespace-nowrap overflow-hidden text-ellipsis">Owner: {walletAddress}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="p-3 bg-black border border-white/5 rounded-sm text-center">
                <span className="text-[10px] font-mono text-gray-500 uppercase font-bold">Uptime Monitor</span>
                <span className="block text-xs font-bold text-white font-mono mt-1 whitespace-nowrap overflow-hidden">
                  {uptime}
                </span>
              </div>
              <div className="p-3 bg-black border border-white/5 rounded-sm text-center">
                <span className="text-[10px] font-mono text-gray-500 uppercase font-bold">ERC-8004 Reputation</span>
                <span className="block text-sm font-bold text-[#00FF7F] font-mono mt-0.5">
                  {reputationScore} / 1000
                </span>
                <div className="w-full bg-black h-1 rounded-sm mt-1 overflow-hidden border border-white/5">
                  <div className="h-full bg-[#00FF7F]" style={{ width: `${reputationScore / 10}%` }} />
                </div>
              </div>
            </div>

            {/* Current Asset Allocation bar */}
            <div>
              <span className="block text-[10px] font-mono text-gray-400 uppercase tracking-widest mb-2.5 font-bold">Current Vault RFI Allocation</span>
              <div className="space-y-2">
                {Object.entries(allocation).map(([symbol, percentage]) => (
                  <div key={symbol} className="text-xs">
                    <div className="flex justify-between font-mono text-gray-300 mb-0.5">
                      <span>{symbol}</span>
                      <span>{percentage}%</span>
                    </div>
                    <div className="w-full bg-black h-2 rounded-sm overflow-hidden border border-white/5">
                      <div
                        className={`h-full transition-all duration-1000 ${
                          symbol === 'mETH' ? 'bg-[#00f0ff]' :
                          symbol === 'USDY' ? 'bg-[#00FF7F]' :
                          symbol === 'NVDAx' ? 'bg-[#d000ff]' :
                          symbol === 'AAPLx' ? 'bg-yellow-500' : 'bg-red-500'
                        }`}
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>

          {/* ACTION LEDGER */}
          <div className="bg-[#020202]/95 border border-white/10 rounded-sm p-4 h-[414px] flex flex-col justify-between backdrop-blur-md overflow-hidden">
            <div>
              <div className="flex justify-between items-center border-b border-white/5 pb-3 mb-3">
                <div>
                  <h3 className="font-sans text-base text-white font-black uppercase tracking-tighter">Action Ledger</h3>
                  <p className="text-[10px] font-mono text-gray-500 uppercase tracking-widest">Historical Block Proofs</p>
                </div>
                <Database className="w-4 h-4 text-[#d000ff]" />
              </div>

              <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1 scrollbar-thin">
                {decisions.map((dec) => (
                  <div
                    key={dec.id}
                    onClick={() => setSelectedDecision(dec)}
                    className="p-2.5 bg-black border border-white/5 hover:border-white/10 rounded-sm transition-all cursor-pointer flex justify-between items-center group shadow-sm hover:shadow-md"
                  >
                    <div className="flex-1 min-w-0 pr-1">
                      <div className="flex items-center gap-1.5">
                        <span className={`text-[9px] font-mono font-bold px-1.5 py-0.2 rounded-sm uppercase ${
                          dec.action === 'ROTATE' ? 'bg-[#00FF7F]/10 text-[#00FF7F]' :
                          dec.action === 'CLMM_OPEN' ? 'bg-cyan-500/10 text-cyan-400' : 'bg-white/5 text-gray-400'
                        }`}>
                          {dec.action}
                        </span>
                        <span className="text-[9px] font-mono text-gray-500">{dec.timestamp}</span>
                      </div>
                      <p className="text-[11px] font-mono text-gray-200 mt-1 whitespace-nowrap overflow-hidden text-ellipsis uppercase font-bold">
                        {dec.fromAsset} {dec.action !== 'SKIP' && `→ ${dec.toAsset}`}
                      </p>
                      <span className="text-[9px] font-mono text-gray-400 flex items-center gap-1">
                        TX:
                        {dec.txHash && dec.txHash !== '0x0000000000000000000000000000000000000000000000000000000000000000' ? (
                          <a
                            href={`https://sepolia.mantlescan.xyz/tx/${dec.txHash}`}
                            target="_blank"
                            rel="noreferrer"
                            onClick={e => e.stopPropagation()}
                            className="text-[#00FF7F] hover:text-white flex items-center gap-0.5 transition-colors"
                            title="View on Mantle Sepolia"
                          >
                            {dec.txHash.slice(0, 8)}...
                            <ExternalLink className="w-2.5 h-2.5" />
                          </a>
                        ) : (
                          <span className="text-gray-600">0x0000... (skip)</span>
                        )}
                        {dec.action !== 'SKIP' && <span className="text-[#00FF7F] font-bold">{dec.outcomeDelta?.split(' ')[0]}</span>}
                      </span>
                    </div>
                    <ChevronRight className="w-4 h-4 text-gray-600 group-hover:text-white group-hover:translate-x-0.5 transition-all flex-shrink-0" />
                  </div>
                ))}
              </div>
            </div>

            <div className="text-[10px] font-mono text-gray-500 text-center uppercase tracking-widest border-t border-white/5 pt-2.5 font-bold">
              Select ledger cell to dissect proofs & verify cryptographic math.
            </div>

          </div>

        </div>

      </div>

      {/* Proof Modal Viewer Integration */}
      <ProofModal decision={selectedDecision} onClose={() => setSelectedDecision(null)} />

    </div>
  );
}
