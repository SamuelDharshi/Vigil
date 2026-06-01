import { ethers, network } from "hardhat";
import * as fs from "fs";
import * as path from "path";

async function main() {
  const [deployer] = await ethers.getSigners();
  const networkName = network.name;

  console.log("═══════════════════════════════════════════════");
  console.log("  VIGIL Production Deployment Sequence");
  console.log("═══════════════════════════════════════════════");
  console.log(`  Network:   ${networkName}`);
  console.log(`  Deployer:  ${deployer.address}`);
  console.log(`  Balance:   ${ethers.formatEther(await ethers.provider.getBalance(deployer.address))} MNT`);
  console.log("═══════════════════════════════════════════════\n");

  // Read current .env
  const envPath = path.resolve(__dirname, "../../../.env");
  let envContent = "";
  if (fs.existsSync(envPath)) {
    envContent = fs.readFileSync(envPath, "utf-8");
  }

  // Derive Agent wallet from configured private key
  const agentPrivateKeyMatch = envContent.match(/AGENT_PRIVATE_KEY=(0x[a-fA-F0-9]{64})/);
  if (!agentPrivateKeyMatch) {
    throw new Error("AGENT_PRIVATE_KEY not set in .env!");
  }
  const agentWallet = new ethers.Wallet(agentPrivateKeyMatch[1], ethers.provider);
  console.log(`🤖 Agent Wallet derived: ${agentWallet.address}\n`);

  // 1. Deploy VIGIL ERC-8004 Registry
  console.log("📦 Deploying VIGILERC8004Registry...");
  const RegistryFactory = await ethers.getContractFactory("VIGILERC8004Registry");
  const registry = await RegistryFactory.deploy();
  await registry.waitForDeployment();
  const registryAddress = await registry.getAddress();
  console.log(`   ✅ VIGILERC8004Registry deployed at: ${registryAddress}`);

  // 2. Deploy VIGIL Tokens
  console.log("\n📦 Deploying VIGIL ERC-20 Tokens...");
  const TokenFactory = await ethers.getContractFactory("VIGILToken");

  const mntToken = await TokenFactory.deploy("Mantle", "MNT", 18);
  await mntToken.waitForDeployment();
  const mntAddress = await mntToken.getAddress();

  const methToken = await TokenFactory.deploy("Mantle Staked ETH", "mETH", 18);
  await methToken.waitForDeployment();
  const methAddress = await methToken.getAddress();

  const usdyToken = await TokenFactory.deploy("Ondo USDY", "USDY", 18);
  await usdyToken.waitForDeployment();
  const usdyAddress = await usdyToken.getAddress();

  const nvdaxToken = await TokenFactory.deploy("NVIDIA xStock", "NVDAx", 18);
  await nvdaxToken.waitForDeployment();
  const nvdaxAddress = await nvdaxToken.getAddress();

  const aaplxToken = await TokenFactory.deploy("Apple xStock", "AAPLx", 18);
  await aaplxToken.waitForDeployment();
  const aaplxAddress = await aaplxToken.getAddress();

  const tslaxToken = await TokenFactory.deploy("Tesla xStock", "TSLAx", 18);
  await tslaxToken.waitForDeployment();
  const tslaxAddress = await tslaxToken.getAddress();

  console.log(`   ✓ VIGIL MNT:   ${mntAddress}`);
  console.log(`   ✓ VIGIL mETH:  ${methAddress}`);
  console.log(`   ✓ VIGIL USDY:  ${usdyAddress}`);
  console.log(`   ✓ VIGIL NVDAx: ${nvdaxAddress}`);
  console.log(`   ✓ VIGIL AAPLx: ${aaplxAddress}`);
  console.log(`   ✓ VIGIL TSLAx: ${tslaxAddress}`);

  // 3. Deploy VIGIL Chainlink Price Feeds
  console.log("\n📦 Deploying VIGIL Chainlink Feeds (8 decimals)...");
  const FeedFactory = await ethers.getContractFactory("VIGILChainlinkFeed");

  const mntFeed = await FeedFactory.deploy(65_000_000n); // $0.65
  await mntFeed.waitForDeployment();

  const methFeed = await FeedFactory.deploy(2000_000_000_00n); // $2000.00
  await methFeed.waitForDeployment();

  const usdyFeed = await FeedFactory.deploy(1_000_000_00n); // $1.00
  await usdyFeed.waitForDeployment();

  const nvdaxFeed = await FeedFactory.deploy(211_750_000_00n); // $211.75
  await nvdaxFeed.waitForDeployment();

  const aaplxFeed = await FeedFactory.deploy(312_090_000_00n); // $312.09
  await aaplxFeed.waitForDeployment();

  const tslaxFeed = await FeedFactory.deploy(435_520_000_00n); // $435.52
  await tslaxFeed.waitForDeployment();

  console.log(`   ✓ MNT/USD feed:   ${await mntFeed.getAddress()}`);
  console.log(`   ✓ mETH/USD feed:  ${await methFeed.getAddress()}`);
  console.log(`   ✓ USDY/USD feed:  ${await usdyFeed.getAddress()}`);
  console.log(`   ✓ NVDAx/USD feed: ${await nvdaxFeed.getAddress()}`);
  console.log(`   ✓ AAPLx/USD feed: ${await aaplxFeed.getAddress()}`);
  console.log(`   ✓ TSLAx/USD feed: ${await tslaxFeed.getAddress()}`);

  // 4. Deploy VIGILVault
  console.log("\n📦 Deploying VIGILVault...");
  const VaultFactory = await ethers.getContractFactory("VIGILVault");
  const vault = await VaultFactory.deploy(
    agentWallet.address,
    mntAddress,
    [methAddress, usdyAddress, nvdaxAddress, aaplxAddress, tslaxAddress, mntAddress],
    [
      await methFeed.getAddress(),
      await usdyFeed.getAddress(),
      await nvdaxFeed.getAddress(),
      await aaplxFeed.getAddress(),
      await tslaxFeed.getAddress(),
      await mntFeed.getAddress(),
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

  // 6. Connect Ledger to Vault
  console.log("\n🔗 Connecting VIGILLedger to VIGILVault...");
  const connectTx = await vault.setLedger(ledgerAddress);
  await connectTx.wait();
  console.log("   ✅ Ledger connected successfully");

  // 7. Seed Initial Funds & Setup Gas Reservoir
  console.log("\n💵 Seeding initial funds and gas reservoir...");
  
  // Fund Agent with MNT for gas reservoir
  const mintMntTx = await mntToken.mint(agentWallet.address, ethers.parseEther("100"));
  await mintMntTx.wait();

  // Approve and fund gas reservoir
  const approveTx = await mntToken.connect(agentWallet).approve(vaultAddress, ethers.parseEther("100"));
  await approveTx.wait();

  const fundReservoirTx = await vault.connect(agentWallet).fundGasReservoir(ethers.parseEther("10"));
  await fundReservoirTx.wait();
  console.log(`   ✓ Funded Vault Gas Reservoir with 10.0 MNT.`);

  // Mint initial token balances to the Vault so it has assets to manage
  await methToken.mint(vaultAddress, ethers.parseEther("10")); // 10 mETH (~$20k)
  await usdyToken.mint(vaultAddress, ethers.parseEther("20000")); // 20,000 USDY (~$20k)
  await nvdaxToken.mint(vaultAddress, ethers.parseEther("50")); // 50 NVDAx (~$10k)
  console.log(`   ✓ Seeded Vault with 10 mETH, 20,000 USDY, and 50 NVDAx.`);

  // ─── Auto-patch root .env and frontend .env with new addresses ───────────
  const rootEnvPath = path.resolve(__dirname, "../../../.env");
  const frontendEnvPath = path.resolve(__dirname, "../../frontend/.env");

  const patchEnv = (envFilePath: string) => {
    if (fs.existsSync(envFilePath)) {
      let envContent = fs.readFileSync(envFilePath, "utf8");
      envContent = envContent
        .replace(/^VIGIL_VAULT_ADDRESS=.*/m, `VIGIL_VAULT_ADDRESS=${vaultAddress}`)
        .replace(/^VIGIL_LEDGER_ADDRESS=.*/m, `VIGIL_LEDGER_ADDRESS=${ledgerAddress}`)
        .replace(/^ERC8004_IDENTITY_REGISTRY=.*/m, `ERC8004_IDENTITY_REGISTRY=${registryAddress}`)
        .replace(/^ERC8004_REPUTATION_REGISTRY=.*/m, `ERC8004_REPUTATION_REGISTRY=${registryAddress}`)
        .replace(/^ERC8004_VALIDATION_REGISTRY=.*/m, `ERC8004_VALIDATION_REGISTRY=${registryAddress}`);
      fs.writeFileSync(envFilePath, envContent);
    }
  };

  patchEnv(rootEnvPath);
  patchEnv(frontendEnvPath);
  console.log(`\n📝 .env files updated automatically with new addresses`);

  console.log("\n═══════════════════════════════════════════════");
  console.log("  ✅ Live Deployment Complete!");
  console.log("═══════════════════════════════════════════════\n");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
