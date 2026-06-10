"use client";

import { useParams } from "next/navigation";
import { useState, useEffect } from "react";
import Link from "next/link";

/**
 * /proof/[txHash]
 * Public shareable proof page for a single VIGIL decision.
 * All data is fetched from /api/proof/[txHash] which reads from:
 *   1. Postgres indexer (fast path, if running)
 *   2. VIGILLedger.sol on Mantle Sepolia (always available)
 *
 * No mock data. If the tx is not in VIGILLedger, returns a clear 404 message.
 */

interface ProofData {
  txHash: string;
  agentId: number;
  entryId: number;
  timestamp: number;
  fromAsset: string;
  toAsset: string;
  fromToken: string;
  toToken: string;
  amountUSD: number;
  slippageBps: number;
  confidence: number;
  reasoning: string;
  zkProofHash: string | null;
  signalBundleHash: string | null;
  mantlescanUrl: string;
  erc8004Url: string;
  network: string;
  fetchedFrom: "chain" | "indexer";
}

const MANTLE_EXPLORER = process.env.NEXT_PUBLIC_MANTLE_EXPLORER || "https://sepolia.mantlescan.xyz";

export default function ProofPage() {
  const params   = useParams();
  const txHash   = params.txHash as string;
  const [proof, setProof] = useState<ProofData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied]   = useState(false);

  useEffect(() => {
    if (!txHash) return;

    fetch(`/api/proof/${txHash}`)
      .then(async r => {
        if (!r.ok) {
          const body = await r.json().catch(() => ({}));
          throw new Error(body.error || `HTTP ${r.status}`);
        }
        return r.json();
      })
      .then(data => {
        setProof(data);
        setLoading(false);
      })
      .catch(err => {
        setError(err.message);
        setLoading(false);
      });
  }, [txHash]);

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg-void)" }}>
        <div style={{ textAlign: "center" }}>
          <div className="font-mono" style={{ color: "var(--text-secondary)", fontSize: 12 }}>
            Reading VIGILLedger on Mantle Sepolia...
          </div>
          <div className="font-mono" style={{ color: "var(--text-tertiary)", fontSize: 10, marginTop: "var(--space-2)" }}>
            {txHash?.slice(0, 20)}...
          </div>
        </div>
      </div>
    );
  }

  if (error || !proof) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg-void)" }}>
        <div style={{ textAlign: "center", maxWidth: 480, padding: "var(--space-8)" }}>
          <p className="font-mono" style={{ color: "var(--accent-amber)", fontSize: 13, marginBottom: "var(--space-4)" }}>
            Decision not found in VIGILLedger
          </p>
          <p className="font-mono" style={{ color: "var(--text-tertiary)", fontSize: 11, marginBottom: "var(--space-4)" }}>
            {error}
          </p>
          <p className="font-mono" style={{ color: "var(--text-tertiary)", fontSize: 10, marginBottom: "var(--space-6)", wordBreak: "break-all" }}>
            TX: {txHash}
          </p>
          <a
            href={`${MANTLE_EXPLORER}/tx/${txHash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="proof-link-btn"
            style={{ display: "inline-flex", marginBottom: "var(--space-3)" }}
          >
            Check on Mantlescan ↗
          </a>
          <br />
          <Link href="/" style={{ color: "var(--accent-green)", fontFamily: "var(--font-mono)", fontSize: 12 }}>
            ← Back to War Room
          </Link>
        </div>
      </div>
    );
  }

  const decisionDate = new Date(proof.timestamp);
  const utcStr = decisionDate.toLocaleString("en-US", {
    timeZone: "UTC",
    month: "long", day: "numeric", year: "numeric",
    hour: "2-digit", minute: "2-digit", hour12: false,
  });

  // Calculate NYSE gap at decision time
  const nycDate = new Date(decisionDate.toLocaleString("en-US", { timeZone: "America/New_York" }));
  const nycHour = nycDate.getHours() + nycDate.getMinutes() / 60;
  const day = nycDate.getDay();
  const isWeekend = day === 0 || day === 6;
  const isAfterHours = nycHour < 9.5 || nycHour >= 16;
  const nyseWasClosed = isWeekend || isAfterHours;

  // Calculate hours NYSE was/would be closed
  let closedHours = 0;
  if (isWeekend) {
    closedHours = day === 0 ? 24 + 9.5 - nycHour + 16 : 24 + 24 + 9.5;
  } else if (nycHour < 9.5) {
    closedHours = 9.5 - nycHour;
  } else if (nycHour >= 16) {
    closedHours = 24 - nycHour + 9.5;
  }

  const shareText = encodeURIComponent(
    `VIGIL made this autonomous trade while ${nyseWasClosed ? `NYSE was CLOSED (${Math.round(closedHours)}h of market gap)` : "the market was open"}:\n\n` +
    `${proof.fromAsset} → ${proof.toAsset} · $${proof.amountUSD.toLocaleString(undefined, { maximumFractionDigits: 0 })}\n` +
    `Confidence: ${(proof.confidence * 100).toFixed(0)}% · Slippage: ${(proof.slippageBps / 100).toFixed(2)}%\n` +
    `ZK-verified on Mantle ERC-8004.\n\n` +
    `This is 24/7 autonomous RWA execution.\n`
  );

  const shareUrl = `https://twitter.com/intent/tweet?text=${shareText}&url=${encodeURIComponent(typeof window !== "undefined" ? window.location.href : "")}`;

  const handleCopyProof = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-void)" }}>
      {/* Nav */}
      <div style={{ height: 44, display: "flex", alignItems: "center", padding: "0 var(--space-6)", borderBottom: "0.5px solid var(--border-subtle)" }}>
        <Link href="/" style={{ fontFamily: "var(--font-serif)", fontSize: 18, color: "var(--text-primary)", textDecoration: "none", letterSpacing: "-0.02em" }}>
          VIGIL
        </Link>
        <span className="font-mono" style={{ fontSize: 10, color: "var(--text-tertiary)", marginLeft: "var(--space-3)" }}>
          / Decision #{proof.entryId}
        </span>
        <span className="badge badge-mantle" style={{ marginLeft: "auto" }}>
          {proof.network}
        </span>
      </div>

      <div className="proof-page">
        {/* Data source indicator */}
        <div style={{ display: "inline-flex", alignItems: "center", gap: "var(--space-2)", marginBottom: "var(--space-4)" }}>
          <span className="font-mono" style={{ fontSize: 10, color: "var(--text-tertiary)" }}>
            Source:
          </span>
          <span className="badge badge-mantle">
            {proof.fetchedFrom === "chain" ? "VIGILLedger.sol on Mantle" : "Indexed from VIGILLedger"}
          </span>
        </div>

        {/* When */}
        <p className="proof-header-label">Agent #{proof.agentId} made this move at:</p>
        <p className="font-mono" style={{ fontSize: 16, color: "var(--text-primary)", marginTop: "var(--space-2)" }}>
          {utcStr} UTC
        </p>

        {nyseWasClosed && (
          <p className="font-mono" style={{ fontSize: 13, color: "var(--accent-amber)", marginTop: "var(--space-1)" }}>
            NYSE was CLOSED · ~{Math.round(closedHours)}h of market gap
          </p>
        )}

        <div style={{ height: "0.5px", background: "var(--border-subtle)", margin: "var(--space-6) 0" }} />

        {/* What happened */}
        <p className="proof-header-label">What Happened</p>
        <p className="proof-decision-title">
          {proof.fromAsset} → {proof.toAsset}
          {proof.amountUSD > 0 && ` · $${proof.amountUSD.toLocaleString(undefined, { maximumFractionDigits: 0 })} rotated`}
        </p>

        <div style={{ display: "flex", gap: "var(--space-6)", marginTop: "var(--space-4)", flexWrap: "wrap" }}>
          <div>
            <div className="proof-header-label">Confidence</div>
            <div className="font-mono" style={{ fontSize: 14, color: "var(--text-primary)", marginTop: "var(--space-1)" }}>
              {(proof.confidence * 100).toFixed(0)}%
            </div>
          </div>
          {proof.slippageBps > 0 && (
            <div>
              <div className="proof-header-label">Actual Slippage</div>
              <div className="font-mono" style={{ fontSize: 14, color: "var(--accent-green)", marginTop: "var(--space-1)" }}>
                {(proof.slippageBps / 100).toFixed(2)}%
                <span style={{ color: "var(--text-tertiary)" }}> (cap: 0.40%)</span>
              </div>
            </div>
          )}
          <div>
            <div className="proof-header-label">Execution Route</div>
            <div className="font-mono" style={{ fontSize: 13, color: "var(--text-primary)", marginTop: "var(--space-1)" }}>
              Fluxion xChange Atomic RFQ
            </div>
          </div>
        </div>

        <div style={{ height: "0.5px", background: "var(--border-subtle)", margin: "var(--space-6) 0" }} />

        {/* Why */}
        {proof.reasoning && (
          <>
            <p className="proof-header-label">Why The Agent Acted</p>
            <p className="proof-reasoning" style={{ marginTop: "var(--space-3)" }}>
              "{proof.reasoning}"
            </p>
            <div style={{ height: "0.5px", background: "var(--border-subtle)", margin: "var(--space-6) 0" }} />
          </>
        )}

        {/* On-chain proof */}
        <p className="proof-header-label">On-Chain Proof</p>
        <div className="proof-links" style={{ marginTop: "var(--space-3)" }}>
          <a href={proof.mantlescanUrl} target="_blank" rel="noopener noreferrer" className="proof-link-btn">
            Mantlescan ↗
          </a>
          {proof.erc8004Url && (
            <a href={proof.erc8004Url} target="_blank" rel="noopener noreferrer" className="proof-link-btn">
              ERC-8004 Registry ↗
            </a>
          )}
          {proof.zkProofHash && (
            <span
              className="proof-link-btn"
              style={{ cursor: "pointer", maxWidth: 300, overflow: "hidden", textOverflow: "ellipsis" }}
              title="Click to copy ZK proof hash"
              onClick={() => { navigator.clipboard.writeText(proof.zkProofHash!); }}
            >
              ZK: {proof.zkProofHash.slice(0, 22)}... ⎘
            </span>
          )}
          {proof.signalBundleHash && proof.signalBundleHash !== "0x0000000000000000000000000000000000000000000000000000000000000000" && (
            <a
              href={`https://ipfs.io/ipfs/search?q=${proof.signalBundleHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="proof-link-btn"
              title="Search IPFS for this signal bundle by its keccak256 hash"
            >
              Signal Bundle IPFS ↗
            </a>
          )}
        </div>

        {/* Token addresses */}
        <div style={{ marginTop: "var(--space-3)", display: "flex", gap: "var(--space-3)", flexWrap: "wrap" }}>
          {proof.fromToken && (
            <a href={`${MANTLE_EXPLORER}/address/${proof.fromToken}`} target="_blank" rel="noopener noreferrer" className="proof-link-btn">
              {proof.fromAsset} contract ↗
            </a>
          )}
          {proof.toToken && (
            <a href={`${MANTLE_EXPLORER}/address/${proof.toToken}`} target="_blank" rel="noopener noreferrer" className="proof-link-btn">
              {proof.toAsset} contract ↗
            </a>
          )}
        </div>

        <div style={{ height: "0.5px", background: "var(--border-subtle)", margin: "var(--space-6) 0" }} />

        {/* Share */}
        <div style={{ display: "flex", gap: "var(--space-3)", flexWrap: "wrap" }}>
          <a href={shareUrl} target="_blank" rel="noopener noreferrer" className="share-btn">
            Share on X →
          </a>
          <button onClick={handleCopyProof} className="proof-link-btn" style={{ cursor: "pointer" }}>
            {copied ? "Copied! ✓" : "Copy proof link"}
          </button>
          <Link href="/" className="proof-link-btn">
            ← War Room
          </Link>
        </div>

        {/* Raw tx hash */}
        <p className="font-mono" style={{ fontSize: 10, color: "var(--text-tertiary)", marginTop: "var(--space-6)", wordBreak: "break-all" }}>
          TX: {proof.txHash}
        </p>
      </div>
    </div>
  );
}
