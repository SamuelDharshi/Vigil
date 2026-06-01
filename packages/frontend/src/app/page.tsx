"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

const PHRASES = [
  "Collecting Chainlink price feeds...",
  "Analyzing Nansen smart money wallet flows...",
  "Running Elfa AI sentiment analysis...",
  "Scoring mETH, USDY, NVDAx, AAPLx, TSLAx...",
  "Confidence check: threshold at 30%...",
  "Watching for the next cross-chain opportunity...",
  "Pinning signal bundle to IPFS via Pinata...",
  "Checking Byreal CLMM pool APRs on Solana...",
];

interface AgentStats {
  total_decisions: number;
  total_executed: number;
  total_skipped: number;
  gas_reservoir_mnt: number;
  vault_address?: string;
}

export default function Landing() {
  const router = useRouter();
  const [stats, setStats] = useState<AgentStats>({ total_decisions: 0, total_executed: 0, total_skipped: 0, gas_reservoir_mnt: 0 });
  const [phraseIndex, setPhraseIndex] = useState(0);
  const [typed, setTyped] = useState("");
  const [fadeOut, setFadeOut] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    fetch("/api/agent").then(r => r.json()).then(d => {
      if (!d.error) setStats(d);
    }).catch(() => {});
  }, []);

  // Typing animation
  useEffect(() => {
    const phrase = PHRASES[phraseIndex];
    let i = 0;
    setTyped("");
    const interval = setInterval(() => {
      i++;
      setTyped(phrase.slice(0, i));
      if (i >= phrase.length) {
        clearInterval(interval);
        setTimeout(() => setPhraseIndex(p => (p + 1) % PHRASES.length), 2200);
      }
    }, 36);
    return () => clearInterval(interval);
  }, [phraseIndex]);

  const enter = () => {
    setFadeOut(true);
    setTimeout(() => router.push("/dashboard"), 650);
  };

  return (
    <div style={{
      width: "100vw", height: "100vh",
      background: "#030508",
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      position: "relative", overflow: "hidden",
      opacity: fadeOut ? 0 : 1,
      transition: "opacity 0.65s ease",
    }}>
      <style>{`
        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0} }
        @keyframes glow-pulse { 0%,100%{opacity:0.6} 50%{opacity:1} }
        @keyframes float { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-8px)} }
        @keyframes scan { 0%{top:-2px} 100%{top:100%} }
        @keyframes dot-pulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.5;transform:scale(0.8)} }
        @keyframes fade-up { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:translateY(0)} }
        @keyframes grid-flow {
          0% { background-position: 0 0; }
          100% { background-position: 40px 40px; }
        }
        .enter-btn:hover {
          background: rgba(0,208,151,0.18) !important;
          box-shadow: 0 0 60px rgba(0,208,151,0.25), inset 0 0 20px rgba(0,208,151,0.05) !important;
          transform: translateY(-3px) !important;
          letter-spacing: 0.16em !important;
        }
        .feature-card:hover {
          border-color: rgba(0,208,151,0.2) !important;
          background: rgba(0,208,151,0.04) !important;
        }
      `}</style>

      {/* Animated grid background */}
      <div style={{
        position: "absolute", inset: 0,
        backgroundImage: `
          linear-gradient(rgba(0,208,151,0.03) 1px, transparent 1px),
          linear-gradient(90deg, rgba(0,208,151,0.03) 1px, transparent 1px)
        `,
        backgroundSize: "40px 40px",
        animation: "grid-flow 8s linear infinite",
        pointerEvents: "none",
      }} />

      {/* Radial glow center */}
      <div style={{
        position: "absolute", top: "50%", left: "50%",
        transform: "translate(-50%, -50%)",
        width: 700, height: 700, borderRadius: "50%",
        background: "radial-gradient(circle, rgba(0,208,151,0.07) 0%, transparent 65%)",
        animation: "glow-pulse 4s ease-in-out infinite",
        pointerEvents: "none",
      }} />

      {/* Scan line */}
      <div style={{
        position: "absolute", left: 0, right: 0, height: 1,
        background: "linear-gradient(90deg, transparent, rgba(0,208,151,0.15), transparent)",
        animation: "scan 5s linear infinite",
        pointerEvents: "none",
      }} />

      {/* Content */}
      <div style={{
        textAlign: "center", zIndex: 10,
        maxWidth: 720, padding: "0 32px",
        animation: "fade-up 0.8s ease forwards",
      }}>

        {/* Live badge */}
        <div style={{
          display: "inline-flex", alignItems: "center", gap: 8,
          marginBottom: 36, padding: "5px 14px",
          border: "0.5px solid rgba(0,208,151,0.25)",
          borderRadius: 20,
          background: "rgba(0,208,151,0.05)",
        }}>
          <div style={{
            width: 6, height: 6, borderRadius: "50%",
            background: "#00d097", boxShadow: "0 0 8px #00d097",
            animation: "dot-pulse 2s ease-in-out infinite",
          }} />
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "rgba(0,208,151,0.85)", textTransform: "uppercase", letterSpacing: "0.2em" }}>
            Mantle Sepolia · Agent Active
          </span>
        </div>

        {/* VIGIL wordmark */}
        <h1 style={{
          fontFamily: "var(--font-serif)",
          fontSize: "clamp(64px, 10vw, 108px)",
          color: "white",
          letterSpacing: "-0.035em",
          lineHeight: 1,
          marginBottom: 20,
          textShadow: "0 0 80px rgba(0,208,151,0.15)",
          animation: "float 6s ease-in-out infinite",
        }}>VIGIL</h1>

        <p style={{
          fontFamily: "var(--font-mono)", fontSize: 12,
          color: "rgba(255,255,255,0.3)",
          textTransform: "uppercase", letterSpacing: "0.22em",
          marginBottom: 44,
        }}>
          Autonomous RWA Intelligence on Mantle
        </p>

        {/* Live typing feed */}
        <div style={{
          padding: "14px 24px",
          background: "rgba(0,0,0,0.4)",
          border: "0.5px solid rgba(0,208,151,0.12)",
          borderRadius: 8,
          marginBottom: 44,
          minHeight: 48,
          display: "flex", alignItems: "center", justifyContent: "flex-start",
        }}>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "rgba(0,208,151,0.6)", letterSpacing: "0.03em" }}>
            <span style={{ color: "rgba(0,208,151,0.35)", marginRight: 10 }}>agent@vigil:~$</span>
            {typed}
            <span style={{ animation: "blink 1s step-end infinite", marginLeft: 1 }}>█</span>
          </span>
        </div>

        {/* Stats row */}
        {mounted && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 44 }}>
            {[
              { label: "Total Decisions", value: stats.total_decisions.toString(), color: "white", glow: false },
              { label: "Executed On-Chain", value: stats.total_executed.toString(), color: "#00d097", glow: true },
              { label: "Gas Reservoir", value: `${(stats.gas_reservoir_mnt ?? 0).toFixed(1)} MNT`, color: "#f59e0b", glow: false },
            ].map(s => (
              <div key={s.label} style={{
                padding: "16px 14px",
                background: "rgba(255,255,255,0.025)",
                border: `0.5px solid rgba(255,255,255,${s.glow ? "0.1" : "0.05"})`,
                borderRadius: 8,
                boxShadow: s.glow ? "0 0 20px rgba(0,208,151,0.05)" : "none",
              }}>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 26, color: s.color, fontWeight: 700, marginBottom: 5, textShadow: s.glow ? "0 0 20px rgba(0,208,151,0.4)" : "none" }}>
                  {s.value}
                </div>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "rgba(255,255,255,0.22)", textTransform: "uppercase", letterSpacing: "0.12em" }}>
                  {s.label}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* How it works — 3 cards */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 44 }}>
          {[
            { n: "01", title: "No Prompts Needed", desc: "VIGIL runs a cron job every 30 minutes. It decides entirely on its own — you don't type anything.", color: "#00d097" },
            { n: "02", title: "Scoring Engine", desc: "Chainlink prices + Nansen smart money + Elfa sentiment → weighted confidence score. Needs 30% to trade.", color: "#8b5cf6" },
            { n: "03", title: "ZK-Proven On-Chain", desc: "Every decision — trade or skip — gets a Groth16 ZK proof and ERC-8004 reputation log on Mantle.", color: "#3b82f6" },
          ].map(f => (
            <div key={f.n} className="feature-card" style={{
              padding: "16px 14px",
              background: "rgba(255,255,255,0.02)",
              border: "0.5px solid rgba(255,255,255,0.06)",
              borderRadius: 8, textAlign: "left",
              transition: "all 0.2s ease", cursor: "default",
            }}>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: f.color, opacity: 0.7, marginBottom: 8, letterSpacing: "0.1em" }}>{f.n}</div>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "white", marginBottom: 8, fontWeight: 600, lineHeight: 1.4 }}>{f.title}</div>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "rgba(255,255,255,0.28)", lineHeight: 1.65 }}>{f.desc}</div>
            </div>
          ))}
        </div>

        {/* CTA */}
        <button
          onClick={enter}
          className="enter-btn"
          style={{
            padding: "16px 52px",
            background: "rgba(0,208,151,0.08)",
            border: "0.5px solid rgba(0,208,151,0.35)",
            borderRadius: 8,
            color: "#00d097",
            fontFamily: "var(--font-mono)",
            fontSize: 13, fontWeight: 600,
            cursor: "pointer",
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            transition: "all 0.25s ease",
            boxShadow: "0 0 40px rgba(0,208,151,0.08)",
          }}
        >
          Enter Dashboard →
        </button>

        <p style={{ marginTop: 16, fontFamily: "var(--font-mono)", fontSize: 10, color: "rgba(255,255,255,0.18)" }}>
          Drag to orbit · Scroll to zoom · Live WebSocket data
        </p>
      </div>
    </div>
  );
}
