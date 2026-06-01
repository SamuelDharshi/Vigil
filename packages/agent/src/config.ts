import * as dotenv from "dotenv";
import * as path from "path";
import { ethers } from "ethers";

dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

/**
 * VIGIL Agent — Centralized Configuration
 * All addresses, endpoints, and constants in one place.
 *
 * ─── Address Sources ───────────────────────────────────────────────────────────
 * Mantle Sepolia RPC:     https://docs.mantle.xyz/network/introduction/quick-start
 * MNT Token:              https://docs.mantle.xyz/network/introduction/token-contract-address
 * mETH Token:             https://docs.methprotocol.xyz/technical-docs/contracts (Mantle Sepolia)
 * USDY Token:             https://docs.ondo.finance/usdy/introduction (verify on Mantle)
 * xStocks Tokens:         https://docs.fluxion.network/xstocks (BackedFi on Mantle Sepolia)
 * Pyth Oracle:            https://docs.pyth.network/price-feeds/contract-addresses/evm (Mantle)
 * ERC-8004 Registries:    Deployed via CREATE2 — same address on every chain
 *                         Identity:   0x8004A818BFB912233c491871b3d84c89A494BD9e
 *                         Reputation: 0x8004B663056A597Dffe9eCcC1965A193B7388713
 *                         Validation: 0x8004Cb1BF31DAf7788923b405b754f57acEB4272
 * Fluxion xChange:        https://docs.fluxion.network (Mantle Sepolia)
 * Super Portal:           https://portal.mantle.xyz / bridge.sepolia.mantle.xyz
 */

// ─── Network ──────────────────────────────────────────────────────────────────
export const MANTLE_RPC_URL  = process.env.MANTLE_RPC_URL  || "https://rpc.sepolia.mantle.xyz";
export const MANTLE_CHAIN_ID = 5003; // Mantle Sepolia
export const MANTLE_EXPLORER = "https://sepolia.mantlescan.xyz";

export const provider = new ethers.JsonRpcProvider(MANTLE_RPC_URL, undefined, { batchMaxCount: 1 });

export const agentWallet = new ethers.Wallet(
  process.env.AGENT_PRIVATE_KEY || (() => { throw new Error("AGENT_PRIVATE_KEY not set in .env"); })(),
  provider
);

// ─── VIGIL Deployed Contracts (fill after Phase 1 deploy) ─────────────────────
export const VIGIL_VAULT_ADDRESS   = process.env.VIGIL_VAULT_ADDRESS   || "";
export const VIGIL_LEDGER_ADDRESS  = process.env.VIGIL_LEDGER_ADDRESS  || "";
export const VERIFIER_ADDRESS      = process.env.VERIFIER_ADDRESS      || "";

// ─── ERC-8004 Registry Addresses (Mantle Sepolia) ─────────────────────────────
// Deployed via CREATE2 — identical address on every supported chain.
// Source: https://github.com/erc-8004/erc-8004-contracts
export const ERC8004_IDENTITY_REGISTRY   = process.env.ERC8004_IDENTITY_REGISTRY   || "0x8004A818BFB912233c491871b3d84c89A494BD9e";
export const ERC8004_REPUTATION_REGISTRY = process.env.ERC8004_REPUTATION_REGISTRY || "0x8004B663056A597Dffe9eCcC1965A193B7388713";
export const ERC8004_VALIDATION_REGISTRY = process.env.ERC8004_VALIDATION_REGISTRY || "0x8004Cb1BF31DAf7788923b405b754f57acEB4272";

// ─── Native Token ─────────────────────────────────────────────────────────────
// Mantle Sepolia native MNT token wrapper (ERC-20) for EVM calls
// Source: https://docs.mantle.xyz/network/introduction/token-contract-address
export const MNT_TOKEN_ADDRESS = process.env.MNT_ADDRESS || "0x78c1b0c915c4FAA5FffA6CAbf0219DA63d7f4cb8";

// ─── Protocol Addresses (fill from official docs before first run) ─────────────
export const SUPER_PORTAL_ADDRESS    = process.env.SUPER_PORTAL_ADDRESS    || "";
export const FLUXION_XCHANGE_ADDRESS = process.env.FLUXION_XCHANGE_ADDRESS || "";
export const FLUXION_RFQ_ENDPOINT    = process.env.FLUXION_RFQ_ENDPOINT    || "https://api.fluxion.network/v1/rfq";

