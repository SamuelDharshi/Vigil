/**
 * AgentFlowGraph — VIGIL execution pipeline visualization
 * Styled after FlowForge: dark canvas, connected nodes, glowing on active stages
 * Each node lights up as the agent executes its corresponding pipeline step
 */
import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ExternalLink } from 'lucide-react';

export type PipelineStage =
  | 'idle'
  | 'signals'
  | 'inference'
  | 'guardrails'
  | 'execution'
  | 'ledger'
  | 'done';

export interface FlowNodeData {
  txHash?: string;
  confidence?: number;
  action?: string;
  reasoning?: string;
  asset?: string;
  gasCost?: string;
}

interface Props {
  activeStage: PipelineStage;
  nodeData: FlowNodeData;
  cycleCount: number;
}

const MANTLESCAN = 'https://sepolia.mantlescan.xyz/tx/';

const NODE_DEFS = [
  {
    id: 'signals',
    label: 'Signal\nAggregator',
    sublabel: 'Pyth · Elfa · Nansen',
    icon: '📡',
    x: 60,
    y: 160,
    color: '#00f0ff',
    stage: 'signals' as PipelineStage,
  },
  {
    id: 'inference',
    label: 'Decision\nEngine',
    sublabel: 'ERC-8004 · Gemini',
    icon: '🧠',
    x: 280,
    y: 80,
    color: '#d000ff',
    stage: 'inference' as PipelineStage,
  },
  {
    id: 'guardrails',
    label: 'Smart Contract\nGuardrails',
    sublabel: 'Slippage · Whitelist',
    icon: '🔒',
    x: 280,
    y: 240,
    color: '#f59e0b',
    stage: 'guardrails' as PipelineStage,
  },
  {
    id: 'execution',
    label: 'VIGILVault\nExecution',
    sublabel: 'Mantle Sepolia',
    icon: '⚡',
    x: 500,
    y: 160,
    color: '#00FF7F',
    stage: 'execution' as PipelineStage,
  },
  {
    id: 'ledger',
    label: 'On-Chain\nLedger',
    sublabel: 'ZK Proof · IPFS',
    icon: '📒',
    x: 700,
    y: 160,
    color: '#00FF7F',
    stage: 'ledger' as PipelineStage,
  },
];

const EDGES = [
  { from: 'signals', to: 'inference' },
  { from: 'signals', to: 'guardrails' },
  { from: 'inference', to: 'execution' },
  { from: 'guardrails', to: 'execution' },
  { from: 'execution', to: 'ledger' },
];

const NODE_W = 130;
const NODE_H = 72;

function getCenter(node: typeof NODE_DEFS[0]) {
  return { x: node.x + NODE_W / 2, y: node.y + NODE_H / 2 };
}

const STAGE_ORDER: PipelineStage[] = ['idle', 'signals', 'inference', 'guardrails', 'execution', 'ledger', 'done'];

function isStageActive(nodeStage: PipelineStage, active: PipelineStage) {
  const nodeIdx = STAGE_ORDER.indexOf(nodeStage);
  const activeIdx = STAGE_ORDER.indexOf(active);
  return activeIdx >= nodeIdx;
}

function isNodeGlowing(nodeStage: PipelineStage, active: PipelineStage) {
  return active === nodeStage;
}

