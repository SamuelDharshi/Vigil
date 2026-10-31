# BLI Video Script (under 2 minutes)

**0:00 Problem.** "When an autonomous agent acts, who can check why? Vigil keeps a record of its decisions, including when it refused to act."

**0:20 Workflow.** Show cre/vigil-risk-monitor/main.ts. "On a schedule, Chainlink CRE reads Vigil's contracts on Mantle Sepolia, fetches live market data and decides a risk posture."

**0:50 Simulation.** From the cre folder, run this live:

`cre workflow simulate vigil-risk-monitor --target staging-settings --non-interactive --trigger-index 0`

Point at the chain counts, the market data and the posture.

**1:20 Proof.** Open the VIGILLedger address on sepolia.mantlescan.xyz and show its transactions.

**1:35 Legal value.** "The rules are readable, skipped actions are recorded, missing data means caution, and the monitor cannot trade."

**1:50 Close.** "This is a testnet prototype. Questions of liability and regulation remain open, and we list them in our submission."
