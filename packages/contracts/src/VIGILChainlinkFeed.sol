// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

/// @title VIGILChainlinkFeed
/// @notice Standard Chainlink AggregatorV3 price feed contract for the VIGIL token universe.
contract VIGILChainlinkFeed {
    int256 private _price;
    uint8 private _decimals = 8; // Chainlink standard
    uint80 private _roundId = 1;
    uint256 private _updatedAt;

    constructor(int256 initialPrice) {
        _price = initialPrice;
        _updatedAt = block.timestamp;
    }

    /// @notice Matches AggregatorV3Interface.latestRoundData() selector (0xfeaf968c)
    function latestRoundData()
        external
        view
        returns (
            uint80 roundId,
            int256 answer,
            uint256 startedAt,
            uint256 updatedAt,
            uint80 answeredInRound
        )
    {
        return (_roundId, _price, _updatedAt, _updatedAt, _roundId);
    }

    function decimals() external view returns (uint8) {
        return _decimals;
    }

    function setPrice(int256 newPrice) external {
        _price = newPrice;
        _updatedAt = block.timestamp;
        _roundId++;
    }

    function description() external pure returns (string memory) {
        return "VIGIL Price Feed";
    }
}
