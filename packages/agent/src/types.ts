/**
 * VIGIL Agent — Decision & Signal Type Definitions
 * These are the canonical TypeScript types used throughout the agent runtime.
 */

// ─────────────────────────────────────────────────────────────────────────────
// SIGNAL TYPES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * PythBundle — live prices from Pyth Network on Mantle Sepolia.
 * Chainlink is NOT deployed on Mantle Sepolia. Pyth IS.
 * Contract: 0xA2aa501b19aff244D90cc15a4Cf739D2725B5729
 */
export interface PythBundle {
  mEthPriceUsd: number;      // ETH/USD price (mETH tracks ETH)
  mEthApr: number;           // mETH APR from on-chain exchange rate
  usdyYield: number;         // USDY/USD ≈ 1.0 (Ondo stablecoin)
  xstockPrices: Record<string, number>; // { NVDAx: 118.40, TSLAx: 312.20, AAPLx: ... }
  mntPriceUsd: number;       // MNT/USD for gas reservoir valuation
  updateData: string[];      // Pyth Hermes binary price update (for on-chain push)
  publishTimes: Record<string, number>; // symbol → Unix timestamp of price
  fetchedAt: number;         // Unix ms
}

/** @deprecated Use PythBundle — Chainlink is not on Mantle Sepolia */
export type ChainlinkBundle = PythBundle;

export interface SmartMoneyFlow {
  token: string;             // Token symbol (e.g., "mETH", "NVDAx")
  tokenAddress: string;      // On-chain address
  direction: "IN" | "OUT";  // Capital movement direction
  usdValue: number;          // USD value of the flow
  walletsCount: number;      // Number of smart money wallets involved
  walletLabels: string[];    // Nansen wallet labels
}

export interface NansenBundle {
  smartMoneyFlows: SmartMoneyFlow[];
  fetchedAt: number;
}

export interface ElfaBundle {
  sentimentDeltas: Record<string, number>; // token → normalized delta [-1, 1]
  rawScores: Record<string, { current: number; baseline: number }>;
  fetchedAt: number;
}

export interface MantleOnChainState {
  currentAllocation: Record<string, number>; // token → basis points
  gasReservoir: bigint;                       // in wei
  epochAllocationUsed: number;                // USD, 6 decimals
  epochAllocationRemaining: number;           // USD, 6 decimals
  totalDecisions: number;
  totalSkipped: number;
}

export interface SignalBundle {
  pyth: PythBundle;           // Live prices from Pyth Network on Mantle Sepolia
  chainlink: PythBundle;      // Alias for backwards compat — same data as pyth
  nansen: NansenBundle;
  elfa: ElfaBundle;
  mantle: MantleOnChainState;
  bundleId: string;           // UUID for this signal bundle
  timestamp: number;          // Unix ms
}

// ─────────────────────────────────────────────────────────────────────────────
// DECISION TYPES
// ─────────────────────────────────────────────────────────────────────────────

export type DecisionAction = "ROTATE" | "CLMM_OPEN" | "CLMM_CLOSE" | "CLMM_REBALANCE" | "SKIP";

export type SkipReason =
  | "CONFIDENCE_TOO_LOW"
  | "GAS_LOW"
  | "GUARDRAIL_REJECTED"
  | "EPOCH_CAP_REACHED"
  | "NO_OPPORTUNITY"
  | "EXECUTION_ERROR"
  | "PROOF_GENERATION_FAILED";

export interface AssetScores {
  mETH: number;
  USDY: number;
  NVDAx: number;
  AAPLx: number;
  TSLAx: number;
  MNT?: number;
}

