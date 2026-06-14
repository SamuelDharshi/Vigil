// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

/// @title VIGILLedger
/// @notice Append-only, immutable on-chain ledger recording every VIGIL agent decision.
///         Once logged, entries cannot be modified or deleted. This is the cryptographic
///         proof of VIGIL's 14-day autonomous track record.
/// @dev Only the authorized VIGILVault contract can write entries.
contract VIGILLedger {

    // ─────────────────────────────────────────────────────────────────────────
    // TYPES
    // ─────────────────────────────────────────────────────────────────────────

    /// @notice Entry type enum
    /// 0 = SKIPPED — agent decided not to act (confidence too low, guardrail blocked)
    /// 1 = EXECUTED — trade executed successfully on Fluxion or Mantle DEX
    /// 2 = CROSS_CHAIN — capital routed via Super Portal → Byreal CLMM
    /// 3 = CLMM_REBALANCED — existing Byreal position rebalanced or closed
    uint8 public constant TYPE_SKIPPED = 0;
    uint8 public constant TYPE_EXECUTED = 1;
    uint8 public constant TYPE_CROSS_CHAIN = 2;
    uint8 public constant TYPE_CLMM_REBALANCED = 3;

    /// @notice A single immutable decision record
    struct LedgerEntry {
        uint256 timestamp;          // Unix timestamp of decision
        uint256 agentId;            // ERC-8004 token ID of the agent
        uint8 entryType;            // 0=SKIPPED 1=EXECUTED 2=CROSS_CHAIN 3=CLMM_REBALANCED
        address fromToken;          // Source token (address(0) for SKIPPED)
        address toToken;            // Destination token (address(0) for SKIPPED)
        uint256 amount;             // USD trade size (6 decimals, 0 for SKIPPED)
        uint256 confidence;         // Signal confidence × 10000 (e.g., 7900 = 79.00%)
        uint256 slippageBps;        // Actual slippage achieved (basis points)
        bytes32 txHash;             // On-chain execution transaction hash
        bytes32 zkProofHash;        // Groth16 proof hash (bytes32 of encoded proof)
        bytes32 signalBundleHash;   // IPFS CID of raw SignalBundle (first 32 bytes)
        string skipReason;          // Human-readable skip reason (empty if EXECUTED)
        string reasoning;           // Human-readable decision reasoning (Instrument Serif in UI)
    }

    // ─────────────────────────────────────────────────────────────────────────
    // STATE
    // ─────────────────────────────────────────────────────────────────────────

    /// @notice The canonical append-only decision log. Never modified after push.
    LedgerEntry[] private _entries;

    /// @notice Only this address can append entries (set to VIGILVault at deployment)
    address public immutable AUTHORIZED_VAULT;

    /// @notice Mapping from txHash to entry ID for fast lookups
    mapping(bytes32 => uint256) public txHashToEntryId;

    /// @notice Mapping from zkProofHash to entry ID
    mapping(bytes32 => uint256) public zkProofToEntryId;

    // ─────────────────────────────────────────────────────────────────────────
    // EVENTS
    // ─────────────────────────────────────────────────────────────────────────

    /// @notice Emitted every time a new entry is appended
    /// @dev This is the primary event the Postgres indexer listens for
    event EntryLogged(
        uint256 indexed entryId,
        uint256 indexed agentId,
        uint8 indexed entryType,
        uint256 confidence,
        bytes32 zkProofHash,
        uint256 timestamp
    );

    /// @notice Emitted for EXECUTED entries with additional execution details
    event ExecutionLogged(
        uint256 indexed entryId,
        address fromToken,
        address toToken,
        uint256 amount,
        uint256 slippageBps,
        bytes32 txHash
    );

    // ─────────────────────────────────────────────────────────────────────────
    // ERRORS
    // ─────────────────────────────────────────────────────────────────────────

    error NotAuthorized();
    error InvalidEntryType();
    error EntryNotFound(uint256 entryId);

    // ─────────────────────────────────────────────────────────────────────────
    // CONSTRUCTOR
    // ─────────────────────────────────────────────────────────────────────────

    /// @param _authorizedVault The VIGILVault contract address — the only writer
    constructor(address _authorizedVault) {
        require(_authorizedVault != address(0), "VIGILLedger: zero vault");
        AUTHORIZED_VAULT = _authorizedVault;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // WRITE — Append-only. Only VIGILVault can log.
    // ─────────────────────────────────────────────────────────────────────────

    /// @notice Append a new immutable decision record to the ledger.
    ///         Called by VIGILVault after every decision cycle.
    /// @param entry The complete decision record to log
    /// @return entryId The index of the new entry (0-based)
    function log(LedgerEntry calldata entry) external returns (uint256 entryId) {
        if (msg.sender != AUTHORIZED_VAULT) revert NotAuthorized();
        if (entry.entryType > TYPE_CLMM_REBALANCED) revert InvalidEntryType();

        _entries.push(entry);
        entryId = _entries.length - 1;

        // Index lookups
        if (entry.txHash != bytes32(0)) {
            txHashToEntryId[entry.txHash] = entryId;
        }
        if (entry.zkProofHash != bytes32(0)) {
            zkProofToEntryId[entry.zkProofHash] = entryId;
        }

        emit EntryLogged(
            entryId,
            entry.agentId,
            entry.entryType,
            entry.confidence,
            entry.zkProofHash,
            entry.timestamp
        );

        // Emit additional execution details for non-skip entries
        if (entry.entryType != TYPE_SKIPPED) {
            emit ExecutionLogged(
                entryId,
                entry.fromToken,
                entry.toToken,
                entry.amount,
                entry.slippageBps,
                entry.txHash
            );
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // READ — Paginated access for frontend and indexer
    // ─────────────────────────────────────────────────────────────────────────

    /// @notice Returns the total number of entries in the ledger
    function totalEntries() external view returns (uint256) {
        return _entries.length;
    }

    /// @notice Returns a single entry by index
    function getEntry(uint256 entryId) external view returns (LedgerEntry memory) {
        if (entryId >= _entries.length) revert EntryNotFound(entryId);
        return _entries[entryId];
    }

    /// @notice Returns a paginated slice of entries (newest-first ordering for UI)
    /// @param from Start index (inclusive)
    /// @param count Maximum number of entries to return
    function getEntries(uint256 from, uint256 count)
        external
        view
        returns (LedgerEntry[] memory results)
    {
        uint256 total = _entries.length;
        if (from >= total) return new LedgerEntry[](0);

        uint256 end = from + count;
        if (end > total) end = total;

        results = new LedgerEntry[](end - from);
        for (uint256 i = from; i < end; i++) {
            results[i - from] = _entries[i];
        }
    }

    /// @notice Returns the last N entries (most recent decisions for War Room UI)
    /// @param count Number of recent entries to return
    function getRecentEntries(uint256 count)
        external
        view
        returns (LedgerEntry[] memory results)
    {
        uint256 total = _entries.length;
        if (total == 0) return new LedgerEntry[](0);

        uint256 actualCount = count > total ? total : count;
        results = new LedgerEntry[](actualCount);

        for (uint256 i = 0; i < actualCount; i++) {
            results[i] = _entries[total - 1 - i]; // reverse order: newest first
        }
    }

    /// @notice Returns only executed (non-skipped) entries in a range
    function getExecutedEntries(uint256 from, uint256 count)
        external
        view
        returns (LedgerEntry[] memory results, uint256 found)
    {
        uint256 total = _entries.length;
        LedgerEntry[] memory buffer = new LedgerEntry[](count);
        found = 0;

        for (uint256 i = from; i < total && found < count; i++) {
            if (_entries[i].entryType != TYPE_SKIPPED) {
                buffer[found] = _entries[i];
                found++;
            }
        }

        results = new LedgerEntry[](found);
        for (uint256 i = 0; i < found; i++) {
            results[i] = buffer[i];
        }
    }

    /// @notice Look up an entry by its transaction hash
    function getEntryByTxHash(bytes32 txHash)
        external
        view
        returns (LedgerEntry memory entry, bool exists)
    {
        uint256 id = txHashToEntryId[txHash];
        if (id == 0 && (
            _entries.length == 0 ||
            _entries[0].txHash != txHash
        )) {
            return (entry, false);
        }
        return (_entries[id], true);
    }

    /// @notice Returns aggregate stats for the War Room reputation panel
    function getStats() external view returns (
        uint256 total,
        uint256 executed,
        uint256 skipped,
        uint256 crossChain
    ) {
        total = _entries.length;
        for (uint256 i = 0; i < total; i++) {
            uint8 t = _entries[i].entryType;
            if (t == TYPE_SKIPPED) skipped++;
            else if (t == TYPE_CROSS_CHAIN || t == TYPE_CLMM_REBALANCED) crossChain++;
            else executed++;
        }
    }
}

