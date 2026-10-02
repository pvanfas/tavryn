import { Blockchain } from "@circle-fin/developer-controlled-wallets";

import {
  DEFAULT_ARC_CHAIN_ID,
  DEFAULT_ARC_ESCROW_CONTRACT,
  DEFAULT_ARC_EXPLORER_URL,
  DEFAULT_ARC_FAUCET_URL,
  DEFAULT_ARC_RPC_URL,
  DEFAULT_ARC_USDC_CONTRACT,
  DEFAULT_CIRCLE_BLOCKCHAIN,
} from "../constants";

/**
 * Circle & Arc Network Configuration
 * All values are configurable via environment variables with safe defaults for Arc Testnet.
 */
export const ARC_CONFIG = {
  blockchain: (process.env.CIRCLE_BLOCKCHAIN ||
    DEFAULT_CIRCLE_BLOCKCHAIN) as Blockchain,
  rpcUrl: process.env.NEXT_PUBLIC_ARC_RPC_URL || DEFAULT_ARC_RPC_URL,
  chainId: Number(process.env.NEXT_PUBLIC_ARC_CHAIN_ID || DEFAULT_ARC_CHAIN_ID),
  usdcContractAddress:
    process.env.NEXT_PUBLIC_USDC_CONTRACT_ADDRESS || DEFAULT_ARC_USDC_CONTRACT,
  escrowContractAddress:
    process.env.NEXT_PUBLIC_ESCROW_CONTRACT_ADDRESS ||
    DEFAULT_ARC_ESCROW_CONTRACT,
  faucetUrl: process.env.NEXT_PUBLIC_ARC_FAUCET_URL || DEFAULT_ARC_FAUCET_URL,
  explorerUrl:
    process.env.NEXT_PUBLIC_ARC_EXPLORER_URL || DEFAULT_ARC_EXPLORER_URL,
};

/**
 * Checks whether Circle credentials are configured in the current environment.
 */
export function isCircleConfigured(): boolean {
  return Boolean(
    process.env.CIRCLE_API_KEY && process.env.CIRCLE_ENTITY_SECRET,
  );
}

/**
 * Checks whether the environment is in simulation-only mode.
 * Simulation mode triggers when LLM_PROVIDER is 'mock' or when neither
 * Circle credentials nor ARC_PRIVATE_KEY are provided.
 */
export function isSimulationMode(forceRealChain?: boolean): boolean {
  if (forceRealChain) return false;
  if (
    process.env.FORCE_REAL_CHAIN === "true" ||
    process.env.FORCE_REAL_ESCROW === "true"
  ) {
    return false;
  }
  if (process.env.LLM_PROVIDER === "mock") return true;
  if (!isCircleConfigured() && !process.env.ARC_PRIVATE_KEY) return true;
  return false;
}
