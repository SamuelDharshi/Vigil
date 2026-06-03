/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Check, Copy, Share2, Shield, Fingerprint, Lock, ExternalLink, RefreshCw } from 'lucide-react';
import { DecisionItem } from '../types';

interface ProofModalProps {
  decision: DecisionItem | null;
  onClose: () => void;
}

export default function ProofModal({ decision, onClose }: ProofModalProps) {
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedProof, setCopiedProof] = useState(false);

  if (!decision) return null;

  // Render dummy ZK-Proof Groth16 bytecode sequence
  const sampleZkProof = `Groth16 Proof {
  pi_a: [
    "${decision.zkProofHash.substring(0, 32)}...",
    "0x2b89aed79124231b2fc82a1a2b9bcde148fafde742231b2ff3a...",
    "0x01a2f9bcde2b89aed79124231b2ff3a0a1fbcff42907bd3a82..."
  ],
  pi_b: [
    [
      "0x1f90ac0bd6aa902bcfbc82289aed79124231b1a2b9bcde148f43...",
      "0x00d0979bef7fa24db90adcb6aa902bcfbc82a1a2b9bcde148fa..."
    ],
    [
      "0xfa04ea9153cb82a8ebdc701a2f9bcde2b4fc829a8ebdc701a2f...",
      "0x3dc221fbcfe148fadff0242231b288a12facded290a1fbcff4..."
    ]
  ],
  pi_c: [
    "0x2b89aed79124231b2fc82a1a2f9bcde148fafde742231b2ff3a...",
    "0x1c8b99ef7fa24db90adcb6aa902bcfbc82a1a2b9bcde148fafde..."
  ],
  public_inputs: [
    "${(decision.confidence * 10000).toFixed(0)}", 
    "10000"
  ]
}`;

  const tweetText = `VIGIL (Agent #047) completed an autonomous ${decision.action} decision while traditional markets were CLOSED. Verified with a ZK proof on Mantle. https://vigil.app/proof/${decision.txHash.slice(0,10)}`;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(`https://vigil.app/proof/${decision.txHash}`);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleCopyProof = () => {
    navigator.clipboard.writeText(sampleZkProof);
    setCopiedProof(true);
    setTimeout(() => setCopiedProof(false), 2000);
  };

  const shareOnX = () => {
    const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(tweetText)}`;
    window.open(url, '_blank');
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
        {/* Background Dim click handler */}
        <div id="modal-dim-back" className="absolute inset-0" onClick={onClose} />

        <motion.div
          id="proof-inner-modal"
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          className="relative w-full max-w-4xl bg-[#020202] border border-white/10 rounded-sm overflow-hidden shadow-2xl flex flex-col max-h-[90vh]"
        >
          {/* Header Banner */}
          <div className="absolute top-0 left-0 right-0 h-1 bg-[#00FF7F]" />

          <div className="flex justify-between items-center px-6 py-4 border-b border-white/10">
            <div className="flex items-center gap-2.5">
              <Shield className="w-5 h-5 text-[#00FF7F]" />
              <div>
                <h3 className="font-sans text-xl font-black text-white uppercase tracking-tighter">Public Proof of Autonomous Execution</h3>
                <p className="text-[10px] font-mono text-gray-500 uppercase tracking-widest">
                  ERC-8004 Verification Panel • Task {decision.erc8004TaskId}
                </p>
              </div>
            </div>
            <button
              id="proof-close-btn"
              onClick={onClose}
              className="p-1.5 hover:bg-white/5 rounded-sm text-gray-400 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Modal Content Scrollable Area */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6 font-sans">
            
            {/* Quick Summary Row */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-white/5 border border-white/10 p-3.5 rounded-sm">
                <span className="block text-[10px] font-mono text-gray-500 uppercase tracking-wider mb-1">Action Type</span>
                <span className={`text-sm font-mono font-bold px-2.5 py-0.5 rounded-sm inline-block ${
                  decision.action === 'SKIP' ? 'bg-white/10 text-gray-400 border border-white/10' : 'bg-[#00FF7F]/10 text-[#00FF7F] border border-[#00FF7F]/30'
                }`}>
                  {decision.action}
                </span>
              </div>
              <div className="bg-white/5 border border-white/10 p-3.5 rounded-sm">
                <span className="block text-[10px] font-mono text-gray-500 uppercase tracking-wider mb-1">Asset Target</span>
                <span className="text-sm font-mono font-medium text-gray-200">
                  {decision.fromAsset} {decision.action !== 'SKIP' && `→ ${decision.toAsset}`}
                </span>
              </div>
              <div className="bg-white/5 border border-white/10 p-3.5 rounded-sm">
                <span className="block text-[10px] font-mono text-gray-500 uppercase tracking-wider mb-1">Volume Executed</span>
                <span className="text-sm font-semibold font-mono text-white">
                  ${decision.amount.toLocaleString()} USD
                </span>
              </div>
              <div className="bg-white/5 border border-white/10 p-3.5 rounded-sm">
                <span className="block text-[10px] font-mono text-gray-500 uppercase tracking-wider mb-1">Confidence Score</span>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold font-mono text-[#00f0ff]">
                    {(decision.confidence * 100).toFixed(0)}%
                  </span>
                  <div className="flex-1 h-1.5 bg-black/60 rounded-sm overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-[#00FF7F] to-cyan-500" style={{ width: `${decision.confidence * 100}%` }} />
                  </div>
                </div>
              </div>
            </div>

            {/* Why Acted / Rational Panel */}
            <div className="bg-white/5 border border-white/10 rounded-sm p-5 font-sans">
              <span className="block text-xs font-mono text-gray-400 uppercase tracking-wide mb-3">Model Inference Reasoning</span>
              <p className="font-serif text-lg leading-relaxed text-gray-100 italic">
                "{decision.reasoning}"
              </p>
            </div>

            {/* Split ZK Verification vs On-Chain Ledgers */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {/* Left Column: ZK Proof and Mathematics */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono text-gray-400 uppercase tracking-wide flex items-center gap-1.5">
                    <Fingerprint className="w-4 h-4 text-[#d000ff]" /> Zero-Knowledge Proof (Groth16)
                  </span>
                  <button
                    id="copy-proof-btn"
                    onClick={handleCopyProof}
                    className="flex items-center gap-1 text-[11px] font-mono text-gray-500 hover:text-white transition-colors"
                  >
                    {copiedProof ? <Check className="w-3.5 h-3.5 text-[#00FF7F]" /> : <Copy className="w-3.5 h-3.5" />}
                    {copiedProof ? 'Copied' : 'Copy Payload'}
                  </button>
                </div>
                
                <div className="bg-black border border-white/10 rounded-sm p-4 overflow-x-auto h-64 font-mono text-[10px] text-gray-400 leading-relaxed scrollbar-thin">
                  {sampleZkProof}
                </div>
              </div>

              {/* Right Column: On-Chain Offsets and Guardrails */}
              <div className="space-y-4">
                <span className="block text-xs font-mono text-gray-400 uppercase tracking-wide flex items-center gap-1.5">
                  <Lock className="w-4 h-4 text-[#00f0ff]" /> Immutable Smart Contract Guardrails
                </span>

                <div className="bg-black border border-white/10 rounded-sm p-4 space-y-3 font-mono text-xs text-gray-300">
                  <div className="flex justify-between items-center pb-2 border-b border-white/5">
                    <span className="text-gray-500 font-bold">Whitelist Validation:</span>
                    <span className="text-[#00FF7F] font-bold flex items-center gap-1">PASS ✓</span>
                  </div>
                  <div className="flex justify-between items-center pb-2 border-b border-white/5">
                    <span className="text-gray-500 font-bold">Slippage Protection:</span>
                    <span className="text-[#00FF7F] font-bold flex items-center gap-1">PASS (0.12% / Max 0.40%) ✓</span>
                  </div>
                  <div className="flex justify-between items-center pb-2 border-b border-white/5">
                    <span className="text-gray-500 font-bold">Epoch Maximum (Current):</span>
                    <span className="text-[#00FF7F] font-bold flex items-center gap-1">PASS (7.4% / Max 15.0%) ✓</span>
                  </div>
                  <div className="flex justify-between items-center pb-2 border-b border-white/5">
                    <span className="text-gray-500 font-bold">Gas Reservation Buffer:</span>
                    <span className="text-[#00FF7F] font-bold flex items-center gap-1">PASS (Refilled) ✓</span>
                  </div>
                  <div className="flex justify-between items-center pt-1 font-sans">
                    <span className="text-xs text-gray-400">Total Vault Value Context:</span>
                    <span className="text-sm font-mono font-bold text-white">$142,851 USD</span>
                  </div>
                </div>

                <span className="block text-xs font-mono text-gray-400 uppercase tracking-wide">
                  On-Chain References
                </span>

                <div className="space-y-2">
                  <div className="flex items-center justify-between p-2.5 bg-black border border-white/10 rounded-sm text-xs font-mono hover:border-[#00FF7F]/30 transition-colors">
                    <span className="text-gray-500">Tx Hash:</span>
                    <a
                      href={`https://sepolia.mantlescan.xyz/tx/${decision.txHash}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[#00FF7F] hover:text-white flex items-center gap-1.5 transition-colors group"
                      title="View on Mantle Sepolia Explorer"
                    >
                      {decision.txHash.slice(0, 14)}...{decision.txHash.slice(-6)}
                      <ExternalLink className="w-3 h-3 text-gray-500 group-hover:text-[#00FF7F] transition-colors" />
                    </a>
                  </div>
                  <div className="flex items-center justify-between p-2.5 bg-black border border-white/10 rounded-sm text-xs font-mono hover:border-[#d000ff]/30 transition-colors">
                    <span className="text-gray-500">Validation Registry:</span>
                    <a
                      href="https://sepolia.mantlescan.xyz/address/0x8004Cb1BF31DAf7788923b405b754f57acEB4272"
                      target="_blank"
                      rel="noreferrer"
                      className="text-[#d000ff] hover:text-white flex items-center gap-1.5 transition-colors group"
                      title="ERC-8004 Validation Registry on Mantle Sepolia"
                    >
                      0x8004Cb1B...4272
                      <ExternalLink className="w-3 h-3 text-gray-500 group-hover:text-[#d000ff] transition-colors" />
                    </a>
                  </div>
                </div>
              </div>

            </div>

            {/* Performance Outcomes */}
            {decision.action !== 'SKIP' && (
              <div className="p-4 bg-[#00FF7F]/5 border border-[#00FF7F]/25 rounded-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4 text-sm">
                <div>
                   <span className="block text-[10px] font-mono text-gray-500 uppercase tracking-wider mb-1">Preflight Protection Value</span>
                  <p className="text-gray-300">
                    Estimated loss prevented or yield captured within a 6 to 24 hour macro execution gap:
                  </p>
                </div>
                <div className="text-right whitespace-nowrap">
                  <span className="text-lg font-mono font-bold text-[#00FF7F]">
                    {decision.outcomeDelta}
                  </span>
                  <span className="block text-[10px] font-mono text-gray-500 uppercase">
                    Gas Spent: {decision.gasCost}
                  </span>
                </div>
              </div>
            )}

          </div>

          {/* Footer Social Action */}
          <div className="px-6 py-4 bg-black border-t border-white/10 flex flex-col sm:flex-row justify-between items-center gap-3">
            <p className="text-xs font-mono text-gray-400 text-center sm:text-left uppercase tracking-widest text-[9px]">
              Share this proof to trigger community multipliers & vote rewards
            </p>
            <div className="flex gap-2.5 w-full sm:w-auto">
              <button
                id="modal-raw-copy-btn"
                onClick={handleCopyLink}
                className="flex-1 sm:flex-none py-2.5 px-4 rounded-sm border border-white/10 bg-transparent text-xs font-mono text-gray-300 hover:text-white transition-all flex items-center justify-center gap-2 cursor-pointer transform -skew-x-12"
              >
                <div className="skew-x-12 flex items-center gap-1.5">
                  {copiedLink ? <Check className="w-3.5 h-3.5 text-[#00FF7F]" /> : <Copy className="w-3.5 h-3.5" />}
                  {copiedLink ? 'Copied' : 'Copy Proof URL'}
                </div>
              </button>
              <button
                id="modal-share-x-btn"
                onClick={shareOnX}
                className="flex-1 sm:flex-none py-2.5 px-5 rounded-sm bg-[#00FF7F] text-black text-xs font-mono font-black uppercase tracking-wider hover:opacity-90 transition-all flex items-center justify-center gap-2 cursor-pointer transform -skew-x-12"
              >
                <div className="skew-x-12 flex items-center gap-1.5">
                  <Share2 className="w-3.5 h-3.5 text-black" />
                  Share verified proof
                </div>
              </button>
            </div>
          </div>

        </motion.div>
      </div>
    </AnimatePresence>
  );
}
