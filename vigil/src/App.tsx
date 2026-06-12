/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { Shield, Sparkles, HelpCircle, ChevronDown, CheckCircle2, AlertCircle, TrendingUp, Info, BarChart2, Database, Box, Sun, Moon } from 'lucide-react';
import ThreeBackground from './components/ThreeBackground';
import SpawnScreen from './components/SpawnScreen';
import WarRoom from './components/WarRoom';
import MarketClock from './components/MarketClock';

export default function App() {
  const navigate = useNavigate();
  const [scrollProgress, setScrollProgress] = useState(0);
  const [volatility, setVolatility] = useState(1.0);
  
  // App routing state
  const [showSpawn, setShowSpawn] = useState(false);
  const [isSpawned, setIsSpawned] = useState(false);
  const [wallet, setWallet] = useState('');
  const [agentId, setAgentId] = useState('047');

  // Theme state
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    return (localStorage.getItem('theme') as 'dark' | 'light') || 'dark';
  });

  // Page Scroll Tracker
  useEffect(() => {
    const handleScroll = () => {
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      if (docHeight <= 0) return;
      const progress = window.scrollY / docHeight;
      setScrollProgress(Math.min(Math.max(progress, 0), 1));
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();

    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    const root = document.getElementById('vigil-root-container');
    if (!root) return;
    if (theme === 'light') {
      root.classList.add('light');
    } else {
      root.classList.remove('light');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  const handleSpawnComplete = (userWallet: string, assignedId: string) => {
    setWallet(userWallet);
    setAgentId(assignedId);
    setIsSpawned(true);
    setShowSpawn(false);
  };

  return (
    <div id="vigil-root-container" className="relative min-h-screen bg-[#020202] overflow-x-hidden selection:bg-[#00FF7F]/30 selection:text-white transition-colors duration-300">
      
      {/* Absolute FIXED Three.js background reacting smoothly to scrolls & volatility */}
      <ThreeBackground scrollProgress={scrollProgress} volatility={volatility} theme={theme} />

      {/* Floating Header */}
      <header className="fixed top-0 left-0 right-0 h-16 border-b border-white/5 bg-[#020202]/90 backdrop-blur-md z-40 px-4 md:px-8 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded bg-linear-to-br from-[#00FF7F] to-cyan-400 p-0.5">
            <div className="w-full h-full bg-[#020202] rounded-sm flex items-center justify-center font-serif font-black text-[#00FF7F] text-md">
              V
            </div>
          </div>
          <div>
            <h1 className="font-sans font-black tracking-tighter text-lg text-white leading-none">
              VIGIL<span className="text-[#00FF7F]">.</span>
            </h1>
            <span className="text-[9px] font-mono uppercase text-gray-500 tracking-wider">Autonomous RWA Sentinel</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-2 text-xs font-mono text-gray-400 border border-white/10 rounded-full px-3.5 py-1 bg-white/5">
            <span className="w-2 h-2 rounded-full bg-[#00FF7F] animate-pulse" />
            Mantle: AI × RWA Track
          </div>

          {/* Page nav links */}
          <div className="hidden md:flex items-center gap-1">
            {[
              { label: 'War Room', path: '/warroom', color: 'hover:text-[#00FF7F]' },
              { label: 'Charts', path: '/charts', color: 'hover:text-cyan-400' },
              { label: 'Proofs', path: '/proof', color: 'hover:text-[#d000ff]' },
              { label: 'Market', path: '/3d', color: 'hover:text-yellow-400' },
            ].map(({ label, path, color }) => (
              <button
                key={path}
                onClick={() => navigate(path)}
                className={`px-3 py-1 text-[11px] font-mono text-gray-500 ${color} transition-colors cursor-pointer rounded hover:bg-white/5`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Theme Toggle Button */}
          <button
            id="theme-toggle-btn"
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="p-2 rounded border border-white/10 bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-all cursor-pointer flex items-center justify-center"
            title={theme === 'dark' ? 'Switch to Light Theme' : 'Switch to Dark Theme'}
          >
            {theme === 'dark' ? (
              <Sun className="w-3.5 h-3.5 text-[#00FF7F]" />
            ) : (
              <Moon className="w-3.5 h-3.5 text-gray-800" />
            )}
          </button>
          
          {!isSpawned && !showSpawn && (
            <button
              id="header-spawn-btn"
              onClick={() => setShowSpawn(true)}
              className="py-1.5 px-4 bg-[#00FF7F] text-black font-black text-xs rounded-sm hover:opacity-90 transform -skew-x-12 transition-all uppercase tracking-wider font-mono cursor-pointer"
            >
              <div className="skew-x-12">Deploy Agent</div>
            </button>
          )}

          {isSpawned && (
            <div className="flex items-center gap-2 font-mono text-xs text-gray-300">
              <span className="text-[#00FF7F]">●</span>
              <span>Id: #{agentId}</span>
            </div>
          )}
        </div>
      </header>

      {/* Primary Interaction Interface Switch */}
      <AnimatePresence mode="wait">
        {showSpawn ? (
          <motion.div
            id="spawn-mount-zone"
            key="spawn"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="pt-20 pb-12"
          >
            <SpawnScreen onSpawnComplete={handleSpawnComplete} />
          </motion.div>
        ) : isSpawned ? (
          <motion.div
            id="warroom-mount-zone"
            key="warroom"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <WarRoom
              walletAddress={wallet}
              agentId={agentId}
              volatility={volatility}
              onVolatilityChange={setVolatility}
            />
          </motion.div>
        ) : (
          <motion.div
            id="landing-mount-zone"
            key="landing"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col relative z-20"
          >
            {/* HERO SECTION */}
            <section className="min-h-screen flex flex-col justify-center items-start text-left px-6 md:px-16 lg:px-24 pt-24 relative max-w-7xl mx-auto">
              <div className="max-w-3xl space-y-6 md:space-y-8">
                
                <div className="inline-flex items-center gap-2 rounded-full border border-[#00FF7F]/20 bg-[#00FF7F]/5 px-3.5 py-1 font-mono text-xs text-[#00FF7F] shadow-lg shadow-[#00FF7F]/5">
                  <Sparkles className="w-3.5 h-3.5 text-[#00FF7F]" />
                  <span>Mantle Turing Test Hackathon Entry</span>
                </div>

                <h1 className="font-sans text-4xl md:text-6xl lg:text-7xl leading-[0.9] font-black tracking-tighter neon-text uppercase text-white">
                  THE MARKET<br />
                  NEVER <span className="text-transparent text-stroke-neon">SLEEPS.</span><br />
                  NEITHER DOES <span className="text-[#00FF7F]">VIGIL.</span>
                </h1>

                <p className="font-sans text-sm md:text-base text-gray-400 max-w-xl leading-relaxed font-light">
                  Traditional multi-billion dollar equity books freeze every Friday at 4:00 PM. On-chain, execution is eternal. VIGIL is an autonomous sentinel continuously rebalancing portfolios across mETH, stable treasury yields, and tokenized real-assets (xStocks).
                </p>

                <div className="flex flex-col sm:flex-row gap-4 justify-start items-center pt-2">
                  <button
                    id="hero-spawn-trigger-btn"
                    onClick={() => setShowSpawn(true)}
                    className="w-full sm:w-auto py-3 px-8 bg-[#00FF7F] text-black font-black rounded-sm text-xs uppercase tracking-wider transform -skew-x-12 hover:scale-105 transition-all cursor-pointer shadow-lg shadow-[#00FF7F]/20"
                  >
                    <div className="skew-x-12">Deploy Autonomous Agent</div>
                  </button>
                  <a
                    id="hero-scroll-trigger-btn"
                    href="#details-features"
                    className="w-full sm:w-auto py-3 px-8 border border-white/20 hover:border-white/40 hover:bg-white/5 rounded-sm text-xs font-mono tracking-wider font-bold text-gray-300 hover:text-white transform -skew-x-12 transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <div className="skew-x-12 flex items-center gap-1.5">
                      Explore Philosophy
                      <ChevronDown className="w-4 h-4" />
                    </div>
                  </a>
                </div>

                {/* Clock indicator inside landing */}
                <div className="pt-4 max-w-md">
                  <div className="p-3 bg-white/5 border border-white/10 rounded-lg font-mono text-[10px] md:text-xs text-gray-400 flex items-center justify-start gap-3">
                    <span>NYSE / NASDAQ: <span className="text-[#ff0055]">CLOSED</span></span>
                    <span className="text-gray-700">|</span>
                    <span className="flex items-center gap-1.5 text-[#00FF7F]">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#00FF7F] animate-ping" />
                      VIGIL ALIVE (24/7 ACTIVE)
                    </span>
                  </div>
                </div>

              </div>

              {/* Scroll prompt marker */}
              <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1">
                <span className="text-[10px] font-mono uppercase tracking-widest text-gray-600">Scroll to explore Market</span>
                <motion.div
                  animate={{ y: [0, 6, 0] }}
                  transition={{ repeat: Infinity, duration: 2 }}
                >
                  <ChevronDown className="w-4 h-4 text-gray-600" />
                </motion.div>
              </div>


            </section>

            {/* PRODUCT DETAILS GRID */}
            <section id="details-features" className="min-h-screen py-16 px-4 md:px-8 max-w-7xl mx-auto flex flex-col justify-center gap-16 relative">
              
              <div className="max-w-3xl text-left">
                <span className="text-[10px] font-mono text-[#00FF7F] uppercase tracking-widest block mb-2">Technical Paradigm</span>
                <h2 className="font-sans text-3xl md:text-5xl text-white font-black tracking-tighter uppercase mb-4">
                  Decentralized overnight risk parity.
                </h2>
                <p className="text-gray-400 font-sans leading-relaxed text-base">
                  While institutions wait until Monday morning for major earnings and guidance drops, VIGIL's 30-minute evaluation loops read oracle parameters, Smart Money transfers, and social vectors—instantly executing portfolio rebalances via Fluxion RFQ.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                
                {/* Visual Block 1 */}
                <div className="p-6 bg-white/5 border border-white/10 rounded-xl backdrop-blur-md space-y-4">
                  <div className="w-10 h-10 rounded bg-[#00FF7F]/15 border border-[#00FF7F]/30 flex items-center justify-center">
                    <Shield className="w-5 h-5 text-[#00FF7F]" />
                  </div>
                  <h3 className="font-serif text-xl font-medium text-white">Solidity Vault Guardrails</h3>
                  <p className="text-sm text-gray-400 leading-relaxed">
                    Zero risk of AI hallucinations. Hardcoded onchain limits prevent any trade exceeding the slippage tolerance (0.40%) or historical single-transaction allocations. Your principal is cryptographically sealed inside VIGILVault.
                  </p>
                </div>

                {/* Visual Block 2 */}
                <div className="p-6 bg-white/5 border border-white/10 rounded-xl backdrop-blur-md space-y-4 font-sans">
                  <div className="w-10 h-10 rounded bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center">
                    <TrendingUp className="w-5 h-5 text-cyan-400" />
                  </div>
                  <h3 className="font-serif text-xl font-medium text-white">Atomic RFQ & Bridge</h3>
                  <p className="text-sm text-gray-400 leading-relaxed">
                    Bypasses AMM slippage through BackedFi-direct issuer pricing quote parameters. Automatically monitors Solana CLMM differentials and routes liquid stake assets via Mantle's native Super Portal when opportunities emerge.
                  </p>
                </div>

                {/* Visual Block 3 */}
                <div className="p-6 bg-white/5 border border-white/10 rounded-xl backdrop-blur-md space-y-4">
                  <div className="w-10 h-10 rounded bg-[#d000ff]/15 border border-[#d000ff]/30 flex items-center justify-center">
                    <Sparkles className="w-5 h-5 text-[#d000ff]" />
                  </div>
                  <h3 className="font-serif text-xl font-medium text-white">ERC-8004 Verification</h3>
                  <p className="text-sm text-gray-400 leading-relaxed">
                    Participates in the open agent validation standard. Every single buy, sell, or skip decision compiles a fully verifiable Groth16 mathematical proof on the Validation and Reputation registries, building a verifiable reputation block.
                  </p>
                </div>

              </div>

              {/* Cinematic Quote Callout */}
              <div className="border border-white/10 bg-white/5 rounded-xl p-6 md:p-8 flex flex-col md:flex-row justify-between items-center gap-6">
                <div className="space-y-1">
                  <span className="text-[10px] font-mono text-[#00FF7F] uppercase tracking-wide">Reputation Ledger Track</span>
                  <div className="text-white text-xl font-serif">
                    "Every other project copy-trades. VIGIL solves structural gaps."
                  </div>
                </div>
                <button
                  id="cta-spawn-join"
                  onClick={() => setShowSpawn(true)}
                  className="w-full md:w-auto py-3.5 px-6 bg-[#00FF7F] text-black font-black rounded-sm text-xs uppercase tracking-wider transform -skew-x-12 transition-all cursor-pointer shadow-md"
                >
                  <div className="skew-x-12">Join Trial Workspace</div>
                </button>
              </div>

            </section>

          </motion.div>
        )}
      </AnimatePresence>

      {/* Persistent global footer clock */}
      <MarketClock />

    </div>
  );
}