export default function AgentFlowGraph({ activeStage, nodeData, cycleCount }: Props) {
  const svgW = 860;
  const svgH = 360;

  const activeStageIdx = STAGE_ORDER.indexOf(activeStage);

  return (
    <div className="relative w-full bg-[#0a0a0f] border border-white/8 rounded-sm overflow-hidden select-none">
      {/* Header bar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-white/5 bg-black/40">
        <div className="flex items-center gap-2.5">
          <div className="w-2 h-2 rounded-full bg-[#00FF7F] animate-pulse" />
          <span className="text-[11px] font-mono font-black uppercase tracking-widest text-white">
            Agent Pipeline
          </span>
          <span className="text-[9px] font-mono text-gray-600 uppercase">
            ERC-8004 · Mantle Sepolia
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[9px] font-mono text-gray-600">Cycle #{cycleCount}</span>
          <div className={`flex items-center gap-1.5 text-[9px] font-mono px-2 py-0.5 rounded-full border ${
            activeStage === 'idle' || activeStage === 'done'
              ? 'text-gray-600 border-white/5'
              : 'text-[#00FF7F] border-[#00FF7F]/25 bg-[#00FF7F]/5'
          }`}>
            {activeStage === 'idle' ? 'IDLE' : activeStage === 'done' ? 'COMPLETE' : 'RUNNING'}
          </div>
        </div>
      </div>

      {/* SVG Canvas */}
      <div className="relative overflow-hidden" style={{ height: svgH }}>
        {/* Background grid */}
        <svg
          className="absolute inset-0 w-full h-full opacity-10"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <pattern id="grid" width="24" height="24" patternUnits="userSpaceOnUse">
              <path d="M 24 0 L 0 0 0 24" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="0.5" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />
        </svg>

        <svg
          viewBox={`0 0 ${svgW} ${svgH}`}
          className="absolute inset-0 w-full h-full"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            {NODE_DEFS.map(n => (
              <filter key={`glow-${n.id}`} id={`glow-${n.id}`} x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="6" result="coloredBlur" />
                <feMerge>
                  <feMergeNode in="coloredBlur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            ))}
            <marker id="arrowhead" markerWidth="6" markerHeight="6" refX="3" refY="3" orient="auto">
              <path d="M0,0 L0,6 L6,3 Z" fill="rgba(255,255,255,0.2)" />
            </marker>
            <marker id="arrowhead-active" markerWidth="6" markerHeight="6" refX="3" refY="3" orient="auto">
              <path d="M0,0 L0,6 L6,3 Z" fill="#00FF7F" />
            </marker>
          </defs>

          {/* Edges */}
          {EDGES.map(edge => {
            const fromNode = NODE_DEFS.find(n => n.id === edge.from)!;
            const toNode = NODE_DEFS.find(n => n.id === edge.to)!;
            const from = getCenter(fromNode);
            const to = getCenter(toNode);

            const isActive = isStageActive(fromNode.stage, activeStage) && isStageActive(toNode.stage, activeStage);
            const isAnimating = activeStage === fromNode.stage || activeStage === toNode.stage;

            // Bezier control points
            const dx = to.x - from.x;
            const cp1x = from.x + dx * 0.4;
            const cp2x = from.x + dx * 0.6;

            return (
              <g key={`${edge.from}-${edge.to}`}>
                {/* Shadow edge */}
                <path
                  d={`M ${from.x} ${from.y} C ${cp1x} ${from.y} ${cp2x} ${to.y} ${to.x} ${to.y}`}
                  fill="none"
                  stroke="rgba(255,255,255,0.04)"
                  strokeWidth="4"
                />
                {/* Main edge */}
                <path
                  d={`M ${from.x} ${from.y} C ${cp1x} ${from.y} ${cp2x} ${to.y} ${to.x} ${to.y}`}
                  fill="none"
                  stroke={isActive ? '#00FF7F' : 'rgba(255,255,255,0.12)'}
                  strokeWidth={isActive ? 1.5 : 1}
                  strokeDasharray={isAnimating ? '6 4' : 'none'}
                  markerEnd={isActive ? 'url(#arrowhead-active)' : 'url(#arrowhead)'}
                  style={isAnimating ? { animation: 'dash 1.5s linear infinite' } : {}}
                  opacity={isActive ? 0.9 : 0.4}
                />
                {/* Animated pulse dot on active edges */}
                {isAnimating && (
                  <circle r="3" fill="#00FF7F" opacity="0.8">
                    <animateMotion
                      dur="1.8s"
                      repeatCount="indefinite"
                      path={`M ${from.x} ${from.y} C ${cp1x} ${from.y} ${cp2x} ${to.y} ${to.x} ${to.y}`}
                    />
                  </circle>
                )}
              </g>
            );
          })}

          {/* Nodes */}
          {NODE_DEFS.map(node => {
            const glowing = isNodeGlowing(node.stage, activeStage);
            const done = isStageActive(node.stage, activeStage) && !glowing;

            return (
              <g key={node.id} transform={`translate(${node.x}, ${node.y})`}>
                {/* Glow backdrop when active */}
                {glowing && (
                  <rect
                    x={-4} y={-4}
                    width={NODE_W + 8} height={NODE_H + 8}
                    rx="7"
                    fill={node.color}
                    opacity="0.08"
                    filter={`url(#glow-${node.id})`}
                  />
                )}

                {/* Node body */}
                <rect
                  width={NODE_W} height={NODE_H}
                  rx="5"
                  fill={glowing ? `${node.color}18` : done ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.6)'}
                  stroke={glowing ? node.color : done ? `${node.color}50` : 'rgba(255,255,255,0.1)'}
                  strokeWidth={glowing ? 1.5 : 1}
                />

                {/* Top status bar */}
                {(glowing || done) && (
                  <rect
                    width={NODE_W} height={2.5}
                    rx="2"
                    fill={node.color}
                    opacity={glowing ? 1 : 0.5}
                  />
                )}

                {/* Icon */}
                <text x={12} y={28} fontSize={16} dominantBaseline="middle">{node.icon}</text>

                {/* Label */}
                <text
                  x={34} y={22}
                  fill={glowing ? '#ffffff' : done ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.35)'}
                  fontSize={9.5}
                  fontFamily="monospace"
                  fontWeight="700"
                  letterSpacing="0.05em"
                >
                  {node.label.split('\n')[0].toUpperCase()}
                </text>
                <text
                  x={34} y={35}
                  fill={glowing ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.25)'}
                  fontSize={9.5}
                  fontFamily="monospace"
                  fontWeight="700"
                  letterSpacing="0.05em"
                >
                  {node.label.split('\n')[1]?.toUpperCase()}
                </text>

                {/* Sublabel */}
                <text
                  x={10} y={54}
                  fill={glowing ? node.color : 'rgba(255,255,255,0.2)'}
                  fontSize={7.5}
                  fontFamily="monospace"
                  letterSpacing="0.04em"
                >
                  {node.sublabel}
                </text>

                {/* Done checkmark */}
                {done && (
                  <text x={NODE_W - 14} y={14} fontSize={10} fill={node.color} opacity={0.7}>✓</text>
                )}

                {/* Spinning indicator when active */}
                {glowing && (
                  <circle
                    cx={NODE_W - 10} cy={10} r={4}
                    fill="none"
                    stroke={node.color}
                    strokeWidth={1.5}
                    strokeDasharray="6 4"
                  >
                    <animateTransform
                      attributeName="transform"
                      type="rotate"
                      from={`0 ${NODE_W - 10} 10`}
                      to={`360 ${NODE_W - 10} 10`}
                      dur="1.5s"
                      repeatCount="indefinite"
                    />
                  </circle>
                )}

                {/* Left handle */}
                {node.id !== 'signals' && (
                  <circle cx={0} cy={NODE_H / 2} r={3.5} fill="#111" stroke="rgba(255,255,255,0.15)" strokeWidth={1} />
                )}
                {/* Right handle */}
                {node.id !== 'ledger' && (
                  <circle cx={NODE_W} cy={NODE_H / 2} r={3.5} fill="#111" stroke="rgba(255,255,255,0.15)" strokeWidth={1} />
                )}
              </g>
            );
          })}
        </svg>

        <style>{`
          @keyframes dash { to { stroke-dashoffset: -20; } }
        `}</style>
      </div>

      {/* Execution Output Panel */}
      <AnimatePresence>
        {(activeStage === 'execution' || activeStage === 'ledger' || activeStage === 'done') && nodeData.txHash && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="border-t border-white/8 bg-black/60 overflow-hidden"
          >
            <div className="px-4 py-3 space-y-2">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[9px] font-mono uppercase tracking-widest text-gray-500">Execution Output</span>
                <div className="flex-1 h-px bg-white/5" />
                <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded-sm ${
                  nodeData.action === 'SKIP' ? 'bg-white/5 text-gray-500' : 'bg-[#00FF7F]/10 text-[#00FF7F]'
                }`}>
                  {nodeData.action || 'SKIP'}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-x-6 gap-y-1 font-mono text-[10px]">
                <div className="flex justify-between">
                  <span className="text-gray-600">TX Hash</span>
                  {nodeData.txHash && nodeData.txHash !== '0x' + '0'.repeat(64) ? (
                    <a
                      href={`${MANTLESCAN}${nodeData.txHash}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[#00FF7F] hover:text-white flex items-center gap-1 transition-colors"
                    >
                      {nodeData.txHash.slice(0, 10)}...{nodeData.txHash.slice(-6)}
                      <ExternalLink className="w-2.5 h-2.5" />
                    </a>
                  ) : (
                    <span className="text-gray-600">No TX (Skip)</span>
                  )}
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Confidence</span>
                  <span className="text-cyan-400">{nodeData.confidence ? `${(nodeData.confidence * 100).toFixed(0)}%` : '–'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Asset</span>
                  <span className="text-white">{nodeData.asset || 'mETH → USDY'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Gas</span>
                  <span className="text-gray-400">{nodeData.gasCost || '–'}</span>
                </div>
              </div>

              {nodeData.reasoning && (
                <p className="text-[9px] text-gray-500 font-sans leading-relaxed border-t border-white/5 pt-2 line-clamp-2">
                  {nodeData.reasoning}
                </p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bottom stage progress bar */}
      <div className="flex border-t border-white/5">
        {STAGE_ORDER.filter(s => s !== 'idle' && s !== 'done').map(stage => {
          const isActive = activeStage === stage;
          const isDone = activeStageIdx > STAGE_ORDER.indexOf(stage) && activeStage !== 'idle';
          return (
            <div
              key={stage}
              className={`flex-1 py-1 text-center text-[8px] font-mono uppercase tracking-widest transition-all ${
                isActive ? 'text-[#00FF7F] bg-[#00FF7F]/8' : isDone ? 'text-gray-600 bg-white/2' : 'text-gray-700'
              }`}
            >
              {stage}
            </div>
          );
        })}
      </div>
    </div>
  );
}
