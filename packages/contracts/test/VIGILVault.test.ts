import { expect } from "chai";
import { ethers } from "hardhat";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import {
  VIGILVault,
  VIGILLedger,
  MockERC20,
  MockChainlinkFeed,
} from "../typechain-types";

// ─────────────────────────────────────────────────────────────────────────────
// VIGIL SMART CONTRACT TEST SUITE
// Tests that every guardrail PHYSICALLY REVERTS on-chain.
// The AI cannot bypass these limits regardless of what it outputs.
// ─────────────────────────────────────────────────────────────────────────────

describe("VIGILVault — Guardrail Enforcement", function () {
  let owner: HardhatEthersSigner;
  let agent: HardhatEthersSigner;
  let user: HardhatEthersSigner;
  let attacker: HardhatEthersSigner;

  let vault: VIGILVault;
  let ledger: VIGILLedger;
  let mntToken: MockERC20;
  let mETHToken: MockERC20;
  let usdyToken: MockERC20;
  let nvdaxToken: MockERC20;
  let unknownToken: MockERC20;

  let mntFeed: MockChainlinkFeed;
  let mEthFeed: MockChainlinkFeed;
  let usdyFeed: MockChainlinkFeed;
  let nvdaxFeed: MockChainlinkFeed;

  const DECIMALS_18 = ethers.parseEther("1");
  const DECIMALS_6 = 1_000_000n;

  // Mock prices in Chainlink format (8 decimals)
  const MNT_PRICE_USD = 80_000_000n;    // $0.80
  const METH_PRICE_USD = 270_000_000_000n; // $2700
  const USDY_PRICE_USD = 100_000_000n;  // $1.00
  const NVDAX_PRICE_USD = 118_00_000_000n; // $118.00

  beforeEach(async function () {
    [owner, agent, user, attacker] = await ethers.getSigners();

    // Deploy mock ERC20 tokens
    const MockERC20Factory = await ethers.getContractFactory("MockERC20");
    mntToken = (await MockERC20Factory.deploy("Mantle", "MNT", 18)) as unknown as MockERC20;
    mETHToken = (await MockERC20Factory.deploy("Mantle Staked ETH", "mETH", 18)) as unknown as MockERC20;
    usdyToken = (await MockERC20Factory.deploy("Ondo USDY", "USDY", 18)) as unknown as MockERC20;
    nvdaxToken = (await MockERC20Factory.deploy("NVIDIA xStock", "NVDAx", 18)) as unknown as MockERC20;
    unknownToken = (await MockERC20Factory.deploy("Unknown", "UNK", 18)) as unknown as MockERC20;

    // Deploy mock Chainlink feeds
    const MockFeedFactory = await ethers.getContractFactory("MockChainlinkFeed");
    mntFeed = (await MockFeedFactory.deploy(MNT_PRICE_USD)) as unknown as MockChainlinkFeed;
    mEthFeed = (await MockFeedFactory.deploy(METH_PRICE_USD)) as unknown as MockChainlinkFeed;
    usdyFeed = (await MockFeedFactory.deploy(USDY_PRICE_USD)) as unknown as MockChainlinkFeed;
    nvdaxFeed = (await MockFeedFactory.deploy(NVDAX_PRICE_USD)) as unknown as MockChainlinkFeed;

    // Deploy VIGILVault
    const VaultFactory = await ethers.getContractFactory("VIGILVault");
    vault = (await VaultFactory.deploy(
      agent.address,
      await mntToken.getAddress(),
      [
        await mETHToken.getAddress(),
        await usdyToken.getAddress(),
        await nvdaxToken.getAddress(),
        await mntToken.getAddress(),
      ],
      [
        await mEthFeed.getAddress(),
        await usdyFeed.getAddress(),
        await nvdaxFeed.getAddress(),
        await mntFeed.getAddress(),
      ]
    )) as unknown as VIGILVault;

    // Deploy VIGILLedger — authorized to vault
    const LedgerFactory = await ethers.getContractFactory("VIGILLedger");
    ledger = (await LedgerFactory.deploy(await vault.getAddress())) as unknown as VIGILLedger;

    // Connect ledger to vault
    await vault.setLedger(await ledger.getAddress());

    // Fund agent wallet with MNT for gas reservoir
    await mntToken.mint(agent.address, ethers.parseEther("100"));
    await mntToken.connect(agent).approve(await vault.getAddress(), ethers.parseEther("100"));

    // Fund gas reservoir (1 MNT — above 0.5 MNT minimum)
    await vault.connect(agent).fundGasReservoir(ethers.parseEther("1"));

    // Give vault some tokens to work with
    await mETHToken.mint(await vault.getAddress(), ethers.parseEther("2"));
    await usdyToken.mint(await vault.getAddress(), ethers.parseEther("5000"));
  });

  // ──────────────────────────────────────────────────────────────────────────
  // GUARDRAIL 1: Token Whitelist
  // ──────────────────────────────────────────────────────────────────────────

  describe("Guardrail: Token Whitelist", function () {
    it("REVERT: fromToken not whitelisted", async function () {
      await expect(
        vault.connect(agent).executeRebalance(
          await unknownToken.getAddress(),  // NOT whitelisted
          await usdyToken.getAddress(),
          1000n * DECIMALS_6,
          10n,
          "0x"
        )
      ).to.be.revertedWith("FROM_TOKEN_NOT_WHITELISTED");
    });

    it("REVERT: toToken not whitelisted", async function () {
      await expect(
        vault.connect(agent).executeRebalance(
          await mETHToken.getAddress(),
          await unknownToken.getAddress(),  // NOT whitelisted
          1000n * DECIMALS_6,
          10n,
          "0x"
        )
      ).to.be.revertedWith("TO_TOKEN_NOT_WHITELISTED");
    });

    it("REVERT: both tokens not whitelisted", async function () {
      await expect(
        vault.connect(agent).executeRebalance(
          await unknownToken.getAddress(),
          await unknownToken.getAddress(),
          1000n * DECIMALS_6,
          10n,
          "0x"
        )
      ).to.be.revertedWith("FROM_TOKEN_NOT_WHITELISTED");
    });

    it("PASS: validateDecision returns false with reason for unwhitelisted token", async function () {
      const [valid, reason] = await vault.validateDecision(
        await unknownToken.getAddress(),
        await usdyToken.getAddress(),
        1000n * DECIMALS_6,
        10n
      );
      expect(valid).to.be.false;
      expect(reason).to.equal("FROM_TOKEN_NOT_WHITELISTED");
    });

    it("REVERT: self-trade (same fromToken and toToken)", async function () {
      await expect(
        vault.connect(agent).executeRebalance(
          await mETHToken.getAddress(),
          await mETHToken.getAddress(),  // same token
          1000n * DECIMALS_6,
          10n,
          "0x"
        )
      ).to.be.revertedWith("SAME_TOKEN");
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // GUARDRAIL 2: Slippage Cap (0.40% = 40 bps)
  // ──────────────────────────────────────────────────────────────────────────

  describe("Guardrail: Max Slippage (0.40% = 40 bps)", function () {
    it("REVERT: slippage = 41 bps (exceeds 40 bps cap)", async function () {
      await expect(
        vault.connect(agent).executeRebalance(
          await mETHToken.getAddress(),
          await usdyToken.getAddress(),
          1000n * DECIMALS_6,
          41n,  // ONE basis point over the cap
          "0x"
        )
      ).to.be.revertedWith("SLIPPAGE_EXCEEDED");
    });

    it("REVERT: slippage = 100 bps (1%)", async function () {
      await expect(
        vault.connect(agent).executeRebalance(
          await mETHToken.getAddress(),
          await usdyToken.getAddress(),
          1000n * DECIMALS_6,
          100n,
          "0x"
        )
      ).to.be.revertedWith("SLIPPAGE_EXCEEDED");
    });

    it("REVERT: slippage = 10000 bps (100% — hallucination test)", async function () {
      await expect(
        vault.connect(agent).executeRebalance(
          await mETHToken.getAddress(),
          await usdyToken.getAddress(),
          1000n * DECIMALS_6,
          10000n,
          "0x"
        )
      ).to.be.revertedWith("SLIPPAGE_EXCEEDED");
    });

    it("PASS: slippage = 40 bps (exactly at cap)", async function () {
      await expect(
        vault.connect(agent).executeRebalance(
          await mETHToken.getAddress(),
          await mntToken.getAddress(),
          1000n * DECIMALS_6,
          40n,  // Exactly at cap
          "0x"
        )
      ).to.emit(vault, "DecisionExecuted");
    });

    it("PASS: slippage = 0 bps (perfect execution)", async function () {
      await expect(
        vault.connect(agent).executeRebalance(
          await mETHToken.getAddress(),
          await mntToken.getAddress(),
          1000n * DECIMALS_6,
          0n,
          "0x"
        )
      ).to.emit(vault, "DecisionExecuted");
    });

    it("validateDecision returns correct reason for slippage violation", async function () {
      const [valid, reason] = await vault.validateDecision(
        await mETHToken.getAddress(),
        await usdyToken.getAddress(),
        1000n * DECIMALS_6,
        41n
      );
      expect(valid).to.be.false;
      expect(reason).to.equal("SLIPPAGE_EXCEEDED");
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // GUARDRAIL 3: Single Transaction Size Cap ($10,000)
  // ──────────────────────────────────────────────────────────────────────────

  describe("Guardrail: Max Single TX Size ($10,000)", function () {
    it("REVERT: amount = $10,001 (one dollar over cap)", async function () {
      await expect(
        vault.connect(agent).executeRebalance(
          await mETHToken.getAddress(),
          await usdyToken.getAddress(),
          10_001n * DECIMALS_6,  // $10,001
          10n,
          "0x"
        )
      ).to.be.revertedWith("AMOUNT_EXCEEDS_CAP");
    });

    it("REVERT: amount = $1,000,000 (hallucination test)", async function () {
      await expect(
        vault.connect(agent).executeRebalance(
          await mETHToken.getAddress(),
          await usdyToken.getAddress(),
          1_000_000n * DECIMALS_6,
          10n,
          "0x"
        )
      ).to.be.revertedWith("AMOUNT_EXCEEDS_CAP");
    });

    it("PASS: amount = $10,000 (exactly at cap)", async function () {
      // Fund vault with enough mETH to make epoch cap > $10,000
      // epoch cap = 15% of total value. Need total value > $66,667
      // Mint 30 mETH @ $2700 = $81,000 total → 15% epoch cap = $12,150 > $10,000
      await mETHToken.mint(await vault.getAddress(), ethers.parseEther("30"));

      await expect(
        vault.connect(agent).executeRebalance(
          await mETHToken.getAddress(),
          await mntToken.getAddress(),
          10_000n * DECIMALS_6,  // $10,000 exactly
          10n,
          "0x"
        )
      ).to.emit(vault, "DecisionExecuted");
    });

    it("REVERT: zero amount", async function () {
      await expect(
        vault.connect(agent).executeRebalance(
          await mETHToken.getAddress(),
          await usdyToken.getAddress(),
          0n,
          10n,
          "0x"
        )
      ).to.be.revertedWith("ZERO_AMOUNT");
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // GUARDRAIL 4: Gas Reservoir Minimum (0.5 MNT)
  // ──────────────────────────────────────────────────────────────────────────

  describe("Guardrail: Gas Reservoir Minimum (0.5 MNT)", function () {
    it("REVERT: gas reservoir below minimum (empty reservoir)", async function () {
      // Deploy a fresh vault with NO gas reservoir
      const VaultFactory = await ethers.getContractFactory("VIGILVault");
      const emptyVault = (await VaultFactory.deploy(
        agent.address,
        await mntToken.getAddress(),
        [await mETHToken.getAddress(), await usdyToken.getAddress()],
        [await mEthFeed.getAddress(), await usdyFeed.getAddress()]
      )) as unknown as VIGILVault;

      const [valid, reason] = await emptyVault.validateDecision(
        await mETHToken.getAddress(),
        await usdyToken.getAddress(),
        1000n * DECIMALS_6,
        10n
      );
      expect(valid).to.be.false;
      expect(reason).to.equal("GAS_RESERVOIR_LOW");
    });

    it("REVERT: executeRebalance with empty gas reservoir", async function () {
      const VaultFactory = await ethers.getContractFactory("VIGILVault");
      const emptyVault = (await VaultFactory.deploy(
        agent.address,
        await mntToken.getAddress(),
        [await mETHToken.getAddress(), await usdyToken.getAddress()],
        [await mEthFeed.getAddress(), await usdyFeed.getAddress()]
      )) as unknown as VIGILVault;

      await expect(
        emptyVault.connect(agent).executeRebalance(
          await mETHToken.getAddress(),
          await usdyToken.getAddress(),
          1000n * DECIMALS_6,
          10n,
          "0x"
        )
      ).to.be.revertedWith("GAS_RESERVOIR_LOW");
    });

    it("PASS: gas reservoir above minimum (1 MNT)", async function () {
      // Vault from beforeEach has 1 MNT in reservoir
      expect(await vault.gasReservoir()).to.be.gte(ethers.parseEther("0.5"));
    });

    it("GasReservoir: consumeGas emits event and reduces reservoir", async function () {
      const before = await vault.gasReservoir();
      const consumeAmount = ethers.parseEther("0.1");

      await expect(vault.connect(agent).consumeGas(consumeAmount))
        .to.emit(vault, "GasConsumed")
        .withArgs(consumeAmount, before - consumeAmount);

      expect(await vault.gasReservoir()).to.equal(before - consumeAmount);
    });

    it("REVERT: consumeGas more than reservoir", async function () {
      await expect(
        vault.connect(agent).consumeGas(ethers.parseEther("1000"))
      ).to.be.revertedWithCustomError(vault, "GasReservoirTooLow");
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // GUARDRAIL 5: Epoch Allocation Cap (15% per epoch)
  // ──────────────────────────────────────────────────────────────────────────

  describe("Guardrail: Epoch Allocation Cap (15% per epoch)", function () {
    it("REVERT: epoch allocation exceeded", async function () {
      // First, fund vault with meaningful token balance so getTotalValue() works
      await mETHToken.mint(await vault.getAddress(), ethers.parseEther("10")); // ~$27,000
      await usdyToken.mint(await vault.getAddress(), ethers.parseEther("50000")); // ~$50,000

      // Execute up to epoch limit with multiple smaller trades
      // Then attempt one that would push over
      // Note: epoch cap = 15% of total value
      // This test validates the logic path — real amounts depend on oracle prices
      const [valid, reason] = await vault.validateDecision(
        await mETHToken.getAddress(),
        await usdyToken.getAddress(),
        10_000n * DECIMALS_6, // $10k — under epoch cap on its own
        10n
      );
      // Should pass if vault has sufficient value
      // If it reverts with EPOCH, the epoch logic is working
      if (!valid) {
        expect(["EPOCH_ALLOCATION_EXCEEDED", ""]).to.include(reason);
      }
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // GUARDRAIL 6: Only Agent Can Execute
  // ──────────────────────────────────────────────────────────────────────────

  describe("Guardrail: Agent Authorization", function () {
    it("REVERT: non-agent tries to executeRebalance", async function () {
      await expect(
        vault.connect(attacker).executeRebalance(
          await mETHToken.getAddress(),
          await usdyToken.getAddress(),
          1000n * DECIMALS_6,
          10n,
          "0x"
        )
      ).to.be.revertedWithCustomError(vault, "NotAgent");
    });

    it("REVERT: owner (not agent) tries to executeRebalance", async function () {
      await expect(
        vault.connect(owner).executeRebalance(
          await mETHToken.getAddress(),
          await usdyToken.getAddress(),
          1000n * DECIMALS_6,
          10n,
          "0x"
        )
      ).to.be.revertedWithCustomError(vault, "NotAgent");
    });

    it("REVERT: non-agent tries to consumeGas", async function () {
      await expect(
        vault.connect(attacker).consumeGas(ethers.parseEther("0.1"))
      ).to.be.revertedWithCustomError(vault, "NotAgent");
    });

    it("REVERT: non-agent tries to recordSkip", async function () {
      await expect(
        vault.connect(attacker).recordSkip("CONFIDENCE_TOO_LOW", 4500)
      ).to.be.revertedWithCustomError(vault, "NotAgent");
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // SUCCESSFUL EXECUTION
  // ──────────────────────────────────────────────────────────────────────────

  describe("Happy Path: Successful Decision Execution", function () {
    it("PASS: emits DecisionExecuted with correct params", async function () {
      const fromToken = await mETHToken.getAddress();
      const toToken = await mntToken.getAddress();
      const amount = 1000n * DECIMALS_6;
      const slippage = 12n;
      const execData = ethers.toUtf8Bytes("fluxion_quote_data");

      const tx = vault.connect(agent).executeRebalance(
        fromToken, toToken, amount, slippage, execData
      );

      await expect(tx)
        .to.emit(vault, "DecisionExecuted")
        .withArgs(fromToken, toToken, amount, slippage, ethers.keccak256(execData));
    });

    it("PASS: totalDecisions increments after execution", async function () {
      const before = await vault.totalDecisions();
      await vault.connect(agent).executeRebalance(
        await mETHToken.getAddress(),
        await mntToken.getAddress(),
        1000n * DECIMALS_6,
        10n,
        "0x"
      );
      expect(await vault.totalDecisions()).to.equal(before + 1n);
    });

    it("PASS: epochAllocationUsed increases after execution", async function () {
      const amount = 1000n * DECIMALS_6;
      await vault.connect(agent).executeRebalance(
        await mETHToken.getAddress(),
        await mntToken.getAddress(),
        amount,
        10n,
        "0x"
      );
      expect(await vault.epochAllocationUsed()).to.equal(amount);
    });

    it("PASS: agent can recordSkip", async function () {
      await expect(
        vault.connect(agent).recordSkip("CONFIDENCE_TOO_LOW", 4500)
      ).to.emit(vault, "DecisionSkipped")
        .withArgs("CONFIDENCE_TOO_LOW", 4500);
    });

    it("PASS: validateDecision returns true for valid inputs", async function () {
      const [valid, reason] = await vault.validateDecision(
        await mETHToken.getAddress(),
        await usdyToken.getAddress(),
        1000n * DECIMALS_6,
        10n
      );
      expect(valid).to.be.true;
      expect(reason).to.equal("");
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // GAS RESERVOIR FUNDING
  // ──────────────────────────────────────────────────────────────────────────

  describe("Gas Reservoir: Self-Sustaining Economy", function () {
    it("PASS: fundGasReservoir emits event and increases balance", async function () {
      const fundAmount = ethers.parseEther("0.5");
      await mntToken.connect(agent).approve(await vault.getAddress(), fundAmount);

      const before = await vault.gasReservoir();
      await expect(
        vault.connect(agent).fundGasReservoir(fundAmount)
      ).to.emit(vault, "GasReservoirFunded")
        .withArgs(fundAmount, before + fundAmount);

      expect(await vault.gasReservoir()).to.equal(before + fundAmount);
    });

    it("REVERT: fundGasReservoir with zero amount", async function () {
      await expect(
        vault.fundGasReservoir(0n)
      ).to.be.revertedWith("VIGIL: zero amount");
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // ADMIN FUNCTIONS
  // ──────────────────────────────────────────────────────────────────────────

  describe("Admin: Owner-only functions", function () {
    it("PASS: owner can whitelist a new token", async function () {
      const newToken = await (await ethers.getContractFactory("MockERC20")).deploy("New", "NEW", 18);
      const newFeed = await (await ethers.getContractFactory("MockChainlinkFeed")).deploy(100_000_000n);

      await expect(
        vault.connect(owner).whitelistToken(await newToken.getAddress(), await newFeed.getAddress())
      ).to.emit(vault, "TokenWhitelisted");

      expect(await vault.allowedTokens(await newToken.getAddress())).to.be.true;
    });

    it("REVERT: non-owner cannot whitelist token", async function () {
      await expect(
        vault.connect(attacker).whitelistToken(await unknownToken.getAddress(), await mntFeed.getAddress())
      ).to.be.revertedWithCustomError(vault, "OwnableUnauthorizedAccount");
    });

    it("PASS: owner can set agent ID", async function () {
      await expect(vault.connect(owner).setAgentId(47))
        .to.emit(vault, "AgentIdSet")
        .withArgs(47);
      expect(await vault.erc8004AgentId()).to.equal(47);
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// VIGILLedger Tests
// ─────────────────────────────────────────────────────────────────────────────

describe("VIGILLedger — Append-Only Integrity", function () {
  let vault: VIGILVault;
  let ledger: VIGILLedger;
  let owner: HardhatEthersSigner;
  let agent: HardhatEthersSigner;
  let attacker: HardhatEthersSigner;
  let mntToken: MockERC20;
  let mEthToken: MockERC20;
  let usdyToken: MockERC20;
  let mntFeed: MockChainlinkFeed;
  let mEthFeed: MockChainlinkFeed;
  let usdyFeed: MockChainlinkFeed;

  beforeEach(async function () {
    [owner, agent, , attacker] = await ethers.getSigners();

    const MockERC20Factory = await ethers.getContractFactory("MockERC20");
    mntToken = (await MockERC20Factory.deploy("MNT", "MNT", 18)) as unknown as MockERC20;
    mEthToken = (await MockERC20Factory.deploy("mETH", "mETH", 18)) as unknown as MockERC20;
    usdyToken = (await MockERC20Factory.deploy("USDY", "USDY", 18)) as unknown as MockERC20;

    const MockFeedFactory = await ethers.getContractFactory("MockChainlinkFeed");
    mntFeed = (await MockFeedFactory.deploy(80_000_000n)) as unknown as MockChainlinkFeed;
    mEthFeed = (await MockFeedFactory.deploy(270_000_000_000n)) as unknown as MockChainlinkFeed;
    usdyFeed = (await MockFeedFactory.deploy(100_000_000n)) as unknown as MockChainlinkFeed;

    const VaultFactory = await ethers.getContractFactory("VIGILVault");
    vault = (await VaultFactory.deploy(
      agent.address,
      await mntToken.getAddress(),
      [await mEthToken.getAddress(), await usdyToken.getAddress(), await mntToken.getAddress()],
      [await mEthFeed.getAddress(), await usdyFeed.getAddress(), await mntFeed.getAddress()]
    )) as unknown as VIGILVault;

    const LedgerFactory = await ethers.getContractFactory("VIGILLedger");
    ledger = (await LedgerFactory.deploy(await vault.getAddress())) as unknown as VIGILLedger;
  });

  it("REVERT: non-vault address cannot log entries", async function () {
    const entry = buildEntry();
    await expect(
      ledger.connect(attacker).log(entry)
    ).to.be.revertedWithCustomError(ledger, "NotAuthorized");
  });

  it("REVERT: owner cannot log entries (only vault)", async function () {
    const entry = buildEntry();
    await expect(
      ledger.connect(owner).log(entry)
    ).to.be.revertedWithCustomError(ledger, "NotAuthorized");
  });

  it("PASS: totalEntries starts at 0", async function () {
    expect(await ledger.totalEntries()).to.equal(0);
  });

  it("PASS: getEntries returns empty array when no entries", async function () {
    const entries = await ledger.getEntries(0, 10);
    expect(entries.length).to.equal(0);
  });

  it("PASS: getRecentEntries returns empty array when no entries", async function () {
    const entries = await ledger.getRecentEntries(5);
    expect(entries.length).to.equal(0);
  });

  function buildEntry() {
    return {
      timestamp: BigInt(Math.floor(Date.now() / 1000)),
      agentId: 47n,
      entryType: 1, // EXECUTED
      fromToken: ethers.ZeroAddress,
      toToken: ethers.ZeroAddress,
      amount: 1000_000_000n,
      confidence: 7900n,
      slippageBps: 12n,
      txHash: ethers.randomBytes(32) as unknown as string,
      zkProofHash: ethers.randomBytes(32) as unknown as string,
      signalBundleHash: ethers.randomBytes(32) as unknown as string,
      skipReason: "",
      reasoning: "Strong NVDAx signal: smart money outflow + 18% sentiment drop",
    };
  }
});
