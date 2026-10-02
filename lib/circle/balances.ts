import {
  createPublicClient,
  createWalletClient,
  type Hex,
  http,
  parseUnits,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";

import { arcTestnet, USDC_ABI } from "../contracts/arc-escrow";
import { getCircleWalletBalance } from "./client";
import { ARC_CONFIG, isCircleConfigured } from "./config";

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
 * Reads USDC token balance directly from Arc Testnet EVM JSON-RPC using the ERC-20
 * precompile interface at 0x3600000000000000000000000000000000000000.
 * Decimals on Arc USDC = 6.
 */
export async function getOnChainUSDCBalance(
  walletAddress: string,
): Promise<number> {
  if (!walletAddress || !walletAddress.startsWith("0x")) {
    throw new Error(`Invalid EVM wallet address: ${walletAddress}`);
  }

  // ERC-20 balanceOf(address) function selector: 0x70a08231
  const cleanAddress = walletAddress
    .toLowerCase()
    .replace(/^0x/, "")
    .padStart(64, "0");
  const callData = `0x70a08231${cleanAddress}`;

  const rpcUrl = process.env.ARC_RPC_URL || ARC_CONFIG.rpcUrl;
  const response = await fetch(rpcUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "eth_call",
      params: [
        {
          to: ARC_CONFIG.usdcContractAddress,
          data: callData,
        },
        "latest",
      ],
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(
      `Arc RPC returned HTTP ${response.status}: ${response.statusText}`,
    );
  }

  const json = await response.json();
  if (json.error) {
    throw new Error(
      `Arc RPC error: ${json.error.message || JSON.stringify(json.error)}`,
    );
  }

  if (!json.result || json.result === "0x") {
    return 0;
  }

  // Parse 6 decimals for USDC
  const rawBigInt = BigInt(json.result);
  return Number(rawBigInt) / 1_000_000;
}

/**
 * Universal USDC Balance fetcher:
 * Tries on-chain direct Arc RPC first when wallet address is known (fast & ground-truth on chain),
 * or falls back to Circle Developer-Controlled Wallets API when walletId is provided.
 */
export async function getTreasuryUSDCBalance(params: {
  walletAddress?: string | null;
  walletId?: string | null;
}): Promise<{
  balance: number;
  source: "chain_rpc" | "circle_api";
  address: string | null;
}> {
  // 1. Direct on-chain EVM RPC read
  if (params.walletAddress && params.walletAddress.startsWith("0x")) {
    try {
      const balance = await getOnChainUSDCBalance(params.walletAddress);
      return {
        balance,
        source: "chain_rpc",
        address: params.walletAddress,
      };
    } catch (rpcErr) {
      console.warn(
        "Direct Arc RPC balance check failed, trying Circle API:",
        (rpcErr as Error).message,
      );
    }
  }

  // 2. Circle Wallets API read
  if (params.walletId && isCircleConfigured()) {
    try {
      const balance = await getCircleWalletBalance(params.walletId);
      return {
        balance,
        source: "circle_api",
        address: params.walletAddress || null,
      };
    } catch (circleErr) {
      console.warn(
        "Circle API balance check failed:",
        (circleErr as Error).message,
      );
    }
  }

  throw new Error(
    "Unable to fetch balance: neither Arc RPC nor Circle API succeeded",
  );
}

/**
 * Polls the Arc Testnet RPC directly via eth_call to query the live USDC token balance.
 */
export async function getArcUsdcBalance(address: string): Promise<number> {
  if (!address || !address.startsWith("0x")) return 0;
  try {
    // 0x70a08231 is balanceOf(address) signature
    const paddedAddress = address
      .toLowerCase()
      .replace(/^0x/, "")
      .padStart(64, "0");
    const data = `0x70a08231${paddedAddress}`;

    const rpcUrl = process.env.ARC_RPC_URL || ARC_CONFIG.rpcUrl;
    const res = await fetch(rpcUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: AbortSignal.timeout(1000),
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "eth_call",
        params: [
          {
            to: ARC_CONFIG.usdcContractAddress,
            data,
          },
          "latest",
        ],
      }),
    });

    if (!res.ok) return 0;
    const json = await res.json();
    if (!json.result || json.result === "0x") return 0;
    // USDC on Arc has 6 decimals
    const rawVal = BigInt(json.result);
    return Number(rawVal) / 1e6;
  } catch (err) {
    if (process.env.NODE_ENV !== "test") {
      console.warn("[Circle/Arc] Failed to query live Arc USDC balance:", err);
    }
    return 0;
  }
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
