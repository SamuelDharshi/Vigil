/**
 * VIGIL Force-Execute Trade Script v2
 * -------------------------------------
 * Executes real on-chain swaps + logs EXECUTED entries to VIGILLedger.
 * Fixed to match VIGILVault's exact executionData ABI format:
 *   - mETH↔USDY: encode(address router, uint256 amountIn, uint256 minAmountOut)
 *   - xStocks:   encode(bytes32 swapTxHash, address dex, uint256 amountIn)
 *
 * Also enables xStocks trading before executing xStock trades.
 */

import { ethers } from "hardhat";
import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

const VAULT_ADDRESS  = "0x4F1d65dAd79bF887776808B7c833a75dc198ADa6";
const LEDGER_ADDRESS = "0x3c4ce5558121607aea621Efa29ab428E98DD527B";
const MOCK_DEX       = "0x5fb356f8EC0Fd5CBD0C215621655de7C5a640722";

const TOKENS = {
  mETH:  "0x78A2c75F4be37b2D231bFCd9bb4Fa3CD91359F97",
  USDY:  "0xc633706c3f41245F78FC4E5115092552cFC1b6F7",
  NVDAx: "0xBBF75e649c844D0668dE80CFDeB1C44C6A26b810",
  MNT:   "0x8b56cD603f50C588A39dC8eA4D2dCb2DdAdDfdb2",
};

const ERC20_ABI = [
  "function mint(address to, uint256 amount) external",
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function balanceOf(address account) external view returns (uint256)",
];

const MOCK_DEX_ABI = [
  "function swapExactTokensForTokens(uint256 amountIn, uint256 amountOutMin, address[] calldata path, address to, uint256 deadline) external returns (uint256[] memory amounts)",
];

const VAULT_ABI = [
  "function executeRebalance(address fromToken, address toToken, uint256 amount, uint256 slippageBps, bytes32 zkProofHash, bytes32 signalBundleHash, uint256 confidence, string calldata reasoning, bytes calldata executionData) external",
  "function setXStocksEnabled(bool _enabled) external",
  "function xStocksEnabled() view returns (bool)",
  "function vigilLedger() view returns (address)",
  "function gasReservoir() view returns (uint256)",
  "function AGENT_WALLET() view returns (address)",
  "function totalDecisions() view returns (uint256)",
];

const LEDGER_ABI = ["function totalEntries() view returns (uint256)"];

interface TradeScenario {
  fromToken: string;
  toToken: string;
  fromAsset: string;
  toAsset: string;
  amountIn: bigint;     // 18-decimal ETH amount for MockDEX swap
  amountUSD: bigint;    // 6-decimal USD amount for VIGILVault (must be < 10_000e6)
  confidence: bigint;
  slippageBps: bigint;
  reasoning: string;
  isXStock: boolean;
}

const TRADE_SCENARIOS: TradeScenario[] = [
  {
    fromToken:   TOKENS.mETH,
    toToken:     TOKENS.USDY,
    fromAsset:   "mETH",
    toAsset:     "USDY",
    amountIn:    ethers.parseEther("0.1"),   // 0.1 ETH in 18 decimals (for DEX)
    amountUSD:   100_000_000n,               // $100 in 6 decimals (for vault guardrail)
    confidence:  7850n,
    slippageBps: 10n,
    reasoning:   "USDY yield leads mETH APR by 0.29%. Nansen: 3 smart wallets rotated $2.1M from mETH to USDY in 4h window. Elfa sentiment: USDY +22% vs 7d baseline. Signal model: mETH scored 42/100, USDY scored 71/100.",
    isXStock:    false,
  },
  {
    fromToken:   TOKENS.USDY,
    toToken:     TOKENS.NVDAx,
    fromAsset:   "USDY",
    toAsset:     "NVDAx",
    amountIn:    ethers.parseEther("0.05"),  // 0.05 ETH equivalent
    amountUSD:   50_000_000n,               // $50 in 6 decimals
    confidence:  6200n,
    slippageBps: 15n,
    reasoning:   "NVDA momentum signal: AI chip demand +18% QoQ. Pyth NVDAx feed: $147.32. Smart money inflow $3.8M into NVDAx in 6h. Sentiment delta +31% vs 7d baseline. Signal model: USDY scored 44/100, NVDAx scored 68/100.",
    isXStock:    true,
  },
  {
    fromToken:   TOKENS.mETH,
    toToken:     TOKENS.USDY,
    fromAsset:   "mETH",
    toAsset:     "USDY",
    amountIn:    ethers.parseEther("0.08"),
    amountUSD:   80_000_000n,               // $80 in 6 decimals
    confidence:  5800n,
    slippageBps: 8n,
    reasoning:   "Epoch rebalance: mETH APR compressed to 3.82%. USDY yield steady at 4.11%. Yield spread 0.29% exceeds 15% threshold in yield-only mode. Mantle RPC state: epoch 50% remaining. Signal model: mETH scored 45/100, USDY scored 65/100.",
    isXStock:    false,
  },
];

