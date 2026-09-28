const { ethers } = require("hardhat");

async function main() {
  console.log("Starting ArcEscrow deployment on Arc Testnet (Chain ID 5042002)...");

  const [deployer] = await ethers.getSigners();
  console.log("Deploying contract with account:", deployer.address);

  // Arc Testnet USDC Precompile / ERC20 Contract Address
  const ARC_USDC_ADDRESS =
    process.env.NEXT_PUBLIC_USDC_CONTRACT_ADDRESS ||
    "0x3600000000000000000000000000000000000000";

  // Agent Wallet & Verifier Wallet (defaults to deployer or env config)
  const AGENT_ADDRESS = process.env.NEXT_PUBLIC_AGENT_WALLET_ADDRESS || deployer.address;
  const VERIFIER_ADDRESS = process.env.VERIFIER_WALLET_ADDRESS || deployer.address;

  // Max cap: 10,000 USDC (6 decimals)
  const MAX_PER_AGREEMENT = ethers.parseUnits("10000", 6);

  console.log("Parameters:");
  console.log("  USDC Token Address:", ARC_USDC_ADDRESS);
  console.log("  Agent Role:", AGENT_ADDRESS);
  console.log("  Verifier Role:", VERIFIER_ADDRESS);
  console.log("  Max Cap Per Agreement:", "10,000 USDC");

  const ArcEscrow = await ethers.getContractFactory("ArcEscrow");
  const escrow = await ArcEscrow.deploy(
    ARC_USDC_ADDRESS,
    AGENT_ADDRESS,
    VERIFIER_ADDRESS,
    MAX_PER_AGREEMENT
  );

  await escrow.waitForDeployment();
  const contractAddress = await escrow.getAddress();

  console.log("ArcEscrow successfully deployed to:", contractAddress);
  console.log("Explorer link: https://testnet.arcscan.app/address/" + contractAddress);

  // Set initial category budgets
  console.log("Configuring initial category budgets...");
  const tx1 = await escrow.setCategoryBudget("software", ethers.parseUnits("50000", 6));
  await tx1.wait();
  const tx2 = await escrow.setCategoryBudget("cloud", ethers.parseUnits("100000", 6));
  await tx2.wait();
  const tx3 = await escrow.setCategoryBudget("contractors", ethers.parseUnits("30000", 6));
  await tx3.wait();
  console.log("Category budgets configured successfully.");
}

main().catch((error) => {
  console.error("Deployment failed:", error);
  process.exitCode = 1;
});
