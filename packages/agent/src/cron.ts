import cron from "node-cron";
import { ethers } from "ethers";
import * as http from "http";
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
let lastCycleTs = 0;
let cycleCount   = 0;
let lastStatus   = "starting";

// ─────────────────────────────────────────────────────────────────────────────
// HEALTH SERVER — keeps Render free tier alive + exposes /health /status
// ─────────────────────────────────────────────────────────────────────────────

function startHealthServer() {
  const PORT = parseInt(process.env.PORT || "10000", 10);

  const server = http.createServer((req, res) => {
    const url = req.url || "/";

    // Liveness / readiness check
    if (url === "/health" || url === "/") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({
        status: "ok",
        agent: "VIGIL",
        network: "mantle-sepolia",
        wallet: agentWallet.address,
        vault: VIGIL_VAULT_ADDRESS,
        cycles: cycleCount,
        lastCycle: lastCycleTs ? new Date(lastCycleTs).toISOString() : null,
        lastStatus,
        uptime: Math.floor(process.uptime()) + "s",
      }));
      return;
    }

    // Detailed status
    if (url === "/status") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ status: lastStatus, cycles: cycleCount, cronSchedule: CRON_SCHEDULE, lastCycle: lastCycleTs ? new Date(lastCycleTs).toISOString() : null }));
      return;
    }

    // Manual trigger (POST /trigger)
    if (url === "/trigger" && req.method === "POST") {
      runDecisionCycle().catch(console.error);
      res.writeHead(202, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ message: "Decision cycle triggered" }));
      return;
    }

    res.writeHead(404);
    res.end("Not found");
  });

  server.listen(PORT, () => {
    console.log(`[Health] ✅ VIGIL health server on port ${PORT}`);
    console.log(`[Health]    GET  /health  — liveness check`);
    console.log(`[Health]    GET  /status  — agent status`);
    console.log(`[Health]    POST /trigger — manual cycle`);
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// AGENT SPAWN
// ─────────────────────────────────────────────────────────────────────────────

export async function spawnAgent(): Promise<string | null> {
  console.log("\n╔═══════════════════════════════════════╗");
  console.log("║   VIGIL AGENT — SPAWNING              ║");
  console.log("╚═══════════════════════════════════════╝\n");

  let agentId = await getAgentId();
  if (agentId) {
    console.log(`[Spawn] ✅ Agent already active. ID: ${agentId}`);
    return agentId;
  }

  const agentCard = buildAgentCard(agentWallet.address);
  console.log("[Spawn] Pinning Agent Card to IPFS...");
  const cid = await pinAgentCard(agentCard);
  console.log(`[Spawn] ✅ Agent Card pinned: ${cid}`);

  try {
    console.log("[Spawn] Minting ERC-8004 identity...");
    agentId = await mintAgentIdentity(cid);
    console.log(`\n[Spawn] ✅ VIGIL Agent spawned! ID: ${agentId}`);
    return agentId;
  } catch (err: any) {
    if (err.code === "INSUFFICIENT_FUNDS" || err.message?.includes("insufficient funds")) {
      console.warn("[Spawn] ⚠ Insufficient MNT — get from https://faucet.sepolia.mantle.xyz");
    } else if (err.code === "CALL_EXCEPTION" || err.message?.includes("reverted")) {
      const syntheticId = BigInt(agentWallet.address).toString().slice(0, 8);
      console.warn(`[Spawn] ⚠ ERC-8004 registry not on Mantle Sepolia — synthetic ID: ${syntheticId}`);
      saveAgentId(syntheticId, cid);
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
  lastCycleTs = cycleStart;
  cycleCount++;
  lastStatus = "running";

  console.log(`\n${"─".repeat(52)}`);
  console.log(`  VIGIL Decision Cycle — ${new Date().toISOString()}`);
  console.log(`${"─".repeat(52)}`);

  const agentId = await getAgentId();

  // STEP 1: INGEST
  let bundle;
  try {
    bundle = await aggregateSignals();
  } catch (err: any) {
    console.error(`[Cron] Signal aggregation crashed: ${err.message}`);
    lastStatus = "error";
    return;
  }

  // STEP 2: IPFS — pin signal bundle
  let bundleCid = "ipfs-unavailable";
  try {
    bundleCid = await pinSignalBundle(bundle.bundleId, bundle);
    console.log(`[Cron] ✅ Signal bundle pinned: ${bundleCid}`);
  } catch (err: any) {
    console.warn(`[Cron] IPFS pin failed (non-fatal): ${err.message}`);
  }

  // STEP 3: WEIGH
  const decisionOrSkip = generateDecision(bundle);
  const isSkip = "skipReason" in decisionOrSkip;

  // STEP 4: BYREAL
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

  // STEP 5: EXECUTE or SKIP
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

  // STEP 6: ZK PROOF
  let proof;
  try {
    console.log("[Cron] Generating ZK proof...");
    const proofInput = buildProofInput(
      bundle.pyth.xstockPrices?.NVDAx || 0,
      bundle.pyth.usdyYield            || 0,
      bundle.pyth.mEthApr              || 0,
      { mETH: bundle.mantle.currentAllocation.mETH || 4000, USDY: bundle.mantle.currentAllocation.USDY || 4000, xStocks: bundle.mantle.currentAllocation.NVDAx || 2000 },
      { mETH: 3800, USDY: 4200, xStocks: 2000 }
    );
    proof = await generateRebalanceProof(proofInput);
    if (decision) decision.zkProofHash = proof.proofHash;
    console.log(`[Cron] ✅ ZK proof: ${proof.proofHash}`);
  } catch (err: any) {
    console.warn(`[Cron] ZK proof (non-fatal): ${err.message}`);
  }

  // STEP 7: IPFS — pin proof metadata
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

  // STEP 8: ERC-8004
  if (agentId) {
    try {
      const reputationScore = executionOk ? 85 + ((decision?.confidence || 0) - 0.55) * 50 : 70;
      await submitReputationFeedback(agentId, decision?.txHash || `skip-${Date.now()}`, reputationScore, proofMetaCid || bundleCid, ERC8004_REPUTATION_REGISTRY);
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

  // STEP 9: VIGILVault log
  await logToVault(
    executionOk ? decision : null,
    skipReason,
    reasoning,
    bundle.bundleId,
    bundleCid,
    proof?.proofHash,
    decision?.confidence || 0
  );

  const elapsed = ((Date.now() - cycleStart) / 1000).toFixed(1);
  lastStatus = isSkip ? `skip:${skipReason}` : `executed:${decision?.fromAsset}→${decision?.toAsset}`;

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
// VAULT LOGGING
// ─────────────────────────────────────────────────────────────────────────────

async function logToVault(
  decision: Decision | null,
  skipReason: SkipReason | null,
  reasoning: string,
  bundleId: string,
  bundleCid: string,
  zkProofHash?: string,
  confidence = 0
): Promise<void> {
  if (!VIGIL_VAULT_ADDRESS) {
    console.warn("[Cron] VIGIL_VAULT_ADDRESS not set — vault log skipped");
    return;
  }

  // Convert IPFS CID to bytes32 — take keccak256 of the UTF-8 string
  const signalBundleHash = bundleCid && bundleCid !== "ipfs-unavailable"
    ? ethers.keccak256(ethers.toUtf8Bytes(bundleCid))
    : ethers.ZeroHash;

  // Convert proof hash string to bytes32 (already a 0x hex string from keccak256)
  const proofHashBytes32: string =
    zkProofHash && zkProofHash.startsWith("0x") && zkProofHash.length === 66
      ? zkProofHash
      : ethers.ZeroHash;

  // Scale confidence to uint256 (multiply by 10000: 0.79 → 7900)
  const confidenceScaled = BigInt(Math.round(confidence * 10_000));

  try {
    if (skipReason || !decision) {
      const vault = new ethers.Contract(
        VIGIL_VAULT_ADDRESS,
        [
          "function recordSkip(string calldata reason, uint256 confidence, bytes32 zkProofHash, bytes32 signalBundleHash, string calldata reasoning) external",
        ],
        agentWallet
      );
      const nonce = await agentWallet.getNonce("pending");
      const tx = await vault.recordSkip(
        skipReason || "EXECUTION_ERROR",
        confidenceScaled,
        proofHashBytes32,
        signalBundleHash,
        reasoning || "",
        { gasLimit: 300_000, nonce }
      );
      console.log(`[Cron] ✅ Vault skip logged: ${tx.hash}`);
      console.log(`[Cron]    zkProofHash: ${proofHashBytes32}`);
      console.log(`[Cron]    signalBundleHash: ${signalBundleHash}`);
    } else {
      const vault = new ethers.Contract(
        VIGIL_VAULT_ADDRESS,
        [
          "function executeRebalance(address fromToken, address toToken, uint256 amount, uint256 slippageBps, bytes32 zkProofHash, bytes32 signalBundleHash, uint256 confidence, string calldata reasoning, bytes calldata executionData) external",
        ],
        agentWallet
      );
      // For generic trades, encode tx hash + bundleCid as execution proof data
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
        proofHashBytes32,
        signalBundleHash,
        confidenceScaled,
        reasoning || "",
        execData,
        { gasLimit: 400_000, nonce }
      );
      console.log(`[Cron] ✅ Vault execute logged: ${tx.hash}`);
      console.log(`[Cron]    zkProofHash: ${proofHashBytes32}`);
      console.log(`[Cron]    signalBundleHash: ${signalBundleHash}`);
    }
  } catch (err: any) {
    console.error("[Cron] Vault log failed:", err.message);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN
// ─────────────────────────────────────────────────────────────────────────────

async function verifyIndexerHealth(retries = 3, delayMs = 3000): Promise<void> {
  const axios = (await import("axios")).default;
  const indexerPort = process.env.WS_PORT || "8080";
  const indexerHealthUrl = `http://localhost:${indexerPort}/health`;
  console.log(`[Cron] Verifying indexer health at ${indexerHealthUrl}...`);

  for (let i = 1; i <= retries; i++) {
    try {
      const response = await axios.get(indexerHealthUrl, { timeout: 4000 });
      if (response.status === 200 && response.data?.status === "OK") {
        console.log(`[Cron] ✅ Indexer health check passed (Attempt ${i}/${retries})`);
        return;
      }
      console.warn(`[Cron] ⚠ Indexer health check returned status: ${response.status} / ${response.data?.status} (Attempt ${i}/${retries})`);
    } catch (err: any) {
      console.warn(`[Cron] ⚠ Indexer health check failed: ${err.message} (Attempt ${i}/${retries})`);
    }
    if (i < retries) {
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }

  console.warn(`[Cron] ⚠ Indexer health verification failed after ${retries} attempts. Continuing, but indexer updates might not broadcast!`);
}

async function main() {
  const args = process.argv.slice(2);
  const runOnce = args.includes("--once");

  if (!runOnce) {
    // Start health server FIRST — Render needs to see the port immediately
    startHealthServer();
    // Verify indexer health on startup
    await verifyIndexerHealth();
  }

  await spawnAgent();
  await runDecisionCycle();

  if (runOnce) {
    console.log("[Cron] ✅ Single decision cycle run completed. Exiting.");
    process.exit(0);
  }

  console.log(`\n[Cron] Starting 30-minute decision loop (${CRON_SCHEDULE})`);
  cronTask = cron.schedule(CRON_SCHEDULE, async () => {
    await runDecisionCycle();
  });
  console.log("[Cron] ✅ VIGIL agent running.\n");

  process.on("SIGINT", () => {
    console.log("\n[Cron] SIGINT — shutting down VIGIL agent");
    cronTask?.stop();
    process.exit(0);
  });
}

if (require.main === module) {
  main().catch(console.error);
}
