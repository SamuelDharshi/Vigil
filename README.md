[![Mantle](https://img.shields.io/badge/Mantle-Sepolia-00D097)](https://mantle.xyz)
[![ERC-8004](https://img.shields.io/badge/ERC--8004-Agent%20%231-8A2BE2)](https://erc8004.quicknode.com)
[![ZK Proofs](https://img.shields.io/badge/ZK-Groth16-FF6B6B)](https://github.com/iden3/snarkjs)
[![License](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)

> **Live Agent:** Agent #1 running on Mantle Sepolia · **Proof TX:** [0x5bafb3...ca6c1](https://sepolia.mantlescan.xyz/tx/0x5bafb36ee8d6bb4e947238b5a20a3507b43fecc48838909d3b2b71fbeb4ca6c1) · **VIGILLedger:** [0x3c4ce5...527B](https://sepolia.mantlescan.xyz/address/0x3c4ce5558121607aea621Efa29ab428E98DD527B)

---

```
 ██╗   ██╗██╗ ██████╗ ██╗██╗
 ██║   ██║██║██╔════╝ ██║██║
 ██║   ██║██║██║  ███╗██║██║
 ╚██╗ ██╔╝██║██║   ██║██║██║
  ╚████╔╝ ██║╚██████╔╝██║███████╗
   ╚═══╝  ╚═╝ ╚═════╝ ╚═╝╚══════╝

  THE MARKET NEVER SLEEPS. NEITHER DOES VIGIL.
  ── Autonomous ERC-8004 Agent on Mantle Sepolia ──
  ── AI × RWA Track · Mantle Turing Test 2026 ────
```

---

# VIGIL — Autonomous RWA Portfolio Agent

**VIGIL** is an always-on, ZK-audited autonomous agent that manages tokenized RWA portfolios on Mantle Sepolia. Every 30 minutes, it ingests live oracle data, scores assets through a weighted model, generates a Groth16 zero-knowledge proof of its reasoning, and executes rebalancing decisions — whether NYSE is open or not.

It is built for the **Mantle Turing Test Hackathon 2026** (AI × RWA track). Every decision VIGIL has ever made is permanently on-chain, verifiable by anyone, benchmarked forever.

---

## 📖 Table of Contents

1. [The Problem](#-the-problem)
2. [The Solution](#-the-solution--the-turing-test-moment)
3. [How It Works — ASCII Flow](#-how-it-works--ascii-flow)
4. [The 9-Step Agent Pipeline](#-the-9-step-agent-pipeline)
5. [Sequence Diagram](#-sequence-diagram)
6. [Decision Engine — Scoring Formula](#-decision-engine--scoring-formula)
7. [System Architecture](#-system-architecture)
8. [Directory Structure](#-directory-structure)
9. [Contract Addresses](#-contract-addresses-mantle-sepolia)
10. [Live On-Chain Evidence](#-live-on-chain-evidence)
11. [Key Technologies](#-key-technologies)
12. [How to Run Locally](#-how-to-run-locally)
13. [Environment Variables](#-environment-variables)
14. [How to Use VIGIL (End User Guide)](#-how-to-use-vigil-end-user-guide)
15. [War Room UI Guide](#-war-room-ui-guide)
16. [Judging Scorecard](#-judging-scorecard-mapping)
17. [License](#-license)

---

## ⚠️ The Problem

Traditional equity markets close for **65 hours every weekend** (Friday 4pm → Monday 9:30am EST). During this gap:

| Situation | Human Trader | VIGIL |
|---|---|---|
| Earnings drop Saturday 2am | ❌ Locked out | ✅ Rebalances in 30 min |
| Smart money moves Sunday night | ❌ Can't react | ✅ Nansen signals detected |
| mETH APR drifts below USDY yield | ❌ Waiting for Monday | ✅ Rotates yield automatically |
| ZK audit of every decision | ❌ Black box | ✅ On-chain proof every cycle |

```
  FRIDAY 4pm EST           MONDAY 9:30am EST
       │                          │
  ┌────┴──────────────────────────┴────┐
  │   65 HOURS — HUMAN TRADERS        │
  │        ARE LOCKED OUT             │
  │                                   │
  │   82 ON-CHAIN TRANSACTIONS CONFIRMED  │
  │   41 AUTONOMOUS CYCLES EXECUTED       │
  │   41 ZK PROOFS GENERATED              │
  └───────────────────────────────────┘
```

**The data:**
- $2.85B in DeFi hacks in 2024 — 59% from access-control exploits with no audit trail
- xStocks on Mantle trade **24/7** but retail has no automated overnight risk management
- Most AI agents are black boxes — VIGIL is a **glass box**

---

## ✅ The Solution — The Turing Test Moment

On **Sunday, June 14, 2026 at 08:15 UTC**:
- NYSE had been closed for **16+ hours**
- VIGIL detected: mETH APR = **2.27%**, USDY yield = **3.55%** → spread = **+1.28%**
- Confidence score: **89.2%** (threshold: 15% in yield-only mode)
- Decision: **EXECUTE** — rotate mETH → USDY
- ZK proof generated in **1.4 seconds** (full Groth16)
- Swap confirmed on Mantle Sepolia

> *"Every institutional equity trader was locked out of their position for 16+ hours. VIGIL wasn't. This is what 24/7 RWA execution looks like."*

**Verified TX:** [`0x5bafb36ee8...ca6c1`](https://sepolia.mantlescan.xyz/tx/0x5bafb36ee8d6bb4e947238b5a20a3507b43fecc48838909d3b2b71fbeb4ca6c1)  
**Block:** `39940116` · **Status:** ✅ Success · **Gas:** 63,272

---

## 🔄 How It Works — ASCII Flow

### Top-Level: Signal → Decision → Proof → Chain

```
  ┌─────────────────────────────────────────────────────────────────┐
  │                    EVERY 30 MINUTES                             │
  └─────────────────────┬───────────────────────────────────────────┘
                        │
          ┌─────────────▼─────────────┐
          │      SIGNAL INTAKE        │
          │  ┌──────────────────────┐ │
          │  │ Pyth Network         │ │  ← mETH, USDY, NVDAx, AAPLx,
          │  │ (Mantle Sepolia)     │ │    TSLAx, ETH, MNT prices
          │  ├──────────────────────┤ │
          │  │ Nansen Smart Money   │ │  ← Whale wallet flows
          │  ├──────────────────────┤ │
          │  │ Elfa AI Sentiment    │ │  ← Social delta (4h vs 7d)
          │  ├──────────────────────┤ │
          │  │ Mantle RPC           │ │  ← Gas reservoir, allocation
          │  └──────────────────────┘ │
          └─────────────┬─────────────┘
                        │
                 ┌──────▼──────┐
                 │  IPFS PIN   │ ← Signal bundle → Pinata → CID
                 └──────┬──────┘
                        │
          ┌─────────────▼─────────────┐
          │     DECISION ENGINE       │
          │                           │
          │  Score(USDY)  = 94.7      │
          │  Score(mETH)  = 5.5       │
          │  Confidence   = 89.2%     │
          │  Threshold    = 15%       │
          │                           │
          │  ┌─────────┐ ┌─────────┐  │
          │  │ EXECUTE │ │  SKIP   │  │
          │  └────┬────┘ └────┬────┘  │
          │       │           │       │
          │  conf ≥ threshold │  conf < threshold
          └───────┼───────────┼───────┘
                  │           │
    ┌─────────────▼──┐   ┌────▼───────────────┐
    │  SWAP EXECUTION│   │  LOG SKIP REASON   │
    │  VIGILMockDEX  │   │  to VIGILLedger    │
    │  (or Fluxion)  │   │  + ERC-8004 Rep    │
    └─────────────┬──┘   └────────────────────┘
                  │
          ┌───────▼───────┐
          │   ZK PROOF    │
          │   Groth16     │ ← snarkjs, ~1.4s
          │   generation  │
          └───────┬───────┘
                  │
          ┌───────▼───────┐
          │  IPFS PIN     │ ← Proof metadata → Pinata
          └───────┬───────┘
                  │
          ┌───────▼───────────────────────┐
          │    ON-CHAIN LOGGING           │
          │                               │
          │  VIGILLedger.logDecision()   │
          │  ERC-8004 Reputation update   │
          │  ZK proof hash stored         │
          └───────────────────────────────┘
```

---

### Market Clock Logic — When Stocks Are Stale

```
  Agent wakes up at 08:15 UTC Sunday
           │
           ▼
  ┌─────────────────────────────────┐
  │ Check Pyth publish times        │
  │ NVDAx last updated: 44,000s ago │
  │ Threshold: 600s                 │
  └────────────────┬────────────────┘
                   │  ALL xStocks stale?
           ┌───────┴────────┐
          YES              NO
           │                │
           ▼                ▼
  ┌────────────────┐  ┌──────────────────┐
  │ YIELD-ONLY     │  │ FULL MODE        │
  │ MODE           │  │ All 5 assets     │
  │ mETH vs USDY   │  │ scored + ranked  │
  │ threshold: 15% │  │ threshold: 30–45%│
  └────────────────┘  └──────────────────┘
```

---

### Gas Loop — Self-Sustaining Operation

```
  ┌─────────────────────────────────────────────────┐
  │              YIELD-TO-GAS LOOP                  │
  │                                                 │
  │  mETH staking yield     VIGILMockDEX            │
  │  accumulates in  ──────► swaps yield   ─────┐  │
  │  vault/wallet           to MNT              │  │
  │                                             │  │
  │                    ┌────────────────────────┘  │
  │                    ▼                           │
  │              Agent Wallet                      │
  │              (gas reservoir)                   │
  │              minimum: 0.5 MNT                 │
  └─────────────────────────────────────────────────┘
```

---

## 🔢 The 9-Step Agent Pipeline

Each 30-minute cycle executes all 9 steps — **regardless of SKIP or EXECUTE**:

```
  STEP 1: INGEST
  ┌──────────────────────────────────────────────────────┐
  │  Pyth Hermes API → signed price update               │
  │  updatePriceFeeds() → on-chain Mantle Sepolia        │
  │  Nansen API / on-chain whale scanner                 │
  │  Elfa AI sentiment delta (4h vs 7d baseline)         │
  │  DeFiLlama → live mETH APR + USDY yield              │
  └──────────────────────────────────────────────────────┘
          │
  STEP 2: IPFS PIN (Signal Bundle)
  ┌──────────────────────────────────────────────────────┐
  │  JSON signal bundle → Pinata → CID                   │
  │  CID: QmaYtqvePBfuQUjo8EsgBWoaLWNLn3ER53NtH2PpiPaeA3│
  └──────────────────────────────────────────────────────┘
          │
  STEP 3: WEIGH (Decision Engine)
  ┌──────────────────────────────────────────────────────┐
  │  Score each asset 0-100                              │
  │  Find best / worst by score delta                    │
  │  Calculate confidence = (best - worst) / 100         │
  │  Compare to threshold (15% / 30% / 45%)              │
  └──────────────────────────────────────────────────────┘
          │
  STEP 4: BYREAL (Parallel check)
  ┌──────────────────────────────────────────────────────┐
  │  Fetch live CLMM pool APR from Byreal SDK            │
  │  If APR > mETH APR + 0.8% → flag cross-chain op     │
  │  Check existing position: in-range? close if not     │
  └──────────────────────────────────────────────────────┘
          │
  STEP 5: EXECUTE or SKIP
  ┌──────────────────────────────────────────────────────┐
  │  EXECUTE: VIGILMockDEX.swapExactTokensForTokens()    │
  │    → 40bps slippage cap enforced by VIGILVault        │
  │    → TX hash captured                                │
  │                                                      │
  │  SKIP: Record reason + reasoning text                │
  │    → Still proceeds to ZK proof generation           │
  └──────────────────────────────────────────────────────┘
          │
  STEP 6: ZK PROOF (Groth16)
  ┌──────────────────────────────────────────────────────┐
  │  buildProofInput(prices, allocations, targets)       │
  │  snarkjs.groth16.fullProve() → ~1.4 seconds          │
  │  proofHash = keccak256(proof + publicSignals)        │
  └──────────────────────────────────────────────────────┘
          │
  STEP 7: IPFS PIN (Proof Metadata)
  ┌──────────────────────────────────────────────────────┐
  │  {txHash, zkProofHash, confidence, bundleCid} → IPFS │
  │  CID: QmYcF1TzGSW23wDg6GV5eHepDX3ox7Va4R5C7jJXiShxf4│
  └──────────────────────────────────────────────────────┘
          │
  STEP 8: ERC-8004 REPUTATION
  ┌──────────────────────────────────────────────────────┐
  │  submitReputationFeedback(score, taskId)             │
  │  Reputation score updated on-chain                   │
  │  Score: 102.1 (cumulative, grows each cycle)         │
  └──────────────────────────────────────────────────────┘
          │
  STEP 9: LEDGER LOG
  ┌──────────────────────────────────────────────────────┐
  │  VIGILLedger.logDecision(action, proofHash, cid)    │
  │  Immutable on-chain record of every decision         │
  │  Event emitted → indexer picks up → UI updates       │
  └──────────────────────────────────────────────────────┘
```

---

## 📊 Sequence Diagram

```
  User/Scheduler    Agent (cron.ts)    Pyth/Nansen/Elfa    Mantle Sepolia       IPFS (Pinata)
       │                  │                   │                   │                   │
       │  30min tick      │                   │                   │                   │
       │─────────────────►│                   │                   │                   │
       │                  │ fetchPythBundle()  │                   │                   │
       │                  │──────────────────►│                   │                   │
       │                  │ fetchNansenBundle()│                   │                   │
       │                  │──────────────────►│                   │                   │
       │                  │ fetchElfaBundle()  │                   │                   │
       │                  │──────────────────►│                   │                   │
       │                  │◄──────────────────│                   │                   │
       │                  │  SignalBundle      │                   │                   │
       │                  │                   │                   │                   │
       │                  │ pinSignalBundle()  │                   │                   │
       │                  │────────────────────────────────────────────────────────►  │
       │                  │◄────────────────────────────────────────────────────────  │
       │                  │  bundleCid (IPFS)  │                   │                   │
       │                  │                   │                   │                   │
       │                  │ generateDecision() │                   │                   │
       │                  │ (local, <5ms)      │                   │                   │
       │                  │                   │                   │                   │
       │                  │   [IF EXECUTE]     │                   │                   │
       │                  │                   │  swapExactTokens()│                   │
       │                  │────────────────────────────────────────►                  │
       │                  │◄────────────────────────────────────────                  │
       │                  │   txHash           │                   │                   │
       │                  │                   │                   │                   │
       │                  │ groth16.fullProve()│                   │                   │
       │                  │ (local snarkjs, ~1.4s)                │                   │
       │                  │                   │                   │                   │
       │                  │ pinProofMetadata() │                   │                   │
       │                  │────────────────────────────────────────────────────────►  │
       │                  │◄────────────────────────────────────────────────────────  │
       │                  │  proofCid          │                   │                   │
       │                  │                   │                   │                   │
       │                  │                   │  ERC8004.submitReputation()            │
       │                  │────────────────────────────────────────►                  │
       │                  │                   │  VIGILLedger.logDecision()             │
       │                  │────────────────────────────────────────►                  │
       │                  │◄────────────────────────────────────────                  │
       │  Cycle complete   │   on-chain receipt│                   │                   │
       │◄─────────────────│                   │                   │                   │
```

---

## 🧮 Decision Engine — Scoring Formula

**Source of truth:** [`packages/agent/src/decision/engine.ts`](./packages/agent/src/decision/engine.ts)

### Asset Score (0–100, baseline 50)

```
Score(asset) = 50
             + (YieldSpread × YIELD_WEIGHT × 100)   [Factor 1]
             + (SmartMoneyNorm × SM_WEIGHT × 20)     [Factor 2]
             + (SentimentDelta × SENT_WEIGHT × 15)   [Factor 3]

Where:
  YIELD_WEIGHT  = 0.35   (mETH APR vs USDY yield differential)
  SM_WEIGHT     = 0.40   (Nansen smart money net flow, normalized to ±$1M)
  SENT_WEIGHT   = 0.25   (Elfa 4h vs 7d social sentiment delta)

YieldSpread = usdyYield - mEthApr
  e.g. 3.55% - 2.27% = +1.28% → USDY gets +1.28 × 0.35 × 100 = +44.8 pts
```

### Confidence & Thresholds

```
Confidence = (bestScore - worstScore) / 100

Mode              Threshold   Condition
──────────────    ─────────   ─────────────────────────────────
YIELD-ONLY        15%         xStock prices stale (market closed)
YIELD NORMAL      30%         Normal trading hours, yield assets only
XSTOCK TRADE      45%         xStocks in play (higher risk bar)

EXECUTE if: confidence ≥ threshold
SKIP    if: confidence < threshold  OR  gas < 0.5 MNT
```

### Example — Sunday June 14, 08:15 UTC

```
  Inputs:
    mETH APR (live DeFiLlama):  2.27%
    USDY yield (live DeFiLlama): 3.55%
    YieldSpread:                 +1.28%
    xStocks:                     STALE (market closed)
    Smart money:                 3 flows, RISK-ON signal
    Sentiment:                   NVIDIA +100% delta

  Calculation:
    Score(USDY) = 50 + (1.28 × 0.35 × 100) + smart_money + sentiment
                = 50 + 44.8 + ε = 94.7
    Score(mETH) = 50 - 44.8 + ε = 5.5

    Confidence = (94.7 - 5.5) / 100 = 89.2%
    Threshold  = 15% (yield-only mode)
    Decision   = EXECUTE ✅
```

### VIGILVault Guardrails (hardcoded in Solidity)

```
  ┌────────────────────────────────────────┐
  │         VIGIVAULT GUARDRAILS           │
  │                                        │
  │  MAX_SLIPPAGE_BPS     =    40 bps      │
  │  MAX_SINGLE_TX_USD    = $10,000        │
  │  MAX_EPOCH_ALLOC      =    15%         │
  │  GAS_RESERVOIR_MIN    =  0.5 MNT      │
  │  TOKEN_WHITELIST      = on-chain       │
  └────────────────────────────────────────┘
```

---

## 🏗️ System Architecture

```
  ┌─────────────────────────────────────────────────────────────────────┐
  │                         VIGIL SYSTEM                                │
  │                                                                     │
  │  ┌──────────────┐    ┌──────────────┐    ┌──────────────────────┐  │
  │  │   FRONTEND   │    │    AGENT     │    │   MANTLE SEPOLIA     │  │
  │  │  (Vite/React)│    │  (Node.js)   │    │   (Blockchain)       │  │
  │  │              │    │              │    │                      │  │
  │  │  Landing     │    │  cron.ts     │    │  VIGILVault          │  │
  │  │  WarRoom     │◄──►│  signals/    │    │  VIGILLedger         │  │
  │  │  ProofModal  │    │  decision/   │───►│  VIGILMockDEX        │  │
  │  │  AgentFlow   │    │  proof/      │    │  ERC-8004 Registries │  │
  │  │  MarketClock │    │  identity/   │    │  Pyth Network        │  │
  │  └──────────────┘    │  executor/   │    └──────────────────────┘  │
  │                      └──────┬───────┘                              │
  │  ┌──────────────┐           │                                      │
  │  │   INDEXER    │           │    ┌──────────────────────────────┐  │
  │  │  (SQLite +   │◄──────────┘    │   EXTERNAL SIGNALS           │  │
  │  │  WebSocket)  │                │                              │  │
  │  └──────────────┘                │  Pyth Hermes API             │  │
  │                                  │  Nansen Smart Money API      │  │
  │  ┌──────────────┐                │  Elfa AI Sentiment API       │  │
  │  │     IPFS     │                │  DeFiLlama (mETH APR/USDY)   │  │
  │  │  (Pinata)    │◄───────────────│  CoinGecko (fallback)        │  │
  │  └──────────────┘                └──────────────────────────────┘  │
  └─────────────────────────────────────────────────────────────────────┘
```

---

## 📁 Directory Structure

```
vigil/
│
├── packages/
│   │
│   ├── agent/                          # Node.js autonomous runtime
│   │   ├── src/
│   │   │   ├── cron.ts                 # 30-min decision loop + health server
│   │   │   ├── config.ts               # All addresses, weights, thresholds
│   │   │   ├── types.ts                # TypeScript types for all data shapes
│   │   │   │
│   │   │   ├── signals/
│   │   │   │   ├── pyth.ts             # Pyth Network price feeds (Mantle Sepolia)
│   │   │   │   ├── nansen.ts           # Smart money flows (API + on-chain fallback)
│   │   │   │   ├── elfa.ts             # Social sentiment delta (Elfa AI)
│   │   │   │   └── aggregator.ts       # Bundle all signals into SignalBundle
│   │   │   │
│   │   │   ├── decision/
│   │   │   │   └── engine.ts           # Weighted scoring + confidence + EXECUTE/SKIP
│   │   │   │
│   │   │   ├── executor/
│   │   │   │   ├── fluxion.ts          # Fluxion Atomic RFQ execution
│   │   │   │   ├── mockdex.ts          # VIGILMockDEX fallback (testnet)
│   │   │   │   ├── byreal.ts           # Byreal CLMM pool analysis
│   │   │   │   └── superPortal.ts      # Cross-chain bridge (Super Portal)
│   │   │   │
│   │   │   ├── proof/
│   │   │   │   └── circuit.ts          # snarkjs Groth16 proof generation
│   │   │   │
│   │   │   └── identity/
│   │   │       ├── erc8004.ts          # Agent spawn + reputation + IPFS card
│   │   │       └── ipfs.ts             # Pinata upload helpers
│   │   │
│   │   ├── circuits/
│   │   │   ├── vigil_rebalance.circom  # ZK circuit source
│   │   │   ├── vigil_rebalance.wasm    # Compiled circuit
│   │   │   └── vigil_rebalance_final.zkey  # Proving key
│   │   │
│   │   └── package.json
│   │
│   ├── contracts/                      # Solidity contracts (Hardhat)
│   │   ├── src/
│   │   │   ├── VIGILVault.sol          # Guardrails + validateDecision()
│   │   │   ├── VIGILLedger.sol         # Immutable decision log (all cycles)
│   │   │   ├── VIGILMockDEX.sol        # Testnet swap execution
│   │   │   └── adapters/
│   │   │       └── FluxionAdapter.sol  # Fluxion RFQ adapter (no-op on testnet)
│   │   ├── scripts/
│   │   │   ├── deploy.ts
│   │   │   ├── bootstrap-ledger.ts     # Seed initial on-chain decisions
│   │   │   └── force-execute-trade.ts  # Manual cycle trigger
│   │   └── hardhat.config.ts
│   │
│   ├── indexer/                        # SQLite event indexer + WebSocket server
│   │   └── src/
│   │       ├── listeners.ts            # VIGILLedger event listener
│   │       └── websocket.ts            # Broadcasts to frontend
│   │
│   └── frontend/                       # Next.js 15 dashboard (legacy)
│       └── app/
│
├── vigil/                              # Vite/React landing page + War Room
│   └── src/
│       ├── App.tsx                     # Landing page (Turing Test hero)
│       ├── data.ts                     # Initial signal + decision data
│       ├── types.ts                    # Frontend types
│       └── components/
│           ├── WarRoom.tsx             # 3-column War Room dashboard
│           ├── AgentFlowGraph.tsx      # SVG 5-stage animated pipeline
│           ├── MarketClock.tsx         # Footer market status (NYSE/NASDAQ/LSE/TSE)
│           ├── ProofModal.tsx          # ZK proof detail overlay
│           ├── SpawnScreen.tsx         # Agent onboarding flow
│           └── ThreeBackground.tsx     # Three.js animated background
│
├── .env                                # Environment variables (see below)
├── .env.example                        # Template
└── README.md                           # This file
```

---

## 📍 Contract Addresses (Mantle Sepolia)

| Contract | Address | Verified |
|---|---|---|
| **VIGILVault** | [`0x4F1d65dAd79bF887776808B7c833a75dc198ADa6`](https://sepolia.mantlescan.xyz/address/0x4F1d65dAd79bF887776808B7c833a75dc198ADa6) | ✅ |
| **VIGILLedger** | [`0x3c4ce5558121607aea621Efa29ab428E98DD527B`](https://sepolia.mantlescan.xyz/address/0x3c4ce5558121607aea621Efa29ab428E98DD527B) | ✅ |
| **FluxionAdapter** | [`0xEEB25dabFa3F404D7d90e9fEBeB71abb467c110D`](https://sepolia.mantlescan.xyz/address/0xEEB25dabFa3F404D7d90e9fEBeB71abb467c110D) | — |
| **VIGILMockDEX** | [`0x5fb356f8EC0Fd5CBD0C215621655de7C5a640722`](https://sepolia.mantlescan.xyz/address/0x5fb356f8EC0Fd5CBD0C215621655de7C5a640722) | — |
| **ERC-8004 Identity Registry** | [`0x8004A818BFB912233c491871b3d84c89A494BD9e`](https://sepolia.mantlescan.xyz/address/0x8004A818BFB912233c491871b3d84c89A494BD9e) | Official |
| **ERC-8004 Reputation Registry** | [`0x8004B663056A597Dffe9eCcC1965A193B7388713`](https://sepolia.mantlescan.xyz/address/0x8004B663056A597Dffe9eCcC1965A193B7388713) | Official |
| **Pyth Network (Mantle Sepolia)** | `0xA2aa501b19aff244D90cc15a4Cf739D2725B5729` | Official |

---

## 🔗 Live On-Chain Evidence

```
  ┌─────────────────────────────────────────────────────────────────┐
  │              VIGIL AGENT — VERIFIED ON-CHAIN STATS              │
  │                                                                 │
  │  Agent ID:           ERC-8004 #1                               │
  │  Agent Wallet:       0x3Ba85544C7a5C386AE7Cf753e887FB05Ac946074│
  │  Reputation Score:   102.1 (live, grows each cycle)            │
  │                                                                 │
  │  Total On-Chain Txs: 82                                         │
  │    Execute Rebalance: 41  ████████████████████ 50%              │
  │    Fund Gas Reservoir: 41  ████████████████████ 50%             │
  │                                                                 │
  │  (Every cycle = 1 Execute Rebalance + 1 Fund Gas Reservoir     │
  │   = 2 on-chain txs. 82 txs = ~41 autonomous cycles)            │
  │                                                                 │
  │  Running continuously at 5-minute intervals since deploy.       │
  └─────────────────────────────────────────────────────────────────┘

  LATEST VERIFIED TRANSACTION:
  ──────────────────────────────────────────────────────────────────
  TX Hash:   0xe3708a410067165b777f58068869268e68a86a31946c98c991d78dfbb58cd4b8
  Block:     39943142
  Age:       11 mins ago (Jun 14, 2026 — Sunday — NYSE closed)
  Method:    Execute Rebalance
  Agent:     0x3Ba85544...5Ac946074

  PROOF TX (verified swap):
  TX Hash:   0x5bafb36ee8d6bb4e947238b5a20a3507b43fecc48838909d3b2b71fbeb4ca6c1
  Block:     39940116
  Timestamp: Jun 14, 2026 08:15:05 UTC
  Action:    EXECUTE mETH → USDY
  Confidence:89.2%
  ZK Proof:  0xe6d20068cefdfe54ae94561d3a0520fa4b155880dc5004e1e905007e63e48c20
  IPFS Proof:QmYcF1TzGSW23wDg6GV5eHepDX3ox7Va4R5C7jJXiShxf4
  Gas Used:  63,272
  ──────────────────────────────────────────────────────────────────

  All 82 transactions visible on Mantlescan:
  https://sepolia.mantlescan.xyz/address/0x4F1d65dAd79bF887776808B7c833a75dc198ADa6
```

---

## 🔧 Key Technologies

| Technology | Purpose | Why Mantle |
|---|---|---|
| **Pyth Network** | Real-time price feeds | 200+ feeds on Mantle Sepolia (Chainlink has none) |
| **ERC-8004** | Agent identity + reputation | Official standard, live on Mantle — Identity + Reputation registries |
| **Groth16 (snarkjs)** | ZK proof of decision logic | First ZK-validated autonomous agent on Mantle |
| **Fluxion xChange** | Atomic RFQ for xStocks | 2026 Mantle product — first agent integration |
| **VIGILMockDEX** | Testnet swap execution | Deployed on Mantle Sepolia, funds itself |
| **Byreal SDK** | Cross-chain CLMM routing | MNT-USDC concentrated liquidity via Super Portal |
| **Pinata / IPFS** | Signal + proof archiving | Immutable, verifiable off-chain storage |
| **Three.js** | Animated background | Not WebGL boilerplate — reacts to volatility slider |
| **snarkjs (circom)** | ZK circuit compilation | Local proof generation, no trusted setup server |

---

## 🚀 How to Run Locally

### Prerequisites

```bash
node >= 18.x
npm >= 9.x
git
```

### 1. Clone & Install

```bash
git clone https://github.com/SamuelDharshi/Vigil.git
cd Vigil
npm install
```

### 2. Configure Environment

```bash
cp .env.example .env
# Edit .env with your keys (see Environment Variables section below)
```

### 3. Deploy Contracts (Mantle Sepolia)

```bash
cd packages/contracts

# Compile
npx hardhat compile

# Deploy all contracts
npx hardhat run scripts/deploy.ts --network mantleSepolia

# Seed initial ledger entries (optional)
npx hardhat run scripts/bootstrap-ledger.ts --network mantleSepolia
```

### 4. Start the Agent

```bash
cd packages/agent
npm run dev
```

The agent will:
1. Start health server on `http://localhost:10000`
2. Spawn ERC-8004 agent identity (or reuse existing)
3. Run first decision cycle immediately
4. Schedule cron every 30 minutes (or custom `CRON_SCHEDULE`)

**Manual trigger:**
```bash
# Force a new cycle immediately
curl -X POST http://localhost:10000/trigger

# Check agent status
curl http://localhost:10000/health
```

### 5. Start the Landing Page / War Room

```bash
cd vigil
npm run dev
# Open http://localhost:3000
```

### 6. (Optional) Start the Indexer

```bash
cd packages/indexer
npm run dev
# WebSocket on ws://localhost:8080
# SQLite DB at packages/indexer/vigil.db
```

---

## 🔐 Environment Variables

```env
# ── Network ──────────────────────────────────────────
MANTLE_RPC_URL=https://rpc.sepolia.mantle.xyz
AGENT_PRIVATE_KEY=0x...your_agent_wallet_key...

# ── Deployed Contracts ───────────────────────────────
VIGIL_VAULT_ADDRESS=0x4F1d65dAd79bF887776808B7c833a75dc198ADa6
VIGIL_LEDGER_ADDRESS=0x3c4ce5558121607aea621Efa29ab428E98DD527B
VIGIL_MOCK_DEX_ADDRESS=0x5fb356f8EC0Fd5CBD0C215621655de7C5a640722

# ── Oracle ───────────────────────────────────────────
PYTH_CONTRACT_ADDRESS=0xA2aa501b19aff244D90cc15a4Cf739D2725B5729
PYTH_HERMES_URL=https://hermes.pyth.network

# ── ERC-8004 Registries ───────────────────────────────
ERC8004_IDENTITY_REGISTRY=0x8004A818BFB912233c491871b3d84c89A494BD9e
ERC8004_REPUTATION_REGISTRY=0x8004B663056A597Dffe9eCcC1965A193B7388713

# ── External APIs ─────────────────────────────────────
NANSEN_API_KEY=...          # Optional — falls back to on-chain whale scanner
ELFA_API_KEY=...            # Optional — falls back to empty sentiment bundle

# ── IPFS ─────────────────────────────────────────────
PINATA_JWT=...              # Pinata JWT for signal + proof pinning

# ── Cron ─────────────────────────────────────────────
CRON_SCHEDULE=*/5 * * * *  # Default: every 5 minutes (demo) / */30 for production

# ── ZK Circuits ──────────────────────────────────────
CIRCUIT_WASM_PATH=./circuits/vigil_rebalance.wasm
CIRCUIT_ZKEY_PATH=./circuits/vigil_rebalance_final.zkey
```

---

## 🖥️ How to Use VIGIL (End User Guide)

### Step 1 — Open the Landing Page

Navigate to `http://localhost:3000`. You'll see:

```
  ┌───────────────────────────────────────────────────────────────┐
  │  🟢 MANTLE TURING TEST — AI × RWA TRACK    ERC-8004 AGENT    │
  │                                                               │
  │   THE MARKET                                                  │
  │   NEVER SLEEPS.                                               │
  │   NEITHER DOES VIGIL.                                        │
  │                                                               │
  │   [Deploy Autonomous Agent]    [Explore Philosophy ▼]        │
  │                                                               │
  │   NYSE/NASDAQ: OPEN | 🟢 VIGIL ALIVE | ERC-8004 #1 · 102.1  │
  │   ⚡ LAST PROOF: TX 0x5bafb3...ca6c1 · Block 39940116 ↗     │
  └───────────────────────────────────────────────────────────────┘
```

### Step 2 — Deploy Your Agent

Click **"Deploy Autonomous Agent"** to open the spawn screen:

1. Connect your wallet (MetaMask, WalletConnect)
2. Set starting capital allocation (mETH / USDY / xStocks)
3. Confirm agent spawn → ERC-8004 identity minted on-chain
4. You'll be assigned an Agent ID (e.g., #2)

### Step 3 — The War Room

After spawning, you enter the **War Room** — a live 3-column dashboard:

```
  ┌──────────────┬───────────────────────────────┬──────────────┐
  │              │         AGENT PIPELINE        │              │
  │  EVENT       │                               │   DECISIONS  │
  │  STREAM      │  [Signal]→[Engine]→[Vault]    │   FEED       │
  │              │  →[Execute]→[Ledger]          │              │
  │  PYTH feed   │                               │  EXECUTE ✅  │
  │  NANSEN flow │  Cycle #14 — RUNNING          │  SKIP ⚠️     │
  │  ELFA delta  │  Confidence: 89.2%            │  EXECUTE ✅  │
  │  MANTLE data │  TX: 0x5bafb3...↗             │  SKIP ⚠️     │
  │              │                               │              │
  └──────────────┴───────────────────────────────┴──────────────┘
```

**Controls available:**
- **"Fast-Forward Evaluation"** — trigger a new 5-stage cycle immediately
- **Volatility Slider** — adjusts background animation + price spread simulation
- Click any decision in the feed → opens **Proof Modal** with ZK proof details

### Step 4 — View a ZK Proof

Clicking any decision opens a modal showing:

```
  ┌─────────────────────────────────────────────────────┐
  │  DECISION PROOF — EXECUTE mETH → USDY               │
  │                                                     │
  │  Action:      EXECUTE                               │
  │  Confidence:  89.2%                                 │
  │  Asset:       mETH → USDY                           │
  │  Amount:      $3,386                                │
  │                                                     │
  │  TX Hash:     0x5bafb3...ca6c1 ↗ (Mantlescan)      │
  │  ZK Proof:    0xe6d200...c20 (Groth16, 1.4s)        │
  │  IPFS Bundle: QmaYtqv...eA3 ↗ (Pinata)              │
  │  ZK Log:      VIGILLedger 0x3c4ce5...527B ↗         │
  │                                                     │
  │  Reasoning:   USDY yield leads by 1.28%.            │
  │               Signal model: mETH 5/100, USDY 94/100 │
  └─────────────────────────────────────────────────────┘
```

### Step 5 — Verify On-Chain

All of VIGIL's decisions are permanently on-chain:

| What to verify | Where to look |
|---|---|
| All decisions ever made | [VIGILLedger Events](https://sepolia.mantlescan.xyz/address/0x3c4ce5558121607aea621Efa29ab428E98DD527B#events) |
| Agent identity | [ERC-8004 Identity Registry](https://sepolia.mantlescan.xyz/address/0x8004A818BFB912233c491871b3d84c89A494BD9e) |
| Reputation score history | [ERC-8004 Reputation Registry](https://sepolia.mantlescan.xyz/address/0x8004B663056A597Dffe9eCcC1965A193B7388713) |
| Swap transactions | [VIGILMockDEX](https://sepolia.mantlescan.xyz/address/0x5fb356f8EC0Fd5CBD0C215621655de7C5a640722) |
| Latest proof TX | [0x5bafb36e...ca6c1](https://sepolia.mantlescan.xyz/tx/0x5bafb36ee8d6bb4e947238b5a20a3507b43fecc48838909d3b2b71fbeb4ca6c1) |

---

## 🎭 War Room UI Guide

```
  HEADER
  ──────
  [VIGIL.] Autonomous RWA Sentinel          [War Room] [Charts] [Proofs] [Market] [☀️/🌙] [Deploy Agent]

  ERC-8004 IDENTITY BANNER (purple)
  ──────────────────────────────────
  🟣 ERC-8004 Agent Identity | ID: #1 | Wallet: 0x3Ba855...946074 | Reputation: 102.1 | EXECUTED: 5 | SKIPPED: 8
  Identity Registry ↗ | Reputation ↗ | VIGILLedger (ZK Proofs) ↗

  STATS GRID (4 columns)
  ───────────────────────
  ┌─────────────────┬─────────────────┬─────────────────┬────────────────┐
  │ Asset Oracles   │ Evaluation      │ Volatility      │  [4th column]  │
  │ mETH $1675.58   │ 29:47           │ Slider 1.0x     │                │
  │ USDY $1.00      │ until next pass │ (STABLE CAP)    │                │
  │ NVDAx $205.10   │                 │                 │                │
  │ AAPLx $291.15   │ [Fast-Forward   │                 │                │
  │ TSLAx $406.52   │  Evaluation]    │                 │                │
  │ MNT   $0.56     │                 │                 │                │
  └─────────────────┴─────────────────┴─────────────────┴────────────────┘

  MAIN WAR ROOM (3 columns)
  ──────────────────────────
  ┌─────────────┬──────────────────────────────────┬───────────────┐
  │ EVENT STREAM│ AGENT PIPELINE SVG               │ DECISIONS     │
  │             │                                  │               │
  │ PYTH source │ [📡Signal]→[🧠Engine]→[🔒Vault] │ ▶ EXECUTE     │
  │ NANSEN flow │ →[⚡Execute]→[📒Ledger]           │   mETH→USDY   │
  │ ELFA delta  │                                  │   89.2% conf  │
  │             │ Stage: EXECUTION  [RUNNING]       │   0x5bafb3↗   │
  │ Status:     │ Cycle #14                        │               │
  │ WATCHING    │                                  │ ⚠️ SKIP       │
  │ ACTED       │ TX: 0x5bafb3...ca6c1 ↗           │   mETH→USDY   │
  │ SKIPPED     │ Confidence: 89.2%                │   11.2% conf  │
  └─────────────┴──────────────────────────────────┴───────────────┘

  FOOTER (market clock)
  ──────────────────────
  [TRADITIONAL MARKETS (click to toggle demo)]  NYSE: OPEN  NASDAQ: OPEN  LSE: OPEN  TSE: OPEN
                                                                                  VIGIL PIPELINE: ● ACTIVE
```

**Footer tip:** Click **"TRADITIONAL MARKETS"** to toggle Demo Mode — forces all markets to show OPEN for demo recordings regardless of time of day.

---

## 🏆 Judging Scorecard Mapping

| Criterion | Max Pts | How VIGIL Scores |
|---|---|---|
| **Technical depth** | 15 | ERC-8004 (both official registries), Groth16 ZK proofs (real circom circuit), Pyth oracles (live on Mantle), Fluxion RFQ adapter |
| **Mantle ecosystem integration** | 10 | mETH, USDY, xStocks (NVDAx/AAPLx/TSLAx), Pyth (Mantle native), ERC-8004 (Mantle standard), Fluxion xChange |
| **Innovation** | 10 | First ZK-validated autonomous agent on Mantle. First agent integration on Fluxion xChange. Turing Test framing: every decision benchmarked on-chain |
| **Business potential** | 10 | Vault management fees, institutional white-label, $2.85B hack prevention market, xPoints loyalty integration path |
| **User experience** | 5 | SVG 5-stage animated pipeline (War Room), real-time signal feed, click-to-verify proof modal, streamable for radical transparency |
| **BGA / financial inclusion** | 10 | Retail xStocks holders get 24/7 institutional-grade risk management — closes 65-hour weekend execution gap |
| **Transparency / verifiability** | 7.5 | Every decision: ZK-proved (Groth16) + on-chain ledger (VIGILLedger) + IPFS archived + public proof page |
| **Real-world impact** | 5 | Live agent, verified swap, real ZK proof, real ERC-8004 reputation score — not a prototype |
| **Demo quality** | 5 | Turing Test moment: Sunday 08:15 UTC swap, NYSE closed 16h, verifiable on Mantlescan block 39940116 |
| **TOTAL** | **77.5** | |

---

## 📜 License

MIT © 2026 Samuel Dharshi

---

```
 ┌───────────────────────────────────────────────────────────────────┐
 │                                                                   │
 │   VIGIL has made 41 autonomous cycles since deployment.         │
 │   82 on-chain transactions. All proved. All verifiable.         │
 │                                                                   │
 │   The market never sleeps.                                       │
 │   Neither does VIGIL.                                            │
 │                                                                   │
 │   Verify: sepolia.mantlescan.xyz/address/                        │
 │   0x3c4ce5558121607aea621Efa29ab428E98DD527B                     │
 │                                                                   │
 └───────────────────────────────────────────────────────────────────┘
```