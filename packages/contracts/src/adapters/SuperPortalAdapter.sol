// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

/// @title SuperPortalAdapter
/// @notice Adapter for the Mantle Super Portal cross-chain bridge.
///         VIGIL uses this to route $MNT from Mantle L2 → Solana for Byreal CLMM positions.
///         Launched January 27, 2026. Built with Bybit and Byreal.
/// @dev Called by the agent runtime when Byreal CLMM APR exceeds mETH APR + 0.8%
interface IMantelSuperPortal {
    /// @notice Bridge tokens cross-chain
    /// @param token The token to bridge (MNT address on Mantle)
    /// @param amount Amount to bridge (18 decimals for MNT)
    /// @param destinationChainId Destination chain identifier
    /// @param recipient Recipient address on destination chain (bytes32 for cross-chain)
    /// @param deadline Transaction deadline (Unix timestamp)
    function bridge(
        address token,
        uint256 amount,
        uint32 destinationChainId,
        bytes32 recipient,
        uint256 deadline
    ) external payable returns (bytes32 transferId);

    /// @notice Check bridge status
    function getTransferStatus(bytes32 transferId) external view returns (uint8 status);
}

contract SuperPortalAdapter {

    /// @notice Solana chain ID as used by Mantle Super Portal
    uint32 public constant SOLANA_CHAIN_ID = 1399811149;

    /// @notice Minimum bridge amount (prevent dust attacks)
    uint256 public constant MIN_BRIDGE_AMOUNT = 10 ether; // 10 MNT minimum

    /// @notice Maximum bridge amount per transaction (risk limit)
    uint256 public constant MAX_BRIDGE_AMOUNT = 10_000 ether; // 10,000 MNT max

    event BridgeInitiated(
        bytes32 indexed transferId,
        address indexed token,
        uint256 amount,
        bytes32 recipient,
        uint32 destinationChainId
    );

    error BridgeAmountTooLow(uint256 amount, uint256 minimum);
    error BridgeAmountTooHigh(uint256 amount, uint256 maximum);
    error DeadlineTooShort(uint256 deadline, uint256 minimum);

    /// @notice Initiate a cross-chain bridge of MNT to Solana for Byreal CLMM
    /// @param superPortalAddress The Super Portal contract address (from env)
    /// @param mntToken The MNT token address on Mantle
    /// @param amount Amount of MNT to bridge (18 decimals)
    /// @param solanaRecipient The agent's Solana wallet address as bytes32
    function bridgeToSolana(
        address superPortalAddress,
        address mntToken,
        uint256 amount,
        bytes32 solanaRecipient
    ) external returns (bytes32 transferId) {
        if (amount < MIN_BRIDGE_AMOUNT) revert BridgeAmountTooLow(amount, MIN_BRIDGE_AMOUNT);
        if (amount > MAX_BRIDGE_AMOUNT) revert BridgeAmountTooHigh(amount, MAX_BRIDGE_AMOUNT);

        uint256 deadline = block.timestamp + 1800; // 30 minute deadline
        if (deadline < block.timestamp + 900) revert DeadlineTooShort(deadline, block.timestamp + 900);

        // Approve and bridge
        (bool approveSuccess, ) = mntToken.call(
            abi.encodeWithSignature("approve(address,uint256)", superPortalAddress, amount)
        );
        require(approveSuccess, "SuperPortalAdapter: approve failed");

        IMantelSuperPortal portal = IMantelSuperPortal(superPortalAddress);
        transferId = portal.bridge(
            mntToken,
            amount,
            SOLANA_CHAIN_ID,
            solanaRecipient,
            deadline
        );

        emit BridgeInitiated(transferId, mntToken, amount, solanaRecipient, SOLANA_CHAIN_ID);
    }

    /// @notice Check the status of a pending bridge transfer
    function checkBridgeStatus(
        address superPortalAddress,
        bytes32 transferId
    ) external view returns (uint8 status) {
        return IMantelSuperPortal(superPortalAddress).getTransferStatus(transferId);
    }
}
