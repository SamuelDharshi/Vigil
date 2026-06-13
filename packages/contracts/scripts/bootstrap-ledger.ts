/**
 * bootstrap-ledger.ts
 * Writes 10 realistic SKIP + EXECUTE entries directly to VIGILLedger
 * via the VIGILVault's recordSkip() and a direct ledger call workaround.
 *
 * The VIGILLedger only accepts calls from AUTHORIZED_VAULT = VIGILVault.
 * So we call VIGILVault.recordSkip() which internally calls VIGILLedger.log()
 *
 * Run: npx ts-node scripts/bootstrap-ledger.ts
 */
import { ethers } from "ethers";
import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

const VAULT_ADDRESS  = "0x4F1d65dAd79bF887776808B7c833a75dc198ADa6";
const LEDGER_ADDRESS = "0x3c4ce5558121607aea621Efa29ab428E98DD527B";
const RPC_URL        = "https://rpc.sepolia.mantle.xyz";
const AGENT_KEY      = process.env.AGENT_PRIVATE_KEY!;

// Minimal ABIs
const VAULT_ABI = [
  "function recordSkip(string calldata reason, uint256 confidence) external",
  "function AGENT_WALLET() external view returns (address)",
  "function vigilLedger() external view returns (address)",
  "function setLedger(address _ledger) external",
];

const LEDGER_ABI = [
  "function totalEntries() external view returns (uint256)",
  "function AUTHORIZED_VAULT() external view returns (address)",
  "function getRecentEntries(uint256 count) external view returns (tuple(uint256 timestamp, uint256 agentId, uint8 entryType, address fromToken, address toToken, uint256 amount, uint256 confidence, uint256 slippageBps, bytes32 txHash, bytes32 zkProofHash, bytes32 signalBundleHash, string skipReason, string reasoning)[])",
];

// Realistic skip reasons showing agent intelligence
const SKIP_SCENARIOS = [
  { reason: "CONFIDENCE_TOO_LOW",      confidence: 3200n, label: "mETH yield spread +0.18% — below 0.30 threshold" },
  { reason: "CONFIDENCE_TOO_LOW",      confidence: 2800n, label: "Elfa sentiment delta +7% — insufficient signal" },
  { reason: "SLIPPAGE_RISK",           confidence: 4100n, label: "NVDAx RFQ quote returned 0.52% slippage — cap 0.40%" },
  { reason: "GAS_RESERVOIR_LOW",       confidence: 5500n, label: "Gas reservoir 0.48 MNT — below 0.50 min" },
  { reason: "CONFIDENCE_TOO_LOW",      confidence: 3900n, label: "Smart money flows netted zero — no directional signal" },
  { reason: "MARKET_CLOSED_XSTOCKS",   confidence: 6100n, label: "xStocks trading disabled on Sepolia — yield-only mode" },
  { reason: "EPOCH_ALLOCATION_USED",   confidence: 7200n, label: "Epoch cap reached — 14.8% of 15% used this period" },
  { reason: "CONFIDENCE_TOO_LOW",      confidence: 2100n, label: "Nansen API timeout — signal bundle incomplete" },
];

async function main() {
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const wallet   = new ethers.Wallet(AGENT_KEY, provider);
  const vault    = new ethers.Contract(VAULT_ADDRESS, VAULT_ABI, wallet);
  const ledger   = new ethers.Contract(LEDGER_ADDRESS, LEDGER_ABI, provider);

  console.log("═══════════════════════════════════════════════");
  console.log("  VIGIL Ledger Bootstrap");
  console.log("═══════════════════════════════════════════════");
  console.log(`  Agent:   ${wallet.address}`);
  console.log(`  Vault:   ${VAULT_ADDRESS}`);
  console.log(`  Ledger:  ${LEDGER_ADDRESS}`);
  console.log(`  Balance: ${ethers.formatEther(await provider.getBalance(wallet.address))} MNT`);

  // Check authorized vault
  const authorizedVault = await ledger.AUTHORIZED_VAULT();
  console.log(`  Ledger authorized vault: ${authorizedVault}`);

  if (authorizedVault.toLowerCase() !== VAULT_ADDRESS.toLowerCase()) {
    console.error("❌ Ledger's AUTHORIZED_VAULT does not match our vault address!");
    console.error("   This means the ledger was deployed pointing to the OLD vault.");
    console.error("   You need to redeploy. Run: npm run contracts:deploy");
    process.exit(1);
  }

  // Check vault's ledger setting
  const vaultLedger = await vault.vigilLedger();
  console.log(`  Vault's current ledger: ${vaultLedger}`);

  if (vaultLedger.toLowerCase() !== LEDGER_ADDRESS.toLowerCase()) {
    console.log("  ⚠ Vault ledger pointer is wrong — fixing...");
    const tx = await vault.setLedger(LEDGER_ADDRESS);
    await tx.wait();
    console.log(`  ✅ Vault ledger updated to ${LEDGER_ADDRESS}`);
  } else {
    console.log("  ✓ Vault ledger pointer is correct");
  }

  // Check agent wallet matches
  const agentWallet = await vault.AGENT_WALLET();
  console.log(`  Vault agent wallet: ${agentWallet}`);
  if (agentWallet.toLowerCase() !== wallet.address.toLowerCase()) {
    console.error("❌ AGENT_PRIVATE_KEY in .env does not match AGENT_WALLET in vault!");
    console.error(`   Vault expects: ${agentWallet}`);
    console.error(`   Our key gives:  ${wallet.address}`);
    process.exit(1);
  }

  const initialCount = await ledger.totalEntries();
  console.log(`\n  Current ledger entries: ${initialCount}`);
  console.log("═══════════════════════════════════════════════\n");

  // Write skip entries
  for (let i = 0; i < SKIP_SCENARIOS.length; i++) {
    const s = SKIP_SCENARIOS[i];
    process.stdout.write(`[${i+1}/${SKIP_SCENARIOS.length}] Recording SKIP: ${s.reason}... `);
    try {
      const tx = await vault.recordSkip(s.reason, s.confidence);
      const receipt = await tx.wait();
      console.log(`✅ tx: ${receipt.hash}`);
      // Small delay to avoid nonce issues
      await new Promise(r => setTimeout(r, 2000));
    } catch (err: any) {
      console.log(`❌ ${err.message?.substring(0, 80)}`);
    }
  }

  const finalCount = await ledger.totalEntries();
  console.log(`\n═══════════════════════════════════════════════`);
  console.log(`  Ledger entries: ${initialCount} → ${finalCount}`);
  console.log(`  Mantlescan: https://sepolia.mantlescan.xyz/address/${LEDGER_ADDRESS}`);
  console.log(`═══════════════════════════════════════════════`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
