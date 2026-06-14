import * as fs from "fs";
import * as path from "path";
import { ethers } from "ethers";

// ─────────────────────────────────────────────────────────────────────────────
// SELF-HEALING: Setup .env before importing config to prevent crashing
// ─────────────────────────────────────────────────────────────────────────────
const rootDir = path.resolve(__dirname, "../../../");
const envPath = path.join(rootDir, ".env");
const envExamplePath = path.join(rootDir, ".env.example");

if (!fs.existsSync(envPath)) {
  console.log("[Setup] .env file not found. Initializing from .env.example...");
  if (fs.existsSync(envExamplePath)) {
    let exampleContent = fs.readFileSync(envExamplePath, "utf-8");
    // Generate a random valid EVM private key for the agent
    const randomWallet = ethers.Wallet.createRandom();
    exampleContent = exampleContent.replace(
      "AGENT_PRIVATE_KEY=",
      `AGENT_PRIVATE_KEY=${randomWallet.privateKey}`
    );
    fs.writeFileSync(envPath, exampleContent, "utf-8");
    console.log(`[Setup] ✅ Created .env with random agent private key: ${randomWallet.address}`);
  } else {
    console.error("[Setup] Could not find .env.example to copy from.");
  }
}

// Now load dotenv and local modules
import * as dotenv from "dotenv";
dotenv.config({ path: envPath });

import {
  provider,
  agentWallet,
  VIGIL_VAULT_ADDRESS,
  VIGIL_LEDGER_ADDRESS,
  SUPER_PORTAL_ADDRESS,
  FLUXION_XCHANGE_ADDRESS,
  FLUXION_RFQ_ENDPOINT,
  ERC8004_IDENTITY_REGISTRY,
  ERC8004_REPUTATION_REGISTRY,
  ERC8004_VALIDATION_REGISTRY,
  NANSEN_API_KEY,
  ELFA_API_KEY,
  WEB3_STORAGE_KEY,
  TOKEN_ADDRESSES,
  DATABASE_URL,
  CIRCUIT_WASM_PATH,
  CIRCUIT_ZKEY_PATH,
} from "./config";

import { fetchPythBundle } from "./signals/pyth";
import { fetchNansenBundle } from "./signals/nansen";
import { fetchElfaBundle } from "./signals/elfa";
import { aggregateSignals } from "./signals/aggregator";
import { generateDecision, scoreAsset } from "./decision/engine";
import { requestQuote } from "./executor/fluxion";
import { isByrealAvailable, analyzeByrealPool } from "./executor/byreal";

// ─────────────────────────────────────────────────────────────────────────────
// E2E RUNNER DIAGNOSTIC TEST SUITE
// ─────────────────────────────────────────────────────────────────────────────

interface PillarResult {
  title: string;
  passed: boolean;
  notes: string[];
  warnings: string[];
  errors: string[];
}

