/**
 * verify-contracts.ts
 * Verifies VIGILVault and VIGILLedger on Mantle Sepolia (Mantlescan)
 * Run: npx hardhat run scripts/verify-contracts.ts --network mantleSepolia
 */
import { run } from "hardhat";
import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";

dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

const VAULT_ADDRESS  = "0x507610ca7d6FBFF8a8502D2D3bdd5Af8C02d220D";
const LEDGER_ADDRESS = "0x22cE36a8Cc9E94eBA75F7Be96007e6fF3856727e";

// These are the constructor args used when the contracts were deployed.
// Must exactly match the original deploy call.
const configPath = path.resolve(__dirname, "../../config/deployments.sepolia.json");
const config = JSON.parse(fs.readFileSync(configPath, "utf-8"));

const agentPrivateKeyMatch = fs
  .readFileSync(path.resolve(__dirname, "../../../.env"), "utf-8")
  .match(/AGENT_PRIVATE_KEY=(0x[a-fA-F0-9]{64})/);

if (!agentPrivateKeyMatch) throw new Error("AGENT_PRIVATE_KEY not found in .env");

import { ethers } from "hardhat";

async function main() {
  const agentWallet = new ethers.Wallet(agentPrivateKeyMatch![1]);
  const tokens = config.tokens;

  const methFeedAddress  = config.contracts.mETHFeed  || "";
  const usdyFeedAddress  = config.contracts.USDYFeed  || "";
  const nvdaxFeedAddress = config.contracts.NVDAXFeed || "";
  const aaplxFeedAddress = config.contracts.AAPLXFeed || "";
  const tslaxFeedAddress = config.contracts.TSLAXFeed || "";
  const mntFeedAddress   = config.contracts.MNTFeed   || "";

  console.log("═══════════════════════════════════════════════");
  console.log("  VIGIL Contract Verification on Mantle Sepolia");
  console.log("═══════════════════════════════════════════════");
  console.log(`  VIGILVault:  ${VAULT_ADDRESS}`);
  console.log(`  VIGILLedger: ${LEDGER_ADDRESS}`);
  console.log(`  Agent Wallet: ${agentWallet.address}`);
  console.log("═══════════════════════════════════════════════\n");

  // ─── Verify VIGILLedger ──────────────────────────────────────────────────
  console.log("📋 Verifying VIGILLedger...");
  try {
    await run("verify:verify", {
      address: LEDGER_ADDRESS,
      constructorArguments: [VAULT_ADDRESS],
      contract: "src/VIGILLedger.sol:VIGILLedger",
    });
    console.log("   ✅ VIGILLedger verified!\n");
  } catch (err: any) {
    if (err.message.includes("Already Verified")) {
      console.log("   ✓ VIGILLedger already verified\n");
    } else {
      console.error("   ❌ VIGILLedger verification failed:", err.message, "\n");
    }
  }

  // ─── Verify VIGILVault ───────────────────────────────────────────────────
  console.log("📋 Verifying VIGILVault...");
  try {
    await run("verify:verify", {
      address: VAULT_ADDRESS,
      constructorArguments: [
        agentWallet.address,
        tokens.MNT,
        [tokens.mETH, tokens.USDY, tokens.NVDAx, tokens.AAPLx, tokens.TSLAx, tokens.MNT],
        [
          methFeedAddress,
          usdyFeedAddress,
          nvdaxFeedAddress,
          aaplxFeedAddress,
          tslaxFeedAddress,
          mntFeedAddress,
        ],
      ],
      contract: "src/VIGILVault.sol:VIGILVault",
    });
    console.log("   ✅ VIGILVault verified!\n");
  } catch (err: any) {
    if (err.message.includes("Already Verified")) {
      console.log("   ✓ VIGILVault already verified\n");
    } else {
      console.error("   ❌ VIGILVault verification failed:", err.message, "\n");
    }
  }

  console.log("═══════════════════════════════════════════════");
  console.log("  Verification Complete");
  console.log("═══════════════════════════════════════════════");
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
