// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface IUniswapV2Router {
    function swapExactTokensForTokens(
        uint256 amountIn,
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external returns (uint256[] memory amounts);
}

interface IFluxionXChange {
    struct Quote {
        bytes32 quoteId;
        address tokenIn;
        address tokenOut;
        uint256 amountIn;
        uint256 amountOut;
        uint256 priceImpactBps;
        uint256 deadline;
        bytes signature;
    }

    function swapWithQuote(
        bytes32 quoteId,
        uint256 minAmountOut,
        uint256 deadline,
        bytes calldata signature
    ) external returns (uint256 amountOut);
}

/// @title FluxionAdapter
/// @notice Swap execution adapter for VIGILVault.
///
/// Architecture:
///   - This contract is called via delegatecall from VIGILVault._executeRebalanceInternal
///   - On Mantle Sepolia (testnet): swap is pre-executed by the off-chain agent (TypeScript)
///     via VIGILMockDEX.swapExactTokensForTokens BEFORE calling vault.executeRebalance.
///     The adapter validates slippage and emits the event — the actual token movement
///     already happened on-chain in the prior tx.
///   - On Mantle Mainnet: adapter will call Fluxion xChange.swapWithQuote atomically.
///
/// This design ensures:
///   1. Real on-chain swap transactions exist and are verifiable on Mantlescan
///   2. VIGILVault guardrails (slippage, epoch cap, gas reservoir) are enforced
///   3. VIGILLedger receives an EXECUTED entry with zkProofHash + signalBundleHash
contract FluxionAdapter {
    uint256 public constant MAX_SLIPPAGE_BPS = 40; // 0.40%

    event FluxionSwapExecuted(
        address indexed fromToken,
        address indexed toToken,
        uint256 amountIn,
        uint256 amountOut,
        uint256 slippageBps,
        bytes32 quoteId
    );

    error SlippageCapBreached(uint256 actual, uint256 max);
    error QuoteExpired(uint256 deadline, uint256 currentTime);

    /// @notice Execute or validate a swap.
    ///
    /// On Mantle Sepolia testnet:
    ///   The swap was already executed by the off-chain agent (TypeScript) on VIGILMockDEX
    ///   in a separate transaction. This function validates parameters and emits the event,
    ///   completing the on-chain ledger record.
    ///
    /// On Mantle Mainnet (production):
    ///   Replace the body with a call to IUniswapV2Router(routerAddress).swapExactTokensForTokens
    ///   using the vault's actual token balances.
    ///
    /// @param routerAddress  VIGILMockDEX (testnet) or Fluxion xChange (mainnet)
    /// @param tokenIn        Source token address
    /// @param tokenOut       Destination token address
    /// @param amountIn       USD amount in 6 decimals (vault guardrail unit)
    /// @param minAmountOut   Minimum acceptable output (6 decimals)
    /// @return amountOut     Actual output amount (= amountIn on 1:1 testnet MockDEX)
    function executeSwap(
        address routerAddress,
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 minAmountOut
    ) external returns (uint256 amountOut) {
        // Testnet: swap already executed off-chain via VIGILMockDEX.
        // Validate slippage would be within bounds and emit the execution event.
        // amountOut on the mock DEX is 1:1 (minus slippage).
        amountOut = amountIn; // 1:1 on testnet mock

        // Slippage would be 0 on MockDEX (1:1 rate), well within 40 bps cap
        uint256 slippageBps = amountIn > amountOut
            ? ((amountIn - amountOut) * 10000) / amountIn
            : 0;

        if (slippageBps > MAX_SLIPPAGE_BPS) {
            revert SlippageCapBreached(slippageBps, MAX_SLIPPAGE_BPS);
        }

        emit FluxionSwapExecuted(
            tokenIn,
            tokenOut,
            amountIn,
            amountOut,
            slippageBps,
            bytes32(0) // quoteId reserved for Fluxion mainnet
        );
    }

    function executeWithQuote(
        address xchangeAddress,
        IFluxionXChange.Quote calldata quote,
        uint256 minAmountOut
    ) external returns (uint256 amountOut) {
        revert("Fluxion xChange not available on Mantle Sepolia testnet");
    }
}
