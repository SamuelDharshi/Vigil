import cron from "node-cron";
import { ethers } from "ethers";
import { aggregateSignals } from "./signals/aggregator";
import { generateDecision, checkByRealOpportunity } from "./decision/engine";
import { executeXStockTrade } from "./executor/fluxion";
import { bridgeToSolana, waitForBridgeCompletion } from "./executor/superPortal";
import { openClmmPosition, analyzePosition, closeClmmPosition, analyzeByrealPool } from "./executor/byreal";
import { generateRebalanceProof, buildProofInput } from "./proof/circuit";

import { pinSignalBundle, pinProofMetadata, pinAgentCard } from "./identity/ipfs";
import {
  mintAgentIdentity,
  setAgentCard,
  getAgentId,
  saveAgentId,
  submitReputationFeedback,
  submitValidationProof,
  buildAgentCard,
} from "./identity/erc8004";
import {
  provider,
  agentWallet,
  CRON_SCHEDULE,
  VIGIL_VAULT_ADDRESS,
  ERC8004_REPUTATION_REGISTRY,
  ERC8004_VALIDATION_REGISTRY,
} from "./config";
import { Decision, SkipReason } from "./types";

/**
 * VIGIL Agent — 30-Minute Autonomous Decision Loop
 * ================================================
 * Every 30 minutes, ALL 9 steps run regardless of SKIP or EXECUTE:
 * 1. INGEST     — fetch signals from Pyth, Nansen, Elfa, Mantle RPC
 * 2. IPFS       — pin signal bundle immediately
 * 3. WEIGH      — run scoring model
 * 4. BYREAL     — check cross-chain CLMM opportunity in parallel
 * 5. EXECUTE    — Fluxion RFQ if confidence >= threshold, else SKIP
 * 6. ZK PROOF   — generate Groth16 proof of the signal state (always)
 * 7. IPFS PROOF — pin proof metadata (always)
 * 8. ERC-8004   — update reputation + submit ZK validation (always)
 * 9. VAULT LOG  — write to VIGILLedger on Mantle Sepolia (always)
 */

let activeClmmPositionId: string | null = null;
let cronTask: cron.ScheduledTask | null = null;

// ─────────────────────────────────────────────────────────────────────────────
// AGENT SPAWN
// ─────────────────────────────────────────────────────────────────────────────

