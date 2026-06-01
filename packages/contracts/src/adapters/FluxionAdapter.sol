// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import "../VIGILVault.sol";

/// @title FluxionAdapter
/// @notice Execution adapter for Fluxion xChange Atomic RFQ trades.
///         VIGIL uses this to execute xStocks trades with issuer-direct pricing.
///         Implements the two-step requestQuote → swapWithQuote flow.
/// @dev Called via delegatecall from VIGILVault during rebalancing execution.
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

contract FluxionAdapter {

    /// @notice Hardcoded slippage cap — cannot be overridden by the agent
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

    /// @notice Execute an xStocks trade via Fluxion xChange Atomic RFQ.
    ///         Quote is pre-fetched off-chain and validated here.
    /// @param xchangeAddress The Fluxion xChange contract address (from env)
    /// @param quote The pre-fetched and signed RFQ quote
    /// @param minAmountOut The minimum acceptable output amount (slippage protection)
    function executeWithQuote(
        address xchangeAddress,
        IFluxionXChange.Quote calldata quote,
        uint256 minAmountOut
    ) external returns (uint256 amountOut) {
        // Validate quote hasn't expired
        if (block.timestamp > quote.deadline) {
            revert QuoteExpired(quote.deadline, block.timestamp);
        }

        // Validate slippage on the quote itself
        if (quote.priceImpactBps > MAX_SLIPPAGE_BPS) {
            revert SlippageCapBreached(quote.priceImpactBps, MAX_SLIPPAGE_BPS);
        }

        IFluxionXChange xchange = IFluxionXChange(xchangeAddress);
        amountOut = xchange.swapWithQuote(
            quote.quoteId,
            minAmountOut,
            quote.deadline,
            quote.signature
        );

        emit FluxionSwapExecuted(
            quote.tokenIn,
            quote.tokenOut,
            quote.amountIn,
            amountOut,
            quote.priceImpactBps,
            quote.quoteId
        );
    }
}
