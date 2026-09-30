import {
  Blockchain,
  type CircleDeveloperControlledWalletsClient,
  initiateDeveloperControlledWalletsClient,
} from "@circle-fin/developer-controlled-wallets";
import crypto from "crypto";

/**
 * Circle & Arc Network Configuration
 * All values are configurable via environment variables with safe defaults for Arc Testnet.
 */
export const ARC_CONFIG = {
  blockchain: (process.env.CIRCLE_BLOCKCHAIN || "ARC-TESTNET") as Blockchain,
  rpcUrl:
    process.env.NEXT_PUBLIC_ARC_RPC_URL || "https://rpc.testnet.arc.network",
  chainId: Number(process.env.NEXT_PUBLIC_ARC_CHAIN_ID || 5042002),
  usdcContractAddress:
    process.env.NEXT_PUBLIC_USDC_CONTRACT_ADDRESS ||
    "0x3600000000000000000000000000000000000000",
  escrowContractAddress:
    process.env.NEXT_PUBLIC_ESCROW_CONTRACT_ADDRESS ||
    "0x880eF868be5484852086eA9d424b94D673752e50",
  faucetUrl:
    process.env.NEXT_PUBLIC_ARC_FAUCET_URL || "https://faucet.circle.com",
  explorerUrl:
    process.env.NEXT_PUBLIC_ARC_EXPLORER_URL || "https://testnet.arcscan.app",
};

let cachedClient: CircleDeveloperControlledWalletsClient | null = null;

/**
 * Initializes and returns the Circle Developer-Controlled Wallets SDK client.
 * Throws a descriptive error if required environment credentials are missing.
 */
export function getCircleClient(): CircleDeveloperControlledWalletsClient {
  if (cachedClient) {
    return cachedClient;
  }

  const apiKey = process.env.CIRCLE_API_KEY;
  const entitySecret = process.env.CIRCLE_ENTITY_SECRET;

  if (!apiKey || !entitySecret) {
    throw new Error(
      "Missing required Circle credentials. Please set CIRCLE_API_KEY and CIRCLE_ENTITY_SECRET in .env.local.",
    );
  }

  cachedClient = initiateDeveloperControlledWalletsClient({
    apiKey,
    entitySecret,
  });

  return cachedClient;
}

/**
 * Returns whether Circle credentials are configured in the current environment.
 */
export function isCircleConfigured(): boolean {
  return Boolean(
    process.env.CIRCLE_API_KEY && process.env.CIRCLE_ENTITY_SECRET,
  );
}

/**
 * Creates a developer-controlled Smart Contract Account (SCA) treasury wallet on Arc Testnet.
 *
 * If CIRCLE_WALLET_SET_ID is not provided in env, it dynamically resolves or creates
 * a wallet set named "Tavryn Treasury Wallets".
 */
export async function createTreasuryWallet(params: {
  businessId: string;
  businessName: string;
}): Promise<{
  walletId: string;
  address: string;
  blockchain: string;
  walletSetId: string;
}> {
  if (!isCircleConfigured()) {
    const deterministicHash = crypto
      .createHash("sha256")
      .update(`tavryn-treasury-${params.businessId}`)
      .digest("hex");
    const fallbackAddress = `0x${deterministicHash.slice(0, 40)}`;
    return {
      walletId: `sim-wallet-${params.businessId}`,
      address: fallbackAddress,
      blockchain: ARC_CONFIG.blockchain,
      walletSetId: "sim-wallet-set",
    };
  }

  const client = getCircleClient();

  let walletSetId = process.env.CIRCLE_WALLET_SET_ID;

  if (!walletSetId) {
    try {
      // Check existing wallet sets first
      const existingSets = await client.listWalletSets({});
      const found =
        existingSets.data?.walletSets?.find(
          (ws) =>
            "name" in ws &&
            (ws as { name?: string }).name === "Tavryn Treasury Wallets",
        ) || existingSets.data?.walletSets?.[0];
      if (found?.id) {
        walletSetId = found.id;
      }
    } catch {
      // Continue to create if listing fails
    }

    if (!walletSetId) {
      const createdSet = await client.createWalletSet({
        name: "Tavryn Treasury Wallets",
      });
      if (!createdSet.data?.walletSet?.id) {
        throw new Error("Failed to create Circle Wallet Set for treasury");
      }
      walletSetId = createdSet.data.walletSet.id;
    }
  }

  // Create SCA wallet on Arc Testnet
  const response = await client.createWallets({
    accountType: "SCA",
    blockchains: [ARC_CONFIG.blockchain],
    walletSetId,
    count: 1,
    metadata: [
      {
        name: `${params.businessName.slice(0, 20)} Treasury`,
        refId: `biz_${params.businessId}`,
      },
    ],
  });

  const wallet = response.data?.wallets?.[0];
  if (!wallet?.id || !wallet?.address) {
    throw new Error(
      "Failed to create Circle Developer-Controlled Wallet on Arc Testnet",
    );
  }

  return {
    walletId: wallet.id,
    address: wallet.address,
    blockchain: wallet.blockchain,
    walletSetId,
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
 * Reads token balance for a Circle Developer-Controlled wallet using Circle's API.
 */
export async function getCircleWalletBalance(
  walletId: string,
): Promise<number> {
  const client = getCircleClient();
  const response = await client.getWalletTokenBalance({
    id: walletId,
    includeAll: true,
  });

  const usdcToken = response.data?.tokenBalances?.find(
    (tb) => tb.token.symbol?.toUpperCase() === "USDC",
  );

  if (
    !usdcToken ||
    usdcToken.amount === undefined ||
    usdcToken.amount === null
  ) {
    return 0;
  }

  return Number(usdcToken.amount);
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
 * Sends USDC from a developer-controlled wallet to a destination on Arc Testnet.
 * Includes idempotency key protection and medium fee tier gas sponsorship.
 */
export async function sendUSDC(params: {
  walletId: string;
  destinationAddress: string;
  amount: number | string;
  idempotencyKey?: string;
  refId?: string;
}): Promise<{
  transactionId: string;
  state?: string;
}> {
  const client = getCircleClient();

  const numAmount = Number(params.amount);
  if (isNaN(numAmount) || numAmount <= 0) {
    throw new Error(`Invalid transfer amount: ${params.amount}`);
  }

  if (
    !params.destinationAddress ||
    !params.destinationAddress.startsWith("0x")
  ) {
    throw new Error(
      `Invalid destination EVM address: ${params.destinationAddress}`,
    );
  }

  const amountStr = numAmount.toFixed(6);

  const response = await client.createTransaction({
    walletId: params.walletId,
    destinationAddress: params.destinationAddress,
    amount: [amountStr],
    tokenAddress: ARC_CONFIG.usdcContractAddress,
    fee: {
      type: "level",
      config: {
        feeLevel: "MEDIUM",
      },
    },
    idempotencyKey: params.idempotencyKey,
    refId: params.refId,
  });

  if (!response.data?.id) {
    throw new Error(
      "Circle did not return a transaction ID for the USDC transfer",
    );
  }

  return {
    transactionId: response.data.id,
    state: response.data.state,
  };
}
