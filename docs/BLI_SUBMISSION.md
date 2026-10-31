# BLI Legal Tech Hackathon 2 Submission

**Name:** Vigil

**Tagline:** An autonomous agent that keeps its reasoning open to audit.

**Description:** Vigil is an autonomous market agent on Mantle Sepolia that records its decisions, including the times it chose not to act. A Chainlink CRE workflow orchestrates automated risk monitoring: on a schedule it reads Vigil's on-chain ledger and vault, fetches market data from external APIs and sets a risk posture using deterministic rules. It recommends only. It holds no key and cannot trade.

**Track:** LegalTech & RegTech

**Bounty:** Chainlink, Best workflow with CRE

## Requirement evidence

| Requirement | Where | Evidence |
|---|---|---|
| CRE workflow as orchestration layer | cre/vigil-risk-monitor/main.ts | Cron trigger, chain read, API calls, decision |
| Blockchain integration | EVMClient reads of VIGILLedger and VIGILVault | 12 ledger entries, 4 decisions, 8 skips on Mantle Sepolia |
| External API | HTTPClient calls to Alternative.me and CoinGecko | Fear & greed 30, ETH 24h +0.88% |
| Successful CLI simulation | CRE CLI v1.33.0 | docs/evidence/cre-simulate-vigil.log |

## Reproduce

From cre/: copy .env.example to .env, add a throwaway key with no funds, run bun install in vigil-risk-monitor, then run:

`cre workflow simulate vigil-risk-monitor --target staging-settings --non-interactive --trigger-index 0`

## Legal and regulatory value

- **Audit trail:** on-chain entries, including skipped actions, give a reviewer a record that is hard to alter afterwards.
- **Human-readable rules:** the posture comes from written thresholds, not an opaque model, so a compliance reviewer can read them.
- **Separation of authority:** the monitor can recommend but cannot trade.
- **Fail-safe behaviour:** missing market data produces CAUTION, and no value is substituted.

Open questions: who is responsible for an autonomous agent's decisions, whether its output could count as investment advice, and how much evidentiary weight on-chain records carry. No lawyer has reviewed this.

## Disclosures

- The workflow is simulated, not deployed to the CRE network, so there is no workflow ID.
- It reads the chain but does not write to it. The posture is not yet consumed automatically by the agent.
- Testnet only. No real funds. Vigil's earlier trades used mock tokens on a mock DEX.
- Some older frontend pages show simulated demo data and are labelled so.

## Provenance

Originally built for the Mantle Turing Test Hackathon. New for this hackathon: the CRE workflow and this submission. The practice-trading research pipeline was added for the RYO-CHAN hackathon.

## Tech stack

Chainlink CRE (TypeScript SDK), Mantle Sepolia, Solidity, TypeScript, CoinGecko, Alternative.me.

## Links

- Repo: https://github.com/SamuelDharshi/Vigil/tree/ryo-chan-hackathon
- VIGILLedger: 0x3c4ce5558121607aea621Efa29ab428E98DD527B
- VIGILVault: 0x4F1d65dAd79bF887776808B7c833a75dc198ADa6

## Team

To be completed by the team.
