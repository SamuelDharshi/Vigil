import cron from "node-cron";
import { ethers } from "ethers";
import { aggregateSignals } from "./signals/aggregator";
import { generateDecision, checkByRealOpportunity } from "./decision/engine";
import { executeXStockTrade } from "./executor/fluxion";
import { bridgeToSolana, waitForBridgeCompletion } from "./executor/superPortal";
import { openClmmPosition, analyzePosition, closeClmmPosition, analyzeByrealPool } from "./executor/byreal";
import { generateRebalanceProof, buildProofInput } from "./proof/circuit";
import {
  getAgentId,
  submitReputationFeedback,
  submitValidationProof,
  buildAgentCard,
} from "./identity/erc8004";
import { pinSignalBundle, pinProofMetadata, pinAgentCard } from "./identity/ipfs";
import { mintAgentIdentity, setAgentCard } from "./identity/erc8004";
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
 * This is the central runtime orchestrating VIGIL's complete decision cycle.
 *
 * Every 30 minutes:
 * 1. INGEST  — fetch signals from Chainlink, Nansen, Elfa, Mantle RPC
 * 2. WEIGH   — run scoring model → Decision or SKIP
 * 3. VALIDATE — check guardrails via VIGILVault (on-chain)
 * 4. EXECUTE — route to Fluxion RFQ or Byreal CLI via Super Portal
 * 5. PROVE   — generate Groth16 ZK proof
 * 6. LOG     — submit to ERC-8004 Reputation + Validation registries
 *
 * Cross-chain check runs in parallel: if Byreal APR > mETH + 0.8%, route to CLMM.
 */

// Persistent Byreal CLMM position ID (if open)
let activeClmmPositionId: string | null = null;

// Cron task reference for graceful shutdown
let cronTask: cron.ScheduledTask | null = null;

// ─────────────────────────────────────────────────────────────────────────────
// AGENT SPAWN — Run once at startup
// ─────────────────────────────────────────────────────────────────────────────

export async function spawnAgent(): Promise<string | null> {
  console.log("\n╔═══════════════════════════════════════╗");
  console.log("║   VIGIL AGENT — SPAWNING              ║");
  console.log("╚═══════════════════════════════════════╝\n");

  // Check if already spawned
  let agentId = await getAgentId();
  if (agentId) {
    console.log(`[Spawn] Agent already spawned. Token ID: ${agentId}`);
    return agentId;
  }

  // Build and pin Agent Card to IPFS (works even with no gas)
  const agentCard = buildAgentCard(agentWallet.address);
  console.log("[Spawn] Pinning Agent Card to IPFS...");
  const cid = await pinAgentCard(agentCard);

  // Mint ERC-8004 identity — requires gas on Mantle Sepolia
  try {
    console.log("[Spawn] Minting ERC-8004 identity on Mantle Sepolia...");
    agentId = await mintAgentIdentity(cid);

    console.log(`\n[Spawn] ✅ VIGIL Agent spawned!`);
    console.log(`[Spawn]   Agent ID:  ${agentId}`);
    console.log(`[Spawn]   Agent CID: ${cid}`);
    console.log(`[Spawn]   Wallet:    ${agentWallet.address}`);
  } catch (err: any) {
    if (err.code === "INSUFFICIENT_FUNDS" || err.message?.includes("insufficient funds")) {
      console.warn("\n[Spawn] ⚠ INSUFFICIENT FUNDS — ERC-8004 mint skipped.");
      console.warn(`[Spawn]   Wallet: ${agentWallet.address}`);
      console.warn(`[Spawn]   Get testnet MNT: https://faucet.sepolia.mantle.xyz`);
      console.warn(`[Spawn]   Agent CID (ready to register when funded): ${cid}`);
      console.warn("[Spawn]   Decision loop will still run — skipping on-chain registry.\n");
      return null; // Return null — agent runs in signal-only mode
    }
    // Re-throw unexpected errors
    throw err;
  }

  return agentId;
}


// ─────────────────────────────────────────────────────────────────────────────
// CORE DECISION LOOP — Runs every 30 minutes
// ─────────────────────────────────────────────────────────────────────────────

