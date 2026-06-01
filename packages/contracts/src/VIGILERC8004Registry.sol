// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

/// @title VIGILERC8004Registry
/// @notice Implements the ERC-8004 Identity, Reputation, and ZK Validation registry interfaces.
///         Enables trustless agent lifecycle management on-chain.
contract VIGILERC8004Registry {

    // ─── IDENTITY REGISTRY STATE ─────────────────────────────────────────────
    uint256 private _nextAgentId = 1;
    mapping(uint256 => string) private _agentCards;
    mapping(uint256 => address) private _owners;

    event Transfer(address indexed from, address indexed to, uint256 indexed tokenId);
    event AgentCardUpdated(uint256 indexed tokenId, string cid);

    // ─── REPUTATION REGISTRY STATE ───────────────────────────────────────────
    struct Feedback {
        bytes32 taskId;
        int128 score;
        uint8 decimals;
        string metadataCid;
    }

    mapping(uint256 => Feedback[]) private _reputationFeedback;
    event FeedbackSubmitted(uint256 indexed agentId, bytes32 taskId, int128 score, string metadataCid);

    // ─── VALIDATION REGISTRY STATE ───────────────────────────────────────────
    struct ValidationRecord {
        bytes32 proofHash;
        address verifier;
        uint256 timestamp;
    }

    mapping(uint256 => ValidationRecord[]) private _validationProofs;
    event ValidationSubmitted(uint256 indexed agentId, bytes32 proofHash, address verifier);

    // ─── IDENTITY METHODS ────────────────────────────────────────────────────

    function mintIdentity(string calldata agentCardCid) external returns (uint256 tokenId) {
        tokenId = _nextAgentId++;
        _agentCards[tokenId] = agentCardCid;
        _owners[tokenId] = msg.sender;

        emit Transfer(address(0), msg.sender, tokenId);
        emit AgentCardUpdated(tokenId, agentCardCid);
        return tokenId;
    }

    function setAgentCard(uint256 tokenId, string calldata cid) external {
        require(_owners[tokenId] == msg.sender, "ERC8004: not owner");
        _agentCards[tokenId] = cid;
        emit AgentCardUpdated(tokenId, cid);
    }

    function getAgentCard(uint256 tokenId) external view returns (string memory cid) {
        return _agentCards[tokenId];
    }

    function ownerOf(uint256 tokenId) external view returns (address) {
        address owner = _owners[tokenId];
        require(owner != address(0), "ERC8004: invalid token");
        return owner;
    }

    // ─── REPUTATION METHODS ──────────────────────────────────────────────────

    function submitFeedback(
        uint256 agentId,
        bytes32 taskId,
        int128 score,
        uint8 decimals,
        string calldata metadataCid
    ) external {
        _reputationFeedback[agentId].push(Feedback({
            taskId: taskId,
            score: score,
            decimals: decimals,
            metadataCid: metadataCid
        }));

        emit FeedbackSubmitted(agentId, taskId, score, metadataCid);
    }

    function getReputation(uint256 agentId) external view returns (int128 score, uint256 totalFeedback) {
        Feedback[] storage list = _reputationFeedback[agentId];
        totalFeedback = list.length;
        if (totalFeedback == 0) {
            return (0, 0);
        }

        int256 sum = 0;
        for (uint256 i = 0; i < totalFeedback; i++) {
            sum += list[i].score;
        }

        score = int128(sum / int256(totalFeedback));
        return (score, totalFeedback);
    }

    // ─── VALIDATION METHODS ──────────────────────────────────────────────────

    function submitValidation(
        uint256 agentId,
        bytes calldata zkProof,
        address verifierAddress
    ) external {
        bytes32 proofHash = keccak256(zkProof);
        _validationProofs[agentId].push(ValidationRecord({
            proofHash: proofHash,
            verifier: verifierAddress,
            timestamp: block.timestamp
        }));

        emit ValidationSubmitted(agentId, proofHash, verifierAddress);
    }

    function getValidation(
        uint256 agentId,
        uint256 index
    ) external view returns (bytes32 proofHash, address verifier, uint256 timestamp) {
        require(index < _validationProofs[agentId].length, "ERC8004: out of bounds");
        ValidationRecord storage record = _validationProofs[agentId][index];
        return (record.proofHash, record.verifier, record.timestamp);
    }

    // ─── HELPER VIEW METHODS ──────────────────────────────────────────────────

    function getValidationCount(uint256 agentId) external view returns (uint256) {
        return _validationProofs[agentId].length;
    }
}
