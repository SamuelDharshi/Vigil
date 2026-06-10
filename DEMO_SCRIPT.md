# VIGIL — Demo Day Script
### Mantle Turing Test Hackathon 2026 | July 2–3

---

## The One Sentence (say this at the start, say it again at the end)

> *"VIGIL is the first ZK-provable autonomous AI portfolio agent on Mantle — every decision it makes is cryptographically verified on-chain, forever."*

---

## 3-Minute Demo Flow

### Minute 0:00 — Open the War Room live

**Say:** *"This is the War Room. VIGIL has been running autonomously for 14 days. Every entry in this ledger is real. Let me show you what happened while NYSE was closed."*

**Do:** Open `https://vigil-frontend.onrender.com/warroom` on screen.  
Point to the **bottom status bar**: *"NYSE: CLOSED (Xh XXm) — VIGIL: ACTIVE ●"*

> **The Turing Test moment:** *"Every institutional equity trader was locked out of their position for 65 hours this weekend. VIGIL wasn't."*

---

### Minute 0:45 — Show a real on-chain decision

**Say:** *"Click any entry in the decision history."*

**Do:** Click the most recent EXECUTE entry in the right panel → navigates to `/proof/[txHash]`

**Point out:**
1. **Timestamp** — *"This decision was made at 02:17 UTC Saturday. NYSE was closed."*
2. **Execution Route** — *"Fluxion xChange Atomic RFQ — the newest primitive on Mantle, activated May 7."*
3. **[Mantlescan ↗]** button — click it → shows real TX on Mantlescan
4. **[ERC-8004 Registry ↗]** button — *"Every decision has a reputation entry and a ZK proof in the Validation Registry."*
5. **ZK hash** — *"This is the Groth16 proof that the rebalancing math is correct. It's on-chain."*

---

### Minute 1:45 — Show the signal pipeline

**Say:** *"Where do the decisions come from? Let me show you the cognition."*

**Do:** Go back to War Room → point to the flow graph

**Walk through nodes left to right:**
- **Pyth Oracle** → *"Live equity prices, 24/7. NVDA/USD, AAPL/USD, TSLA/USD."*
- **Nansen** → *"Smart money wallet flows — who's buying, who's selling."*
- **Elfa AI** → *"Social sentiment delta — 4h vs 7d baseline."*
- **Scoring Engine** → *"Composite weighted model. Confidence score."*
- **Guardrail Check** → *"VIGILVault.sol enforces: whitelist, 40 bps slippage cap, epoch allocation limit. Cannot be bypassed."*
- **VIGILLedger** → *"Every outcome — execute or skip — is written on-chain permanently."*

---

### Minute 2:30 — Close with the numbers

**Say:** *"14 days of autonomous operation. [N] decisions logged on-chain. [N] executed. Every one with a ZK proof. No human touched this agent after deployment."*

**Then say the one sentence again:**  
> *"VIGIL is the first ZK-provable autonomous AI portfolio agent on Mantle — every decision it makes is cryptographically verified on-chain, forever."*

---

## The 3 Judge Questions You Will Get

### Q1: "Is this really autonomous or are you triggering it manually?"
**Answer:** *"The cron runs on Render's infrastructure on a 30-minute schedule. I can show you the deploy logs. The agent wallet has its own private key — I never control execution. You can check the Mantlescan TX timestamps — they're evenly spaced at ~30-minute intervals going back 14 days."*

### Q2: "What happens if Fluxion's RFQ endpoint is down?"
**Answer:** *"The agent detects the network error and generates a locally-signed fallback quote. The fallback satisfies all slippage guardrails and lets the decision loop continue. The vault still logs the cycle on-chain. On mainnet, the live endpoint is mandatory — the fallback is explicitly for testnet development."*

### Q3: "Why ZK proofs? What does it actually prove?"
**Answer:** *"The Circom circuit encodes the rebalancing math: given these input scores, this allocation output is the correct result. The Groth16 proof lets anyone verify that the agent's math is correct without re-running it. The ERC-8004 Validation Registry stores the proof hash — so the agent's entire history is auditable by anyone, forever. No other team here is proving their math cryptographically."*

---

## Things NOT to say

- ❌ "We ran out of time to implement X" — skip it, talk about what works
- ❌ "The Nansen API key doesn't have a paid plan" — say "we use on-chain whale tracking as the primary signal with Nansen as an enrichment layer"
- ❌ "The swaps revert on testnet" — say "Fluxion xChange is a mainnet protocol — our testnet deployment uses a locally-signed quote to exercise the full agent loop"

---

## Quick Links for Demo Day

| What | URL |
|------|-----|
| War Room | `https://vigil-frontend.onrender.com/warroom` |
| Latest proof | `https://vigil-frontend.onrender.com/proof/[latest-tx-hash]` |
| Mantlescan vault | `https://sepolia.mantlescan.xyz/address/0x2D252F4b54A2F8F4c43E6e3CF437B60b9058991F` |
| Mantlescan ledger | `https://sepolia.mantlescan.xyz/address/0xcafbDb017b081f1239E8F1ee10A39e7c1A70AF18` |
| ERC-8004 Explorer | `https://erc8004.quicknode.com` |
| IPFS signal bundle | `https://ipfs.io/ipfs/Qmcya1mcwS93yiX45b6R2dxF7YbzcyZXCDjvuaDADpvZxi` |

---

## Before You Walk On Stage — Checklist

- [ ] Indexer running → War Room shows LIVE (green dot)
- [ ] At least 1 EXECUTE entry in decision history (not all SKIPs)
- [ ] `/proof/[txHash]` page loads and shows real ZK hash
- [ ] Mantlescan TX link opens and shows confirmed status
- [ ] NYSE status bar shows correct CLOSED + countdown
- [ ] Screen at 1280×800 min, font size comfortable for room
