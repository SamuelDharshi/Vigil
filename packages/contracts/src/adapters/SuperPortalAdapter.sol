// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

contract SuperPortalAdapter {
    function bridgeToSolana(
        address superPortalAddress,
        address mntToken,
        uint256 amount,
        bytes32 solanaRecipient
    ) external returns (bytes32 transferId) {
        revert("SuperPortal bridge not available on Mantle Sepolia");
    }

    function checkBridgeStatus(
        address superPortalAddress,
        bytes32 transferId
    ) external view returns (uint8 status) {
        revert("SuperPortal bridge not available on Mantle Sepolia");
    }
}
