import { ethers } from "ethers";
import * as fs from "fs";
import * as path from "path";
import {
  provider,
  agentWallet,
  ERC8004_IDENTITY_REGISTRY,
  ERC8004_REPUTATION_ABI,
  ERC8004_VALIDATION_ABI,
  ERC8004_IDENTITY_ABI,
  VIGIL_VAULT_ADDRESS,
  VERIFIER_ADDRESS,
} from "../config";
import { AgentCard, SerializedProof } from "../types";

/**
 * VIGIL ERC-8004 Identity Module
 *
 * Three registries used:
 * 1. Identity Registry  — Mint agent NFT at spawn
 * 2. Reputation Registry — Submit performance feedback after every decision
 * 3. Validation Registry — Submit Groth16 ZK proof after every execution
 *
 * On Mantle Sepolia testnet, the CREATE2 ERC-8004 registries are not deployed.
 * VIGIL uses a synthetic agent ID (derived from wallet address) as fallback,
 * persisted to .agent-state.json so it survives restarts.
 */

// ─── Persistent Agent State ───────────────────────────────────────────────────
const STATE_FILE = path.join(__dirname, "../../.agent-state.json");

function loadState(): { agentId?: string; agentCid?: string } {
  try {
    if (fs.existsSync(STATE_FILE)) {
      return JSON.parse(fs.readFileSync(STATE_FILE, "utf-8"));
    }
  } catch { /* ignore */ }
  return {};
}

export function saveAgentId(id: string, cid?: string): void {
  try {
    const state = loadState();
    state.agentId = id;
    if (cid) state.agentCid = cid;
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
    console.log(`[ERC-8004] Agent state saved: ID=${id}`);
  } catch (e: any) {
    console.warn(`[ERC-8004] Could not save agent state: ${e.message}`);
  }
}

// ─── In-memory cache ──────────────────────────────────────────────────────────
let _cachedAgentId: string | null = null;

/**
 * Mint the agent's ERC-8004 identity NFT on the Identity Registry.
 * Called once at agent spawn.
 */
export async function mintAgentIdentity(agentCardCid: string): Promise<string> {
  if (!ERC8004_IDENTITY_REGISTRY) {
    throw new Error("ERC8004_IDENTITY_REGISTRY not configured in .env");
  }

  console.log("[ERC-8004] Minting agent identity...");
  console.log(`[ERC-8004] Registry: ${ERC8004_IDENTITY_REGISTRY}`);
  console.log(`[ERC-8004] Agent Card CID: ${agentCardCid}`);

  const identityRegistry = new ethers.Contract(
    ERC8004_IDENTITY_REGISTRY,
    ERC8004_IDENTITY_ABI,
    agentWallet
  );

  const tx = await identityRegistry.mintIdentity(agentCardCid, {
    gasLimit: 300_000,
  });

  console.log(`[ERC-8004] Identity mint TX submitted: ${tx.hash}`);
  const receipt = await tx.wait();

  if (!receipt) throw new Error("Identity mint transaction failed");

  const transferLog = receipt.logs[0];
  const agentId = transferLog.topics[3]
    ? BigInt(transferLog.topics[3]).toString()
    : receipt.logs[0].topics[1]
    ? BigInt(receipt.logs[0].topics[1]).toString()
    : "0";

  _cachedAgentId = agentId;
  saveAgentId(agentId, agentCardCid);

  console.log(`[ERC-8004] ✅ Agent identity minted! Token ID: ${agentId}`);
  console.log(`[ERC-8004] View on explorer: https://erc8004.quicknode.com`);

  return agentId;
}

/**
 * Register the agent card CID on-chain after minting.
 */
export async function setAgentCard(tokenId: string, cid: string): Promise<void> {
  if (!ERC8004_IDENTITY_REGISTRY) return;

  const identityRegistry = new ethers.Contract(
    ERC8004_IDENTITY_REGISTRY,
    ERC8004_IDENTITY_ABI,
    agentWallet
  );

  const tx = await identityRegistry.setAgentCard(tokenId, cid, { gasLimit: 200_000 });
  await tx.wait();
  console.log(`[ERC-8004] Agent card CID registered on-chain: ${cid}`);
}

/**
 * Submit performance feedback to the ERC-8004 Reputation Registry.
 */
export async function submitReputationFeedback(
  agentId: string,
  taskId: string,
  score: number,
  metadataCid: string,
  reputationRegistryAddress: string
): Promise<void> {
  if (!reputationRegistryAddress) {
    console.warn("[ERC-8004] Reputation registry not configured — skipping feedback");
    return;
  }

  try {
    const reputationRegistry = new ethers.Contract(
      reputationRegistryAddress,
      ERC8004_REPUTATION_ABI,
      agentWallet
    );

    const scaledScore = BigInt(Math.round(score * 10));
    const taskIdBytes = ethers.id(taskId).slice(0, 66);

    const tx = await reputationRegistry.submitFeedback(
      BigInt(agentId),
      taskIdBytes,
      scaledScore,
      1n,
      metadataCid,
      { gasLimit: 150_000 }
    );

    await tx.wait();
    console.log(`[ERC-8004] Reputation feedback submitted: score ${score}, task ${taskId}`);
  } catch (err) {
    console.error("[ERC-8004] Failed to submit reputation feedback:", err);
  }
}

