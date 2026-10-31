// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

/// @title VIGILReasoningAnchor
/// @notice Append-only anchors for off-chain practice-trade decision records.
///         Stores hashes only. It holds no funds and cannot trade.
contract VIGILReasoningAnchor {
    address public immutable agent;
    uint256 public totalAnchors;
    mapping(bytes32 => uint256) public anchoredAt;

    event DecisionAnchored(bytes32 indexed recordHash, bytes32 indexed snapshotId, uint8 action, uint256 sequence);

    error NotAgent();
    error AlreadyAnchored(bytes32 recordHash);

    constructor(address _agent) {
        require(_agent != address(0), "VIGILReasoningAnchor: zero agent");
        agent = _agent;
    }

    /// @param action 0=BUY 1=EXIT 2=HOLD 3=NO_TRADE
    function anchor(bytes32 recordHash, bytes32 snapshotId, uint8 action) external {
        if (msg.sender != agent) revert NotAgent();
        if (anchoredAt[recordHash] != 0) revert AlreadyAnchored(recordHash);
        anchoredAt[recordHash] = block.timestamp;
        emit DecisionAnchored(recordHash, snapshotId, action, totalAnchors++);
    }
}