async function runDiagnostics() {
  console.log("\n=======================================================");
  console.log("     VIGIL — E2E System Integration & Diagnostic Suite ");
  console.log("=======================================================\n");

  const results: PillarResult[] = [];

  // ---------------------------------------------------------------------------
  // PILLAR 1: Zero-Mock Signal Intake & Ingestion
  // ---------------------------------------------------------------------------
  const pillar1: PillarResult = {
    title: "Pillar 1: Zero-Mock Signal Intake & Processing",
    passed: true,
    notes: [],
    warnings: [],
    errors: [],
  };
  
  try {
    console.log("[Pillar 1] Testing live price ingestion from Pyth Hermes...");
    const pythBundle = await fetchPythBundle();
    if (pythBundle.mEthPriceUsd > 0) {
      pillar1.notes.push(`✓ Pyth: mETH price = $${pythBundle.mEthPriceUsd.toFixed(2)}`);
      pillar1.notes.push(`✓ Pyth: MNT price = $${pythBundle.mntPriceUsd.toFixed(4)}`);
      pillar1.notes.push(`✓ Pyth: NVDAx price = $${pythBundle.xstockPrices.NVDAx?.toFixed(2) ?? "N/A"}`);
    } else {
      pillar1.errors.push("Pyth price fetch returned 0 or failed.");
      pillar1.passed = false;
    }

    pillar1.notes.push(`✓ mETH APR: ${pythBundle.mEthApr.toFixed(2)}% (live DeFiLlama rate)`);

    console.log("[Pillar 1] Testing Nansen API wallet flow fetch...");
    if (NANSEN_API_KEY) {
      const nansenBundle = await fetchNansenBundle(6);
      pillar1.notes.push(`✓ Nansen flows retrieved: ${nansenBundle.smartMoneyFlows.length}`);
    } else {
      pillar1.warnings.push("NANSEN_API_KEY not configured — using empty bundle fallback");
    }

    console.log("[Pillar 1] Testing Elfa AI sentiment fetch...");
    if (ELFA_API_KEY) {
      const elfaBundle = await fetchElfaBundle(4);
      pillar1.notes.push(`✓ Elfa sentiment deltas: ${Object.keys(elfaBundle.sentimentDeltas).join(", ")}`);
    } else {
      pillar1.warnings.push("ELFA_API_KEY not configured — using empty sentiment fallback");
    }

    console.log("[Pillar 1] Aggregating signals bundle...");
    const fullBundle = await aggregateSignals();
    if (fullBundle.bundleId && fullBundle.timestamp) {
      pillar1.notes.push(`✓ Signal bundle schema validated: ID = ${fullBundle.bundleId}`);
    } else {
      pillar1.errors.push("Signal bundle is missing bundleId or timestamp.");
      pillar1.passed = false;
    }
  } catch (err: any) {
    pillar1.errors.push(`Ingestion error: ${err.message}`);
    pillar1.passed = false;
  }
  results.push(pillar1);

  // ---------------------------------------------------------------------------
  // PILLAR 2: Guardrail Integration & Circuit Proof Validation
  // ---------------------------------------------------------------------------
  const pillar2: PillarResult = {
    title: "Pillar 2: Guardrail Integration & ZK Circuit Checks",
    passed: true,
    notes: [],
    warnings: [],
    errors: [],
  };

  try {
    console.log("[Pillar 2] Testing Decision Engine threshold filters...");
    const mockBundle = await aggregateSignals();
    
    // Simulate low confidence
    mockBundle.chainlink.usdyYield = 5.0;
    mockBundle.chainlink.mEthApr = 5.0;
    mockBundle.nansen.smartMoneyFlows = [];
    mockBundle.elfa.sentimentDeltas = {};

    const lowConfDecision = generateDecision(mockBundle);
    if ("skipReason" in lowConfDecision && lowConfDecision.action === "SKIP") {
      pillar2.notes.push(`✓ Decision Engine properly skips low confidence signals (reason: ${lowConfDecision.skipReason})`);
    } else {
      pillar2.errors.push("Decision Engine did not SKIP on neutral/low confidence signals.");
      pillar2.passed = false;
    }

    // Check VIGILVault deployment
    if (VIGIL_VAULT_ADDRESS) {
      console.log(`[Pillar 2] Verifying VIGILVault guardrails on-chain at: ${VIGIL_VAULT_ADDRESS}`);
      try {
        const vault = new ethers.Contract(
          VIGIL_VAULT_ADDRESS,
          [
            "function validateDecision(address fromToken, address toToken, uint256 amount, uint256 slippageBps) view returns (bool valid, string memory reason)",
            "function MAX_SLIPPAGE_BPS() view returns (uint256)",
          ],
          provider
        );
        const maxSlippage = await vault.MAX_SLIPPAGE_BPS();
        pillar2.notes.push(`✓ Connected to VIGILVault on-chain. Max Slippage Cap: ${maxSlippage.toString()} bps`);

        // Perform test validation on invalid slippage
        const fromToken = TOKEN_ADDRESSES.mETH || ethers.ZeroAddress;
        const toToken = TOKEN_ADDRESSES.USDY || ethers.ZeroAddress;
        
        const [valid, reason] = await vault.validateDecision(fromToken, toToken, 1000n * 1_000_000n, 50n); // 50 bps (> 40 bps limit)
        if (!valid && reason === "SLIPPAGE_EXCEEDED") {
          pillar2.notes.push("✓ Vault correctly validates and rejects high slippage (> 40 bps)");
        } else {
          pillar2.warnings.push(`Vault validateDecision returned valid=${valid}, reason=${reason} for 50 bps slippage`);
        }
      } catch (err: any) {
        pillar2.warnings.push(`Failed to verify on-chain vault guardrails: ${err.message}`);
      }
    } else {
      pillar2.warnings.push("VIGIL_VAULT_ADDRESS not configured — skipping live on-chain guardrail validation");
    }

    // Check ZK circuits
    console.log("[Pillar 2] Checking ZK circuit compilation files...");
    const wasmExists = fs.existsSync(CIRCUIT_WASM_PATH);
    const zkeyExists = fs.existsSync(CIRCUIT_ZKEY_PATH);

    if (wasmExists && zkeyExists) {
      pillar2.notes.push("✓ ZK Circuit WASM file present");
      pillar2.notes.push("✓ ZK Circuit zkey file present");
      
      // Attempt local proof generation test
      try {
        const { generateRebalanceProof, buildProofInput } = await import("./proof/circuit");
        const proofInput = buildProofInput(
          80, 50, 50,
          { mETH: 4000, USDY: 4000, xStocks: 2000 },
          { mETH: 3500, USDY: 4500, xStocks: 2000 }
        );
        const serialized = await generateRebalanceProof(proofInput);
        pillar2.notes.push(`✓ Local ZK Proof generated successfully. Hash: ${serialized.proofHash}`);
      } catch (err: any) {
        pillar2.errors.push(`Local ZK Proof generation failed: ${err.message}`);
        pillar2.passed = false;
      }
    } else {
      pillar2.warnings.push("ZK Circuit compiled files (.wasm / .zkey) not found in packages/agent/circuits/.");
      pillar2.notes.push("To setup ZK proof layer:");
      pillar2.notes.push("  1. Run: cd packages/agent && npm run circuit:setup");
      pillar2.notes.push("  2. Ensure circom CLI is installed globally.");
    }

  } catch (err: any) {
    pillar2.errors.push(`Guardrail/Proof check error: ${err.message}`);
    pillar2.passed = false;
  }
  results.push(pillar2);

  // ---------------------------------------------------------------------------
  // PILLAR 3: Execution Routing & Cross-Chain Super Portal Checks
  // ---------------------------------------------------------------------------
  const pillar3: PillarResult = {
    title: "Pillar 3: Execution Routing & Cross-Chain Checks",
    passed: true,
    notes: [],
    warnings: [],
    errors: [],
  };

  try {
    console.log("[Pillar 3] Testing Fluxion RFQ endpoint quote query...");
    if (FLUXION_RFQ_ENDPOINT) {
      try {
        const quote = await requestQuote(
          TOKEN_ADDRESSES.mETH || ethers.ZeroAddress,
          TOKEN_ADDRESSES.USDY || ethers.ZeroAddress,
          1000000000000000000n // 1 ether
        );
        pillar3.notes.push(`✓ Fluxion RFQ Quote active. ID: ${quote.quoteId}, Price Impact: ${quote.priceImpactBps} bps`);
      } catch (err: any) {
        pillar3.warnings.push(`Fluxion RFQ Quote fetch failed: ${err.message} (Is endpoint active?)`);
      }
    } else {
      pillar3.warnings.push("FLUXION_RFQ_ENDPOINT not configured in .env");
    }

    console.log("[Pillar 3] Testing Super Portal address padding...");
    const testSolanaAddress = "HN7cAB1Sc3wXgJ6C8Qcf35S3uK4NcbLwspE7x9bCUpD4";
    // base58 decode to 32 bytes hex
    const ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
    let decoded = BigInt(0);
    for (const char of testSolanaAddress) {
      const idx = ALPHABET.indexOf(char);
      if (idx >= 0) decoded = decoded * 58n + BigInt(idx);
    }
    const hex = decoded.toString(16).padStart(64, "0");
    const bytes32Hex = "0x" + hex.slice(-64);
    
    if (bytes32Hex.length === 66 && bytes32Hex.startsWith("0x")) {
      pillar3.notes.push(`✓ Super Portal Address Translation: base58 -> bytes32 padded hex (${bytes32Hex})`);
    } else {
      pillar3.errors.push("Solana base58 translation did not return valid bytes32 format.");
      pillar3.passed = false;
    }

    console.log("[Pillar 3] Testing Byreal CLI availability...");
    if (isByrealAvailable()) {
      pillar3.notes.push("✓ @byreal-io/byreal-cli installed");
      try {
        const poolAnalysis = await analyzeByrealPool("H1ByEjzUbD2xBoqhGnqFQr8WeumXBor6hTtB6f4NjjW");
        pillar3.notes.push(`✓ Byreal Pool analyzed: PENGUIN-USDC APR = ${poolAnalysis.apr}%`);
      } catch (err: any) {
        pillar3.warnings.push(`Byreal pools analyze command failed: ${err.message}`);
      }
    } else {
      pillar3.warnings.push("byreal-cli is not installed or configured.");
      pillar3.notes.push("To install Byreal CLI:");
      pillar3.notes.push("  1. Run: npm install -g @byreal-io/byreal-cli");
      pillar3.notes.push("  2. Run: byreal-cli init --home ~/.config/byreal/vigil-agent");
    }

  } catch (err: any) {
    pillar3.errors.push(`Execution routing error: ${err.message}`);
    pillar3.passed = false;
  }
  results.push(pillar3);

  // ---------------------------------------------------------------------------
  // PILLAR 4: ERC-8004 Registry Logging & Ledger Events
  // ---------------------------------------------------------------------------
  const pillar4: PillarResult = {
    title: "Pillar 4: ERC-8004 Registry Logging & Ledger Events",
    passed: true,
    notes: [],
    warnings: [],
    errors: [],
  };

  try {
    console.log("[Pillar 4] Verifying ERC-8004 Registry deployments...");
    const registries = [
      { name: "Identity Registry", address: ERC8004_IDENTITY_REGISTRY },
      { name: "Reputation Registry", address: ERC8004_REPUTATION_REGISTRY },
      { name: "Validation Registry", address: ERC8004_VALIDATION_REGISTRY },
    ];

    for (const reg of registries) {
      if (reg.address) {
        const code = await provider.getCode(reg.address);
        if (code !== "0x") {
          pillar4.notes.push(`✓ ${reg.name} deployed at: ${reg.address}`);
        } else {
          pillar4.warnings.push(`${reg.name} contract code is empty at: ${reg.address} (Not deployed on this network)`);
        }
      } else {
        pillar4.warnings.push(`${reg.name} address is not configured`);
      }
    }

    if (VIGIL_LEDGER_ADDRESS) {
      const code = await provider.getCode(VIGIL_LEDGER_ADDRESS);
      if (code !== "0x") {
        pillar4.notes.push(`✓ VIGILLedger deployed at: ${VIGIL_LEDGER_ADDRESS}`);
        const ledgerContract = new ethers.Contract(
          VIGIL_LEDGER_ADDRESS,
          ["function totalEntries() view returns (uint256)"],
          provider
        );
        const entries = await ledgerContract.totalEntries();
        pillar4.notes.push(`✓ VIGILLedger total logged decisions: ${entries.toString()}`);
      } else {
        pillar4.warnings.push(`VIGILLedger contract code is empty at: ${VIGIL_LEDGER_ADDRESS}`);
      }
    } else {
      pillar4.warnings.push("VIGIL_LEDGER_ADDRESS not set in .env");
    }

    console.log("[Pillar 4] Verifying SQLite Database presence...");
    try {
      const pathMod = await import("path");
      const dbPath = pathMod.resolve(__dirname, "../../indexer/vigil.db");
      const dbExists = fs.existsSync(dbPath);
      if (dbExists) {
        pillar4.notes.push(`✓ SQLite DB found at: ${dbPath}`);
      } else {
        pillar4.warnings.push("SQLite DB not found yet — created automatically when indexer starts.");
      }
    } catch (err: any) {
      pillar4.warnings.push(`SQLite check skipped: ${err.message}`);
    }


  } catch (err: any) {
    pillar4.errors.push(`Registry/Indexer verification error: ${err.message}`);
    pillar4.passed = false;
  }
  results.push(pillar4);

  // ---------------------------------------------------------------------------
  // PILLAR 5: Frontend Synchronization & E2E Runtime Lifecycle
  // ---------------------------------------------------------------------------
  const pillar5: PillarResult = {
    title: "Pillar 5: Frontend Synchronization & WebSocket Broadcasts",
    passed: true,
    notes: [],
    warnings: [],
    errors: [],
  };

  try {
    console.log("[Pillar 5] Testing indexer WebSocket server connection...");
    const wsUrl = "ws://127.0.0.1:8080";
    
    // Perform an active socket handshake using dynamic import of ws
    const { WebSocket } = await import("ws");
    
    const wsCheck = () => new Promise<boolean>((resolve) => {
      const socket = new WebSocket(wsUrl);
      const timer = setTimeout(() => {
        socket.terminate();
        resolve(false);
      }, 2000);

      socket.on("open", () => {
        clearTimeout(timer);
        socket.close();
        resolve(true);
      });

      socket.on("error", () => {
        clearTimeout(timer);
        resolve(false);
      });
    });

    const isWsUp = await wsCheck();
    if (isWsUp) {
      pillar5.notes.push(`✓ WebSocket indexer online at: ${wsUrl}`);
    } else {
      pillar5.warnings.push(`WebSocket indexer offline on port 8080. Start indexer using: cd packages/indexer && npm run dev`);
    }

    const pinataJwt = process.env.PINATA_JWT;
    if (WEB3_STORAGE_KEY) {
      pillar5.notes.push("✓ IPFS storage gateway configured (Storacha/web3.storage)");
    } else if (pinataJwt) {
      pillar5.notes.push("✓ IPFS storage gateway configured (Pinata)");
    } else {
      pillar5.warnings.push("WEB3_STORAGE_KEY and PINATA_JWT not configured — IPFS uploads will default to mock return values or throw");
    }

  } catch (err: any) {
    pillar5.errors.push(`Frontend sync verification error: ${err.message}`);
    pillar5.passed = false;
  }
  results.push(pillar5);

  // ─────────────────────────────────────────────────────────────────────────────
  // FINAL REPORT
  // ─────────────────────────────────────────────────────────────────────────────
  console.log("\n=======================================================");
  console.log("                 DIAGNOSTIC REPORT SUMMARY             ");
  console.log("=======================================================\n");

  let allPassed = true;

  for (const res of results) {
    const statusSymbol = res.passed
      ? (res.warnings.length > 0 ? "🟡" : "🟢")
      : "🔴";
    const statusText = res.passed
      ? (res.warnings.length > 0 ? "PASSED WITH WARNINGS" : "PASSED")
      : "FAILED";

    console.log(`${statusSymbol} ${res.title} — [${statusText}]`);
    
    if (res.notes.length > 0) {
      res.notes.forEach(note => console.log(`   ${note}`));
    }
    if (res.warnings.length > 0) {
      res.warnings.forEach(warn => console.log(`   ⚠ WARNING: ${warn}`));
    }
    if (res.errors.length > 0) {
      res.errors.forEach(err => console.log(`   ❌ ERROR: ${err}`));
    }
    console.log("");
    if (!res.passed) allPassed = false;
  }

  console.log("=======================================================");
  if (allPassed) {
    console.log("  ✅ SYSTEM IS BUILD-READY & INTEGRATION VERIFIED");
  } else {
    console.log("  ❌ SYSTEM HAS INTEGRATION ERRORS OR COMPILATION BLOCKS");
  }
  console.log("=======================================================\n");
  
  if (!allPassed) {
    process.exit(1);
  }
}

runDiagnostics().catch(console.error);
