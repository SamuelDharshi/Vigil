import { ethers } from "ethers";
import { NextResponse } from "next/server";

/**
 * GET /api/agent
 * Returns live agent stats by reading directly from:
 * - VIGILVault.sol on Mantle Sepolia (via public RPC)
 * - VIGILLedger.sol total entries
 * - ERC-8004 Reputation Registry
 */

import deployments from "../../../../../config/deployments.sepolia.json";

const MANTLE_RPC   = deployments.rpc;
const VAULT_ADDR   = deployments.contracts.VIGILVault;
const LEDGER_ADDR  = deployments.contracts.VIGILLedger;
const REP_REGISTRY = deployments.erc8004.ReputationRegistry;

const VAULT_ABI = [
  "function totalDecisions() view returns (uint256)",
  "function totalSkipped() view returns (uint256)",
  "function gasReservoir() view returns (uint256)",
  "function epochAllocationUsed() view returns (uint256)",
  "function epochAllocationRemaining() view returns (uint256)",
  "function erc8004AgentId() view returns (uint256)",
];

const LEDGER_ABI = [
  "function totalEntries() view returns (uint256)",
];

const REPUTATION_ABI = [
  "function getReputation(uint256 agentId) view returns (int128 score, uint256 totalFeedback)",
];

export async function GET() {
  if (!VAULT_ADDR) {
    return NextResponse.json(
      { error: "VIGIL_VAULT_ADDRESS not configured — deploy contracts first" },
      { status: 503 }
    );
  }

  try {
    const provider = new ethers.JsonRpcProvider(MANTLE_RPC);
    const vault    = new ethers.Contract(VAULT_ADDR, VAULT_ABI, provider);
    const ledger   = LEDGER_ADDR ? new ethers.Contract(LEDGER_ADDR, LEDGER_ABI, provider) : null;

    const totalDecisions = await vault.totalDecisions();
    const totalSkipped   = await vault.totalSkipped();
    const gasReservoir   = await vault.gasReservoir();
    const agentId        = await vault.erc8004AgentId();
    const totalEntries   = ledger ? await ledger.totalEntries() : 0n;

    const totalExecuted = Number(totalDecisions) - Number(totalSkipped);

    // Fetch reputation if registry is configured
    let reputationScore = 0;
    let totalFeedback = 0;
    if (REP_REGISTRY && agentId > 0n) {
      try {
        const repRegistry = new ethers.Contract(REP_REGISTRY, REPUTATION_ABI, provider);
        const [score, feedback] = await repRegistry.getReputation(agentId);
        reputationScore = Number(score) / 10; // reverse 10x scaling applied in erc8004.ts
        totalFeedback   = Number(feedback);
      } catch {
        // Reputation registry not yet populated — not an error
      }
    }

    return NextResponse.json({
      agent_id:           Number(agentId) || null,
      reputation_score:   reputationScore,
      total_decisions:    Number(totalDecisions),
      total_executed:     totalExecuted,
      total_skipped:      Number(totalSkipped),
      total_ledger_entries: Number(totalEntries),
      total_feedback:     totalFeedback,
      gas_reservoir_mnt:  Number(ethers.formatEther(gasReservoir)),
      vault_address:      VAULT_ADDR,
      ledger_address:     LEDGER_ADDR,
      network:            "Mantle Sepolia",
      rpc:                MANTLE_RPC,
      fetched_at:         Date.now(),
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: `Failed to read from Mantle Sepolia: ${err.message}` },
      { status: 500 }
    );
  }
}