// ─── Token Addresses (Mantle Sepolia) ─────────────────────────────────────────
// mETH: https://docs.methprotocol.xyz/technical-docs/contracts
// USDY: verify from https://docs.ondo.finance/usdy/supported-chains
// xStocks: verify from https://docs.fluxion.network/xstocks after BackedFi activation
export const TOKEN_ADDRESSES: Record<string, string> = {
  MNT:   MNT_TOKEN_ADDRESS,
  mETH:  process.env.METH_ADDRESS   || "0xcDA86A272531e8640cD7F1a92c01839911B90bb0", // Mantle Sepolia
  USDY:  process.env.USDY_ADDRESS   || "",  // Fill from Ondo docs for Mantle Sepolia
  NVDAx: process.env.NVDAX_ADDRESS  || "",  // Fill from Fluxion xStocks docs
  AAPLx: process.env.AAPLX_ADDRESS  || "",  // Fill from Fluxion xStocks docs
  TSLAx: process.env.TSLAX_ADDRESS  || "",  // Fill from Fluxion xStocks docs
};

// ─── Pyth Oracle Configuration ─────────────────────────────────────────────────
// Chainlink does NOT have price feeds on Mantle Sepolia.
// VIGIL uses Pyth Network which IS deployed on Mantle Sepolia.
//
// Pyth contract on Mantle Sepolia:
// Source: https://docs.pyth.network/price-feeds/contract-addresses/evm
export const PYTH_CONTRACT_ADDRESS = "0xA2aa501b19aff244D90cc15a4Cf739D2725B5729";
export const PYTH_HERMES_URL       = "https://hermes.pyth.network";

// Pyth Price Feed IDs — these are universal across all chains.
// Source: https://pyth.network/developers/price-feed-ids
export const PYTH_PRICE_IDS: Record<string, string> = {
  // Equities (xStocks = BackedFi tokenized stocks, priced via equity feeds)
  "NVDA/USD":  "0xb1073854ed24cbc755dc527418f52b7d271f6cc967bbf8d8129112b18860a593",
  "AAPL/USD":  "0x49f6b65cb1de6b10eaf75e7c03ca029c306d0357e91b5311b175084a5ad55688",
  "TSLA/USD":  "0x16dad506d7db8da01c87581c87ca897a012a153557d4d578c3b9c9e1bc0632f1",
  // Crypto — mETH tracks ETH price + staking premium
  "ETH/USD":   "0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace",
  "MNT/USD":   "0x4e3037c822d852d79af3ac80e35eb420ee3b870dca49f9344a38ef4773fb0585",
  // USDY tracks USD closely (Ondo stablecoin)
  "USDC/USD":  "0xeaa020c61cc479712813461ce153894a96a6c00b21ed0cfc2798d1f9a9e9c94a",
};

// ─── mETH Protocol APR ───────────────────────────────────────────────────────
// The mETH staking contract on Mantle Sepolia testnet does not expose stakingRate().
// We use the real mainnet APR as a baseline signal (currently ~3.8% annualized).
// Source: https://docs.methprotocol.xyz/technical-docs/contracts
export const METH_BASELINE_APR = parseFloat(process.env.METH_BASELINE_APR || "3.8");
// USDY real yield from Ondo (4.09% annualized as of June 2026)
export const USDY_BASELINE_YIELD = parseFloat(process.env.USDY_BASELINE_YIELD || "4.09");

// ─── Solana Configuration (for Byreal CLMM) ───────────────────────────────────
export const BYREAL_SOLANA_WALLET = process.env.BYREAL_SOLANA_WALLET || "";

// ─── API Keys ────────────────────────────────────────────────────────────────
export const NANSEN_API_KEY    = process.env.NANSEN_API_KEY    || "";
export const ELFA_API_KEY      = process.env.ELFA_API_KEY      || "";
export const WEB3_STORAGE_KEY  = process.env.WEB3_STORAGE_KEY  || "";

