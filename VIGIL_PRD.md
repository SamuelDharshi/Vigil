# VIGIL — Product Requirements Document
### Mantle Turing Test Hackathon 2026 | AI × RWA Track

> *"While every equity trader on Earth waits for Monday morning, VIGIL has already moved."*

**Version:** 1.0  
**Date:** June 2026  
**Status:** Hackathon Submission — Build-Ready  

---

## Table of Contents

1. [Strategic Foundation](#1-strategic-foundation)
2. [The Core Problem](#2-the-core-problem)
3. [What VIGIL Is](#3-what-vigil-is)
4. [Hackathon Strategy](#4-hackathon-strategy)
5. [Product Requirements — User Flows](#5-product-requirements--user-flows)
6. [UI Architecture — Screen by Screen](#6-ui-architecture--screen-by-screen)
7. [Internal System Architecture](#7-internal-system-architecture)
8. [Technology Stack — Specs and Docs](#8-technology-stack--specs-and-docs)
9. [Smart Contract Specification](#9-smart-contract-specification)
10. [Agent Behavior Specification](#10-agent-behavior-specification)
11. [Data Models](#11-data-models)
12. [Self-Sustaining Gas Economy](#12-self-sustaining-gas-economy)
13. [Security Guardrails](#13-security-guardrails)
14. [Demo Day Playbook](#14-demo-day-playbook)
15. [Build Timeline](#15-build-timeline)
16. [Judging Scorecard Mapping](#16-judging-scorecard-mapping)
17. [Repository Structure](#17-repository-structure)

---

## 1. Strategic Foundation

### Why Every Other Project Will Lose

798 registered hackers will all start from the same question: *"What can an AI agent DO on Mantle?"* They will build yield optimizers, copy-trading bots, Telegram alert bots, and arbitrage scripts. They will wrap one or two APIs in a dashboard, call a Chainlink oracle, register an ERC-8004 identity (the easy part), and submit.

Mantle judges — Joshua, Whisker Yu, and the Mantle Core Contributor Team — built three things in 2026 that nobody has written a real application on top of yet:

1. **xStocks + Fluxion xChange (Atomic RFQ)** — activated May 7, 2026. Full-cycle issuance, trading, and direct redemption of tokenized equities on-chain. Three weeks old. Zero agent applications exist.
2. **Mantle Super Portal** — launched January 27, 2026. Native cross-chain infrastructure bridging $MNT from Ethereum L2 to Solana, with Byreal CLMM pools as the destination. Byreal judges James and Stanley built this integration.
3. **ERC-8004 Validation Registry with ZK proofs** — the standard's most advanced registry. Every hackathon team will use the Identity Registry (mint an NFT). Almost none will use the Validation Registry. Difeng Jiang from Allora — your judge — works on agent verification infrastructure. He will immediately know who read the spec.

The winning strategy is not to be the most technically complex team. It is to be the **only team that uses Mantle's newest, hardest-built technologies in the precise way their creators intended.**

### The One Sentence That Wins the Room

> VIGIL is an autonomous AI agent that manages a cross-asset portfolio across mETH, USDY, and xStocks — reacting to global macro events 24 hours a day, executing via Fluxion's Atomic RFQ, routing yield to Byreal on Solana via the Super Portal, and logging every decision with a ZK-verified proof on ERC-8004's Validation Registry — while every traditional equity market on Earth is closed.

---

## 2. The Core Problem

### The 30-Hour Execution Gap

Traditional equity markets are closed for 16+ hours on weekdays and all weekend. Between Friday 4:00 PM EST and Monday 9:30 AM EST — a 65-hour window — price-moving information continues to arrive:

- Earnings surprises and guidance revisions (often released Friday after-hours)
- Federal Reserve minutes and macroeconomic data drops
- Geopolitical events and regulatory announcements
- Smart money on-chain movements that signal institutional positioning

During these windows, institutional traders with 24/7 risk desks adjust their exposure models. Retail investors cannot act until Monday morning. The gap is structural, permanent, and universally experienced.

**On Mantle, this gap does not exist.**

xStocks are tradable 24/7. Fluxion's Atomic RFQ mechanism provides issuer-direct execution quality at any hour. mETH staking yield accrues continuously. USDY treasury yield does not pause. Byreal CLMM positions can be opened or rebalanced at 2:00 AM on a Sunday.

VIGIL is the agent that lives in this gap — operating autonomously across the entire Mantle asset stack at every hour traditional markets cannot.

### Who Has This Problem

- **Retail holders of xStocks on Mantle** — they bought tokenized equities but cannot react to after-hours signals
- **mETH/USDY holders optimizing yield** — manually rebalancing between staking yield and treasury yield based on macro conditions
- **Liquidity providers on Byreal** — CLMM positions go out of range overnight and nobody rebalances them

All three are the same user. VIGIL serves all three simultaneously.

---

## 3. What VIGIL Is

### Agent Identity

- **Name:** VIGIL
- **Type:** Autonomous cross-asset portfolio management agent
- **Primary chain:** Mantle L2 Mainnet (Sepolia testnet for development)
- **Secondary chain:** Solana (via Byreal + Super Portal)
- **ERC-8004 Identity:** Minted at deployment, registered with a public agent card on IPFS
- **Character:** Conservative on xStocks, assertive on yield arbitrage. This character is not scripted — it emerges from the agent's decision weights and becomes legible in the on-chain ledger over time.

### What The Agent Does

Every 30 minutes, VIGIL's decision loop runs:

1. **Ingest** — pulls signals from Chainlink oracles, Nansen smart money API, Elfa AI social sentiment, and Mantle's own on-chain state (mETH APR, USDY yield, xStocks prices)
2. **Weigh** — runs signals through a structured model that assigns weights and produces a typed JSON decision object
3. **Check guardrails** — validates the decision against hardcoded Solidity guardrails (whitelist, slippage cap, epoch allocation limit)
4. **Execute** — if decision clears guardrails: executes via Fluxion Atomic RFQ (for xStocks) or Byreal CLI (for Solana CLMM positions via Super Portal)
5. **Prove** — generates a Groth16 ZK proof of the rebalancing math using a pre-compiled Circom circuit
6. **Log** — submits feedback to ERC-8004 Reputation Registry; submits ZK proof to Validation Registry
7. **Self-fund gas** — earns MNT micro-fees from protocol yield; pays its own gas from this reservoir

---

## 4. Hackathon Strategy

### Primary Track
**AI × RWA** — directly judged by Mantle's own team. This is the track where Mantle's internal judges evaluate submissions about their own asset stack. Winning here is the highest-signal outcome possible.

### Secondary Track / Cross-Entry
**Consumer & Viral DApps** — the War Room interface (see Section 6) is a standalone consumer product. Note it in the submission.

### Prize Pools in Play

| Prize | Amount | Why VIGIL Qualifies |
|---|---|---|
| AI × RWA Track First | $8,500 | Primary submission track |
| Best UI/UX | $3,000 | War Room is a category-defining interface |
| Community Voting × 2 | $17,000 | Shareable proof links, X thread strategy |
| Grand Champion | $9,000 | Multi-track strength + live demo moment |
| Elfa AI Partner Prize | TBD | Elfa API is a core signal layer |
| Nansen Partner Prize | TBD | Nansen smart money is a core signal layer |
| **Total in play** | **~$37,500+** | |

### The Narrative That Wins

The hackathon is called **The Turing Test.** Your demo moment must be the Turing Test, literally.

At Demo Day (July 2–3), you open the War Room live. The agent has been running for 14 days. Its ledger is real. You scroll to a specific event — a Saturday earnings signal — and show that VIGIL repositioned the xStocks allocation 6 hours before NYSE opened Monday. The hash is on Mantlescan. The ZK proof is in the Validation Registry.

Then you say: *"Every institutional equity trader was locked out of their position for 65 hours. VIGIL wasn't. This is what 24/7 RWA execution looks like."*

The Turing Test is not mimicking human language. It is exceeding human capability. On stage. Live. With 14 days of on-chain proof.

---

## 5. Product Requirements — User Flows

### Flow 1: Agent Spawn (First-Time User)

```
User connects wallet
  → Frontend reads wallet address
  → Backend calls ERC-8004 Identity Registry: mintIdentity()
  → Agent card JSON generated:
      { name, capabilities, endpoints, paymentAddress, supportedProtocols }
  → Agent card pinned to IPFS via web3.storage SDK
  → CID registered on-chain: identityRegistry.setAgentCard(tokenId, cid)
  → War Room initializes with agent name, ID, and 00:00 uptime counter
  → Agent cron job starts: runs every 30 minutes
```

**What the user sees:** A single loading screen with the message *"Your agent is waking up. Agent #[ID] has been assigned to [wallet]. Registering identity on Mantle..."* — not a spinner, a sentence. Then the War Room appears with all panels live.

**What the judges see:** A real ERC-8004 identity minted live on Mantle. Verifiable immediately on the ERC-8004 Explorer (erc8004.quicknode.com).

---

### Flow 2: The 30-Minute Decision Loop (Autonomous, No User Needed)

```
Cron fires (every 30 min)
  → Signal Aggregator runs in parallel:
      ├─ Chainlink: fetch mETH APR, USDY yield, xStocks prices (TSLAx, NVDAx, AAPLx)
      ├─ Nansen: query smart money wallet movements for mETH, USDY, xStocks
      ├─ Elfa AI: fetch social sentiment delta for mETH, NVDAx, USDY (7d rolling)
      └─ Mantle RPC: read on-chain allocation from VIGILVault contract
  → Signal Aggregator outputs: SignalBundle (typed JSON, see Data Models)
  → Decision Engine processes SignalBundle:
      → Scores each asset class (mETH, USDY, xStocks per ticker)
      → Generates Decision object: { action, fromAsset, toAsset, amount, confidence }
      → Confidence below 55% threshold → SKIP (logged as "skipped, confidence too low")
  → If action = EXECUTE:
      → Guardrail contract call: VIGILVault.validateDecision(Decision)
      → If guardrail PASS → route to executor:
          ├─ xStocks trades → Fluxion Atomic RFQ (xChange)
          ├─ Yield rotation mETH↔USDY → Mantle DEX
          └─ CLMM positions (Byreal APR > mETH APR + 0.8%) → Super Portal → Byreal CLI
      → Tx hash captured
      → ZK proof generated (Circom circuit, Groth16)
      → ERC-8004 Reputation Registry: submitFeedback(agentId, taskId, score, metadataCID)
      → ERC-8004 Validation Registry: submitValidation(agentId, zkProof, verifierAddress)
      → Event logged to VIGILLedger contract
      → Frontend WebSocket receives event → War Room updates live
```

**What the user sees:** Live War Room updating in real time. Decision pipeline animates. Ledger entry appears. No user action required at any point.

---

### Flow 3: Yield Routing to Byreal (Cross-Chain)

```
Condition: Byreal MNT-USDC CLMM APR > mETH staking APR + 0.8% (threshold configurable)
  → Decision Engine fires: ROUTE_TO_CLMM
  → Executor calls Super Portal bridge contract:
      superPortal.bridge({ token: MNT, amount, destChain: SOLANA, recipient: agentSolanaWallet })
  → Byreal CLI (Node.js subprocess):
      byreal-cli positions open --pool MNT-USDC --amount [x] --range-type balanced --auto-swap
  → Position ID captured
  → Monitor loop (every 30 min): byreal-cli positions analyze --id [positionId]
  → If out-of-range: rebalance or close
  → On close: bridge MNT back via Super Portal
  → Log full round-trip on ERC-8004 + VIGILLedger
```

---

### Flow 4: Public Proof Share

```
Every executed decision → unique public URL generated:
  vigil.app/proof/[txHash]
  
Public proof page shows:
  - Signal inputs that triggered the decision (anonymized wallet amounts)
  - Decision reasoning (JSON expanded to human-readable sentences)
  - ZK proof hash + link to Validation Registry on Mantlescan
  - Outcome (pending / confirmed / measured delta)
  - Copy-to-X button: "VIGIL made this move at 02:17 UTC Sunday while NYSE was closed. Verified on Mantle. [link]"
```

This is the Community Voting mechanic. Every proof is a shareable tweet. Every tweet drives votes. $17,000 in Community Voting prizes is rarely aggressively designed for — VIGIL does it by making every decision naturally shareable.

---

## 6. UI Architecture — Screen by Screen

### Design Language

VIGIL's interface speaks Mantle's visual language precisely:
- **Background:** Near-black (`#0A0B0D`) — matches Mantle's dark mode identity
- **Primary accent:** Mantle green (`#00D097`) — used for live states, success badges, fill bars
- **Typography:**
  - Interface labels, data: `DM Mono` (monospace, 10–12px) — cold, precise, machine-like
  - Narrative text (event descriptions, decision reasoning): `Instrument Serif` — gives the agent a voice, a persona
  - Body copy: `Figtree` — clean, modern, readable
- **Border language:** 0.5px semi-transparent borders — never heavy, never boxed-in
- **Motion:** Only two animations used anywhere: a 2-second pulse on the live dot (top-left), and a 300ms slide-in on new ledger entries. Nothing else moves. Motion is earned.

---

### Screen 1: Spawn Screen (First Visit)

**Layout:** Full-screen centered card. Dark background. Single animated element.

```
[Mantle green pulse dot, slow breath animation]

VIGIL
Autonomous RWA Portfolio Agent

Connecting to wallet...
[wallet address appears]

Registering agent identity on Mantle...
[progress line fills left to right]

Agent #[N] assigned.
Your agent is awake.

[War Room loads]
```

**Engineering note:** The spawn screen masks the 8–15 second ERC-8004 registration + IPFS pin. It should feel like the agent is being born, not like a loading bar.

---

### Screen 2: The War Room (Primary Interface)

Three columns, always visible. No tabs. No navigation. Everything is live, everything is now.

#### Column 1 (left, 28%): Macro Event Stream

A reverse-chronological feed of every signal the agent has observed in the last 24 hours. Each entry shows:
- Timestamp (UTC)
- Signal source badge: `CHAINLINK` / `NANSEN` / `ELFA` / `MANTLE`
- One-sentence description of what was observed (written by the agent using Instrument Serif)
- Status badge: `ACTED` (green) / `SKIPPED` (grey) / `WATCHING` (amber)

The feed scrolls automatically. No pagination. Users can click any entry to see its full signal data in a slide-out panel.

**Key design detail:** `SKIPPED` entries must be visible and numerous. An agent that never skips looks like it's trading noise. An agent that skips 70% of signals and only acts on 30% looks intelligent.

#### Column 2 (center, 44%): Decision Pipeline

This is the heart of VIGIL's UX. It shows the current or most recent decision flowing through the agent's logic stages — live.

Five stages, rendered as cards stacked vertically with arrows between them:

```
[Stage 1] Signal Intake
  Shows the specific signals feeding this decision

      ↓

[Stage 2] Weighted Model  ← HIGHLIGHTED when active
  Shows weights applied: "NVDAx earnings signal: 0.71 | Smart money: 0.62"
  Shows combined confidence: "79%"
  Shows ZK proof status: "Computing Groth16 proof..."

      ↓

[Stage 3] Guardrail Check
  Shows each check: whitelist ✓ | slippage limit ✓ | epoch cap ✓

      ↓

[Stage 4] Execution
  Shows route taken: "Fluxion Atomic RFQ" or "Super Portal → Byreal CLMM"
  Shows tx hash when confirmed

      ↓

[Stage 5] ERC-8004 Logged
  Shows reputation score delta: "847 → 851"
  Shows validation proof hash
```

When no decision is active: shows the last completed pipeline in a dimmed state. Shows "Next evaluation in: 14:32" countdown.

**Key design detail:** The pipeline is not a log. It's a live visualization of cognition. Judges watch an agent *thinking* in real time. No other submission will have this.

#### Column 3 (right, 28%): Agent Identity + Ledger

**Top section — Agent Reputation (ERC-8004)**
```
Agent #047 · VIGIL
[green pulse dot] ACTIVE · 14d 6h uptime

Reputation Score: 851 / 1000
[progress bar, 85.1% filled]

Decisions: 214 total · 167 verified
Accuracy: 78% (measured by outcome delta)
```

**Middle section — Action Ledger**

Last 8 executed decisions. Each row:
```
[asset pair]     [amount]     [time]
NVDAx → USDY    $1,840       02:17 UTC
[Atomic RFQ]    [0x8f3a...b2c1]   +0.41%
```

Clicking any row opens the public proof page for that transaction.

**Bottom section — Current Allocation**

Horizontal bar chart. Five rows: mETH, USDY, NVDAx, AAPLx, MNT (gas reserve). Bars animate smoothly when allocation changes. Percentages update live.

---

### Screen 3 (Footer Bar): The Market Gap Clock

A persistent bar across the bottom of the War Room. Always visible. Never removed.

```
TRADITIONAL MARKETS    NYSE: CLOSED (06:59)    NASDAQ: CLOSED (06:59)    LSE: CLOSED (07:29)    TSE: CLOSED (01:31)    ||    VIGIL: ACTIVE ●
```

When markets are open during US trading hours, the bar reads:
```
NYSE: OPEN    NASDAQ: OPEN    ||    VIGIL: ACTIVE ● · [N] decisions executed this session
```

This bar is the product's thesis made visible. It never lets the judge forget the core value proposition.

---

### Screen 4: Public Proof Page (`/proof/[txHash]`)

Standalone page. Shareable URL. Minimal layout. Designed to be read in 30 seconds on a phone.

```
VIGIL · Verified Decision

Agent #047 made this move at:
02:17 UTC · Sunday, June 1, 2026
NYSE was CLOSED · 6h 59m until open

WHAT HAPPENED:
NVDAx → USDY · $1,840 rotated
Executed via Fluxion xChange Atomic RFQ
Slippage: 0.12% (cap: 0.40%)

WHY THE AGENT ACTED:
"NVIDIA Q2 guidance showed $400M revenue miss vs consensus.
Two smart wallets (Nansen-flagged) exited $1.2M NVDAx combined.
Social sentiment on NVDAx dropped 18% in 4 hours.
Combined signal weight: 0.74 → above 0.60 execution threshold."

OUTCOME (measured 6h later):
NVDAx price: −2.3%
USDY yield captured: +0.09%
Net benefit: +$47.80 on $1,840 position

ON-CHAIN PROOF:
[Mantlescan TX]  [ERC-8004 Validation Registry]  [ZK Proof Hash]

[Share on X →]  [View agent ledger →]
```

---

## 7. Internal System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        VIGIL SYSTEM                              │
│                                                                  │
│  ┌─────────────────┐     ┌──────────────────────────────────┐   │
│  │  Frontend (Next) │     │         Agent Runtime             │   │
│  │                  │     │                                  │   │
│  │  War Room UI     │◄────│  Cron: every 30 min              │   │
│  │  Proof Pages     │     │  ┌────────────────────────────┐  │   │
│  │  WebSocket live  │     │  │    Signal Aggregator        │  │   │
│  └─────────────────┘     │  │  Chainlink · Nansen · Elfa  │  │   │
│                           │  │  Mantle RPC · mETH oracle   │  │   │
│  ┌─────────────────┐     │  └──────────┬─────────────────┘  │   │
│  │  VIGILVault.sol  │     │             │                     │   │
│  │  (Mantle)        │     │  ┌──────────▼─────────────────┐  │   │
│  │                  │◄────│  │    Decision Engine          │  │   │
│  │  validateDecision│     │  │  Weighted scoring model     │  │   │
│  │  executeRebalance│     │  │  JSON output: Decision{}    │  │   │
│  │  gasReservoir    │     │  └──────────┬─────────────────┘  │   │
│  └────────┬────────┘     │             │                     │   │
│           │               │  ┌──────────▼─────────────────┐  │   │
│           │               │  │    Guardrail Validator      │  │   │
│           │               │  │  Calls VIGILVault.validate  │  │   │
│           │               │  └──────────┬─────────────────┘  │   │
│           │               │             │                     │   │
│           │               │  ┌──────────▼─────────────────┐  │   │
│           │               │  │       Executor Router       │  │   │
│           │               │  │                             │  │   │
│           │               │  │  ┌──────────┐ ┌──────────┐ │  │   │
│           │               │  │  │ Fluxion  │ │  Byreal  │ │  │   │
│           │               │  │  │ xChange  │ │  CLI +   │ │  │   │
│           │               │  │  │ Atomic   │ │  Super   │ │  │   │
│           │               │  │  │ RFQ      │ │  Portal  │ │  │   │
│           │               │  │  └──────────┘ └──────────┘ │  │   │
│           │               │  └──────────┬─────────────────┘  │   │
│           │               │             │                     │   │
│           │               │  ┌──────────▼─────────────────┐  │   │
│           │               │  │    Proof & Registry Layer   │  │   │
│           │               │  │                             │  │   │
│           │               │  │  Circom circuit → Groth16   │  │   │
│           │               │  │  ERC-8004 Reputation Reg.   │  │   │
│           │               │  │  ERC-8004 Validation Reg.   │  │   │
│           │               │  │  VIGILLedger event emit     │  │   │
│           │               │  └─────────────────────────────┘  │   │
│           │               └──────────────────────────────────┘   │
│           │                                                        │
└───────────┼────────────────────────────────────────────────────────┘
            │
            ▼
     Mantlescan · ERC-8004 Explorer · IPFS
```

### Service Breakdown

| Service | Tech | Responsibility |
|---|---|---|
| `frontend/` | Next.js 15, Tailwind, wagmi | War Room, Proof pages, WebSocket receiver |
| `agent/` | Node.js 20, TypeScript | Cron runner, Signal Aggregator, Decision Engine |
| `executor/` | Node.js, ethers.js, byreal-cli | Tx routing: Fluxion / Byreal |
| `prover/` | snarkjs, Circom 2.x | ZK proof generation (Groth16) |
| `contracts/` | Solidity 0.8.25, Hardhat | VIGILVault, VIGILLedger |
| `indexer/` | Postgres + event listeners | Store decision history, serve to frontend |

---

## 8. Technology Stack — Specs and Docs

### 8.1 ERC-8004 — Trustless Agents Standard

**What it is:** Three on-chain registries for agent identity, reputation, and validation. Authored by MetaMask, Ethereum Foundation, Google, and Coinbase. Live on Ethereum mainnet since January 29, 2026. Live on Mantle.

**Contract addresses:**
- Identity Registry (mainnets): vanity address prefix `0x8004A169...`
- Identity Registry (testnets): vanity address prefix `0x8004A818...`
- Full address list: https://github.com/sudeepb02/awesome-erc8004

**How VIGIL uses all three registries:**

| Registry | VIGIL Usage | Why It Matters |
|---|---|---|
| Identity Registry | Mint agent NFT at spawn; pin agent card JSON to IPFS; register CID on-chain | Gives VIGIL a public, discoverable, verifiable identity |
| Reputation Registry | After every decision: submit signed feedback with slippage, latency, outcome delta | Builds a public track record that grows over 14 days |
| Validation Registry | Submit Groth16 ZK proof of portfolio rebalancing math after every execution | The only team proving its math cryptographically |

**Agent Card JSON structure (pin to IPFS, register CID):**
```json
{
  "name": "VIGIL",
  "description": "24/7 autonomous RWA portfolio agent on Mantle. Manages mETH, USDY, and xStocks positions using macro signals.",
  "version": "1.0.0",
  "capabilities": [
    { "id": "rwa-rebalance", "description": "Rebalance across mETH, USDY, xStocks" },
    { "id": "clmm-manage", "description": "Open/close Byreal CLMM positions via Super Portal" },
    { "id": "xstocks-execute", "description": "Execute xStocks trades via Fluxion Atomic RFQ" }
  ],
  "endpoints": [
    { "protocol": "https", "url": "https://vigil.app/api/agent" },
    { "protocol": "mcp", "url": "https://vigil.app/mcp" }
  ],
  "paymentAddress": "0x[agentWallet]",
  "supportedProtocols": ["A2A", "MCP", "x402"]
}
```

**Key integration code (Identity Registry):**
```typescript
// From: https://docs.monad.xyz/guides/erc-8004
import { identityRegistryAbi } from './abis/erc8004';

const IDENTITY_REGISTRY = '0x8004A169...'; // Mantle mainnet address

async function mintAgentIdentity(agentCardCID: string) {
  const tx = await identityRegistry.write.mintIdentity([agentCardCID]);
  const receipt = await publicClient.waitForTransactionReceipt({ hash: tx });
  const agentId = receipt.logs[0].topics[1]; // tokenId
  return agentId;
}

async function submitReputation(agentId: string, taskId: string, score: number, metadataCID: string) {
  // score: int128 fixed point, score = 85.5 → 855n (2 decimals)
  await reputationRegistry.write.submitFeedback([agentId, taskId, BigInt(score * 10), 2n, metadataCID]);
}
```

**Docs:**
- EIP spec: https://eips.ethereum.org/EIPS/eip-8004
- Monad implementation guide (fully transferable to Mantle): https://docs.monad.xyz/guides/erc-8004
- Quicknode ERC-8004 Explorer: https://erc8004.quicknode.com
- awesome-erc8004 resource list: https://github.com/sudeepb02/awesome-erc8004

---

### 8.2 Fluxion xChange — Atomic RFQ for xStocks

**What it is:** Activated May 7, 2026. Allows direct mint/redemption of xStocks tokens (TSLAx, NVDAx, AAPLx, METAx, GOOGLx, MSTRx, HOODx, SPYx, QQQx, CRCLx) via Request for Quote, bypassing AMM. Issuer-direct pricing. This is three weeks old. No agent application exists on it yet.

**Why VIGIL uses it:** Atomic RFQ provides institutional-grade execution quality for xStocks trades — critical when executing after-hours on a Sunday. AMM slippage would be unacceptable for an agent claiming precision. Atomic RFQ gives the agent real-price execution from the issuer itself.

**Integration approach:**
```typescript
// Fluxion xChange contract (get address from Fluxion docs: https://docs.fluxion.network)
// Two-step: requestQuote → executeWithQuote

async function executeXStockTrade(fromToken: string, toToken: string, amount: bigint) {
  // Step 1: Request quote from RFQ endpoint
  const quote = await fluxionRfq.requestQuote({
    tokenIn: fromToken,   // e.g., xStocks USDY address
    tokenOut: toToken,    // e.g., NVDAx contract address
    amountIn: amount,
    slippageTolerance: 40, // 0.4% max — hardcoded, not configurable by agent
  });

  if (quote.priceImpact > 40n) {
    throw new GuardrailError('SLIPPAGE_EXCEEDED');
  }

  // Step 2: Execute with quote
  const tx = await fluxionXChange.write.swapWithQuote([
    quote.quoteId,
    quote.amountOut,
    quote.deadline,
    quote.signature
  ]);
  
  return tx;
}
```

**Docs:**
- Fluxion Network docs: https://docs.fluxion.network
- xStocks on Mantle: https://xstocks.fi
- BackedFi (issuer): https://backed.fi/docs

**xStocks contract addresses (Mantle mainnet):**

Get these from https://docs.fluxion.network/xstocks — do not hardcode assumptions, fetch from official docs before coding.

---

### 8.3 Byreal Skills CLI — CLMM on Solana

**What it is:** Open-source CLI published as an Openclaw skill. Allows AI agents to execute swaps, manage CLMM positions, copy top farmers, and analyze pools on Byreal DEX (Solana). The CLI is designed natively for machine users — its output is structured JSON.

**Install:**
```bash
npm install -g @byreal-io/byreal-cli
byreal-cli setup  # stores keypair at ~/.config/byreal/keys/ (mode 0600)
byreal-cli wallet address
```

**Key commands used by VIGIL:**
```bash
# Check CLMM APR before routing capital
byreal-cli pools analyze --pool MNT-USDC --output json

# Open CLMM position with auto-swap (balances asset ratio automatically)
byreal-cli positions open \
  --pool MNT-USDC \
  --amount 3200 \
  --range-type balanced \
  --auto-swap \
  --output json

# Monitor position (run every 30 min)
byreal-cli positions analyze --id [positionId] --output json

# Close position when out-of-range or APR drops below threshold
byreal-cli positions close --id [positionId] --output json

# Claim accumulated fees
byreal-cli positions claim --id [positionId] --output json
```

**Integration in Node.js agent:**
```typescript
import { execSync } from 'child_process';

function byrealCli(args: string): Record<string, unknown> {
  const output = execSync(`byreal-cli ${args} --output json`, {
    env: { ...process.env, HOME: '/home/vigil-agent' } // isolated keypair directory
  });
  return JSON.parse(output.toString());
}

async function openClmmPosition(amountMNT: number): Promise<string> {
  const result = byrealCli(`positions open --pool MNT-USDC --amount ${amountMNT} --range-type balanced --auto-swap`);
  return result.positionId as string;
}
```

**Security note:** The Byreal CLI never transmits private keys over the network. Keys are stored locally and used only for local transaction signing. VIGIL's agent wallet keypair is isolated in a dedicated directory with mode 0600.

**Docs:**
- GitHub: https://github.com/byreal-git/byreal-agent-skills
- SKILL.md (canonical reference): https://github.com/byreal-git/byreal-cli/blob/main/skills/byreal-cli/SKILL.md
- Byreal docs: https://docs.byreal.io
- How to set up: https://docs.byreal.io/byreal-ai-agent-skills/how-to-set-up-ai-agent

---

### 8.4 Mantle Super Portal — Cross-Chain Bridge

**What it is:** Mantle's native cross-chain infrastructure. Launched January 27, 2026. Bridges $MNT from Ethereum/Mantle L2 to Solana, enabling native use in Byreal CLMM pools. Built with Bybit and Byreal.

**VIGIL uses it when:** Byreal MNT-USDC CLMM APR exceeds mETH staking APR by more than 0.8% (configurable threshold). When this condition holds, the agent routes capital cross-chain autonomously.

**Integration:**
```typescript
// Super Portal bridge interface (get ABI from: https://portal.mantle.xyz)
async function bridgeToSolana(amountMNT: bigint, solanaDestWallet: string) {
  const superPortal = new ethers.Contract(SUPER_PORTAL_ADDRESS, SUPER_PORTAL_ABI, agentSigner);
  
  const tx = await superPortal.bridge({
    token: MNT_TOKEN_ADDRESS,
    amount: amountMNT,
    destinationChain: 'SOLANA',
    recipient: solanaDestWallet,  // agent's Solana wallet address
    deadline: BigInt(Math.floor(Date.now() / 1000) + 1800) // 30 min deadline
  });
  
  await tx.wait();
  return tx.hash;
}
```

**Docs:**
- Super Portal: https://portal.mantle.xyz
- Press release (architecture details): https://prnewswire.com/news-releases/bybit-mantle-and-byreal-partner-to-extend-cedefi-access-for-mnt-on-solana-via-mantle-super-portal-302671330.html
- Learn article: https://learn.bybit.com/en/altcoins/mnt-bridging-ethereum-solana

---

### 8.5 Chainlink Oracles — Macro Signal Layer

**What VIGIL fetches:**
- mETH staking APR (Mantle's own oracle)
- USDY 7-day effective yield (Ondo/Chainlink feed)
- xStocks real-time price feeds (TSLAx, NVDAx, AAPLx) — available via BackedFi oracle or Chainlink
- Federal Reserve data and macroeconomic indicators (Chainlink Functions for off-chain data)

**Key integration:**
```typescript
// Chainlink Data Feeds — EVM
import { ethers } from 'ethers';
const AGGREGATOR_ABI = ['function latestRoundData() view returns (uint80,int256,uint256,uint256,uint80)'];

async function fetchPrice(feedAddress: string): Promise<number> {
  const feed = new ethers.Contract(feedAddress, AGGREGATOR_ABI, provider);
  const [,answer,,] = await feed.latestRoundData();
  return Number(answer) / 1e8; // Chainlink uses 8 decimals
}
```

**Docs:**
- Chainlink Data Feeds on Mantle: https://docs.chain.link/data-feeds/price-feeds/addresses?network=mantle
- Chainlink Functions (for off-chain macro data): https://docs.chain.link/chainlink-functions

---

### 8.6 Nansen Smart Money API

**What VIGIL fetches:** Flagged smart wallet movements for mETH, USDY, and xStocks assets. When 2+ smart wallets exit or enter a position within a 6-hour window, this is treated as a high-weight signal.

**Sponsor credits:** Apply at dorahacks.io/hackathon/mantleturingtesthackathon2026 — $7,000 in Nansen API credits available for hackathon participants. **Apply immediately upon reading this.**

```typescript
const nansenClient = new NansenAPI({ apiKey: process.env.NANSEN_API_KEY });

async function getSmartMoneyFlows(tokenAddress: string, windowHours = 6) {
  const flows = await nansenClient.smartMoney.getTokenFlows({
    token: tokenAddress,
    chain: 'mantle',
    windowHours,
    minUsdValue: 50000, // only care about $50k+ moves
  });
  return flows.filter(f => f.walletLabel.includes('Smart Money'));
}
```

**Docs:** https://docs.nansen.ai (API key from sponsor credits application)

---

### 8.7 Elfa AI — Social Sentiment Layer

**What VIGIL fetches:** Social sentiment delta for mETH, NVDAx, AAPLx, USDY tokens. A 4-hour sentiment drop of >15% on a token is treated as a negative signal. A 4-hour surge of >20% is a positive signal.

**Sponsor credits:** $36,000 in API credits — the largest credit pool in the hackathon. Apply via the hackathon resource portal. The Elfa AI CEO (Tristan Teo) is a judge — using their API visibly is strategic.

```typescript
const elfaClient = new ElfaAI({ apiKey: process.env.ELFA_API_KEY });

async function getSentimentDelta(keyword: string, hours = 4) {
  const current = await elfaClient.sentiment.get({ keyword, window: `${hours}h` });
  const baseline = await elfaClient.sentiment.get({ keyword, window: '7d' });
  return (current.score - baseline.score) / baseline.score; // normalized delta
}
```

**Docs:** https://docs.elfa.ai

---

### 8.8 ZK Proofs — Circom + snarkjs (Groth16)

**What VIGIL proves:** Every portfolio rebalancing decision includes a Groth16 ZK proof that validates:
1. The signal weights used were within the declared model range
2. The allocation change does not exceed the per-epoch cap
3. The resulting portfolio allocation sums to 100%

This proves the agent's math is correct without revealing the exact signal values.

**Circuit (Circom 2.x):**
```circom
// vigil_rebalance.circom
pragma circom 2.0.0;

template VigilRebalance() {
  // Private inputs (not revealed)
  signal input mEthSignalWeight;
  signal input usdySignalWeight;
  signal input xstockSignalWeight;
  
  // Public inputs (on-chain)
  signal input prevAllocation[3];   // [mETH%, USDY%, xStocks%] × 100
  signal input newAllocation[3];
  signal input maxEpochChange;      // max 15% per epoch — hardcoded
  
  // Constraints
  // 1. Allocations sum to 100
  signal alloc_sum;
  alloc_sum <== newAllocation[0] + newAllocation[1] + newAllocation[2];
  alloc_sum === 10000; // 100.00% × 100
  
  // 2. Per-epoch change within cap
  component abs0 = AbsoluteValue();
  abs0.in <== newAllocation[0] - prevAllocation[0];
  abs0.out <= maxEpochChange;
  
  // 3. Weights within declared range [0, 100]
  mEthSignalWeight * (100 - mEthSignalWeight) >= 0;
}

component main = VigilRebalance();
```

**Proof generation:**
```typescript
import { groth16 } from 'snarkjs';

async function generateRebalanceProof(input: ProofInput): Promise<Proof> {
  const { proof, publicSignals } = await groth16.fullProve(
    input,
    'circuits/vigil_rebalance.wasm',
    'circuits/vigil_rebalance_final.zkey'
  );
  return { proof, publicSignals };
}

// Submit to ERC-8004 Validation Registry
async function submitProofToRegistry(agentId: string, proof: Proof) {
  await validationRegistry.write.submitValidation([
    agentId,
    proof.proofBytes,     // calldata-encoded Groth16 proof
    VIGIL_VERIFIER_ADDRESS // deployed Solidity verifier
  ]);
}
```

**Docs:**
- Circom 2.x: https://docs.circom.io
- snarkjs: https://github.com/iden3/snarkjs
- Reference implementation (Zyfai, rebalancer use case): https://github.com/ondefy/erc8004-implementation

---

### 8.9 x402 — Agent Micro-Payments

**What it is:** Standard for native HTTP-layer micro-payments between agents. VIGIL uses x402 to pay for Nansen and Elfa API data requests autonomously, without any manual authorization flow.

```typescript
import { x402Client } from '@quicknode/x402';

// Agent pays for data automatically — no human approval
const nansenData = await x402Client.fetch('https://api.nansen.ai/v1/smart-money/flows', {
  paymentToken: 'USDC',
  maxPaymentAmount: '0.01', // $0.01 per request — agent pays from its micro-fee reservoir
  chain: 'mantle'
});
```

**Docs:**
- x402 npm package: `npm install @quicknode/x402`
- Quicknode x402 docs: https://www.quicknode.com/docs/x402

---

### 8.10 Web3.storage (Filecoin/IPFS) — Agent Card Pinning

```typescript
import { create } from '@web3-storage/w3up-client';

async function pinAgentCard(agentCard: AgentCard): Promise<string> {
  const client = await create();
  const blob = new Blob([JSON.stringify(agentCard)], { type: 'application/json' });
  const cid = await client.uploadFile(blob);
  return cid.toString(); // Returns IPFS CID
}
```

**Docs:** https://web3.storage/docs

---

## 9. Smart Contract Specification

### 9.1 VIGILVault.sol

Primary on-chain contract. Deployed on Mantle Sepolia (dev) and Mantle Mainnet (demo).

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract VIGILVault is Ownable {
    
    // ── GUARDRAILS (hardcoded, non-configurable by agent) ──
    uint256 public constant MAX_SLIPPAGE_BPS = 40;       // 0.40%
    uint256 public constant MAX_EPOCH_ALLOCATION = 1500; // 15% per epoch
    uint256 public constant MAX_SINGLE_TX_USD = 10_000e6; // $10,000 per tx
    uint256 public constant GAS_RESERVOIR_MIN = 0.5 ether; // 0.5 MNT minimum
    
    // ── ASSET WHITELIST (agent can ONLY interact with these) ──
    mapping(address => bool) public allowedTokens;
    // Populated at deployment:
    // mETH, USDY, TSLAx, NVDAx, AAPLx, METAx, GOOGLx, MSTRx, SPYx, QQQx, MNT
    
    // ── AGENT IDENTITY ──
    address public immutable AGENT_WALLET;
    uint256 public erc8004AgentId;
    
    // ── GAS RESERVOIR ──
    uint256 public gasReservoir; // In MNT, earned from protocol yield
    
    // ── STATE ──
    mapping(address => uint256) public allocation;  // token → basis points (10000 = 100%)
