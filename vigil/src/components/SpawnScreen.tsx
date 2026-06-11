/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Activity, ShieldAlert, Cpu, Sparkles, Database, FileKey, Waypoints } from 'lucide-react';
import { generateRandomHash } from '../data';

interface SpawnScreenProps {
  onSpawnComplete: (walletAddress: string, agentId: string) => void;
}

export default function SpawnScreen({ onSpawnComplete }: SpawnScreenProps) {
  const [wallet, setWallet] = useState('0xac13a62FC7E50d08945ba2e79B5Eaa190d8D7D9a'); // standard sample
  const [customWallet, setCustomWallet] = useState(false);
  const [isSpawning, setIsSpawning] = useState(false);
  const [spawnStage, setSpawnStage] = useState(0);
  const [spawnLogs, setSpawnLogs] = useState<string[]>([]);
  const [agentId, setAgentId] = useState('');

  const stages = [
    { text: 'Scanning Mantle network state...', duration: 1500, icon: Waypoints },
    { text: 'Instantiating ERC-8004 standard environment...', duration: 1800, icon: Cpu },
    { text: 'Minting secure autonomous Agent NFT Identity...', duration: 2000, icon: Sparkles },
    { text: 'Generating IPFS metadata card & pinning via Filecoin...', duration: 1600, icon: Database },
    { text: 'Establishing secure wallet pairing & signing local keys...', duration: 1500, icon: FileKey },
    { text: 'Handshaking with Groth16 Validation Registry on-chain...', duration: 1400, icon: Activity },
  ];

  useEffect(() => {
    if (!isSpawning) return;

    if (spawnStage < stages.length) {
      const stage = stages[spawnStage];
      const timer = setTimeout(() => {
        const timestamp = new Date().toISOString().substring(11, 19);
        let logText = `[${timestamp}] `;
        
        switch (spawnStage) {
          case 0:
            logText += `SYSTEM: Found nodes on Mantle L2. RPC ping: 12ms. Status: ACTIVE.`;
            break;
          case 1:
            logText += `ERC-8004: Identity Registry bound to address: 0x8004A169b2F0c2D19aCdCBb2829ecDc1a2b97912.`;
            break;
          case 2:
            const newId = Math.floor(100 + Math.random() * 900).toString();
            setAgentId(newId);
            logText += `MINT: Success. Minted ERC-8004 Agent NFT with ID #${newId}. TX: ${generateRandomHash(24)}`;
            break;
          case 3:
            logText += `IPFS: Card pinned successfully to CID: QmYwAPzEwnPyf1DTSA2DcA219uV39w9w3j255S6...`;
            break;
          case 4:
            logText += `SECURITY: Generated agent operational keys (Secp256k1) and assigned gas reserve wallet.`;
            break;
          case 5:
            logText += `ZK: Handshake complete. Verification address synchronized. Ready for 24/7 autonomous cycles.`;
            break;
        }

        setSpawnLogs((prev) => [...prev, `[${timestamp}] START: ${stage.text}`, logText]);
        setSpawnStage((prev) => prev + 1);
      }, stage.duration);

      return () => clearTimeout(timer);
    } else {
      // Completed!
      const timer = setTimeout(() => {
        onSpawnComplete(wallet, agentId || '047');
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [isSpawning, spawnStage, wallet, onSpawnComplete, agentId]);

  const handleStartSpawn = (e: React.FormEvent) => {
    e.preventDefault();
    if (!wallet.match(/^0x[a-fA-F0-9]{40}$/)) {
      alert('Please enter a valid Ethereum / Mantle wallet address (0x followed by 40 hex characters).');
      return;
    }
    setIsSpawning(true);
    setSpawnLogs([`[${new Date().toISOString().substring(11, 19)}] INITIALIZATION: Triggering agent allocation...`]);
  };

  const handleGenerateWallet = () => {
    setWallet(generateRandomHash(40));
    setCustomWallet(true);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative z-10 font-sans text-gray-200">
      <AnimatePresence mode="wait">
        {!isSpawning ? (
          <motion.div
            id="spawn-setup-card"
            key="setup"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -30 }}
            className="w-full max-w-lg bg-[#0e1116]/95 border border-gray-800 rounded-2xl p-8 shadow-2xl backdrop-blur-md relative overflow-hidden"
          >
            {/* Top design accent */}
            <div className="absolute top-0 left-0 right-0 h-1 bg-[#00FF7F]" />
            
            <div className="flex flex-col items-center mb-6 text-center">
              <div className="w-16 h-16 rounded bg-[#00FF7F]/10 flex items-center justify-center border border-[#00FF7F]/30 mb-4 animate-pulse">
                <Cpu className="w-8 h-8 text-[#00FF7F]" />
              </div>
              <h1 className="font-sans text-3xl text-white font-black tracking-tighter uppercase mb-1">
                Deploy VIGIL Agent
              </h1>
              <p className="text-sm font-mono text-[#00FF7F] tracking-wider uppercase">
                MANTLE TURING TEST HACKATHON 2026
              </p>
            </div>

            <div className="p-4 bg-white/5 border border-white/10 rounded-sm mb-6 flex gap-3 text-xs text-yellow-300">
              <ShieldAlert className="w-5 h-5 flex-shrink-0 text-yellow-400" />
              <div>
                <p className="font-bold uppercase tracking-wider mb-1 text-yellow-400">Mantle Autonomous Guardrails Active</p>
                <p className="text-gray-400 leading-relaxed">
                  Your spawned agent will be bound permanently to your address. All portfolio rotations are locked under decentralized smart contract constraints.
                </p>
              </div>
            </div>

            <form onSubmit={handleStartSpawn} className="space-y-4">
              <div>
                <label className="block text-[10px] font-mono tracking-widest uppercase text-gray-500 mb-2">
                  Bonding Wallet Address (Mantle Network)
                </label>
                <div className="flex gap-2">
                  <input
                    id="wallet-input"
                    type="text"
                    value={wallet}
                    onChange={(e) => {
                      setWallet(e.target.value);
                      setCustomWallet(true);
                    }}
                    placeholder="0x..."
                    className="w-full px-4 py-3 bg-[#020202] border border-white/15 rounded-sm focus:border-[#00FF7F] outline-none font-mono text-sm text-gray-300 transition-colors"
                  />
                  <button
                    id="gen-wallet-btn"
                    type="button"
                    onClick={handleGenerateWallet}
                    className="px-3 bg-white/5 border border-white/10 hover:border-white/25 rounded-sm text-xs font-mono text-gray-300 transition-colors whitespace-nowrap"
                  >
                    Generate Real
                  </button>
                </div>
              </div>

              <button
                id="spawn-agent-btn"
                type="submit"
                className="w-full py-4 bg-[#00FF7F] text-black font-black rounded-sm hover:opacity-95 transition-all text-xs uppercase tracking-widest transform -skew-x-12 cursor-pointer shadow-lg shadow-[#00FF7F]/20 flex items-center justify-center gap-2 font-mono"
              >
                <div className="skew-x-12 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-black" />
                  Initialize Vigil Core Protocol
                </div>
              </button>
            </form>

            <div className="mt-6 pt-6 border-t border-white/10 flex items-center justify-between text-[10px] font-mono text-gray-500 uppercase tracking-widest">
              <span>Standard: ERC-8004 Identity</span>
              <span>Network: Mantle Sepolia</span>
            </div>
          </motion.div>
        ) : (
          <motion.div
            id="spawning-progress-card"
            key="progress"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="w-full max-w-xl bg-[#020202]/95 border border-white/10 rounded-sm p-6 shadow-2xl backdrop-blur-md"
          >
            {/* Stage Title */}
            <div className="flex items-center justify-between border-b border-white/10 pb-4 mb-4">
              <div className="flex items-center gap-3">
                <span className="w-2.5 h-2.5 rounded-full bg-[#00FF7F] animate-ping" />
                <h2 className="text-lg font-sans font-black text-white uppercase tracking-tighter">Spawning Agent VIGIL...</h2>
              </div>
              <div className="text-xs font-mono text-[#00FF7F] font-bold">
                {Math.round((spawnStage / stages.length) * 100)}% Complete
              </div>
            </div>

            {/* Stages visualization */}
            <div className="space-y-3 mb-6">
              {stages.map((stg, idx) => {
                const Icon = stg.icon;
                const isCompleted = spawnStage > idx;
                const isActive = spawnStage === idx;

                return (
                  <div
                    key={idx}
                    className={`flex items-center gap-3 p-2.5 rounded-sm border transition-all ${
                      isCompleted
                        ? 'bg-[#00FF7F]/5 border-[#00FF7F]/25 text-[#00FF7F]'
                        : isActive
                        ? 'bg-white/5 border-white/20 text-white shadow-md'
                        : 'bg-transparent border-transparent text-gray-600'
                    }`}
                  >
                    <div
                      className={`w-7 h-7 rounded-sm flex items-center justify-center border text-xs ${
                        isCompleted
                          ? 'border-[#00FF7F]/40 bg-[#00FF7F]/10'
                          : isActive
                          ? 'border-white/30 bg-white/5 animate-spin'
                          : 'border-transparent'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="flex-1 text-sm font-mono tracking-wide">{stg.text}</div>
                    {isCompleted && <span className="text-xs font-mono font-bold">OK</span>}
                  </div>
                );
              })}
            </div>

            {/* Telemetry Console */}
            <div className="bg-[#020202] border border-white/10 rounded-sm p-4 h-44 overflow-y-auto font-mono text-xs text-gray-400 space-y-1.5 scrollbar-thin">
              <div className="text-gray-500 border-b border-white/5 pb-1.5 mb-1.5 uppercase text-[10px] tracking-widest flex justify-between">
                <span>VIGIL System Core Telemetry Logging</span>
                <span className="text-[#00FF7F] font-bold">Live Link</span>
              </div>
              {spawnLogs.map((log, lidx) => (
                <div key={lidx} className={log.includes('START') ? 'text-cyan-400 font-medium' : log.includes('SYSTEM') || log.includes('OK') || log.includes('Success') ? 'text-[#00FF7F]' : 'text-gray-400'}>
                  {log}
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
