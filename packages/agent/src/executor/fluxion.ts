import axios from "axios";
import { ethers } from "ethers";
import { agentWallet, FLUXION_XCHANGE_ADDRESS, FLUXION_RFQ_ENDPOINT } from "../config";
import { FluxionQuote, ExecutionResult } from "../types";

/**
 * VIGIL Executor — Fluxion xChange Atomic RFQ
 * Implements the two-step requestQuote → swapWithQuote pipeline.
 *
 * Fluxion xChange activated May 7, 2026. VIGIL is purpose-built around it.
 * Execution requires FLUXION_RFQ_ENDPOINT and FLUXION_XCHANGE_ADDRESS in .env.
 *
 * Slippage cap: 0.40% (40 bps) — hardcoded and enforced both here and in
 * VIGILVault.sol. Any quote exceeding this cap is rejected before submission.
 *
 * Docs: https://docs.fluxion.network
 */

const FLUXION_XCHANGE_ABI = [
  "function swapWithQuote(bytes32 quoteId, uint256 minAmountOut, uint256 deadline, bytes calldata signature) external returns (uint256 amountOut)",
  "function getQuote(bytes32 quoteId) external view returns (address tokenIn, address tokenOut, uint256 amountIn, uint256 amountOut, uint256 priceImpactBps, uint256 deadline)",
];

const ERC20_ABI = [
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function allowance(address owner, address spender) external view returns (uint256)",
];

const MAX_SLIPPAGE_BPS = 40; // 0.40% — mirrors VIGILVault.MAX_SLIPPAGE_BPS constant

/**
 * Step 1: Request a live signed quote from Fluxion RFQ endpoint.
 * Throws if endpoint is not configured — no fallback to fake quotes.
 */
export async function requestQuote(
  tokenIn: string,
  tokenOut: string,
  amountIn: bigint,
  slippageTolerance = MAX_SLIPPAGE_BPS
): Promise<FluxionQuote> {
  if (!FLUXION_RFQ_ENDPOINT) {
    throw new Error("[Fluxion] FLUXION_RFQ_ENDPOINT is not set in .env — cannot request quote");
  }

  console.log(`[Fluxion] Requesting live RFQ quote: ${amountIn} ${tokenIn} → ${tokenOut}`);

  const response = await axios.post(
    `${FLUXION_RFQ_ENDPOINT}/quote`,
    {
      tokenIn,
      tokenOut,
      amountIn: amountIn.toString(),
      slippageTolerance,
      recipient: agentWallet.address,
    },
    {
      headers: {
        "Content-Type": "application/json",
        "X-Agent-Address": agentWallet.address,
      },
      timeout: 5_000,
    }
  );

  const data = response.data;

  const quote: FluxionQuote = {
    quoteId: data.quoteId,
    tokenIn: data.tokenIn,
    tokenOut: data.tokenOut,
    amountIn: BigInt(data.amountIn),
    amountOut: BigInt(data.amountOut),
    priceImpactBps: data.priceImpactBps,
    deadline: data.deadline,
    signature: data.signature,
  };

  // Hard guardrail: reject any quote that exceeds the slippage cap
  if (quote.priceImpactBps > MAX_SLIPPAGE_BPS) {
    throw new Error(
      `[Fluxion] SLIPPAGE_EXCEEDED: live quote priceImpact ${quote.priceImpactBps} bps > ${MAX_SLIPPAGE_BPS} bps cap — trade aborted`
    );
  }

  console.log(
    `[Fluxion] Live quote received: amountOut=${quote.amountOut}, priceImpact=${quote.priceImpactBps} bps, deadline=${new Date(quote.deadline * 1000).toISOString()}`
  );

  return quote;
}

/**
 * Step 2: Execute a live atomic swap using the signed Fluxion quote.
 * Approve ERC20 spend if needed, then call swapWithQuote on-chain.
 * Throws if FLUXION_XCHANGE_ADDRESS is not configured.
 */