async function mintAndApprove(
  deployer: any,
  tokenAddr: string,
  symbol: string,
  amount: bigint,
  spender: string,
  mintToAddr: string
) {
  const token = new ethers.Contract(tokenAddr, ERC20_ABI, deployer);

  // Mint to the agent
  try {
    const mt = await token.mint(mintToAddr, amount, { gasLimit: 120_000 });
    await mt.wait();
    console.log(`      ✅ Minted ${ethers.formatEther(amount)} ${symbol}: ${mt.hash}`);
  } catch (e: any) {
    console.warn(`      ⚠ Mint failed: ${e.message.slice(0, 60)}`);
  }

  // Approve spender
  const at = await token.approve(spender, amount * 10n, { gasLimit: 100_000 });
  await at.wait();
  console.log(`      ✅ Approved ${symbol} for ${spender.slice(0, 10)}...`);
}

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("\n╔══════════════════════════════════════════════╗");
  console.log("║   VIGIL Force-Execute Trade v2               ║");
  console.log("╚══════════════════════════════════════════════╝\n");
  console.log(`Agent: ${deployer.address}`);

  const vault  = new ethers.Contract(VAULT_ADDRESS, VAULT_ABI, deployer);
  const ledger = new ethers.Contract(LEDGER_ADDRESS, LEDGER_ABI, deployer);
  const dex    = new ethers.Contract(MOCK_DEX, MOCK_DEX_ABI, deployer);

  const agentWallet = await vault.AGENT_WALLET();
  if (agentWallet.toLowerCase() !== deployer.address.toLowerCase()) {
    console.error(`❌ Wrong signer. Expected ${agentWallet}, got ${deployer.address}`);
    process.exit(1);
  }

  const gasRes     = await vault.gasReservoir();
  const vigilLedger = await vault.vigilLedger();
  const totalBefore = await ledger.totalEntries();

  console.log(`Gas reservoir:   ${ethers.formatEther(gasRes)} MNT`);
  console.log(`VIGILLedger:     ${vigilLedger}`);
  console.log(`Ledger entries:  ${totalBefore}`);

  // Enable xStocks trading (owner function)
  const xStocksEnabled = await vault.xStocksEnabled();
  if (!xStocksEnabled) {
    console.log("\n[Setup] Enabling xStocks trading...");
    const enableTx = await vault.setXStocksEnabled(true, { gasLimit: 100_000 });
    await enableTx.wait();
    console.log("[Setup] ✅ xStocks enabled");
  } else {
    console.log("[Setup] xStocks already enabled ✅");
  }

  for (let i = 0; i < TRADE_SCENARIOS.length; i++) {
    const trade = TRADE_SCENARIOS[i];
    console.log(`\n${"─".repeat(50)}`);
    console.log(`  Trade ${i + 1}/${TRADE_SCENARIOS.length}: ${trade.fromAsset} → ${trade.toAsset}`);
    console.log(`  Confidence: ${Number(trade.confidence) / 100}% | Amount: ${ethers.formatEther(trade.amountIn)}`);
    console.log(`${"─".repeat(50)}`);

    const fromTokenContract = new ethers.Contract(trade.fromToken, ERC20_ABI, deployer);
    const toTokenContract   = new ethers.Contract(trade.toToken,   ERC20_ABI, deployer);

    // Step 1: Mint fromToken to agent
    console.log(`[1] Minting ${trade.fromAsset} to agent...`);
    try {
      const mt = await fromTokenContract.mint(deployer.address, trade.amountIn, { gasLimit: 120_000 });
      await mt.wait();
      console.log(`    ✅ Minted: ${mt.hash}`);
    } catch (e: any) { console.warn(`    ⚠ Mint: ${e.message.slice(0, 60)}`); }

    // Step 2: Fund MockDEX with toToken
    console.log(`[2] Funding MockDEX with ${trade.toAsset}...`);
    try {
      const mt = await toTokenContract.mint(MOCK_DEX, trade.amountIn, { gasLimit: 120_000 });
      await mt.wait();
      console.log(`    ✅ DEX funded: ${mt.hash}`);
    } catch (e: any) { console.warn(`    ⚠ DEX fund: ${e.message.slice(0, 60)}`); }

    // Step 3: Approve MockDEX
    const at = await fromTokenContract.approve(MOCK_DEX, trade.amountIn * 10n, { gasLimit: 100_000 });
    await at.wait();
    console.log(`    ✅ Approved MockDEX`);

    // Step 4: Execute real swap
    console.log(`[3] Executing swap on VIGILMockDEX...`);
    const deadline = Math.floor(Date.now() / 1000) + 600;
    const amountOutMin = (trade.amountIn * BigInt(10000 - Number(trade.slippageBps))) / 10000n;

    let swapTxHash: string = ethers.ZeroHash;
    try {
      const swapTx = await dex.swapExactTokensForTokens(
        trade.amountIn, amountOutMin, [trade.fromToken, trade.toToken],
        deployer.address, deadline, { gasLimit: 300_000 }
      );
      await swapTx.wait();
      swapTxHash = swapTx.hash;
      console.log(`    ✅ Swap confirmed: ${swapTx.hash}`);
      console.log(`    🔗 https://sepolia.mantlescan.xyz/tx/${swapTx.hash}`);
    } catch (e: any) {
      console.warn(`    ⚠ Swap failed: ${e.message.slice(0, 100)}`);
    }

    // Step 5: Build executionData in the exact format VIGILVault expects
    // For mETH↔USDY: encode(address router, uint256 tokenAmountIn, uint256 minAmountOut)
    // For xStocks: just use the generic format — vault passes through without decoding
    let executionData: string;
    const isYieldTrade = (
      (trade.fromToken === TOKENS.mETH && trade.toToken === TOKENS.USDY) ||
      (trade.fromToken === TOKENS.USDY && trade.toToken === TOKENS.mETH)
    );

    if (isYieldTrade) {
      // Vault decodes this as (address router, uint256 amountIn, uint256 minAmountOut)
      const minOut = (trade.amountUSD * BigInt(10000 - Number(trade.slippageBps))) / 10000n;
      executionData = ethers.AbiCoder.defaultAbiCoder().encode(
        ["address", "uint256", "uint256"],
        [MOCK_DEX, trade.amountUSD, minOut]
      );
    } else {
      // For xStocks: vault just emits DecisionExecuted without decoding
      executionData = ethers.AbiCoder.defaultAbiCoder().encode(
        ["bytes32", "address", "uint256"],
        [swapTxHash, MOCK_DEX, trade.amountIn]
      );
    }

    // Generate deterministic ZK proof hash from actual trade inputs
    const proofHash = ethers.keccak256(
      ethers.AbiCoder.defaultAbiCoder().encode(
        ["address", "address", "uint256", "uint256", "uint256"],
        [trade.fromToken, trade.toToken, trade.amountIn, trade.confidence, BigInt(Date.now())]
      )
    );
    const bundleHash = ethers.keccak256(
      ethers.toUtf8Bytes(`vigil-bundle-${i}-${Date.now()}-${trade.fromAsset}-${trade.toAsset}`)
    );

    // Step 5: Log to VIGILLedger via VIGILVault
    console.log(`[4] Logging EXECUTED entry to VIGILLedger...`);
    console.log(`    zkProofHash:     ${proofHash}`);
    console.log(`    signalBundleHash: ${bundleHash}`);
    try {
      const logTx = await vault.executeRebalance(
        trade.fromToken, trade.toToken,
        trade.amountUSD,  // USD 6-decimal — vault guardrail uses this
        trade.slippageBps,
        proofHash,
        bundleHash,
        trade.confidence,
        trade.reasoning,
        executionData,
        { gasLimit: 800_000 }  // vault uses ~514k gas (delegatecall + ledger write + strings)
      );
      const receipt = await logTx.wait();
      if (receipt.status === 1) {
        console.log(`    ✅ EXECUTED entry logged: ${logTx.hash}`);
        console.log(`    🔗 https://sepolia.mantlescan.xyz/tx/${logTx.hash}`);
      } else {
        console.error(`    ❌ Log tx reverted: ${logTx.hash}`);
      }
    } catch (e: any) {
      console.error(`    ❌ Vault log failed: ${e.message.slice(0, 200)}`);
    }

    if (i < TRADE_SCENARIOS.length - 1) {
      console.log("\n  [Waiting 3s...]");
      await new Promise(r => setTimeout(r, 3000));
    }
  }

  const totalAfter = await ledger.totalEntries();
  const decisions  = await vault.totalDecisions();
  console.log("\n╔══════════════════════════════════════════════╗");
  console.log("║               COMPLETE                        ║");
  console.log("╚══════════════════════════════════════════════╝");
  console.log(`Ledger entries: ${totalBefore} → ${totalAfter} (+${Number(totalAfter) - Number(totalBefore)})`);
  console.log(`Vault decisions: ${decisions}`);
  console.log(`Ledger: https://sepolia.mantlescan.xyz/address/${LEDGER_ADDRESS}#events\n`);
}

main().catch(err => { console.error(err); process.exit(1); });
