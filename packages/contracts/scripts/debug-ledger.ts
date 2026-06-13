/**
 * check-vault-state.ts
 * Minimal check of what the deployed vault actually has
 */
import { ethers } from "ethers";
import * as dotenv from "dotenv";
import * as path from "path";
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

const VAULT_ADDRESS  = "0x507610ca7d6FBFF8a8502D2D3bdd5Af8C02d220D";
const LEDGER_ADDRESS = "0x22cE36a8Cc9E94eBA75F7Be96007e6fF3856727e";
const RPC_URL        = "https://rpc.sepolia.mantle.xyz";
const AGENT_KEY      = process.env.AGENT_PRIVATE_KEY!;

async function main() {
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const wallet   = new ethers.Wallet(AGENT_KEY, provider);

  // Minimal ABI - only stable getters
  const VAULT_MIN_ABI = [
    "function AGENT_WALLET() external view returns (address)",
    "function vigilLedger() external view returns (address)",
    "function totalSkipped() external view returns (uint256)",
    "function totalDecisions() external view returns (uint256)",
    "function setLedger(address _ledger) external",
    "function recordSkip(string calldata reason, uint256 confidence) external",
    "event DecisionSkipped(string reason, uint256 confidence)",
  ];

  const LEDGER_MIN_ABI = [
    "function totalEntries() external view returns (uint256)",
    "function AUTHORIZED_VAULT() external view returns (address)",
  ];

  const vault  = new ethers.Contract(VAULT_ADDRESS, VAULT_MIN_ABI, wallet);
  const ledger = new ethers.Contract(LEDGER_ADDRESS, LEDGER_MIN_ABI, provider);

  try {
    const agentWallet     = await vault.AGENT_WALLET();
    const vigilLedger     = await vault.vigilLedger();
    const totalSkipped    = await vault.totalSkipped();
    const authorizedVault = await ledger.AUTHORIZED_VAULT();
    const totalEntries    = await ledger.totalEntries();
    
    console.log(`AGENT_WALLET:    ${agentWallet}`);
    console.log(`vigilLedger:     ${vigilLedger}`);
    console.log(`totalSkipped:    ${totalSkipped}`);
    console.log(`authorizedVault: ${authorizedVault}`);
    console.log(`totalEntries:    ${totalEntries}`);
    console.log(`Our wallet:      ${wallet.address}`);

    // Key checks
    const vigilLedgerOk = vigilLedger.toLowerCase() === LEDGER_ADDRESS.toLowerCase();
    const authVaultOk   = authorizedVault.toLowerCase() === VAULT_ADDRESS.toLowerCase();
    const agentOk       = agentWallet.toLowerCase() === wallet.address.toLowerCase();

    console.log(`\nvigilLedger correct? ${vigilLedgerOk ? "✅" : "❌"} (is ${vigilLedger})`);
    console.log(`authorizedVault ok? ${authVaultOk ? "✅" : "❌"} (is ${authorizedVault})`);
    console.log(`agentWallet ok?     ${agentOk ? "✅" : "❌"} (is ${agentWallet})`);

    if (!authVaultOk) {
      console.log("\n❌ ROOT CAUSE: VIGILLedger was deployed with a DIFFERENT vault address as AUTHORIZED_VAULT");
      console.log("   This is an immutable constructor arg — we cannot fix it without redeploying.");
      console.log("   We need to redeploy VIGILLedger pointing to the CORRECT vault.");
      return;
    }

    if (!vigilLedgerOk) {
      console.log("\n⚠ vigilLedger points to wrong address — fixing...");
      const tx = await vault.setLedger(LEDGER_ADDRESS);
      await tx.wait();
      console.log("✅ Fixed!");
    }

    // Test write
    if (authVaultOk && agentOk) {
      console.log("\nTesting recordSkip write...");
      const tx = await vault.recordSkip("TEST_ENTRY", 5000n);
      const receipt = await tx.wait();
      console.log(`TX: ${receipt.hash} status=${receipt.status}`);
      console.log(`Logs: ${receipt.logs.length} events emitted`);
      const newTotal = await ledger.totalEntries();
      console.log(`Ledger entries after: ${newTotal}`);
      if (newTotal > totalEntries) {
        console.log("✅ SUCCESS: Ledger is being written!");
      } else {
        console.log("❌ FAIL: Ledger not written. vigilLedger likely address(0) in the execution context.");
      }
    }
  } catch(err: any) {
    console.error("Error:", err.shortMessage || err.message);
  }
}

main().catch(console.error);