export async function executeXStockTrade(
  fromToken: string,
  toToken: string,
  amountIn: bigint
): Promise<ExecutionResult> {
  if (!FLUXION_XCHANGE_ADDRESS) {
    throw new Error("[Fluxion] FLUXION_XCHANGE_ADDRESS is not set in .env — cannot execute trade");
  }

  console.log(`[Fluxion] Executing live Atomic RFQ swap: ${fromToken} → ${toToken}, amount=${amountIn}`);

  // Step 1: Get live quote
  const quote = await requestQuote(fromToken, toToken, amountIn);

  // Validate quote hasn't expired (race condition guard)
  const nowSec = Math.floor(Date.now() / 1000);
  if (nowSec > quote.deadline) {
    throw new Error(`[Fluxion] QUOTE_EXPIRED: deadline was ${quote.deadline}, now is ${nowSec}`);
  }

  // Re-validate slippage before on-chain submission
  if (quote.priceImpactBps > MAX_SLIPPAGE_BPS) {
    throw new Error(`[Fluxion] SLIPPAGE_EXCEEDED on execution: ${quote.priceImpactBps} bps > ${MAX_SLIPPAGE_BPS} bps`);
  }

  // Step 2: Approve fromToken spend if needed
  try {
    const erc20 = new ethers.Contract(fromToken, ERC20_ABI, agentWallet);
    const allowance: bigint = await erc20.allowance(agentWallet.address, FLUXION_XCHANGE_ADDRESS);
    if (allowance < amountIn) {
      console.log(`[Fluxion] Approving ${fromToken} spend...`);
      const approveTx = await erc20.approve(FLUXION_XCHANGE_ADDRESS, amountIn, { gasLimit: 80_000 });
      await approveTx.wait();
      console.log(`[Fluxion] Approval confirmed`);
    }
  } catch (err: any) {
    throw new Error(`[Fluxion] ERC20 approval failed: ${err.message}`);
  }

  // Step 3: Execute the swap on-chain
  const xchange = new ethers.Contract(FLUXION_XCHANGE_ADDRESS, FLUXION_XCHANGE_ABI, agentWallet);
  const minAmountOut = (quote.amountOut * BigInt(10000 - MAX_SLIPPAGE_BPS)) / 10000n;

  try {
    const tx = await xchange.swapWithQuote(
      quote.quoteId,
      minAmountOut,
      quote.deadline,
      quote.signature,
      { gasLimit: 250_000 }
    );

    console.log(`[Fluxion] Swap TX submitted: ${tx.hash} — waiting for confirmation...`);
    const receipt = await tx.wait();

    if (!receipt || receipt.status === 0) {
      throw new Error(`[Fluxion] Swap transaction reverted — check Mantlescan: ${tx.hash}`);
    }

    // Parse actual amountOut from SwapExecuted event if available, fallback to quote
    let actualAmountOut = quote.amountOut;
    const swapEvent = receipt.logs.find((log: any) => log.topics[0] === ethers.id("SwapExecuted(address,address,uint256,uint256)"));
    if (swapEvent) {
      const decoded = ethers.AbiCoder.defaultAbiCoder().decode(["uint256", "uint256"], swapEvent.data);
      actualAmountOut = decoded[1] as bigint;
    }

    const actualSlippageBps = Number((quote.amountIn - actualAmountOut) * 10000n / quote.amountIn);

    console.log(`[Fluxion] ✅ Swap confirmed: ${tx.hash}`);
    console.log(`[Fluxion]   amountOut=${actualAmountOut}, slippage=${actualSlippageBps} bps, gasUsed=${receipt.gasUsed}`);

    return {
      txHash: tx.hash,
      actualSlippageBps: Math.max(0, actualSlippageBps),
      amountOut: actualAmountOut,
      gasUsed: receipt.gasUsed,
      success: true,
    };
  } catch (err: any) {
    // Propagate real on-chain errors — do not swallow or fabricate results
    throw new Error(`[Fluxion] On-chain swap failed: ${err.message}`);
  }
}
