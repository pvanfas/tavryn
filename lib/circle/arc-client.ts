import {
  createPublicClient,
  createWalletClient,
  type Hex,
  http,
  parseUnits,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";

import { arcTestnet, USDC_ABI } from "../contracts/arc-escrow";
import { ARC_CONFIG } from "./config";

/**
 * Public client for querying Arc Testnet state
 */
export function getArcPublicClient() {
  const rpcUrl = process.env.ARC_RPC_URL || ARC_CONFIG.rpcUrl;
  return createPublicClient({
    chain: arcTestnet,
    transport: http(rpcUrl),
  });
}

/**
 * Wallet client for executing signed transactions on Arc Testnet
 */
export function getArcWalletClient(privateKeyOverride?: Hex) {
  const pk = privateKeyOverride || (process.env.ARC_PRIVATE_KEY as Hex);
  if (!pk) {
    throw new Error(
      "Missing ARC_PRIVATE_KEY for on-chain contract execution. Configure in .env.local.",
    );
  }
  const account = privateKeyToAccount(pk);
  const rpcUrl = process.env.ARC_RPC_URL || ARC_CONFIG.rpcUrl;
  return {
    account,
    walletClient: createWalletClient({
      account,
      chain: arcTestnet,
      transport: http(rpcUrl),
    }),
    publicClient: getArcPublicClient(),
  };
}

/**
 * Ensures the spender has sufficient USDC allowance on the precompile contract.
 */
export async function ensureUsdcAllowance(params: {
  spenderAddress: `0x${string}`;
  requiredAmount: bigint;
  privateKey?: Hex;
}): Promise<string | null> {
  const { account, walletClient, publicClient } = getArcWalletClient(
    params.privateKey,
  );
  const currentAllowance = await publicClient.readContract({
    address: ARC_CONFIG.usdcContractAddress as `0x${string}`,
    abi: USDC_ABI,
    functionName: "allowance",
    args: [account.address, params.spenderAddress],
  });

  if (currentAllowance < params.requiredAmount) {
    const maxApproval = parseUnits("1000000", 6); // 1M USDC allowance
    const approveTx = await walletClient.writeContract({
      address: ARC_CONFIG.usdcContractAddress as `0x${string}`,
      abi: USDC_ABI,
      functionName: "approve",
      args: [params.spenderAddress, maxApproval],
    });
    await publicClient.waitForTransactionReceipt({ hash: approveTx });
    return approveTx;
  }
  return null;
}
