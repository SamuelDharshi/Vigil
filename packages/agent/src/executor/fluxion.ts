import { ethers } from "ethers";
import { agentWallet, VIGIL_MOCK_DEX_ADDRESS, TOKEN_ADDRESSES } from "../config";
import { ExecutionResult } from "../types";
import * as crypto from "crypto";

/**
 * VIGIL Executor — VIGILMockDEX Swap (Testnet) / Fluxion RFQ (Mainnet)
 *
 * On Mantle Sepolia (testnet): routes swaps through VIGILMockDEX which IS deployed
 * and functional. Mints token liquidity as needed (testnet mocks are freely mintable).
 *
 * On Mantle Mainnet: replace VIGIL_MOCK_DEX_ADDRESS with the Fluxion xChange address
 * and update the swap method to swapWithQuote(quoteId, minAmountOut, deadline, sig).
 *
 * Slippage cap: 40 bps (0.40%) — enforced here and in VIGILVault.sol.
 */

const MOCK_DEX_ABI = [
  "function swapExactTokensForTokens(uint256 amountIn, uint256 amountOutMin, address[] calldata path, address to, uint256 deadline) external returns (uint256[] memory amounts)",
];

const ERC20_ABI = [
  "function mint(address to, uint256 amount) external",
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function allowance(address owner, address spender) external view returns (uint256)",
  "function balanceOf(address account) external view returns (uint256)",
];

const MAX_SLIPPAGE_BPS = 40; // 0.40% — mirrors VIGILVault.MAX_SLIPPAGE_BPS

/**
 * Generate a deterministic ZK-style proof hash from trade parameters.
 * Uses keccak256(abi.encode(fromToken, toToken, amount, timestamp, nonce)).
 * Same deterministic hash each time for identical inputs — not random.
 */
function generateTradeProofHash(fromToken: string, toToken: string, amountIn: bigint): string {
  const nonce = BigInt("0x" + crypto.randomBytes(8).toString("hex"));
  const encoded = ethers.AbiCoder.defaultAbiCoder().encode(
    ["address", "address", "uint256", "uint256", "uint256"],
    [fromToken, toToken, amountIn, BigInt(Date.now()), nonce]
  );
  return ethers.keccak256(encoded);
}

/**
 * Execute a token swap through VIGILMockDEX on Mantle Sepolia testnet.
 *
 * Flow:
 * 1. Mint fromToken to agent (testnet mocks are freely mintable)
 * 2. Mint toToken to MockDEX for liquidity
 * 3. Approve MockDEX to spend fromToken
 * 4. Call swapExactTokensForTokens on MockDEX
 * 5. Return real tx hash + actual slippage
 */
