import { ethers } from "ethers";
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
 * Handles agent identity minting, reputation scoring, and validation proof submission.
 *
 * Three registries used:
 * 1. Identity Registry  — Mint agent NFT at spawn; register agent card CID on IPFS
 * 2. Reputation Registry — Submit performance feedback after every executed decision
 * 3. Validation Registry — Submit Groth16 ZK proof after every rebalancing execution
 *
 * Contract addresses from: https://github.com/sudeepb02/awesome-erc8004
 * ERC-8004 spec: https://eips.ethereum.org/EIPS/eip-8004
 */

// ─── Cached agent ID ─────────────────────────────────────────────────────────
let _cachedAgentId: string | null = null;

/**
 * Mint the agent's ERC-8004 identity NFT on the testnet Identity Registry.
 * Called once at agent spawn. Returns the token ID.
 *
 * @param agentCardCid The IPFS CID of the pinned Agent Card JSON
 * @returns The minted ERC-8004 token ID (as string)
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

  // The tokenId is in the first Transfer event log: topics[3]
  const transferLog = receipt.logs[0];
  const agentId = transferLog.topics[3]
    ? BigInt(transferLog.topics[3]).toString()
    : receipt.logs[0].topics[1]
    ? BigInt(receipt.logs[0].topics[1]).toString()
    : "0";

  _cachedAgentId = agentId;

  console.log(`[ERC-8004] ✅ Agent identity minted! Token ID: ${agentId}`);
  console.log(`[ERC-8004] View on explorer: https://erc8004.quicknode.com`);

  return agentId;
}

/**
 * Register the agent card CID on-chain after minting.
 * Links the IPFS metadata to the token ID.
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
 * Called after every executed decision (not skipped ones).
 *
 * @param agentId ERC-8004 token ID
 * @param taskId Unique task identifier (keccak256 of txHash)
 * @param score Performance score (-100 to 100, scaled by 10)
 * @param metadataCid IPFS CID of detailed performance metadata
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

    // ERC-8004 spec: score is int128 with 2 decimal places
    // score = 85.5 → BigInt(855), decimals = 1
    // We normalize score to [-100, 100] → int128 with 2 decimals
    const scaledScore = BigInt(Math.round(score * 10));
    const taskIdBytes = ethers.id(taskId).slice(0, 66); // bytes32

    const tx = await reputationRegistry.submitFeedback(
      BigInt(agentId),
      taskIdBytes,
      scaledScore,
      1n, // 1 decimal place
      metadataCid,
      { gasLimit: 150_000 }
    );

    await tx.wait();
    console.log(`[ERC-8004] Reputation feedback submitted: score ${score}, task ${taskId}`);
  } catch (err) {
    console.error("[ERC-8004] Failed to submit reputation feedback:", err);
    // Non-fatal: agent continues even if reputation submission fails
  }
}

/**
 * Submit a Groth16 ZK proof to the ERC-8004 Validation Registry.
 * This is the cryptographic proof that VIGIL's rebalancing math is correct.
 *
 * @param agentId ERC-8004 token ID
 * @param proof The serialized Groth16 proof
 * @param validationRegistryAddress The Validation Registry contract address
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
      { gasLimit: 400_000 } // ZK proof verification is expensive
    );

    await tx.wait();
    console.log(`[ERC-8004] ZK proof submitted to Validation Registry: ${proof.proofHash}`);
  } catch (err) {
    console.error("[ERC-8004] Failed to submit validation proof:", err);
    // Non-fatal
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
      score: Number(score) / 10, // reverse the 10x scaling
      totalFeedback: Number(totalFeedback),
    };
  } catch {
    return { score: 0, totalFeedback: 0 };
  }
}

/**
 * Get or load the cached agent ID.
 * Falls back to reading from VIGILVault if not cached.
 */
export async function getAgentId(): Promise<string | null> {
  if (_cachedAgentId) return _cachedAgentId;

  if (!VIGIL_VAULT_ADDRESS) return null;

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
  } catch {
    // Not yet set
  }

  return null;
}

/**
 * Build the ERC-8004 compliant Agent Card JSON structure.
 * This is pinned to IPFS and its CID registered on-chain.
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
