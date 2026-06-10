import { ethers, network } from "hardhat";
import * as fs from "fs";
import * as path from "path";

async function main() {
  const [deployer] = await ethers.getSigners();
  const networkName = network.name;

  console.log("═══════════════════════════════════════════════");
  console.log("  VIGIL Mantle Sepolia Deployment Sequence");
  console.log("═══════════════════════════════════════════════");
  console.log(`  Network:   ${networkName}`);
  console.log(`  Deployer:  ${deployer.address}`);
  console.log(`  Balance:   ${ethers.formatEther(await ethers.provider.getBalance(deployer.address))} MNT`);
  console.log("═══════════════════════════════════════════════\n");

  const configPath = path.resolve(__dirname, "../../config/deployments.sepolia.json");
  if (!fs.existsSync(configPath)) {
    throw new Error(`Config file not found at ${configPath}`);
  }
  const config = JSON.parse(fs.readFileSync(configPath, "utf-8"));

  // Check agent key in .env
  const envPath = path.resolve(__dirname, "../../../.env");
  if (!fs.existsSync(envPath)) {
    throw new Error(`.env file not found at ${envPath}`);
  }
  const envContent = fs.readFileSync(envPath, "utf-8");
  const agentPrivateKeyMatch = envContent.match(/AGENT_PRIVATE_KEY=(0x[a-fA-F0-9]{64})/);
  if (!agentPrivateKeyMatch) {
    throw new Error("AGENT_PRIVATE_KEY not set in .env!");
  }
  const agentWallet = new ethers.Wallet(agentPrivateKeyMatch[1], ethers.provider);
  console.log(`🤖 Agent Wallet: ${agentWallet.address}\n`);

  const tokens = config.tokens;
  const tokenNames = ["mETH", "USDY", "NVDAx", "AAPLx", "TSLAx", "MNT"];
  for (const name of tokenNames) {
    if (!tokens[name] || tokens[name] === "") {
      throw new Error(`Token address for ${name} is missing in deployments.sepolia.json`);
    }
  }

  // 1. Deploy VIGILMockDEX if not present
  let dexAddress = config.contracts.VIGILMockDEX;
  let dexDeployed = false;
  if (dexAddress && dexAddress !== "") {
    try {
      const code = await ethers.provider.getCode(dexAddress);
      if (code !== "0x" && code !== "0x00") {
        dexDeployed = true;
      }
    } catch {
      // ignore
    }
  }

  if (!dexDeployed) {
    console.log("📦 Deploying VIGILMockDEX...");
    const DEXFactory = await ethers.getContractFactory("VIGILMockDEX");
    const dex = await DEXFactory.deploy();
    await dex.waitForDeployment();
    dexAddress = await dex.getAddress();
    console.log(`   ✅ VIGILMockDEX deployed at: ${dexAddress}`);
    config.contracts.VIGILMockDEX = dexAddress;
  } else {
    console.log(`   ✓ VIGILMockDEX already deployed at: ${dexAddress}`);
  }

  // 2. Deploy Feeds
  console.log("\n📦 Deploying VIGIL Chainlink Price Feeds (8 decimals)...");
  const FeedFactory = await ethers.getContractFactory("VIGILChainlinkFeed");

  const mntFeed = await FeedFactory.deploy(65_000_000n); // $0.65
  await mntFeed.waitForDeployment();
  const mntFeedAddress = await mntFeed.getAddress();

  const methFeed = await FeedFactory.deploy(2000_000_000_00n); // $2000.00
  await methFeed.waitForDeployment();
  const methFeedAddress = await methFeed.getAddress();

  const usdyFeed = await FeedFactory.deploy(1_000_000_00n); // $1.00
  await usdyFeed.waitForDeployment();
  const usdyFeedAddress = await usdyFeed.getAddress();

  const nvdaxFeed = await FeedFactory.deploy(211_750_000_00n); // $211.75
  await nvdaxFeed.waitForDeployment();
  const nvdaxFeedAddress = await nvdaxFeed.getAddress();

  const aaplxFeed = await FeedFactory.deploy(312_090_000_00n); // $312.09
  await aaplxFeed.waitForDeployment();
  const aaplxFeedAddress = await aaplxFeed.getAddress();

  const tslaxFeed = await FeedFactory.deploy(435_520_000_00n); // $435.52
  await tslaxFeed.waitForDeployment();
  const tslaxFeedAddress = await tslaxFeed.getAddress();

  console.log(`   ✓ MNT feed:   ${mntFeedAddress}`);
  console.log(`   ✓ mETH feed:  ${methFeedAddress}`);
  console.log(`   ✓ USDY feed:  ${usdyFeedAddress}`);
  console.log(`   ✓ NVDAx feed: ${nvdaxFeedAddress}`);
  console.log(`   ✓ AAPLx feed: ${aaplxFeedAddress}`);
  console.log(`   ✓ TSLAx feed: ${tslaxFeedAddress}`);

  // 3. Deploy FluxionAdapter & SuperPortalAdapter
  console.log("\n📦 Deploying FluxionAdapter...");
  const FluxionFactory = await ethers.getContractFactory("FluxionAdapter");
  const fluxionAdapter = await FluxionFactory.deploy();
  await fluxionAdapter.waitForDeployment();
  const fluxionAdapterAddress = await fluxionAdapter.getAddress();
  console.log(`   ✅ FluxionAdapter deployed at: ${fluxionAdapterAddress}`);

  console.log("\n📦 Deploying SuperPortalAdapter...");
  const SuperPortalFactory = await ethers.getContractFactory("SuperPortalAdapter");
  const superPortalAdapter = await SuperPortalFactory.deploy();
  await superPortalAdapter.waitForDeployment();
  const superPortalAdapterAddress = await superPortalAdapter.getAddress();
  console.log(`   ✅ SuperPortalAdapter deployed at: ${superPortalAdapterAddress}`);

  // 4. Deploy VIGILVault
  console.log("\n📦 Deploying VIGILVault...");
  const VaultFactory = await ethers.getContractFactory("VIGILVault");
  const vault = await VaultFactory.deploy(
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
    ]
  );
  await vault.waitForDeployment();
  const vaultAddress = await vault.getAddress();
  console.log(`   ✅ VIGILVault deployed: ${vaultAddress}`);

  // 5. Deploy VIGILLedger
  console.log("\n📦 Deploying VIGILLedger...");
  const LedgerFactory = await ethers.getContractFactory("VIGILLedger");
  const ledger = await LedgerFactory.deploy(vaultAddress);
  await ledger.waitForDeployment();
  const ledgerAddress = await ledger.getAddress();
  console.log(`   ✅ VIGILLedger deployed: ${ledgerAddress}`);

  // 6. Connect Adapters and Ledger to Vault
  console.log("\n🔗 Configuring VIGILVault...");
  let tx = await vault.setLedgerContract(ledgerAddress);
  await tx.wait();
  console.log("   ✓ Ledger connected");

  tx = await vault.setFluxionAdapter(fluxionAdapterAddress);
  await tx.wait();
  console.log("   ✓ FluxionAdapter set");

  tx = await vault.setSuperPortalAdapter(superPortalAdapterAddress);
  await tx.wait();
  console.log("   ✓ SuperPortalAdapter set");

  tx = await vault.setXStocksEnabled(false);
  await tx.wait();
  console.log("   ✓ xStocks disabled (Sepolia safety)");

  // 7. Seed Initial Funds & Setup Gas Reservoir
  console.log("\n💵 Seeding initial funds and gas reservoir...");
  const mntToken = await ethers.getContractAt("VIGILToken", tokens.MNT);
  const methToken = await ethers.getContractAt("VIGILToken", tokens.mETH);
  const usdyToken = await ethers.getContractAt("VIGILToken", tokens.USDY);
  const nvdaxToken = await ethers.getContractAt("VIGILToken", tokens.NVDAx);

  // Mint MNT to Agent Wallet if needed, approve, and fund gas reservoir
  try {
    const mintMntTx = await mntToken.mint(agentWallet.address, ethers.parseEther("100"));
    await mintMntTx.wait();
    console.log("   ✓ Minted 100 MNT to agent wallet");
  } catch (err: any) {
    console.log(`   ⚠ Mint MNT bypassed: ${err.message}`);
  }

  // Approve and fund gas reservoir
  try {
    const approveTx = await mntToken.connect(agentWallet).approve(vaultAddress, ethers.parseEther("100"));
    await approveTx.wait();
    const fundReservoirTx = await vault.connect(agentWallet).fundGasReservoir(ethers.parseEther("10"));
    await fundReservoirTx.wait();
    console.log(`   ✓ Funded Vault Gas Reservoir with 10.0 MNT`);
  } catch (err: any) {
    console.log(`   ⚠ Gas reservoir funding failed: ${err.message}`);
  }

  // Mint initial token balances to the Vault so it has assets to manage
  try {
    const mintMethTx = await methToken.mint(vaultAddress, ethers.parseEther("10")); // 10 mETH (~$20k)
    await mintMethTx.wait();
    const mintUsdyTx = await usdyToken.mint(vaultAddress, ethers.parseEther("20000")); // 20,000 USDY (~$20k)
    await mintUsdyTx.wait();
    const mintNvdaxTx = await nvdaxToken.mint(vaultAddress, ethers.parseEther("50")); // 50 NVDAx (~$10k)
    await mintNvdaxTx.wait();
    console.log(`   ✓ Seeded Vault with 10 mETH, 20,000 USDY, and 50 NVDAx`);
  } catch (err: any) {
    console.log(`   ⚠ Seeding vault tokens failed: ${err.message}`);
  }

  // 8. Update deployments.sepolia.json
  config.contracts.VIGILVault = vaultAddress;
  config.contracts.VIGILLedger = ledgerAddress;
  config.contracts.FluxionAdapter = fluxionAdapterAddress;
  config.contracts.SuperPortalAdapter = superPortalAdapterAddress;
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
  console.log(`\n📝 deployments.sepolia.json updated with new contract addresses`);

  // Update root and frontend .env files
  const patchEnv = (envFilePath: string) => {
    if (fs.existsSync(envFilePath)) {
      let envContent = fs.readFileSync(envFilePath, "utf8");
      envContent = envContent
        .replace(/^VIGIL_VAULT_ADDRESS=.*/m, `VIGIL_VAULT_ADDRESS=${vaultAddress}`)
        .replace(/^VIGIL_LEDGER_ADDRESS=.*/m, `VIGIL_LEDGER_ADDRESS=${ledgerAddress}`)
        .replace(/^FLUXION_XCHANGE_ADDRESS=.*/m, `FLUXION_XCHANGE_ADDRESS=${fluxionAdapterAddress}`)
        .replace(/^SUPER_PORTAL_ADDRESS=.*/m, `SUPER_PORTAL_ADDRESS=${superPortalAdapterAddress}`);
      fs.writeFileSync(envFilePath, envContent);
      console.log(`📝 Updated ${path.basename(envFilePath)}`);
    }
  };

  patchEnv(envPath);
  const frontendEnvPath = path.resolve(__dirname, "../../frontend/.env");
  patchEnv(frontendEnvPath);

  console.log("\n═══════════════════════════════════════════════");
  console.log("  ✅ Sepolia Deployment Complete!");
  console.log("═══════════════════════════════════════════════\n");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
