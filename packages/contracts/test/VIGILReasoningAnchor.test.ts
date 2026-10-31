import { expect } from "chai";
import { ethers } from "hardhat";

describe("VIGILReasoningAnchor", function () {
  const hash = ethers.id("record");
  const snapshot = ethers.id("snapshot");

  async function deploy() {
    const [agent, other] = await ethers.getSigners();
    const factory = await ethers.getContractFactory("VIGILReasoningAnchor");
    return { anchor: await factory.deploy(agent.address), other };
  }

  it("records a hash and emits the event", async function () {
    const { anchor } = await deploy();
    await expect(anchor.anchor(hash, snapshot, 3))
      .to.emit(anchor, "DecisionAnchored").withArgs(hash, snapshot, 3, 0);
    expect(await anchor.totalAnchors()).to.equal(1n);
    expect(await anchor.anchoredAt(hash)).to.be.greaterThan(0n);
  });

  it("rejects other senders and duplicates", async function () {
    const { anchor, other } = await deploy();
    await expect(anchor.connect(other).anchor(hash, snapshot, 0)).to.be.revertedWithCustomError(anchor, "NotAgent");
    await anchor.anchor(hash, snapshot, 0);
    await expect(anchor.anchor(hash, snapshot, 0)).to.be.revertedWithCustomError(anchor, "AlreadyAnchored");
  });
});
