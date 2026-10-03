import { expect } from "chai";
import hre from "hardhat";
const { ethers } = hre;

describe("ArcEscrow On-Chain Spending Limits & Policy Suite", function () {
  let mockUsdc, arcEscrow;
  let owner, agent, verifier, vendor, stranger;

  const MAX_CAP = ethers.parseUnits("10000", 6); // 10,000 USDC
  const SOFTWARE_BUDGET = ethers.parseUnits("25000", 6); // 25,000 USDC

  beforeEach(async function () {
    [owner, agent, verifier, vendor, stranger] = await ethers.getSigners();

    // 1. Deploy Mock USDC
    const MockUSDC = await ethers.getContractFactory("MockUSDC");
    mockUsdc = await MockUSDC.deploy();
    await mockUsdc.waitForDeployment();

    // 2. Deploy ArcEscrow
    const ArcEscrow = await ethers.getContractFactory("ArcEscrow");
    arcEscrow = await ArcEscrow.deploy(
      await mockUsdc.getAddress(),
      agent.address,
      verifier.address,
      MAX_CAP,
    );
    await arcEscrow.waitForDeployment();

    // 3. Configure category budget
    await arcEscrow.setCategoryBudget("software", SOFTWARE_BUDGET);

    // 4. Fund agent and owner with USDC and approve escrow contract
    await mockUsdc.mint(agent.address, ethers.parseUnits("50000", 6));
    await mockUsdc
      .connect(agent)
      .approve(await arcEscrow.getAddress(), ethers.MaxUint256);
    await mockUsdc
      .connect(owner)
      .approve(await arcEscrow.getAddress(), ethers.MaxUint256);
  });

  it("1. Agent cannot exceed maxPerAgreement cap, but owner can create above cap", async function () {
    const overCapAmount = ethers.parseUnits("12000", 6); // 12,000 > 10,000

    // Agent attempt -> Revert
    await expect(
      arcEscrow
        .connect(agent)
        .createAgreement(vendor.address, overCapAmount, "software", 3600),
    ).to.be.revertedWith("ArcEscrow: Amount exceeds agent policy cap");

    // Owner attempt -> Success
    await expect(
      arcEscrow
        .connect(owner)
        .createAgreement(vendor.address, overCapAmount, "software", 3600),
    ).to.emit(arcEscrow, "AgreementCreated");
  });

  it("2. Agent cannot exceed category budget", async function () {
    // Set a tiny budget for contractors
    await arcEscrow.setCategoryBudget(
      "contractors",
      ethers.parseUnits("5000", 6),
    );

    // Attempt to allocate 6,000 USDC when budget is 5,000 -> Revert
    await expect(
      arcEscrow
        .connect(agent)
        .createAgreement(
          vendor.address,
          ethers.parseUnits("6000", 6),
          "contractors",
          3600,
        ),
    ).to.be.revertedWith("ArcEscrow: Exceeds category budget");

    // Attempt within cap (4,000) but second agreement (2,000) exceeds budget
    await arcEscrow
      .connect(agent)
      .createAgreement(
        vendor.address,
        ethers.parseUnits("4000", 6),
        "contractors",
        3600,
      );

    await expect(
      arcEscrow
        .connect(agent)
        .createAgreement(
          vendor.address,
          ethers.parseUnits("2000", 6),
          "contractors",
          3600,
        ),
    ).to.be.revertedWith("ArcEscrow: Exceeds category budget");
  });

  it("3. Cannot release twice (double-spend protection)", async function () {
    const amount = ethers.parseUnits("3000", 6);
    await arcEscrow
      .connect(agent)
      .createAgreement(vendor.address, amount, "software", 3600);

    // Fund
    await arcEscrow.connect(agent).fundAgreement(1);
    // Submit milestone
    await arcEscrow
      .connect(vendor)
      .submitMilestone(1, "SaaS Annual Delivery Confirmation");
    // Approve milestone
    await arcEscrow.connect(verifier).approveMilestone(1);

    // First release succeeds
    await expect(arcEscrow.connect(agent).release(1))
      .to.emit(arcEscrow, "FundsReleased")
      .withArgs(1, vendor.address, amount);

    // Second release fails
    await expect(arcEscrow.connect(agent).release(1)).to.be.revertedWith(
      "ArcEscrow: Milestone must be approved",
    );
  });

  it("4. Agent cannot approve its own milestone", async function () {
    const amount = ethers.parseUnits("2000", 6);
    await arcEscrow
      .connect(agent)
      .createAgreement(vendor.address, amount, "software", 3600);
    await arcEscrow.connect(agent).fundAgreement(1);
    await arcEscrow.connect(agent).submitMilestone(1, "Delivered");

    // Agent attempts approval -> Revert
    await expect(
      arcEscrow.connect(agent).approveMilestone(1),
    ).to.be.revertedWith("ArcEscrow: Only verifier authorized");
  });

  it("5. Only verifier can approve milestones", async function () {
    const amount = ethers.parseUnits("2000", 6);
    await arcEscrow
      .connect(agent)
      .createAgreement(vendor.address, amount, "software", 3600);
    await arcEscrow.connect(agent).fundAgreement(1);
    await arcEscrow.connect(agent).submitMilestone(1, "Delivered");

    // Stranger attempts -> Revert
    await expect(
      arcEscrow.connect(stranger).approveMilestone(1),
    ).to.be.revertedWith("ArcEscrow: Only verifier authorized");

    // Verifier attempts -> Success
    await expect(arcEscrow.connect(verifier).approveMilestone(1))
      .to.emit(arcEscrow, "MilestoneApproved")
      .withArgs(1, verifier.address);
  });

  it("6. Refund before deadline fails", async function () {
    const amount = ethers.parseUnits("2500", 6);
    const duration = 3600; // 1 hour
    await arcEscrow
      .connect(agent)
      .createAgreement(vendor.address, amount, "software", duration);
    await arcEscrow.connect(agent).fundAgreement(1);

    // Immediate refund attempt -> Revert
    await expect(arcEscrow.connect(agent).refund(1)).to.be.revertedWith(
      "ArcEscrow: Deadline has not passed",
    );
  });

  it("7. Refund after deadline works and restores depositor balance", async function () {
    const amount = ethers.parseUnits("2500", 6);
    const duration = 60; // 60 seconds
    await arcEscrow
      .connect(agent)
      .createAgreement(vendor.address, amount, "software", duration);
    await arcEscrow.connect(agent).fundAgreement(1);

    const balanceBefore = await mockUsdc.balanceOf(agent.address);

    // Fast-forward time past deadline
    await ethers.provider.send("evm_increaseTime", [120]);
    await ethers.provider.send("evm_mine");

    // Refund succeeds
    await expect(arcEscrow.connect(agent).refund(1))
      .to.emit(arcEscrow, "FundsRefunded")
      .withArgs(1, agent.address, amount);

    const balanceAfter = await mockUsdc.balanceOf(agent.address);
    expect(balanceAfter - balanceBefore).to.equal(amount);
  });

  it("8. Success fee: Owner can set fee up to 20% cap; agent and stranger cannot", async function () {
    // 10% fee = 1000 bps
    await expect(arcEscrow.connect(owner).setFeeConfig(1000, owner.address))
      .to.emit(arcEscrow, "FeeConfigUpdated")
      .withArgs(1000, owner.address);

    expect(await arcEscrow.feeBps()).to.equal(1000);
    expect(await arcEscrow.feeRecipient()).to.equal(owner.address);

    // Over 20% cap (2001 bps) -> Revert
    await expect(
      arcEscrow.connect(owner).setFeeConfig(2001, owner.address),
    ).to.be.revertedWith("ArcEscrow: feeBps exceeds MAX_FEE_BPS");

    // Agent attempt -> Revert
    await expect(
      arcEscrow.connect(agent).setFeeConfig(500, agent.address),
    ).to.be.revertedWith("ArcEscrow: Only owner authorized");
  });

  it("9. Success fee: Zero fee when savings are zero (baseline <= negotiated)", async function () {
    await arcEscrow.connect(owner).setFeeConfig(1000, owner.address); // 10% fee

    const price = ethers.parseUnits("5000", 6);
    const baseline = ethers.parseUnits("5000", 6); // 0 savings
    const idempKey = ethers.encodeBytes32String("no-savings-key");

    await arcEscrow
      .connect(agent)
      .createAgreementWithSavings(
        vendor.address,
        price,
        baseline,
        "software",
        3600,
        idempKey,
      );

    const ag = await arcEscrow.getAgreement(1);
    expect(ag.savings).to.equal(0);
    expect(ag.feeAmount).to.equal(0);
  });

  it("10. Success fee: Fee is funded, released to feeRecipient, and vendor receives price", async function () {
    const feeRecipient = stranger.address;
    await arcEscrow.connect(owner).setFeeConfig(1000, feeRecipient); // 10% of savings

    const negotiatedPrice = ethers.parseUnits("7000", 6); // $7,000
    const baselinePrice = ethers.parseUnits("10000", 6); // $10,000
    // Realized savings = $3,000. 10% fee = $300.
    const expectedFee = ethers.parseUnits("300", 6);
    const totalToFund = ethers.parseUnits("7300", 6);

    const idempKey = ethers.encodeBytes32String("savings-fee-key");
    await arcEscrow
      .connect(agent)
      .createAgreementWithSavings(
        vendor.address,
        negotiatedPrice,
        baselinePrice,
        "software",
        3600,
        idempKey,
      );

    const ag = await arcEscrow.getAgreement(1);
    expect(ag.savings).to.equal(ethers.parseUnits("3000", 6));
    expect(ag.feeAmount).to.equal(expectedFee);

    const agentBefore = await mockUsdc.balanceOf(agent.address);
    const vendorBefore = await mockUsdc.balanceOf(vendor.address);
    const recipientBefore = await mockUsdc.balanceOf(feeRecipient);

    // Fund agreement (7,000 price + 300 fee = 7,300)
    await arcEscrow.connect(agent).fundAgreement(1);
    const agentAfterFund = await mockUsdc.balanceOf(agent.address);
    expect(agentBefore - agentAfterFund).to.equal(totalToFund);

    // Submit & Approve Milestone
    await arcEscrow.connect(vendor).submitMilestone(1, "Milestone done");
    await arcEscrow.connect(verifier).approveMilestone(1);

    // Release funds
    await expect(arcEscrow.connect(agent).release(1))
      .to.emit(arcEscrow, "FundsReleased")
      .withArgs(1, vendor.address, negotiatedPrice)
      .and.to.emit(arcEscrow, "FeeCollected")
      .withArgs(1, feeRecipient, expectedFee);

    const vendorAfter = await mockUsdc.balanceOf(vendor.address);
    const recipientAfter = await mockUsdc.balanceOf(feeRecipient);

    expect(vendorAfter - vendorBefore).to.equal(negotiatedPrice);
    expect(recipientAfter - recipientBefore).to.equal(expectedFee);
  });

  it("11. Success fee: Refund returns both principal and fee to depositor", async function () {
    const feeRecipient = stranger.address;
    await arcEscrow.connect(owner).setFeeConfig(1000, feeRecipient);

    const price = ethers.parseUnits("4000", 6);
    const baseline = ethers.parseUnits("6000", 6); // 2000 savings -> 200 fee
    const expectedFee = ethers.parseUnits("200", 6);
    const totalFunded = price + expectedFee; // 4200

    await arcEscrow.connect(agent).createAgreementWithSavings(
      vendor.address,
      price,
      baseline,
      "software",
      60, // 60 seconds duration
      ethers.encodeBytes32String("refund-fee-key"),
    );

    await arcEscrow.connect(agent).fundAgreement(1);
    const agentBefore = await mockUsdc.balanceOf(agent.address);

    // Fast-forward past deadline
    await ethers.provider.send("evm_increaseTime", [120]);
    await ethers.provider.send("evm_mine");

    // Refund
    await arcEscrow.connect(agent).refund(1);
    const agentAfter = await mockUsdc.balanceOf(agent.address);

    expect(agentAfter - agentBefore).to.equal(totalFunded);
  });

  it("12. Role separation: Cannot set verifier equal to agent address", async function () {
    await expect(
      arcEscrow.connect(owner).setRoles(owner.address, agent.address, agent.address),
    ).to.be.revertedWith("ArcEscrow: Verifier cannot be agent");
  });

  it("13. Decision hash: Agreement records decisionHash and emits it in AgreementCreated", async function () {
    const price = ethers.parseUnits("3000", 6);
    const baseline = ethers.parseUnits("4000", 6);
    const idempKey = ethers.encodeBytes32String("idemp-decision-13");
    const decisionHash = ethers.keccak256(ethers.toUtf8Bytes('{"negotiationId":"neg-123","vendor":"Slack","amount":"3000.000000"}'));

    const tx = await arcEscrow.connect(agent).createAgreementWithDecision(
      vendor.address,
      price,
      baseline,
      "software",
      3600,
      idempKey,
      decisionHash,
    );

    await expect(tx).to.emit(arcEscrow, "AgreementCreated");

    const ag = await arcEscrow.getAgreement(1);
    expect(ag.decisionHash).to.equal(decisionHash);
    expect(await arcEscrow.usedDecisions(decisionHash)).to.equal(true);
  });

  it("14. Decision hash: Replay of same decisionHash strictly reverts on-chain (defense-in-depth)", async function () {
    const price = ethers.parseUnits("2000", 6);
    const baseline = ethers.parseUnits("3000", 6);
    const idempKey1 = ethers.encodeBytes32String("idemp-14-a");
    const idempKey2 = ethers.encodeBytes32String("idemp-14-b");
    const decisionHash = ethers.keccak256(ethers.toUtf8Bytes('{"negotiationId":"neg-456","vendor":"Datadog","amount":"2000.000000"}'));

    // First creation succeeds
    await arcEscrow.connect(agent).createAgreementWithDecision(
      vendor.address,
      price,
      baseline,
      "software",
      3600,
      idempKey1,
      decisionHash,
    );

    // Second creation with the same decisionHash reverts even with a different idempotency key
    await expect(
      arcEscrow.connect(agent).createAgreementWithDecision(
        vendor.address,
        price,
        baseline,
        "software",
        3600,
        idempKey2,
        decisionHash,
      ),
    ).to.be.revertedWith("ArcEscrow: Decision already executed");
  });
});

