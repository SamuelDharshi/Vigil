// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./VIGILLedger.sol";

/// @title VIGILVault
/// @notice Primary on-chain guardrail contract for the VIGIL autonomous portfolio agent.
///         Enforces hardcoded safety limits that the AI cannot override.
/// @dev Deployed on Mantle Sepolia for development, Mantle Mainnet for demo.
contract VIGILVault is Ownable, ReentrancyGuard {

    // ─────────────────────────────────────────────────────────────────────────
    // GUARDRAILS — Hardcoded, non-configurable by any external call
    // ─────────────────────────────────────────────────────────────────────────

    /// @notice Maximum allowed slippage per trade: 0.40% (40 basis points)
    uint256 public constant MAX_SLIPPAGE_BPS = 40;

    /// @notice Maximum portfolio reallocation per epoch: 15% (1500 basis points)
    uint256 public constant MAX_EPOCH_ALLOCATION = 1500;

    /// @notice Maximum single transaction size: $10,000 in USD terms (6 decimals)
    uint256 public constant MAX_SINGLE_TX_USD = 10_000e6;

    /// @notice Minimum MNT required in gas reservoir before execution is allowed
    uint256 public constant GAS_RESERVOIR_MIN = 0.5 ether;

    /// @notice Epoch duration in blocks (~6 hours at ~2s block time on Mantle)
    uint256 public constant EPOCH_BLOCKS = 10_800;

    // ─────────────────────────────────────────────────────────────────────────
    // STATE
    // ─────────────────────────────────────────────────────────────────────────

    /// @notice The autonomous agent wallet — only address allowed to call execute functions
    address public immutable AGENT_WALLET;

    /// @notice MNT token address on Mantle
    address public immutable MNT_TOKEN;

    /// @notice ERC-8004 agent token ID, set after identity mint
    uint256 public erc8004AgentId;

    /// @notice Address of the deployed VIGILLedger contract
    address public vigilLedger;

    /// @notice MNT held in the gas reservoir — funded by yield micro-fees
    uint256 public gasReservoir;

    /// @notice Mapping from token address to whether agent is allowed to trade it
    mapping(address => bool) public allowedTokens;

    /// @notice List of all whitelisted token addresses (for iteration)
    address[] public whitelistedTokenList;

    /// @notice Chainlink oracle feed address for each token (token → feed)
    mapping(address => address) public priceFeeds;

    /// @notice Current portfolio allocation in basis points (10000 = 100%)
    mapping(address => uint256) public allocation;

    /// @notice Block number when the current epoch started
    uint256 public epochStartBlock;

    /// @notice Total USD value reallocated within the current epoch
    uint256 public epochAllocationUsed;

    /// @notice Total number of decisions executed (for stats)
    uint256 public totalDecisions;

    /// @notice Total number of decisions skipped (for stats)
    uint256 public totalSkipped;

    // ─────────────────────────────────────────────────────────────────────────
    // ADAPTER STATE & ADAPTERS
    // ─────────────────────────────────────────────────────────────────────────
    address public fluxionAdapter;
    address public superPortalAdapter;
    address public ledgerContract;
    bool public xStocksEnabled;  // false on Sepolia, true on Mainnet
    uint256 public immutable deployedAt;

    address public mETH_TOKEN;
    address public USDY_TOKEN;

    // ─────────────────────────────────────────────────────────────────────────
    // EVENTS
    // ─────────────────────────────────────────────────────────────────────────

    event DecisionExecuted(
        address indexed fromToken,
        address indexed toToken,
        uint256 amount,
        uint256 slippageBps,
        bytes32 executionHash
    );

    event GuardrailRejected(
        string reason,
        address fromToken,
        address toToken,
        uint256 amount
    );

    event DecisionSkipped(
        string reason,
        uint256 confidence
    );

    event SwapExecuted(
        address indexed tokenIn,
        address indexed tokenOut,
        uint256 amountIn,
        uint256 amountOut
    );

    event GasReservoirFunded(uint256 amount, uint256 newTotal);
    event GasConsumed(uint256 amount, uint256 remaining);
    event EpochReset(uint256 newEpochStartBlock);
    event AgentIdSet(uint256 agentId);
    event LedgerSet(address ledgerAddress);
    event TokenWhitelisted(address token, address priceFeed);
    event AllocationUpdated(address token, uint256 newBps);

    // ─────────────────────────────────────────────────────────────────────────
    // ERRORS
    // ─────────────────────────────────────────────────────────────────────────

    error NotAgent();
    error TokenNotWhitelisted(address token);
    error SlippageExceeded(uint256 actual, uint256 max);
    error AmountExceedsCap(uint256 amount, uint256 cap);
    error EpochAllocationExceeded(uint256 used, uint256 cap);
    error GasReservoirTooLow(uint256 current, uint256 minimum);
    error InvalidAllocation();
    error ZeroAmount();

    // ─────────────────────────────────────────────────────────────────────────
    // MODIFIERS
    // ─────────────────────────────────────────────────────────────────────────

    modifier onlyAgent() {
        if (msg.sender != AGENT_WALLET) revert NotAgent();
        _;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // CONSTRUCTOR
    // ─────────────────────────────────────────────────────────────────────────

    constructor(
        address _agentWallet,
        address _mntToken,
        address[] memory _allowedTokens,
        address[] memory _priceFeeds
    ) Ownable(msg.sender) {
        require(_agentWallet != address(0), "VIGIL: zero agent wallet");
        require(_mntToken != address(0), "VIGIL: zero MNT token");
        require(_allowedTokens.length == _priceFeeds.length, "VIGIL: length mismatch");

        AGENT_WALLET = _agentWallet;
        MNT_TOKEN = _mntToken;
        epochStartBlock = block.number;
        deployedAt = block.timestamp;

        if (_allowedTokens.length > 0) mETH_TOKEN = _allowedTokens[0];
        if (_allowedTokens.length > 1) USDY_TOKEN = _allowedTokens[1];

        for (uint256 i = 0; i < _allowedTokens.length; i++) {
            _whitelistToken(_allowedTokens[i], _priceFeeds[i]);
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // ADMIN FUNCTIONS (owner only — not callable by agent)
    // ─────────────────────────────────────────────────────────────────────────

    function setFluxionAdapter(address _a) external onlyOwner {
        fluxionAdapter = _a;
    }

    function setSuperPortalAdapter(address _a) external onlyOwner {
        superPortalAdapter = _a;
    }

    function setLedgerContract(address _l) external onlyOwner {
        ledgerContract = _l;
        vigilLedger = _l;
        emit LedgerSet(_l);
    }

    function setXStocksEnabled(bool _enabled) external onlyOwner {
        xStocksEnabled = _enabled;
    }

    /// @notice Set the ERC-8004 agent token ID after identity mint
    function setAgentId(uint256 _agentId) external onlyOwner {
        erc8004AgentId = _agentId;
        emit AgentIdSet(_agentId);
    }

    /// @notice Set the VIGILLedger contract address for event logging
    function setLedger(address _ledger) external onlyOwner {
        require(_ledger != address(0), "VIGIL: zero ledger");
        vigilLedger = _ledger;
        ledgerContract = _ledger;
        emit LedgerSet(_ledger);
    }

    /// @notice Add a new token to the whitelist with its Chainlink price feed
    function whitelistToken(address token, address priceFeed) external onlyOwner {
        _whitelistToken(token, priceFeed);
    }

    /// @notice Update the Chainlink price feed for an existing token
    function updatePriceFeed(address token, address newFeed) external onlyOwner {
        require(allowedTokens[token], "VIGIL: token not whitelisted");
        priceFeeds[token] = newFeed;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // GUARDRAIL VALIDATION — Pure view, no state changes
    // ─────────────────────────────────────────────────────────────────────────

    function validateDecision(
        address fromToken,
        address toToken,
        uint256 amount,
        uint256 slippageBps
    ) public view returns (bool valid, string memory reason) {
        if (!allowedTokens[fromToken]) return (false, "FROM_TOKEN_NOT_WHITELISTED");
        if (!allowedTokens[toToken]) return (false, "TO_TOKEN_NOT_WHITELISTED");
        if (fromToken == toToken) return (false, "SAME_TOKEN");
        if (amount == 0) return (false, "ZERO_AMOUNT");
        if (slippageBps > MAX_SLIPPAGE_BPS) return (false, "SLIPPAGE_EXCEEDED");
        if (amount > MAX_SINGLE_TX_USD) return (false, "AMOUNT_EXCEEDS_CAP");

        uint256 effectiveEpochUsed = epochAllocationUsed;
        if (block.number >= epochStartBlock + EPOCH_BLOCKS) {
            effectiveEpochUsed = 0;
        }

        uint256 totalValue = getTotalValue();
        if (totalValue > 0) {
            uint256 epochCap = (totalValue * MAX_EPOCH_ALLOCATION) / 10000;
            if (effectiveEpochUsed + amount > epochCap) {
                return (false, "EPOCH_ALLOCATION_EXCEEDED");
            }
        }

        if (gasReservoir < GAS_RESERVOIR_MIN) return (false, "GAS_RESERVOIR_LOW");

        return (true, "");
    }

    // ─────────────────────────────────────────────────────────────────────────
    // EXECUTION (agent only, after guardrail pass)
    // ─────────────────────────────────────────────────────────────────────────

    function executeRebalance(
        address fromToken,
        address toToken,
        uint256 amount,
        uint256 slippageBps,
        bytes calldata executionData
    ) external onlyAgent nonReentrant {
        _executeRebalanceInternal(
            fromToken,
            toToken,
            amount,
            slippageBps,
            bytes32(0),
            bytes32(0),
            0,
            "",
            executionData
        );
    }

    function executeRebalance(
        address fromToken,
        address toToken,
        uint256 amount,
        uint256 slippageBps,
        bytes32 zkProofHash,
        bytes32 signalBundleHash,
        uint256 confidence,
        string calldata reasoning,
        bytes calldata executionData
    ) external onlyAgent nonReentrant {
        _executeRebalanceInternal(
            fromToken,
            toToken,
            amount,
            slippageBps,
            zkProofHash,
            signalBundleHash,
            confidence,
            reasoning,
            executionData
        );
    }

    function _executeRebalanceInternal(
        address fromToken,
        address toToken,
        uint256 amount,
        uint256 slippageBps,
        bytes32 zkProofHash,
        bytes32 signalBundleHash,
        uint256 confidence,
        string memory reasoning,
        bytes memory executionData
    ) internal {
        (bool valid, string memory reason) = validateDecision(fromToken, toToken, amount, slippageBps);

        if (!valid) {
            emit GuardrailRejected(reason, fromToken, toToken, amount);
            revert(reason);
        }

        if (block.number >= epochStartBlock + EPOCH_BLOCKS) {
            epochAllocationUsed = 0;
            epochStartBlock = block.number;
            emit EpochReset(block.number);
        }

        // Check if trade involves xStocks
        bool isFromXStock = (fromToken != MNT_TOKEN && fromToken != mETH_TOKEN && fromToken != USDY_TOKEN);
        bool isToXStock = (toToken != MNT_TOKEN && toToken != mETH_TOKEN && toToken != USDY_TOKEN);
        if ((isFromXStock || isToXStock) && !xStocksEnabled) {
            revert("xStocks trading not available on this network");
        }

        epochAllocationUsed += amount;
        totalDecisions++;

        bytes32 executionHash = keccak256(executionData);

        if ((fromToken == mETH_TOKEN && toToken == USDY_TOKEN) || (fromToken == USDY_TOKEN && toToken == mETH_TOKEN)) {
            (address router, uint256 tokenAmountIn, uint256 minAmountOut) = abi.decode(executionData, (address, uint256, uint256));
            
            (bool success, bytes memory result) = fluxionAdapter.delegatecall(
                abi.encodeWithSignature(
                    "executeSwap(address,address,address,uint256,uint256)",
                    router,
                    fromToken,
                    toToken,
                    tokenAmountIn,
                    minAmountOut
                )
            );
            require(success, "Swap delegatecall failed");
            uint256 actualAmountOut = abi.decode(result, (uint256));
            emit SwapExecuted(fromToken, toToken, tokenAmountIn, actualAmountOut);
        }

        emit DecisionExecuted(fromToken, toToken, amount, slippageBps, executionHash);

        if (vigilLedger != address(0)) {
            VIGILLedger.LedgerEntry memory entry = VIGILLedger.LedgerEntry({
                timestamp: block.timestamp,
                agentId: erc8004AgentId,
                entryType: 1, // TYPE_EXECUTED
                fromToken: fromToken,
                toToken: toToken,
                amount: amount,
                confidence: confidence,
                slippageBps: slippageBps,
                txHash: bytes32(0),
                zkProofHash: zkProofHash,
                signalBundleHash: signalBundleHash,
                skipReason: "",
                reasoning: reasoning
            });
            VIGILLedger(vigilLedger).log(entry);
        }
    }

    function recordSkip(string calldata reason, uint256 confidence) external onlyAgent {
        _recordSkipInternal(reason, confidence, bytes32(0), bytes32(0), "");
    }

    function recordSkip(
        string calldata reason,
        uint256 confidence,
        bytes32 zkProofHash,
        bytes32 signalBundleHash,
        string calldata reasoning
    ) external onlyAgent {
        _recordSkipInternal(reason, confidence, zkProofHash, signalBundleHash, reasoning);
    }

    function _recordSkipInternal(
        string memory reason,
        uint256 confidence,
        bytes32 zkProofHash,
        bytes32 signalBundleHash,
        string memory reasoning
    ) internal {
        totalSkipped++;
        emit DecisionSkipped(reason, confidence);

        if (vigilLedger != address(0)) {
            VIGILLedger.LedgerEntry memory entry = VIGILLedger.LedgerEntry({
                timestamp: block.timestamp,
                agentId: erc8004AgentId,
                entryType: 0, // TYPE_SKIPPED
                fromToken: address(0),
                toToken: address(0),
                amount: 0,
                confidence: confidence,
                slippageBps: 0,
                txHash: bytes32(0),
                zkProofHash: zkProofHash,
                signalBundleHash: signalBundleHash,
                skipReason: reason,
                reasoning: reasoning
            });
            VIGILLedger(vigilLedger).log(entry);
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // ALLOCATION TRACKING
    // ─────────────────────────────────────────────────────────────────────────

    function updateAllocation(address token, uint256 newBps) external onlyAgent {
        require(allowedTokens[token], "VIGIL: token not whitelisted");
        allocation[token] = newBps;
        emit AllocationUpdated(token, newBps);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // GAS RESERVOIR — Self-sustaining gas economy
    // ─────────────────────────────────────────────────────────────────────────

    function fundGasReservoir(uint256 mntAmount) external nonReentrant {
        require(mntAmount > 0, "VIGIL: zero amount");
        bool success = IERC20(MNT_TOKEN).transferFrom(msg.sender, address(this), mntAmount);
        require(success, "VIGIL: MNT transfer failed");
        gasReservoir += mntAmount;
        emit GasReservoirFunded(mntAmount, gasReservoir);
    }

    function consumeGas(uint256 mntAmount) external onlyAgent nonReentrant {
        if (gasReservoir < mntAmount) revert GasReservoirTooLow(gasReservoir, mntAmount);
        gasReservoir -= mntAmount;
        bool success = IERC20(MNT_TOKEN).transfer(AGENT_WALLET, mntAmount);
        require(success, "VIGIL: MNT transfer failed");
        emit GasConsumed(mntAmount, gasReservoir);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // PORTFOLIO VALUATION — Chainlink-powered
    // ─────────────────────────────────────────────────────────────────────────

    function getTotalValue() public view returns (uint256 totalUSD) {
        for (uint256 i = 0; i < whitelistedTokenList.length; i++) {
            address token = whitelistedTokenList[i];
            address feed = priceFeeds[token];
            if (feed == address(0)) continue;

            uint256 balance = IERC20(token).balanceOf(address(this));
            if (balance == 0) continue;

            int256 price = _getChainlinkPrice(feed);
            if (price <= 0) continue;

            totalUSD += (balance * uint256(price)) / 1e20;
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // INTERNAL HELPERS
    // ─────────────────────────────────────────────────────────────────────────

    function _whitelistToken(address token, address priceFeed) internal {
        require(token != address(0), "VIGIL: zero token");
        if (!allowedTokens[token]) {
            allowedTokens[token] = true;
            whitelistedTokenList.push(token);
        }
        priceFeeds[token] = priceFeed;
        emit TokenWhitelisted(token, priceFeed);
    }

    function _getChainlinkPrice(address feed) internal view returns (int256 price) {
        (bool success, bytes memory data) = feed.staticcall(
            abi.encodeWithSelector(0xfeaf968c)
        );
        if (!success || data.length < 160) return 0;
        (, price, , , ) = abi.decode(data, (uint80, int256, uint256, uint256, uint80));
    }

    // ─────────────────────────────────────────────────────────────────────────
    // VIEW HELPERS
    // ─────────────────────────────────────────────────────────────────────────

    function epochAllocationRemaining() external view returns (uint256) {
        uint256 totalValue = getTotalValue();
        if (totalValue == 0) return 0;
        uint256 epochCap = (totalValue * MAX_EPOCH_ALLOCATION) / 10000;

        if (block.number >= epochStartBlock + EPOCH_BLOCKS) {
            return epochCap;
        }

        return epochCap > epochAllocationUsed ? epochCap - epochAllocationUsed : 0;
    }

    function blocksUntilEpochReset() external view returns (uint256) {
        uint256 epochEnd = epochStartBlock + EPOCH_BLOCKS;
        if (block.number >= epochEnd) return 0;
        return epochEnd - block.number;
    }

    function getWhitelistedTokens() external view returns (address[] memory) {
        return whitelistedTokenList;
    }
}