export interface Decision {
  id: string;                    // UUID
  timestamp: number;             // Unix ms
  action: DecisionAction;
  fromAsset: string;             // Asset symbol (e.g., "NVDAx")
  fromToken: string;             // EVM address
  toAsset: string;               // Asset symbol (e.g., "USDY")
  toToken: string;               // EVM address
  amount: number;                // USD, 6 decimals
  confidence: number;            // 0–1 (e.g., 0.79 = 79%)
  reasoning: string;             // Human-readable, shown in Instrument Serif
  signalBundleId: string;        // UUID of the triggering SignalBundle
  signalBundleCid?: string;      // IPFS CID after pinning
  assetScores: AssetScores;      // Per-asset scores for UI display
  // Set after execution:
  zkProofHash?: string;          // bytes32 hex of Groth16 proof
  txHash?: string;               // On-chain execution transaction hash
  erc8004TaskId?: string;        // ERC-8004 Reputation Registry task ID
  ledgerEntryId?: number;        // VIGILLedger entry index
  slippageBps?: number;          // Actual slippage achieved
  // Skip details:
  skipReason?: SkipReason;
  // Outcome measurement:
  outcomeAt6h?: number;          // Measured delta 6h later
  outcomeAt24h?: number;         // Measured delta 24h later
  publicProofUrl?: string;       // vigil.app/proof/[txHash]
}

// ─────────────────────────────────────────────────────────────────────────────
// ZK PROOF TYPES
// ─────────────────────────────────────────────────────────────────────────────

export interface ProofInput {
  // Private inputs (not revealed in proof)
  mEthSignalWeight: string;      // As field element string
  usdySignalWeight: string;
  xstockSignalWeight: string;
  // Public inputs (visible on-chain)
  prevAllocation: string[];      // [mETH%, USDY%, xStocks%] × 100
  newAllocation: string[];
  maxEpochChange: string;        // 1500 (= 15.00%)
}

export interface GrothProof {
  proof: {
    pi_a: string[];
    pi_b: string[][];
    pi_c: string[];
    protocol: string;
    curve: string;
  };
  publicSignals: string[];
}

export interface SerializedProof {
  proofBytes: string;            // ABI-encoded for on-chain submission
  publicInputs: string[];
  proofHash: string;             // keccak256 of proofBytes as bytes32 hex
}

// ─────────────────────────────────────────────────────────────────────────────
// EXECUTION TYPES
// ─────────────────────────────────────────────────────────────────────────────

export interface FluxionQuote {
  quoteId: string;               // bytes32 hex
  tokenIn: string;               // EVM address
  tokenOut: string;              // EVM address
  amountIn: bigint;
  amountOut: bigint;
  priceImpactBps: number;        // Price impact in basis points
  deadline: number;              // Unix timestamp
  signature: string;             // Issuer signature
}

export interface ExecutionResult {
  txHash: string;
  actualSlippageBps: number;
  amountOut: bigint;
  gasUsed: bigint;
  success: boolean;
  error?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// BYREAL TYPES
// ─────────────────────────────────────────────────────────────────────────────

export interface ByrealPoolAnalysis {
  pool: string;                  // e.g., "MNT-USDC"
  apr: number;                   // Current CLMM APR (%)
  tvl: number;                   // Total value locked (USD)
  volume24h: number;             // 24h volume (USD)
  feeTier: string;
}

export interface ByrealPosition {
  positionId: string;
  pool: string;
  amountMNT: number;
  amountUSDC: number;
  currentApr: number;
  inRange: boolean;
  accruedFees: number;
  openedAt: number;              // Unix ms
}

// ─────────────────────────────────────────────────────────────────────────────
// AGENT CARD (ERC-8004)
// ─────────────────────────────────────────────────────────────────────────────

export interface AgentCapability {
  id: string;
  description: string;
}

export interface AgentEndpoint {
  protocol: "https" | "mcp" | "ws";
  url: string;
}

export interface AgentCard {
  name: string;
  description: string;
  version: string;
  capabilities: AgentCapability[];
  endpoints: AgentEndpoint[];
  paymentAddress: string;
  supportedProtocols: string[];
  agentId?: number;              // ERC-8004 token ID (set after mint)
  deployedAt?: string;           // ISO timestamp
}

// ─────────────────────────────────────────────────────────────────────────────
// LEDGER ENTRY (mirrors VIGILLedger.sol struct)
// ─────────────────────────────────────────────────────────────────────────────

export interface LedgerEntry {
  entryId: number;
  agentId: string;
  decision: Decision;
  reputationScoreBefore: number;
  reputationScoreAfter: number;
  publicProofUrl: string;
  shareText: string;
}
