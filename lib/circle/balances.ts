import { getCircleWalletBalance } from "./client";
import { ARC_CONFIG, isCircleConfigured } from "./config";

// Re-export modular domain subsystems for full backward compatibility
export * from "./arc-client";
export * from "./gateway";
export * from "./usyc";

/**
 * Low-level Arc Testnet JSON-RPC eth_call for ERC-20 balanceOf (selector 0x70a08231).
 * Deduplicates raw RPC call, hex address normalization, and 6-decimal USDC parsing.
 */
async function queryArcUsdcBalanceOnChain(
  walletAddress: string,
  timeoutMs: number,
): Promise<number> {
  const cleanAddress = walletAddress
    .toLowerCase()
    .replace(/^0x/, "")
    .padStart(64, "0");
  const callData = `0x70a08231${cleanAddress}`;

  const rpcUrl = process.env.ARC_RPC_URL || ARC_CONFIG.rpcUrl;
  const response = await fetch(rpcUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    signal: AbortSignal.timeout(timeoutMs),
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

  // Parse 6 decimals for USDC on Arc
  const rawBigInt = BigInt(json.result);
  return Number(rawBigInt) / 1_000_000;
}

/**
 * Reads USDC token balance directly from Arc Testnet EVM JSON-RPC using the ERC-20
 * precompile interface at 0x3600000000000000000000000000000000000000.
 * Decimals on Arc USDC = 6. Strict validation: throws on malformed address or RPC errors.
 */
export async function getOnChainUSDCBalance(
  walletAddress: string,
): Promise<number> {
  if (!walletAddress || !walletAddress.startsWith("0x")) {
    throw new Error(`Invalid EVM wallet address: ${walletAddress}`);
  }

  return queryArcUsdcBalanceOnChain(walletAddress, 3000);
}

/**
 * Polls the Arc Testnet RPC directly via eth_call to query live USDC token balance.
 * Returns 0 on address validation failure or RPC timeout for resilient UI polling.
 */
export async function getArcUsdcBalance(address: string): Promise<number> {
  if (!address || !address.startsWith("0x")) return 0;
  try {
    return await queryArcUsdcBalanceOnChain(address, 1000);
  } catch (err) {
    if (process.env.NODE_ENV !== "test") {
      console.warn("[Circle/Arc] Failed to query live Arc USDC balance:", err);
    }
    return 0;
  }
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
