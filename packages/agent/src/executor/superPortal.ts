import { ethers } from "ethers";
import { agentWallet, SUPER_PORTAL_ADDRESS, MNT_TOKEN_ADDRESS } from "../config";

/**
 * VIGIL Executor — Mantle Super Portal Cross-Chain Bridge
 * Routes $MNT from Mantle L2 → Solana for Byreal CLMM positions.
 *
 * The Super Portal launched January 27, 2026, built with Bybit and Byreal.
 * VIGIL uses this when Byreal MNT-USDC CLMM APR > mETH staking APR + 0.8%.
 *
 * Requires SUPER_PORTAL_ADDRESS in .env — no mock fallback.
 *
 * Docs: https://portal.mantle.xyz
 */

const SUPER_PORTAL_ABI = [
  `function bridge(
    address token,
    uint256 amount,
    uint32 destinationChainId,
    bytes32 recipient,
    uint256 deadline
  ) external payable returns (bytes32 transferId)`,
  "function getTransferStatus(bytes32 transferId) external view returns (uint8 status)",
];

const ERC20_ABI = [
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function allowance(address owner, address spender) external view returns (uint256)",
];

// Solana chain selector as used by Super Portal
// Verify at: https://docs.mantle.xyz/super-portal/chain-ids
const SOLANA_CHAIN_ID = 1399811149;
const MIN_BRIDGE_AMOUNT_MNT = 10;
const BRIDGE_DEADLINE_SECONDS = 1800;

export type BridgeStatus = "PENDING" | "COMPLETED" | "FAILED" | "UNKNOWN";

const STATUS_MAP: Record<number, BridgeStatus> = {
  0: "PENDING",
  1: "COMPLETED",
  2: "FAILED",
};

/**
 * Bridge MNT from Mantle → Solana via the Super Portal.
 * Throws if SUPER_PORTAL_ADDRESS is not configured.
 * Returns the live transferId from the on-chain event.
 */
export async function bridgeToSolana(
  amountMNT: number,
  solanaAgentWallet: string
): Promise<string> {
  if (!SUPER_PORTAL_ADDRESS) {
    throw new Error("[SuperPortal] SUPER_PORTAL_ADDRESS is not set in .env — cannot bridge");
  }

  if (amountMNT < MIN_BRIDGE_AMOUNT_MNT) {
    throw new Error(`[SuperPortal] Amount ${amountMNT} MNT is below the ${MIN_BRIDGE_AMOUNT_MNT} MNT minimum`);
  }

  const amountWei = ethers.parseEther(amountMNT.toString());
  console.log(`[SuperPortal] Bridging ${amountMNT} MNT → Solana wallet: ${solanaAgentWallet}`);

  // Step 1: Approve Super Portal to spend MNT
  const mntContract = new ethers.Contract(MNT_TOKEN_ADDRESS, ERC20_ABI, agentWallet);
  const currentAllowance: bigint = await mntContract.allowance(agentWallet.address, SUPER_PORTAL_ADDRESS);

  if (currentAllowance < amountWei) {
    console.log("[SuperPortal] Approving MNT spend...");
    const approveTx = await mntContract.approve(SUPER_PORTAL_ADDRESS, amountWei, { gasLimit: 80_000 });
    await approveTx.wait();
    console.log("[SuperPortal] Approval confirmed");
  }

  // Step 2: Convert Solana base58 address to bytes32
  // Uses proper bs58 decode padded to 32 bytes
  const recipientBytes32 = solanaAddressToBytes32(solanaAgentWallet);

  // Step 3: Execute bridge
  const deadline = Math.floor(Date.now() / 1000) + BRIDGE_DEADLINE_SECONDS;
  const superPortal = new ethers.Contract(SUPER_PORTAL_ADDRESS, SUPER_PORTAL_ABI, agentWallet);

  const tx = await superPortal.bridge(
    MNT_TOKEN_ADDRESS,
    amountWei,
    SOLANA_CHAIN_ID,
    recipientBytes32,
    deadline,
    { gasLimit: 300_000 }
  );

  console.log(`[SuperPortal] Bridge TX submitted: ${tx.hash} — waiting for confirmation...`);
  const receipt = await tx.wait();

  if (!receipt || receipt.status === 0) {
    throw new Error(`[SuperPortal] Bridge transaction reverted — check: https://sepolia.mantlescan.xyz/tx/${tx.hash}`);
  }

  // Extract transferId from the BridgeInitiated event
  // Topic[0] = event sig, topic[1] = transferId
  const bridgeLog = receipt.logs.find((log: any) =>
    log.topics[0] === ethers.id("BridgeInitiated(bytes32,address,uint256,uint32,bytes32)")
  );

  const transferId = bridgeLog?.topics[1] || tx.hash;

  console.log(`[SuperPortal] ✅ Bridge live! TX: ${tx.hash}`);
  console.log(`[SuperPortal] Transfer ID: ${transferId}`);
  console.log(`[SuperPortal] Track at: https://sepolia.mantlescan.xyz/tx/${tx.hash}`);

  return transferId;
}

/**
 * Check live status of a bridge transfer from the Super Portal contract.
 */
export async function getBridgeStatus(transferId: string): Promise<BridgeStatus> {
  if (!SUPER_PORTAL_ADDRESS) {
    throw new Error("[SuperPortal] SUPER_PORTAL_ADDRESS is not set in .env");
  }

  const superPortal = new ethers.Contract(SUPER_PORTAL_ADDRESS, SUPER_PORTAL_ABI, agentWallet.provider);
  const statusCode: number = await superPortal.getTransferStatus(transferId);
  return STATUS_MAP[statusCode] || "UNKNOWN";
}

/**
 * Poll bridge status every 30 seconds until COMPLETED or FAILED.
 * Times out after 10 minutes and throws.
 */
export async function waitForBridgeCompletion(
  transferId: string,
  timeoutMs = 600_000
): Promise<boolean> {
  const start = Date.now();
  console.log(`[SuperPortal] Polling bridge completion for: ${transferId}`);

  while (Date.now() - start < timeoutMs) {
    const status = await getBridgeStatus(transferId);

    if (status === "COMPLETED") {
      console.log(`[SuperPortal] ✅ Bridge completed: ${transferId}`);
      return true;
    }

    if (status === "FAILED") {
      console.error(`[SuperPortal] ❌ Bridge failed on-chain: ${transferId}`);
      return false;
    }

    console.log(`[SuperPortal] Status: ${status} — polling again in 30s`);
    await new Promise(r => setTimeout(r, 30_000));
  }

  throw new Error(`[SuperPortal] Bridge timed out after ${timeoutMs / 1000}s for transferId: ${transferId}`);
}

/**
 * Decode a Solana base58 public key into a bytes32 hex string for Super Portal.
 * Uses a simplified decode — for production use bs58 package.
 */
function solanaAddressToBytes32(solanaAddress: string): string {
  // Base58 alphabet
  const ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
  let decoded = BigInt(0);

  for (const char of solanaAddress) {
    const idx = ALPHABET.indexOf(char);
    if (idx < 0) throw new Error(`[SuperPortal] Invalid base58 character in Solana address: '${char}'`);
    decoded = decoded * 58n + BigInt(idx);
  }

  // Convert to 32-byte hex
  const hex = decoded.toString(16).padStart(64, "0");
  return "0x" + hex.slice(-64); // take last 64 chars (32 bytes)
}
