import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  const factory = await ethers.getContractFactory("VIGILReasoningAnchor");
  const anchor = await factory.deploy(deployer.address);
  await anchor.waitForDeployment();
  console.log("VIGIL_ANCHOR_ADDRESS=" + (await anchor.getAddress()));
  console.log("tx:", anchor.deploymentTransaction()?.hash);
}

main().catch(err => { console.error(err); process.exit(1); });