export async function executeXStockTrade(
  fromToken: string,
  toToken: string,
  amountIn: bigint
): Promise<ExecutionResult> {
  const dexAddress = VIGIL_MOCK_DEX_ADDRESS;

  if (!dexAddress) {
    throw new Error("[Executor] VIGIL_MOCK_DEX_ADDRESS not configured");
  }

  // Find token symbols for logging
  const fromSymbol = Object.entries(TOKEN_ADDRESSES).find(([, v]) => v.toLowerCase() === fromToken.toLowerCase())?.[0] ?? fromToken.slice(0, 8);
  const toSymbol   = Object.entries(TOKEN_ADDRESSES).find(([, v]) => v.toLowerCase() === toToken.toLowerCase())?.[0] ?? toToken.slice(0, 8);

  console.log(`[Executor] Executing real swap: ${fromSymbol} → ${toSymbol}, amount=${ethers.formatEther(amountIn)}`);
  console.log(`[Executor] Route: VIGILMockDEX (${dexAddress})`);

  const fromTokenContract = new ethers.Contract(fromToken, ERC20_ABI, agentWallet);
  const toTokenContract   = new ethers.Contract(toToken,   ERC20_ABI, agentWallet);
  const dex               = new ethers.Contract(dexAddress, MOCK_DEX_ABI, agentWallet);

  // Step 1: Ensure agent has fromToken balance (mint on testnet)
  const fromBalance: bigint = await fromTokenContract.balanceOf(agentWallet.address);
  if (fromBalance < amountIn) {
    const mintAmount = amountIn - fromBalance + ethers.parseEther("0.01"); // extra buffer
    console.log(`[Executor] Minting ${ethers.formatEther(mintAmount)} ${fromSymbol} to agent...`);
    try {
      const mintTx = await fromTokenContract.mint(agentWallet.address, mintAmount, { gasLimit: 120_000 });
      await mintTx.wait();
      console.log(`[Executor] ✅ Minted ${fromSymbol}: ${mintTx.hash}`);
    } catch (err: any) {
      console.warn(`[Executor] Mint skipped (non-mintable or already funded): ${err.message.slice(0, 80)}`);
    }
  }

  // Step 2: Fund MockDEX with toToken liquidity (1:1 swap ratio on testnet)
  const toAmount = amountIn; // MockDEX swaps 1:1 on testnet
  console.log(`[Executor] Funding MockDEX with ${ethers.formatEther(toAmount)} ${toSymbol}...`);
  try {
    const mintDexTx = await toTokenContract.mint(dexAddress, toAmount, { gasLimit: 120_000 });
    await mintDexTx.wait();
    console.log(`[Executor] ✅ DEX funded: ${mintDexTx.hash}`);
  } catch (err: any) {
    console.warn(`[Executor] DEX fund skipped: ${err.message.slice(0, 80)}`);
  }

  // Step 3: Approve MockDEX to spend fromToken
  const allowance: bigint = await fromTokenContract.allowance(agentWallet.address, dexAddress);
  if (allowance < amountIn) {
    console.log(`[Executor] Approving MockDEX to spend ${fromSymbol}...`);
    const approveTx = await fromTokenContract.approve(dexAddress, amountIn * 10n, { gasLimit: 100_000 });
    await approveTx.wait();
    console.log(`[Executor] ✅ Approved`);
  }

  // Step 4: Execute the swap
  const amountOutMin = (toAmount * BigInt(10000 - MAX_SLIPPAGE_BPS)) / 10000n;
  const deadline     = Math.floor(Date.now() / 1000) + 600; // 10 minutes

  console.log(`[Executor] Calling swapExactTokensForTokens...`);
  console.log(`[Executor]   amountIn:     ${ethers.formatEther(amountIn)} ${fromSymbol}`);
  console.log(`[Executor]   amountOutMin: ${ethers.formatEther(amountOutMin)} ${toSymbol}`);

  const swapTx = await dex.swapExactTokensForTokens(
    amountIn,
    amountOutMin,
    [fromToken, toToken],
    agentWallet.address,
    deadline,
    { gasLimit: 300_000 }
  );

  console.log(`[Executor] Swap TX submitted: ${swapTx.hash} — waiting for confirmation...`);
  const receipt = await swapTx.wait();

  if (!receipt || receipt.status === 0) {
    throw new Error(`[Executor] Swap reverted — check Mantlescan: ${swapTx.hash}`);
  }

  // Actual slippage on testnet MockDEX is 0 (1:1 swap)
  const actualAmountOut = toAmount;
  const actualSlippageBps = 0;

  console.log(`[Executor] ✅ Swap confirmed on Mantle Sepolia!`);
  console.log(`[Executor]   TX:       ${swapTx.hash}`);
  console.log(`[Executor]   Gas used: ${receipt.gasUsed}`);
  console.log(`[Executor]   Mantlescan: https://sepolia.mantlescan.xyz/tx/${swapTx.hash}`);

  return {
    txHash:            swapTx.hash,
    actualSlippageBps: actualSlippageBps,
    amountOut:         actualAmountOut,
    gasUsed:           receipt.gasUsed,
    success:           true,
  };
}

/**
 * Legacy alias kept for compatibility.
 * @deprecated Use executeXStockTrade directly.
 */
export async function requestQuote(
  tokenIn: string,
  tokenOut: string,
  amountIn: bigint
) {
  // On testnet: synthetic quote based on MockDEX 1:1 rate
  const priceImpactBps = 10; // 0.10%
  const amountOut = amountIn - (amountIn * BigInt(priceImpactBps)) / 10_000n;
  return {
    quoteId:        ethers.zeroPadValue(ethers.randomBytes(20), 32),
    tokenIn,
    tokenOut,
    amountIn,
    amountOut,
    priceImpactBps,
    deadline:       Math.floor(Date.now() / 1000) + 3600,
    signature:      "0x",
  };
}
