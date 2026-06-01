// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

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

    event BridgeInitiated(
        bytes32 indexed transferId,
        address token,
        uint256 amount,
        uint32 destinationChainId,
        bytes32 recipient
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

        for (uint256 i = 0; i < _allowedTokens.length; i++) {
            _whitelistToken(_allowedTokens[i], _priceFeeds[i]);
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // ADMIN FUNCTIONS (owner only — not callable by agent)
    // ─────────────────────────────────────────────────────────────────────────

    /// @notice Set the ERC-8004 agent token ID after identity mint
    function setAgentId(uint256 _agentId) external onlyOwner {
        erc8004AgentId = _agentId;
        emit AgentIdSet(_agentId);
    }

    /// @notice Set the VIGILLedger contract address for event logging
    function setLedger(address _ledger) external onlyOwner {
        require(_ledger != address(0), "VIGIL: zero ledger");
        vigilLedger = _ledger;
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

    /// @notice Validates a proposed decision against all hardcoded guardrails.
    ///         Called off-chain before submitting execution, and re-checked on-chain inside executeRebalance.
    /// @param fromToken The token being sold
    /// @param toToken The token being bought
    /// @param amount The USD-denominated amount of the trade (6 decimals)
    /// @param slippageBps The maximum slippage in basis points accepted for this trade
    /// @return valid Whether the decision passes all guardrails
    /// @return reason Human-readable rejection reason if !valid
    function validateDecision(
        address fromToken,
        address toToken,
        uint256 amount,
        uint256 slippageBps
    ) public view returns (bool valid, string memory reason) {
        // 1. Token whitelist check
        if (!allowedTokens[fromToken]) return (false, "FROM_TOKEN_NOT_WHITELISTED");
        if (!allowedTokens[toToken]) return (false, "TO_TOKEN_NOT_WHITELISTED");

        // 2. Self-trade check
        if (fromToken == toToken) return (false, "SAME_TOKEN");

        // 3. Zero amount check
        if (amount == 0) return (false, "ZERO_AMOUNT");

        // 4. Slippage cap check
        if (slippageBps > MAX_SLIPPAGE_BPS) return (false, "SLIPPAGE_EXCEEDED");

        // 5. Single transaction size cap
        if (amount > MAX_SINGLE_TX_USD) return (false, "AMOUNT_EXCEEDS_CAP");

        // 6. Epoch allocation cap (reset epoch if needed)
        uint256 effectiveEpochUsed = epochAllocationUsed;
        if (block.number >= epochStartBlock + EPOCH_BLOCKS) {
            effectiveEpochUsed = 0; // epoch has reset
        }

        uint256 totalValue = getTotalValue();
        if (totalValue > 0) {
            uint256 epochCap = (totalValue * MAX_EPOCH_ALLOCATION) / 10000;
            if (effectiveEpochUsed + amount > epochCap) {
                return (false, "EPOCH_ALLOCATION_EXCEEDED");
            }
        }

        // 7. Gas reservoir minimum
        if (gasReservoir < GAS_RESERVOIR_MIN) return (false, "GAS_RESERVOIR_LOW");

        return (true, "");
    }

    // ─────────────────────────────────────────────────────────────────────────
    // EXECUTION (agent only, after guardrail pass)
    // ─────────────────────────────────────────────────────────────────────────

    /// @notice Records an executed rebalancing decision on-chain.
    ///         Re-validates all guardrails atomically — the agent cannot bypass them.
    /// @param fromToken Token sold
    /// @param toToken Token bought  
    /// @param amount USD-denominated trade size (6 decimals)
    /// @param slippageBps Actual slippage achieved
    /// @param executionData Encoded Fluxion or DEX execution calldata (for hash)
    function executeRebalance(
        address fromToken,
        address toToken,
        uint256 amount,
        uint256 slippageBps,
        bytes calldata executionData
    ) external onlyAgent nonReentrant {
        // Re-validate guardrails atomically (agent cannot skip this)
        (bool valid, string memory reason) = validateDecision(fromToken, toToken, amount, slippageBps);

        if (!valid) {
            emit GuardrailRejected(reason, fromToken, toToken, amount);
            revert(reason);
        }

        // Reset epoch if needed
        if (block.number >= epochStartBlock + EPOCH_BLOCKS) {
            epochAllocationUsed = 0;
            epochStartBlock = block.number;
            emit EpochReset(block.number);
        }

        // Update epoch tracking
        epochAllocationUsed += amount;

        // Update allocation tracking
        // Note: actual token movement happens via Fluxion/DEX — this tracks the intent
        totalDecisions++;

        bytes32 executionHash = keccak256(executionData);
        emit DecisionExecuted(fromToken, toToken, amount, slippageBps, executionHash);
    }

    /// @notice Records a skipped decision (confidence below threshold, etc.)
    /// @param reason The skip reason string (e.g., "CONFIDENCE_TOO_LOW", "GAS_LOW")
    /// @param confidence The confidence score × 10000 (e.g., 4500 = 45.00%)
    function recordSkip(string calldata reason, uint256 confidence) external onlyAgent {
        totalSkipped++;
        emit DecisionSkipped(reason, confidence);
    }

    /// @notice Mock Fluxion RFQ swap execution inside the vault for testnet.
    function swapWithQuote(
        bytes32 quoteId,
        uint256 minAmountOut,
        uint256 deadline,
        bytes calldata signature
    ) external returns (uint256 amountOut) {
        emit SwapExecuted(msg.sender, msg.sender, 0, minAmountOut);
        return minAmountOut;
    }

    /// @notice Mock Mantle Super Portal bridge routing inside the vault for testnet.
    function bridge(
        address token,
        uint256 amount,
        uint32 destinationChainId,
        bytes32 recipient,
        uint256 deadline
    ) external payable returns (bytes32 transferId) {
        transferId = keccak256(abi.encodePacked(token, amount, destinationChainId, recipient, deadline, block.timestamp));
        emit BridgeInitiated(transferId, token, amount, destinationChainId, recipient);
        return transferId;
    }

    /// @notice Mock status check for cross-chain transfer.
    function getTransferStatus(bytes32 transferId) external view returns (uint8 status) {
        return 1; // 1 = COMPLETED
    }

    // ─────────────────────────────────────────────────────────────────────────
    // ALLOCATION TRACKING
    // ─────────────────────────────────────────────────────────────────────────

    /// @notice Update the recorded allocation for a token (called by agent after rebalance)
    /// @param token The token address
    /// @param newBps New allocation in basis points (10000 = 100%)
    function updateAllocation(address token, uint256 newBps) external onlyAgent {
        require(allowedTokens[token], "VIGIL: token not whitelisted");
        allocation[token] = newBps;
        emit AllocationUpdated(token, newBps);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // GAS RESERVOIR — Self-sustaining gas economy
    // ─────────────────────────────────────────────────────────────────────────

    /// @notice Fund the gas reservoir from yield claims.
    ///         Called automatically by the yield claiming logic every 6 hours.
    /// @param mntAmount Amount of MNT to add to the reservoir
    function fundGasReservoir(uint256 mntAmount) external nonReentrant {
        require(mntAmount > 0, "VIGIL: zero amount");
        bool success = IERC20(MNT_TOKEN).transferFrom(msg.sender, address(this), mntAmount);
        require(success, "VIGIL: MNT transfer failed");
        gasReservoir += mntAmount;
        emit GasReservoirFunded(mntAmount, gasReservoir);
    }

    /// @notice Consume MNT from the gas reservoir for transaction fees.
    ///         Only callable by the agent.
    /// @param mntAmount Amount of MNT to consume
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

    /// @notice Compute the total portfolio value in USD (6 decimals) using Chainlink feeds.
    ///         Iterates all whitelisted tokens and sums balance × price.
    function getTotalValue() public view returns (uint256 totalUSD) {
        for (uint256 i = 0; i < whitelistedTokenList.length; i++) {
            address token = whitelistedTokenList[i];
            address feed = priceFeeds[token];
            if (feed == address(0)) continue;

            uint256 balance = IERC20(token).balanceOf(address(this));
            if (balance == 0) continue;

            int256 price = _getChainlinkPrice(feed);
            if (price <= 0) continue;

            // Chainlink prices have 8 decimals, token balances have 18
            // Result in 6 decimals (USD)
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

    /// @notice Read the latest price from a Chainlink aggregator
    function _getChainlinkPrice(address feed) internal view returns (int256 price) {
        // AggregatorV3Interface.latestRoundData()
        // Selector: 0xfeaf968c
        (bool success, bytes memory data) = feed.staticcall(
            abi.encodeWithSelector(0xfeaf968c)
        );
        if (!success || data.length < 160) return 0;
        (, price, , , ) = abi.decode(data, (uint80, int256, uint256, uint256, uint80));
    }

    // ─────────────────────────────────────────────────────────────────────────
    // VIEW HELPERS
    // ─────────────────────────────────────────────────────────────────────────

    /// @notice Returns current epoch allocation remaining capacity (USD, 6 decimals)
    function epochAllocationRemaining() external view returns (uint256) {
        uint256 totalValue = getTotalValue();
        if (totalValue == 0) return 0;
        uint256 epochCap = (totalValue * MAX_EPOCH_ALLOCATION) / 10000;

        if (block.number >= epochStartBlock + EPOCH_BLOCKS) {
            return epochCap; // epoch reset
        }

        return epochCap > epochAllocationUsed ? epochCap - epochAllocationUsed : 0;
    }

    /// @notice Returns blocks until next epoch reset
    function blocksUntilEpochReset() external view returns (uint256) {
        uint256 epochEnd = epochStartBlock + EPOCH_BLOCKS;
        if (block.number >= epochEnd) return 0;
        return epochEnd - block.number;
    }

    /// @notice Returns all whitelisted token addresses
    function getWhitelistedTokens() external view returns (address[] memory) {
        return whitelistedTokenList;
    }
}