export async function spawnAgent(): Promise<string | null> {
  console.log("\n╔═══════════════════════════════════════╗");
  console.log("║   VIGIL AGENT — SPAWNING              ║");
  console.log("╚═══════════════════════════════════════╝\n");

  // First: check if agent is already registered in VIGILVault (fastest)
  let agentId = await getAgentId();
  if (agentId) {
    console.log(`[Spawn] ✅ Agent already active. ID: ${agentId} (from VIGILVault)`);
    return agentId;
  }

  // Pin Agent Card to IPFS regardless of registry status
  const agentCard = buildAgentCard(agentWallet.address);
  console.log("[Spawn] Pinning Agent Card to IPFS...");
  const cid = await pinAgentCard(agentCard);
  console.log(`[Spawn] ✅ Agent Card pinned: ${cid}`);

  // Try to mint ERC-8004 identity — handle testnet registry not deployed
  try {
    console.log("[Spawn] Minting ERC-8004 identity...");
    agentId = await mintAgentIdentity(cid);
    console.log(`\n[Spawn] ✅ VIGIL Agent spawned!`);
    console.log(`[Spawn]   Agent ID:  ${agentId}`);
    console.log(`[Spawn]   Agent CID: ${cid}`);
    console.log(`[Spawn]   Wallet:    ${agentWallet.address}`);
    return agentId;
  } catch (err: any) {
    if (err.code === "INSUFFICIENT_FUNDS" || err.message?.includes("insufficient funds")) {
      console.warn("[Spawn] ⚠ Insufficient MNT — get from https://faucet.sepolia.mantle.xyz");
    } else if (err.code === "CALL_EXCEPTION" || err.message?.includes("reverted")) {
      // ERC-8004 registry not deployed on this testnet — use wallet-derived synthetic ID
      // Derive from wallet address: deterministic, unique, human-readable
      const syntheticId = BigInt(agentWallet.address).toString().slice(0, 8);
      console.warn(`[Spawn] ⚠ ERC-8004 registry not on Mantle Sepolia — synthetic ID: ${syntheticId}`);
      console.warn(`[Spawn]   Agent Card pinned: ${cid}`);
      console.warn(`[Spawn]   View: https://gateway.pinata.cloud/ipfs/${cid}`);
      saveAgentId(syntheticId, cid);  // ← persists to .agent-state.json
      agentId = syntheticId;
      return agentId;
    } else {
      console.warn(`[Spawn] ⚠ Spawn error (non-fatal): ${err.message}`);
    }
    console.warn("[Spawn] Decision loop will still run without ERC-8004 registry.\n");
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// CORE DECISION LOOP — Every step runs on EVERY cycle (SKIP or EXECUTE)
// ─────────────────────────────────────────────────────────────────────────────

export async function runDecisionCycle(): Promise<void> {
  const cycleStart = Date.now();
  console.log(`\n${"─".repeat(52)}`);
  console.log(`  VIGIL Decision Cycle — ${new Date().toISOString()}`);
  console.log(`${"─".repeat(52)}`);

  const agentId = await getAgentId();

  // ─── STEP 1: INGEST ───────────────────────────────────────────────────────
  let bundle;
  try {
    bundle = await aggregateSignals();
  } catch (err: any) {
    console.error(`[Cron] Signal aggregation crashed: ${err.message}`);
    return;
  }

  // ─── STEP 2: IPFS — Pin signal bundle (always, before decision) ──────────
  let bundleCid = "ipfs-unavailable";
  try {
    bundleCid = await pinSignalBundle(bundle.bundleId, bundle);
    console.log(`[Cron] ✅ Signal bundle pinned: ${bundleCid}`);
  } catch (err: any) {
    console.warn(`[Cron] IPFS pin failed (non-fatal): ${err.message}`);
  }

  // ─── STEP 3: WEIGH — Score assets, generate decision ─────────────────────
  const decisionOrSkip = generateDecision(bundle);
  const isSkip = "skipReason" in decisionOrSkip;

  // ─── STEP 4: BYREAL — Check cross-chain CLMM opportunity (parallel) ──────
  try {
    const byrealPool = await analyzeByrealPool("H1ByEjzUbD2xBoqhGnqFQr8WeumXBor6hTtB6f4NjjW");
    const byrealApr  = byrealPool?.apr || 0;
    const byRealOpportunity = await checkByRealOpportunity(bundle, byrealApr);

    if (activeClmmPositionId) {
      const position = await analyzePosition(activeClmmPositionId);
      if (position && !position.inRange) {
        console.log(`[Cron] CLMM out of range — closing ${activeClmmPositionId}`);
        await closeClmmPosition(activeClmmPositionId);
        activeClmmPositionId = null;
      } else if (position) {
        console.log(`[Cron] CLMM active: ${position.positionId} (${position.currentApr.toFixed(2)}% APR)`);
      }
    }

    if (byRealOpportunity && !activeClmmPositionId) {
      const solanaWallet = process.env.BYREAL_SOLANA_WALLET_ADDRESS || "";
      if (solanaWallet) {
        const bridgeAmountMNT = 1000;
        const transferId = await bridgeToSolana(bridgeAmountMNT, solanaWallet);
        if (transferId) {
          const completed = await waitForBridgeCompletion(transferId, 120_000);
          if (completed) {
            const positionId = await openClmmPosition(bridgeAmountMNT);
            if (positionId) {
              activeClmmPositionId = positionId;
              console.log(`[Cron] ✅ CLMM position opened: ${positionId}`);
            }
          }
        }
      }
    }
  } catch (err: any) {
    console.warn(`[Cron] Byreal check (non-fatal): ${err.message}`);
  }

  // ─── STEP 5: EXECUTE or record skip ──────────────────────────────────────
  let decision: Decision | null = null;
  let skipReason: SkipReason | null = null;
  let reasoning = "";
  let executionOk = false;

  if (isSkip) {
    const skip = decisionOrSkip as { action: "SKIP"; skipReason: SkipReason; reasoning: string };
    skipReason = skip.skipReason;
    reasoning  = skip.reasoning;
    console.log(`[Cron] SKIP — ${skipReason}: ${reasoning}`);
  } else {
    decision  = decisionOrSkip as Decision;
    reasoning = decision.reasoning;

    try {
      const executionResult = await executeXStockTrade(
        decision.fromToken,
        decision.toToken,
        BigInt(Math.round(decision.amount))
      );

      if (executionResult.success) {
        decision.txHash          = executionResult.txHash;
        decision.slippageBps     = executionResult.actualSlippageBps;
        decision.signalBundleCid = bundleCid;
        executionOk = true;
        console.log(`[Cron] ✅ EXECUTE: ${decision.fromAsset} → ${decision.toAsset} | TX: ${decision.txHash}`);
      } else {
        console.error(`[Cron] Execution failed: ${executionResult.error}`);
        skipReason = "EXECUTION_ERROR" as SkipReason;
        reasoning  = executionResult.error || "Execution failed";
        decision   = null;
      }
    } catch (err: any) {
      console.error(`[Cron] Execution threw: ${err.message}`);
      skipReason = "EXECUTION_ERROR" as SkipReason;
      reasoning  = err.message;
      decision   = null;
    }
  }

  // ─── STEP 6: ZK PROOF — Always generate (proves signal state) ───────────
  let proof;
  try {
    console.log("[Cron] Generating ZK proof...");
    const proofInput = buildProofInput(
      bundle.pyth.xstockPrices?.NVDAx || 0,
      bundle.pyth.usdyYield            || 0,
      bundle.pyth.mEthApr              || 0,
      {
        mETH:     bundle.mantle.currentAllocation.mETH  || 4000,
        USDY:     bundle.mantle.currentAllocation.USDY  || 4000,
        xStocks:  bundle.mantle.currentAllocation.NVDAx || 2000,
      },
      { mETH: 3800, USDY: 4200, xStocks: 2000 }
    );
    proof = await generateRebalanceProof(proofInput);
    if (decision) decision.zkProofHash = proof.proofHash;
    console.log(`[Cron] ✅ ZK proof: ${proof.proofHash}`);
  } catch (err: any) {
    console.warn(`[Cron] ZK proof (non-fatal): ${err.message}`);
  }

  // ─── STEP 7: IPFS — Pin proof metadata (always) ──────────────────────────
  let proofMetaCid = "";
  try {
    const proofMetadata = {
      cycleTimestamp: Date.now(),
      decision:       isSkip ? "SKIP" : "EXECUTE",
      skipReason:     skipReason || null,
      reasoning,
      txHash:         decision?.txHash          || null,
      confidence:     decision?.confidence      || 0,
      slippageBps:    decision?.slippageBps     || 0,
      bundleCid,
      zkProofHash:    proof?.proofHash          || null,
      assetScores:    decision?.assetScores     || {},
      signalSummary: {
        mEthApr:    bundle.pyth.mEthApr,
        usdyYield:  bundle.pyth.usdyYield,
        nvdaxPrice: bundle.pyth.xstockPrices?.NVDAx || 0,
        smartMoney: bundle.nansen.smartMoneyFlows.length,
        sentiment:  Object.values(bundle.elfa.sentimentDeltas).length,
      },
    };
    proofMetaCid = await pinProofMetadata(proofMetadata);
    console.log(`[Cron] ✅ Proof metadata pinned: ${proofMetaCid}`);
  } catch (err: any) {
    console.warn(`[Cron] Proof metadata pin (non-fatal): ${err.message}`);
  }

  // ─── STEP 8: ERC-8004 — Reputation + ZK validation (always) ─────────────
  if (agentId) {
    try {
      const reputationScore = executionOk
        ? 85 + ((decision?.confidence || 0) - 0.55) * 50
        : 70;
      await submitReputationFeedback(
        agentId,
        decision?.txHash || `skip-${Date.now()}`,
        reputationScore,
        proofMetaCid || bundleCid,
        ERC8004_REPUTATION_REGISTRY
      );
      console.log(`[Cron] ✅ Reputation updated: ${reputationScore.toFixed(1)}`);
    } catch (err: any) {
      console.warn(`[Cron] Reputation submit (non-fatal): ${err.message}`);
    }

    if (proof) {
      try {
        await submitValidationProof(agentId, proof, ERC8004_VALIDATION_REGISTRY);
        console.log(`[Cron] ✅ ZK validation submitted`);
      } catch (err: any) {
        console.warn(`[Cron] ZK validation (non-fatal): ${err.message}`);
      }
    }
  }

  // ─── STEP 9: VIGILVault — Log to chain (always) ──────────────────────────
  await logToVault(
    executionOk ? decision : null,
    skipReason,
    reasoning,
    bundle.bundleId,
    bundleCid
  );

  const elapsed = ((Date.now() - cycleStart) / 1000).toFixed(1);
  console.log(`\n${"─".repeat(52)}`);
  console.log(`  ✅ Cycle complete in ${elapsed}s`);
  console.log(`  Decision:    ${isSkip ? `SKIP (${skipReason})` : `EXECUTE ${decision?.fromAsset} → ${decision?.toAsset}`}`);
  console.log(`  Bundle CID:  ${bundleCid}`);
  if (proofMetaCid) console.log(`  Proof CID:   ${proofMetaCid}`);
  if (proof)        console.log(`  ZK Proof:    ${proof.proofHash}`);
  if (decision?.txHash) console.log(`  TX Hash:     ${decision.txHash}`);
  console.log(`${"─".repeat(52)}\n`);
}

// ─────────────────────────────────────────────────────────────────────────────
// VAULT LOGGING (always called, handles both SKIP and EXECUTE)
// ─────────────────────────────────────────────────────────────────────────────

async function logToVault(
  decision: Decision | null,
  skipReason: SkipReason | null,
  reasoning: string,
  bundleId: string,
  bundleCid: string
): Promise<void> {
  if (!VIGIL_VAULT_ADDRESS) {
    console.warn("[Cron] VIGIL_VAULT_ADDRESS not set — vault log skipped");
    return;
  }

  try {
    if (skipReason || !decision) {
      const vault = new ethers.Contract(
        VIGIL_VAULT_ADDRESS,
        ["function recordSkip(string calldata reason, uint256 confidence) external"],
        agentWallet
      );
      const nonce = await agentWallet.getNonce("pending");
      const tx = await vault.recordSkip(skipReason || "EXECUTION_ERROR", 0, { gasLimit: 80_000, nonce });
      console.log(`[Cron] ✅ Vault skip logged: ${tx.hash}`);
    } else {
      const vault = new ethers.Contract(
        VIGIL_VAULT_ADDRESS,
        ["function executeRebalance(address fromToken, address toToken, uint256 amount, uint256 slippageBps, bytes calldata executionData) external"],
        agentWallet
      );
      const execData = ethers.AbiCoder.defaultAbiCoder().encode(
        ["string", "string"],
        [decision.txHash || "0x", bundleCid]
      );
      const nonce = await agentWallet.getNonce("pending");
      const tx = await vault.executeRebalance(
        decision.fromToken,
        decision.toToken,
        BigInt(Math.round(decision.amount)),
        BigInt(decision.slippageBps || 0),
        execData,
        { gasLimit: 250_000, nonce }
      );
      console.log(`[Cron] ✅ Vault execute logged: ${tx.hash}`);
    }
  } catch (err: any) {
    console.error("[Cron] Vault log failed:", err.message);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN
// ─────────────────────────────────────────────────────────────────────────────

async function main() {
  await spawnAgent();
  await runDecisionCycle();

  console.log(`\n[Cron] Starting 30-minute decision loop (${CRON_SCHEDULE})`);
  cronTask = cron.schedule(CRON_SCHEDULE, async () => {
    await runDecisionCycle();
  });
  console.log("[Cron] ✅ VIGIL agent running. Press Ctrl+C to stop.\n");

  process.on("SIGINT", () => {
    console.log("\n[Cron] SIGINT — shutting down VIGIL agent");
    cronTask?.stop();
    process.exit(0);
  });
}

if (require.main === module) {
  main().catch(console.error);
}
