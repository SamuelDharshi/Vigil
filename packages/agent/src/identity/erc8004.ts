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
 * 1. Identity Registry  — Mint agent NFT at spawn via register(string)
 * 2. Reputation Registry — Submit performance feedback after every decision
 * 3. Validation Registry — Submit Groth16 ZK proof after every execution
 */

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
    const tempFile = STATE_FILE + ".tmp";
    fs.writeFileSync(tempFile, JSON.stringify(state, null, 2));
    fs.renameSync(tempFile, STATE_FILE);
    console.log(`[ERC-8004] Agent state saved atomically: ID=${id}`);
  } catch (e: any) {
    console.warn(`[ERC-8004] Could not save agent state: ${e.message}`);
  }
}

function updateAgentTokenIdInConfig(tokenId: string) {
  try {
    const configPath = path.resolve(__dirname, "../../../config/deployments.sepolia.json");
    if (fs.existsSync(configPath)) {
      const data = JSON.parse(fs.readFileSync(configPath, "utf-8"));
      data.agentTokenId = tokenId;
      fs.writeFileSync(configPath, JSON.stringify(data, null, 2));
      console.log(`[ERC-8004] deployments.sepolia.json updated with agentTokenId: ${tokenId}`);
    }
  } catch (e: any) {
    console.warn(`[ERC-8004] Could not update deployments.sepolia.json: ${e.message}`);
  }
}

let _cachedAgentId: string | null = null;

/**
 * Mint the agent's ERC-8004 identity NFT on the Identity Registry.
 * Called once at agent spawn.
 */
export async function mintAgentIdentity(agentCardCid: string): Promise<string> {
  if (!ERC8004_IDENTITY_REGISTRY) {
    throw new Error("ERC8004_IDENTITY_REGISTRY not configured");
  }

  console.log("[ERC-8004] Minting agent identity...");
  console.log(`[ERC-8004] Registry: ${ERC8004_IDENTITY_REGISTRY}`);
  console.log(`[ERC-8004] Agent Card CID: ${agentCardCid}`);

  const identityRegistry = new ethers.Contract(
    ERC8004_IDENTITY_REGISTRY,
    ERC8004_IDENTITY_ABI,
    agentWallet
  );

  try {
    const tx = await identityRegistry.register(agentCardCid, {
      gasLimit: 300_000,
    });

    console.log(`[ERC-8004] Identity register TX submitted: ${tx.hash}`);
    const receipt = await tx.wait();

    if (!receipt) throw new Error("Identity register transaction failed");

    let agentId = "0";
    const transferTopic = ethers.id("Transfer(address,address,uint256)");
    for (const log of receipt.logs) {
      if (log.topics[0] === transferTopic && log.topics[3]) {
        agentId = BigInt(log.topics[3]).toString();
        break;
      }
    }

    if (agentId === "0") {
      const registeredTopic = ethers.id("Registered(uint256,string,address)");
      for (const log of receipt.logs) {
        if (log.topics[0] === registeredTopic && log.topics[1]) {
          agentId = BigInt(log.topics[1]).toString();
          break;
        }
      }
    }

    if (agentId === "0") {
      throw new Error("Failed to extract agent ID from transaction logs");
    }

    _cachedAgentId = agentId;
    updateAgentTokenIdInConfig(agentId);
    saveAgentId(agentId, agentCardCid);

    console.log(`[ERC-8004] ✅ Agent identity minted! Token ID: ${agentId}`);
    return agentId;
  } catch (err: any) {
    console.error(`[ERC-8004] Mint identity failed: ${err.message}`);
    throw new Error(`IdentityRegistryError: ${err.message}`);
  }
}

/**
 * Register the agent card CID on-chain after minting (standard metadata fallback).
 */
export async function setAgentCard(tokenId: string, cid: string): Promise<void> {
  // Metadata is set directly at registration in register()
  console.log(`[ERC-8004] Agent card CID already set at register: ${cid}`);
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
      { gasLimit: 300_000 }
    );

    await tx.wait();
    console.log(`[ERC-8004] Reputation feedback submitted: score ${score}, task ${taskId}`);
  } catch (err: any) {
    console.error("[ERC-8004] Failed to submit reputation feedback:", err.message);
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
  } catch (err: any) {
    console.error("[ERC-8004] Failed to submit validation proof:", err.message);
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
 */
export async function getAgentId(): Promise<string | null> {
  if (_cachedAgentId) return _cachedAgentId;

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

  try {
    const configPath = path.resolve(__dirname, "../../../config/deployments.sepolia.json");
    if (fs.existsSync(configPath)) {
      const data = JSON.parse(fs.readFileSync(configPath, "utf-8"));
      if (data.agentTokenId && data.agentTokenId !== "") {
        _cachedAgentId = data.agentTokenId.toString();
        return _cachedAgentId;
      }
    }
  } catch { /* ignore */ }

  return null;
}

/**
 * Build the ERC-8004 compliant Agent Card JSON structure.
 */
export function buildAgentCard(agentWalletAddress: string): AgentCard {
  // Use the real deployed URL — RENDER_EXTERNAL_URL is auto-injected by Render
  const baseUrl =
    process.env.RENDER_EXTERNAL_URL?.replace(/\/$/, "") ||
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
    "https://vigil-agent.onrender.com";

  return {
    name: "VIGIL",
    description:
      "24/7 autonomous RWA portfolio agent on Mantle. Manages mETH, USDY, and xStocks positions using macro signals. Executes via Fluxion Atomic RFQ and Byreal CLMM. Every decision is ZK-verified on ERC-8004.",
    version: "1.0.0",
    capabilities: [
      {
        id: "rwa-rebalance",
        description: "Rebalance across mETH, USDY, and xStocks using Pyth, Nansen, and Elfa AI signals",
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
      { protocol: "https", url: `${baseUrl}/api/agent` },
      { protocol: "mcp",   url: `${baseUrl}/mcp` },
      { protocol: "ws",    url: `${baseUrl.replace(/^https/, "wss")}/ws` },
    ],
    paymentAddress: agentWalletAddress,
    supportedProtocols: ["A2A", "MCP", "x402"],
    deployedAt: new Date().toISOString(),
  };
}

if (require.main === module) {
  const args = process.argv.slice(2);
  if (args.includes("--spawn")) {
    const { spawnAgent } = require("../cron");
    spawnAgent().then(() => {
      process.exit(0);
    }).catch((err: any) => {
      console.error("[ERC-8004] Spawn failed:", err);
      process.exit(1);
    });
  }
}