/**
 * Submit a Groth16 ZK proof to the ERC-8004 Validation Registry.
 */
export async function submitValidationProof(
  agentId: string,
  proof: SerializedProof,
  validationRegistryAddress: string
): Promise<void> {
  if (!validationRegistryAddress) {
    console.warn("[ERC-8004] Validation registry not configured — skipping proof submission");
    return;
  }

  if (!VERIFIER_ADDRESS) {
    console.warn("[ERC-8004] VERIFIER_ADDRESS not configured — skipping proof submission");
    return;
  }

  try {
    const validationRegistry = new ethers.Contract(
      validationRegistryAddress,
      ERC8004_VALIDATION_ABI,
      agentWallet
    );

    const tx = await validationRegistry.submitValidation(
      BigInt(agentId),
      proof.proofBytes,
      VERIFIER_ADDRESS,
      { gasLimit: 400_000 }
    );

    await tx.wait();
    console.log(`[ERC-8004] ZK proof submitted to Validation Registry: ${proof.proofHash}`);
  } catch (err) {
    console.error("[ERC-8004] Failed to submit validation proof:", err);
  }
}

/**
 * Read the agent's current reputation score from the Reputation Registry.
 */
export async function getReputationScore(
  agentId: string,
  reputationRegistryAddress: string
): Promise<{ score: number; totalFeedback: number }> {
  if (!reputationRegistryAddress) return { score: 0, totalFeedback: 0 };

  try {
    const reputationRegistry = new ethers.Contract(
      reputationRegistryAddress,
      ERC8004_REPUTATION_ABI,
      provider
    );

    const [score, totalFeedback] = await reputationRegistry.getReputation(BigInt(agentId));
    return {
      score: Number(score) / 10,
      totalFeedback: Number(totalFeedback),
    };
  } catch {
    return { score: 0, totalFeedback: 0 };
  }
}

/**
 * Get or load the agent ID.
 *
 * Resolution order:
 * 1. In-memory cache (fastest)
 * 2. VIGILVault.erc8004AgentId() on-chain read
 * 3. Local .agent-state.json file (survives restarts, stores synthetic ID)
 *
 * The synthetic ID is generated by spawnAgent() when the ERC-8004 registry
 * isn't deployed on the current testnet.
 */
export async function getAgentId(): Promise<string | null> {
  // 1. Memory cache
  if (_cachedAgentId) return _cachedAgentId;

  // 2. On-chain from VIGILVault
  if (VIGIL_VAULT_ADDRESS) {
    try {
      const vault = new ethers.Contract(
        VIGIL_VAULT_ADDRESS,
        ["function erc8004AgentId() view returns (uint256)"],
        provider
      );
      const id = await vault.erc8004AgentId();
      if (id > 0n) {
        _cachedAgentId = id.toString();
        return _cachedAgentId;
      }
    } catch { /* not yet set */ }
  }

  // 3. Local state file (synthetic ID from testnet spawn)
  const state = loadState();
  if (state.agentId) {
    _cachedAgentId = state.agentId;
    return _cachedAgentId;
  }

  return null;
}

/**
 * Build the ERC-8004 compliant Agent Card JSON structure.
 */
export function buildAgentCard(agentWalletAddress: string): AgentCard {
  return {
    name: "VIGIL",
    description:
      "24/7 autonomous RWA portfolio agent on Mantle. Manages mETH, USDY, and xStocks positions using macro signals. Executes via Fluxion Atomic RFQ and Byreal CLMM. Every decision is ZK-verified on ERC-8004.",
    version: "1.0.0",
    capabilities: [
      {
        id: "rwa-rebalance",
        description: "Rebalance across mETH, USDY, and xStocks using Chainlink, Nansen, and Elfa AI signals",
      },
      {
        id: "clmm-manage",
        description: "Open, monitor, and close Byreal CLMM positions on Solana via Mantle Super Portal",
      },
      {
        id: "xstocks-execute",
        description: "Execute xStocks trades (TSLAx, NVDAx, AAPLx) via Fluxion Atomic RFQ",
      },
      {
        id: "zk-prove",
        description: "Generate Groth16 ZK proofs of rebalancing math and submit to ERC-8004 Validation Registry",
      },
    ],
    endpoints: [
      { protocol: "https", url: "https://vigil.app/api/agent" },
      { protocol: "mcp", url: "https://vigil.app/mcp" },
      { protocol: "ws", url: "wss://vigil.app/ws" },
    ],
    paymentAddress: agentWalletAddress,
    supportedProtocols: ["A2A", "MCP", "x402"],
    deployedAt: new Date().toISOString(),
  };
}
