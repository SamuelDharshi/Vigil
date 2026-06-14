/**
 * Deploy new FluxionAdapter and update VIGILVault to use it.
 * Run: npx hardhat run scripts/redeploy-adapter.ts --network mantleSepolia
 */
import { ethers } from "hardhat";

const VAULT_ADDRESS = "0x4F1d65dAd79bF887776808B7c833a75dc198ADa6";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying new FluxionAdapter from:", deployer.address);

  // Deploy new FluxionAdapter
  const Factory = await ethers.getContractFactory("FluxionAdapter");
  const adapter = await Factory.deploy();
  await adapter.waitForDeployment();
  const adapterAddress = await adapter.getAddress();
  console.log("✅ New FluxionAdapter deployed:", adapterAddress);

  // Update vault to use new adapter (owner call)
  const vault = new ethers.Contract(
    VAULT_ADDRESS,
    ["function setFluxionAdapter(address _a) external", "function fluxionAdapter() view returns (address)"],
    deployer
  );

  const tx = await vault.setFluxionAdapter(adapterAddress, { gasLimit: 100_000 });
  await tx.wait();
  console.log("✅ VIGILVault updated to use new adapter:", tx.hash);

  const newAdapter = await vault.fluxionAdapter();
  console.log("VIGILVault.fluxionAdapter:", newAdapter);
}

main().catch(err => { console.error(err); process.exit(1); });
