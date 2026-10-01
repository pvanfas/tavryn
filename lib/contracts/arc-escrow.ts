import { defineChain, parseAbi } from "viem";

import {
  DEFAULT_ARC_CHAIN_ID,
  DEFAULT_ARC_EXPLORER_URL,
  DEFAULT_ARC_RPC_URL,
} from "../constants";

/**
 * Arc Testnet Chain Definition for viem
 * Chain ID: 5042002
 * Native Gas Token: USDC (6 decimals)
 */
export const arcTestnet = defineChain({
  id: DEFAULT_ARC_CHAIN_ID,
  name: "Arc Testnet",
  nativeCurrency: {
    name: "USD Coin",
    symbol: "USDC",
    decimals: 6,
  },
  rpcUrls: {
    default: {
      http: [
        process.env.ARC_RPC_URL ||
          process.env.NEXT_PUBLIC_ARC_RPC_URL ||
          DEFAULT_ARC_RPC_URL,
      ],
    },
    public: {
      http: [DEFAULT_ARC_RPC_URL],
    },
  },
  blockExplorers: {
    default: {
      name: "ArcScan",
      url: DEFAULT_ARC_EXPLORER_URL,
    },
  },
  testnet: true,
});

/**
 * Human-readable ABI for ArcEscrow.sol
 * Matches contracts/contracts/ArcEscrow.sol bytecode
 */
export const ARC_ESCROW_ABI = parseAbi([
  "function createAgreement(address vendor, uint256 amount, string category, uint256 durationSeconds) external returns (uint256)",
  "function createAgreementWithIdempotency(address vendor, uint256 amount, string category, uint256 durationSeconds, bytes32 idempotencyKey) external returns (uint256)",
  "function createAgreementWithSavings(address vendor, uint256 amount, uint256 baselinePrice, string category, uint256 durationSeconds, bytes32 idempotencyKey) external returns (uint256)",
  "function fundAgreement(uint256 agreementId) external",
  "function submitMilestone(uint256 agreementId, string description) external",
  "function approveMilestone(uint256 agreementId) external",
  "function release(uint256 agreementId) external",
  "function refund(uint256 agreementId) external",
  "function nextAgreementId() external view returns (uint256)",
  "function agreements(uint256 agreementId) external view returns (uint256 id, address depositor, address vendor, uint256 amount, uint256 baselinePrice, uint256 savings, uint256 feeAmount, string category, uint256 deadline, uint8 status, string milestoneDescription, uint256 createdAt)",
  "function agreementByIdempotencyKey(bytes32 idempotencyKey) external view returns (uint256)",
  "function getAgreement(uint256 agreementId) external view returns ((uint256 id, address depositor, address vendor, uint256 amount, uint256 baselinePrice, uint256 savings, uint256 feeAmount, string category, uint256 deadline, uint8 status, string milestoneDescription, uint256 createdAt))",
  "function maxPerAgreement() external view returns (uint256)",
  "function categoryBudgets(string category) external view returns (uint256)",
  "function categorySpent(string category) external view returns (uint256)",
  "function feeBps() external view returns (uint256)",
  "function feeRecipient() external view returns (address)",
  "function owner() external view returns (address)",
  "function agent() external view returns (address)",
  "function verifier() external view returns (address)",
  "event AgreementCreated(uint256 indexed agreementId, address indexed depositor, address indexed vendor, uint256 amount, string category, uint256 deadline)",
  "event AgreementFunded(uint256 indexed agreementId, uint256 amount)",
  "event MilestoneSubmitted(uint256 indexed agreementId, string description)",
  "event MilestoneApproved(uint256 indexed agreementId, address indexed verifier)",
  "event FundsReleased(uint256 indexed agreementId, address indexed vendor, uint256 amount)",
  "event FeeCollected(uint256 indexed agreementId, address indexed recipient, uint256 feeAmount)",
  "event FundsRefunded(uint256 indexed agreementId, address indexed depositor, uint256 amount)",
]);

/**
 * Human-readable ABI for Arc USDC Precompile (ERC-20)
 * Address: 0x3600000000000000000000000000000000000000
 */
export const USDC_ABI = parseAbi([
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function allowance(address owner, address spender) external view returns (uint256)",
  "function balanceOf(address account) external view returns (uint256)",
  "function transfer(address to, uint256 amount) external returns (bool)",
  "function transferFrom(address from, address to, uint256 amount) external returns (bool)",
]);

export const AgreementStatus = {
  Created: 0,
  Funded: 1,
  MilestoneSubmitted: 2,
  MilestoneApproved: 3,
  Released: 4,
  Refunded: 5,
} as const;

export type AgreementStatus =
  (typeof AgreementStatus)[keyof typeof AgreementStatus];
