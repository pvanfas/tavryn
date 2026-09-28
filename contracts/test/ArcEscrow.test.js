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
      MAX_CAP
    );
    await arcEscrow.waitForDeployment();

    // 3. Configure category budget
    await arcEscrow.setCategoryBudget("software", SOFTWARE_BUDGET);

    // 4. Fund agent and owner with USDC and approve escrow contract
    await mockUsdc.mint(agent.address, ethers.parseUnits("50000", 6));
    await mockUsdc.connect(agent).approve(await arcEscrow.getAddress(), ethers.MaxUint256);
    await mockUsdc.connect(owner).approve(await arcEscrow.getAddress(), ethers.MaxUint256);
  });

  it("1. Agent cannot exceed maxPerAgreement cap, but owner can create above cap", async function () {
    const overCapAmount = ethers.parseUnits("12000", 6); // 12,000 > 10,000

    // Agent attempt -> Revert
    await expect(
      arcEscrow.connect(agent).createAgreement(vendor.address, overCapAmount, "software", 3600)
    ).to.be.revertedWith("ArcEscrow: Amount exceeds agent policy cap");

    // Owner attempt -> Success
    await expect(
      arcEscrow.connect(owner).createAgreement(vendor.address, overCapAmount, "software", 3600)
    ).to.emit(arcEscrow, "AgreementCreated");
  });

  it("2. Agent cannot exceed category budget", async function () {
    // Set a tiny budget for contractors
    await arcEscrow.setCategoryBudget("contractors", ethers.parseUnits("5000", 6));

    // Attempt to allocate 6,000 USDC when budget is 5,000 -> Revert
    await expect(
      arcEscrow.connect(agent).createAgreement(
        vendor.address,
        ethers.parseUnits("6000", 6),
        "contractors",
        3600
      )
    ).to.be.revertedWith("ArcEscrow: Exceeds category budget");

    // Attempt within cap (4,000) but second agreement (2,000) exceeds budget
    await arcEscrow.connect(agent).createAgreement(
      vendor.address,
      ethers.parseUnits("4000", 6),
      "contractors",
      3600
    );

    await expect(
      arcEscrow.connect(agent).createAgreement(
        vendor.address,
        ethers.parseUnits("2000", 6),
        "contractors",
        3600
      )
    ).to.be.revertedWith("ArcEscrow: Exceeds category budget");
  });

  it("3. Cannot release twice (double-spend protection)", async function () {
    const amount = ethers.parseUnits("3000", 6);
    await arcEscrow.connect(agent).createAgreement(vendor.address, amount, "software", 3600);

    // Fund
    await arcEscrow.connect(agent).fundAgreement(1);
    // Submit milestone
    await arcEscrow.connect(vendor).submitMilestone(1, "SaaS Annual Delivery Confirmation");
    // Approve milestone
    await arcEscrow.connect(verifier).approveMilestone(1);

    // First release succeeds
    await expect(arcEscrow.connect(agent).release(1))
      .to.emit(arcEscrow, "FundsReleased")
      .withArgs(1, vendor.address, amount);

    // Second release fails
    await expect(arcEscrow.connect(agent).release(1)).to.be.revertedWith(
      "ArcEscrow: Milestone must be approved"
    );
  });

  it("4. Agent cannot approve its own milestone", async function () {
    const amount = ethers.parseUnits("2000", 6);
    await arcEscrow.connect(agent).createAgreement(vendor.address, amount, "software", 3600);
    await arcEscrow.connect(agent).fundAgreement(1);
    await arcEscrow.connect(agent).submitMilestone(1, "Delivered");

    // Agent attempts approval -> Revert
    await expect(arcEscrow.connect(agent).approveMilestone(1)).to.be.revertedWith(
      "ArcEscrow: Only verifier authorized"
    );
  });

  it("5. Only verifier can approve milestones", async function () {
    const amount = ethers.parseUnits("2000", 6);
    await arcEscrow.connect(agent).createAgreement(vendor.address, amount, "software", 3600);
    await arcEscrow.connect(agent).fundAgreement(1);
    await arcEscrow.connect(agent).submitMilestone(1, "Delivered");

    // Stranger attempts -> Revert
    await expect(arcEscrow.connect(stranger).approveMilestone(1)).to.be.revertedWith(
      "ArcEscrow: Only verifier authorized"
    );

    // Verifier attempts -> Success
    await expect(arcEscrow.connect(verifier).approveMilestone(1))
      .to.emit(arcEscrow, "MilestoneApproved")
      .withArgs(1, verifier.address);
  });

  it("6. Refund before deadline fails", async function () {
    const amount = ethers.parseUnits("2500", 6);
    const duration = 3600; // 1 hour
    await arcEscrow.connect(agent).createAgreement(vendor.address, amount, "software", duration);
    await arcEscrow.connect(agent).fundAgreement(1);

    // Immediate refund attempt -> Revert
    await expect(arcEscrow.connect(agent).refund(1)).to.be.revertedWith(
      "ArcEscrow: Deadline has not passed"
    );
  });

  it("7. Refund after deadline works and restores depositor balance", async function () {
    const amount = ethers.parseUnits("2500", 6);
    const duration = 60; // 60 seconds
    await arcEscrow.connect(agent).createAgreement(vendor.address, amount, "software", duration);
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
});
