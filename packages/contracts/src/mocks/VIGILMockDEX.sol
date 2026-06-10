// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract VIGILMockDEX {
    event SwapExecuted(
        address indexed sender,
        address indexed tokenIn,
        address indexed tokenOut,
        uint256 amountIn,
        uint256 amountOut
    );

    function swapExactTokensForTokens(
        uint256 amountIn,
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external returns (uint256[] memory amounts) {
        require(path.length >= 2, "VIGILMockDEX: invalid path");
        require(deadline >= block.timestamp, "VIGILMockDEX: expired");
        
        address tokenIn = path[0];
        address tokenOut = path[path.length - 1];
        
        // Transfer tokenIn from caller
        bool successIn = IERC20(tokenIn).transferFrom(msg.sender, address(this), amountIn);
        require(successIn, "VIGILMockDEX: transferFrom failed");
        
        // Calculate amountOut (assume 1:1 swap rate or standard test rate)
        uint256 amountOut = amountOutMin > 0 ? amountOutMin : amountIn;
        
        // Transfer tokenOut to recipient
        bool successOut = IERC20(tokenOut).transfer(to, amountOut);
        require(successOut, "VIGILMockDEX: transfer failed");
        
        amounts = new uint256[](path.length);
        amounts[0] = amountIn;
        amounts[path.length - 1] = amountOut;

        emit SwapExecuted(msg.sender, tokenIn, tokenOut, amountIn, amountOut);
    }
}
