import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.resolve(__dirname, "../../.env") });

const AGENT_PRIVATE_KEY = process.env.AGENT_PRIVATE_KEY || "0x" + "0".repeat(64);
const MANTLE_RPC_URL = process.env.MANTLE_RPC_URL || "https://rpc.sepolia.mantle.xyz";
const MANTLE_MAINNET_RPC_URL = process.env.MANTLE_MAINNET_RPC_URL || "https://rpc.mantle.xyz";

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.25",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
      viaIR: true,
    },
  },
  networks: {
    hardhat: {
      chainId: 31337,
    },
    localhost: {
      url: "http://127.0.0.1:8545",
      chainId: 31337,
    },
    mantleSepolia: {
      url: MANTLE_RPC_URL,
      chainId: 5003,
      accounts: [AGENT_PRIVATE_KEY],
      gasPrice: "auto",
    },
    mantleMainnet: {
      url: MANTLE_MAINNET_RPC_URL,
      chainId: 5000,
      accounts: [AGENT_PRIVATE_KEY],
      gasPrice: "auto",
    },
  },
  paths: {
    sources: "./src",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts",
  },
  typechain: {
    outDir: "./typechain-types",
    target: "ethers-v6",
  },
};

export default config;
