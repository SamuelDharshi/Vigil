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

    // Using VIGILMockDEX as testnet swap venue — production will use Fluxion Atomic RFQ
    function executeSwap(
        address routerAddress,
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 minAmountOut
    ) external returns (uint256 amountOut) {
        IERC20(tokenIn).approve(routerAddress, amountIn);

        address[] memory path = new address[](2);
        path[0] = tokenIn;
        path[1] = tokenOut;

        uint256[] memory amounts = IUniswapV2Router(routerAddress).swapExactTokensForTokens(
            amountIn,
            minAmountOut,
            path,
            address(this),
            block.timestamp + 600
        );

        amountOut = amounts[amounts.length - 1];

        emit FluxionSwapExecuted(
            tokenIn,
            tokenOut,
            amountIn,
            amountOut,
            0,
            bytes32(0)
        );
    }

    function executeWithQuote(
        address xchangeAddress,
        IFluxionXChange.Quote calldata quote,
        uint256 minAmountOut
    ) external returns (uint256 amountOut) {
        revert("Fluxion xChange not available on Mantle Sepolia - cannot execute xStocks trade");
    }
}