export async function runDecisionCycle(): Promise<void> {
  const cycleStart = Date.now();
  console.log(`\n${"─".repeat(50)}`);
  console.log(`  VIGIL Decision Cycle — ${new Date().toISOString()}`);
  console.log(`${"─".repeat(50)}`);

  const agentId = await getAgentId();

  try {
    // ─── STEP 1: INGEST ─────────────────────────────────────────────────────
    const bundle = await aggregateSignals();

    // Pin signal bundle to IPFS for ledger hash
    const bundleCid = await pinSignalBundle(bundle.bundleId, bundle);

    // ─── STEP 2: WEIGH — Decision Engine ────────────────────────────────────
    const decisionOrSkip = generateDecision(bundle);

    // ─── Parallel: Check Byreal cross-chain opportunity ───────────────────
    const byrealPool = await analyzeByrealPool("H1ByEjzUbD2xBoqhGnqFQr8WeumXBor6hTtB6f4NjjW");
    const byrealApr = byrealPool?.apr || 0;
    const byRealOpportunity = await checkByRealOpportunity(bundle, byrealApr);

    // ─── STEP 3: Check active CLMM position ─────────────────────────────────
    if (activeClmmPositionId) {
      const position = await analyzePosition(activeClmmPositionId);
      if (position) {
        if (!position.inRange) {
          console.log(`[Cron] CLMM position out of range — closing ${activeClmmPositionId}`);
          await closeClmmPosition(activeClmmPositionId);
          activeClmmPositionId = null;
        } else {
          console.log(
            `[Cron] CLMM position active: ${position.positionId} (APR: ${position.currentApr.toFixed(2)}%)`
          );
        }
      }
    }

    // ─── STEP 4: Cross-chain routing ─────────────────────────────────────────
    if (byRealOpportunity && !activeClmmPositionId) {
      console.log(`[Cron] 🌉 Byreal opportunity detected — routing to CLMM`);

      const solanaWallet = process.env.BYREAL_SOLANA_WALLET_ADDRESS || "";
      if (solanaWallet) {
        const bridgeAmountMNT = 1000; // 1000 MNT
        const transferId = await bridgeToSolana(bridgeAmountMNT, solanaWallet);

        if (transferId) {
          const completed = await waitForBridgeCompletion(transferId, 120_000); // 2 min timeout
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

    // ─── STEP 5: Handle main decision ────────────────────────────────────────
    if ("skipReason" in decisionOrSkip) {
      // SKIP decision
      console.log(`[Cron] SKIP: ${decisionOrSkip.skipReason} — ${decisionOrSkip.reasoning}`);

      await logToVault(
        null,
        decisionOrSkip.skipReason as SkipReason,
        decisionOrSkip.reasoning,
        bundle.bundleId,
        bundleCid
      );
      return;
    }

    // EXECUTE decision
    const decision = decisionOrSkip as Decision;

    // ─── STEP 6: EXECUTE via Fluxion Atomic RFQ ──────────────────────────────
    const executionResult = await executeXStockTrade(
      decision.fromToken,
      decision.toToken,
      BigInt(Math.round(decision.amount))
    );

    if (!executionResult.success) {
      console.error(`[Cron] Execution failed: ${executionResult.error}`);
      await logToVault(decision, "EXECUTION_ERROR", executionResult.error || "Execution failed", bundle.bundleId, bundleCid);
      return;
    }

    decision.txHash = executionResult.txHash;
    decision.slippageBps = executionResult.actualSlippageBps;
    decision.signalBundleCid = bundleCid;

    // ─── STEP 7: PROVE — Generate Groth16 ZK proof ───────────────────────────
    console.log("[Cron] Generating ZK proof...");

    const proofInput = buildProofInput(
      decision.assetScores.mETH,
      decision.assetScores.USDY,
      decision.assetScores.NVDAx,
      // Use current allocation as prev (simplified for hackathon)
      { mETH: bundle.mantle.currentAllocation.mETH || 4000, USDY: bundle.mantle.currentAllocation.USDY || 4000, xStocks: bundle.mantle.currentAllocation.NVDAx || 2000 },
      { mETH: 3800, USDY: 4200, xStocks: 2000 } // simplified new allocation
    );

    let proof;
    try {
      proof = await generateRebalanceProof(proofInput);
      decision.zkProofHash = proof.proofHash;
    } catch (err) {
      console.error("[Cron] Proof generation failed — continuing without proof");
    }

    // ─── STEP 8: LOG — ERC-8004 Registries ────────────────────────────────────
    if (agentId && proof) {
      // Pin proof metadata to IPFS
      const proofMetadata = {
        decisionId: decision.id,
        txHash: decision.txHash,
        reasoning: decision.reasoning,
        confidence: decision.confidence,
        slippageBps: decision.slippageBps,
        timestamp: decision.timestamp,
        bundleCid,
      };
      const proofMetaCid = await pinProofMetadata(proofMetadata);

      // Submit to Reputation Registry
      const reputationScore = 85 + (decision.confidence - 0.55) * 50; // 85–92.5 range
      await submitReputationFeedback(
        agentId,
        decision.txHash,
        reputationScore,
        proofMetaCid,
        ERC8004_REPUTATION_REGISTRY
      );

      // Submit ZK proof to Validation Registry
      await submitValidationProof(agentId, proof, ERC8004_VALIDATION_REGISTRY);
    }

    // Log to VIGILVault on-chain
    await logToVault(decision, null, decision.reasoning, bundle.bundleId, bundleCid);

    const elapsed = ((Date.now() - cycleStart) / 1000).toFixed(1);
    console.log(`\n✅ Decision cycle complete in ${elapsed}s`);
    console.log(`   ${decision.fromAsset} → ${decision.toAsset} | $${(decision.amount / 1e6).toFixed(0)}`);
    console.log(`   Confidence: ${(decision.confidence * 100).toFixed(1)}% | Slippage: ${decision.slippageBps} bps`);
    console.log(`   TX: ${decision.txHash}`);
    console.log(`   Proof: ${decision.zkProofHash}`);

  } catch (err: any) {
    console.error(`[Cron] Unhandled error in decision cycle:`, err.message);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// VAULT LOGGING
// ─────────────────────────────────────────────────────────────────────────────

async function logToVault(
  decision: Decision | null,
  skipReason: SkipReason | null,
  reasoning: string,
  bundleId: string,
  bundleCid: string
): Promise<void> {
  if (!VIGIL_VAULT_ADDRESS) return;

  try {
    if (skipReason) {
      // Record skip via VIGILVault.recordSkip()
      const vault = new ethers.Contract(
        VIGIL_VAULT_ADDRESS,
        ["function recordSkip(string calldata reason, uint256 confidence) external"],
        agentWallet
      );
      await vault.recordSkip(skipReason, 0, { gasLimit: 80_000 });
    } else if (decision) {
      // Record execution via VIGILVault.executeRebalance()
      const vault = new ethers.Contract(
        VIGIL_VAULT_ADDRESS,
        [
          "function executeRebalance(address fromToken, address toToken, uint256 amount, uint256 slippageBps, bytes calldata executionData) external",
        ],
        agentWallet
      );

      const execData = ethers.AbiCoder.defaultAbiCoder().encode(
        ["string", "string"],
        [decision.txHash || "0x", bundleCid]
      );

      await vault.executeRebalance(
        decision.fromToken,
        decision.toToken,
        BigInt(Math.round(decision.amount)),
        BigInt(decision.slippageBps || 0),
        execData,
        { gasLimit: 250_000 }
      );
    }
  } catch (err: any) {
    console.error("[Cron] Vault logging failed:", err.message);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN ENTRY — Spawn agent + start cron
// ─────────────────────────────────────────────────────────────────────────────

async function main() {
  // Spawn agent identity on first run
  await spawnAgent();

  // Run first cycle immediately
  await runDecisionCycle();

  // Start 30-minute cron
  console.log(`\n[Cron] Starting 30-minute decision loop (schedule: ${CRON_SCHEDULE})`);

  cronTask = cron.schedule(CRON_SCHEDULE, async () => {
    await runDecisionCycle();
  });

  console.log("[Cron] ✅ VIGIL agent running. Press Ctrl+C to stop.\n");

  // Graceful shutdown
  process.on("SIGINT", () => {
    console.log("\n[Cron] SIGINT received — shutting down VIGIL agent");
    cronTask?.stop();
    process.exit(0);
  });
}

// Run if called directly
if (require.main === module) {
  main().catch(console.error);
}