// ─── Decision Engine Constants ────────────────────────────────────────────────
// Thresholds are env-var driven so testnet can use lower values for demos.
// Set YIELD_MIN_CONFIDENCE=0.55 on mainnet, 0.30 on testnet.
export const DECISION_THRESHOLDS = {
  YIELD_MIN_CONFIDENCE:   parseFloat(process.env.YIELD_MIN_CONFIDENCE  || "0.30"),
  XSTOCK_MIN_CONFIDENCE:  parseFloat(process.env.XSTOCK_MIN_CONFIDENCE || "0.45"),
  BYREAL_APR_PREMIUM:     parseFloat(process.env.BYREAL_APR_PREMIUM    || "0.8"),
};

// ─── Signal Weights ───────────────────────────────────────────────────────────
export const SIGNAL_WEIGHTS = {
  YIELD_DIFFERENTIAL: 0.35,  // Chainlink-sourced yield spreads
  SMART_MONEY:        0.40,  // Nansen on-chain wallet flows
  SOCIAL_SENTIMENT:   0.25,  // Elfa AI social signals
} as const;

// ─── Guardrail Constants (must mirror Solidity constants exactly) ─────────────
export const GUARDRAILS = {
  MAX_SLIPPAGE_BPS:     40,    // 0.40% — VIGILVault.MAX_SLIPPAGE_BPS
  MAX_EPOCH_ALLOCATION: 0.15,  // 15%  — VIGILVault.MAX_EPOCH_ALLOCATION
  MAX_SINGLE_TX_USD:    10_000,// $10k — VIGILVault.MAX_SINGLE_TX_USD
  GAS_RESERVOIR_MIN_MNT: 0.5, // 0.5 MNT — VIGILVault.GAS_RESERVOIR_MIN
} as const;

// ─── Cron Schedule ────────────────────────────────────────────────────────────
export const CRON_SCHEDULE = "*/30 * * * *"; // Every 30 minutes

// ─── Circuit Paths ────────────────────────────────────────────────────────────
export const CIRCUIT_WASM_PATH = path.join(__dirname, "../circuits/vigil_rebalance.wasm");
export const CIRCUIT_ZKEY_PATH = path.join(__dirname, "../circuits/vigil_rebalance_final.zkey");

// ─── Database ────────────────────────────────────────────────────────────────
export const DATABASE_URL = process.env.DATABASE_URL || "postgresql://postgres:vigil@localhost:5432/vigil";

// ─── ABIs ─────────────────────────────────────────────────────────────────────

// Pyth IPyth ABI (minimal — for updatePriceFeeds + getPriceUnsafe)
export const PYTH_ABI = [
  "function getPriceUnsafe(bytes32 id) external view returns (int64 price, uint64 conf, int32 expo, uint256 publishTime)",
  "function getPrice(bytes32 id) external view returns (int64 price, uint64 conf, int32 expo, uint256 publishTime)",
  "function updatePriceFeeds(bytes[] calldata updateData) external payable",
  "function getUpdateFee(bytes[] calldata updateData) external view returns (uint256 feeAmount)",
];

// Note: mETH staking APR is sourced from METH_BASELINE_APR constant (env var).
// The staking contract on Mantle Sepolia testnet does not implement stakingRate().

export const ERC8004_IDENTITY_ABI = [
  "function mintIdentity(string calldata agentCardCid) external returns (uint256 tokenId)",
  "function setAgentCard(uint256 tokenId, string calldata cid) external",
  "function getAgentCard(uint256 tokenId) external view returns (string memory cid)",
  "function ownerOf(uint256 tokenId) external view returns (address)",
];

export const ERC8004_REPUTATION_ABI = [
  "function submitFeedback(uint256 agentId, bytes32 taskId, int128 score, uint8 decimals, string calldata metadataCid) external",
  "function getReputation(uint256 agentId) external view returns (int128 score, uint256 totalFeedback)",
];

export const ERC8004_VALIDATION_ABI = [
  "function submitValidation(uint256 agentId, bytes calldata zkProof, address verifierAddress) external",
  "function getValidation(uint256 agentId, uint256 index) external view returns (bytes32 proofHash, address verifier, uint256 timestamp)",
];
