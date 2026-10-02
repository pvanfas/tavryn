import {
  type CircleDeveloperControlledWalletsClient,
  initiateDeveloperControlledWalletsClient,
} from "@circle-fin/developer-controlled-wallets";
import crypto from "crypto";

import { ARC_CONFIG, isCircleConfigured } from "./config";

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

/**
 * Executes a smart contract transaction via Circle Developer-Controlled Wallets SDK.
 * Submits the call and polls getTransaction until the confirmed txHash is returned.
 */
export async function executeCircleContractCall(params: {
  walletId: string;
  contractAddress: string;
  abiFunctionSignature: string;
  abiParameters: any[];
  idempotencyKey?: string;
  refId?: string;
}): Promise<{ transactionId: string; txHash?: string; state?: string }> {
  const client = getCircleClient();
  const response = await client.createContractExecutionTransaction({
    walletId: params.walletId,
    contractAddress: params.contractAddress,
    abiFunctionSignature: params.abiFunctionSignature,
    abiParameters: params.abiParameters,
    fee: { type: "level", config: { feeLevel: "MEDIUM" } },
    idempotencyKey: params.idempotencyKey,
    refId: params.refId,
  });

  const txId = response.data?.id;
  if (!txId) {
    throw new Error(
      "Circle did not return a transaction ID for contract execution",
    );
  }

  // Poll for txHash
  let txHash = (response.data as any)?.txHash;
  let state = (response.data as any)?.state;
  for (let i = 0; i < 15 && !txHash; i++) {
    await new Promise((r) => setTimeout(r, 1500));
    try {
      const polled = await client.getTransaction({ id: txId });
      txHash = polled.data?.transaction?.txHash;
      state = polled.data?.transaction?.state;
      if (state === "FAILED" || state === "CANCELLED") {
        throw new Error(
          `Circle contract execution failed: ${polled.data?.transaction?.errorReason || state}`,
        );
      }
      if (txHash) break;
    } catch (e: any) {
      if (e.message?.includes("failed")) throw e;
    }
  }

  return { transactionId: txId, txHash, state };
}
