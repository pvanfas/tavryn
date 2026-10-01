import {
  Blockchain,
  type CircleDeveloperControlledWalletsClient,
  initiateDeveloperControlledWalletsClient,
} from "@circle-fin/developer-controlled-wallets";
import crypto from "crypto";
import {
  createPublicClient,
  createWalletClient,
  type Hex,
  http,
  keccak256,
  parseUnits,
  toHex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";

import {
  DEFAULT_ARC_CHAIN_ID,
  DEFAULT_ARC_ESCROW_CONTRACT,
  DEFAULT_ARC_EXPLORER_URL,
  DEFAULT_ARC_FAUCET_URL,
  DEFAULT_ARC_RPC_URL,
  DEFAULT_ARC_USDC_CONTRACT,
  DEFAULT_CIRCLE_BLOCKCHAIN,
} from "./constants";
import { ARC_ESCROW_ABI, arcTestnet, USDC_ABI } from "./contracts/arc-escrow";

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
    console.warn("[Circle/Arc] Failed to query live Arc USDC balance:", err);
    return 0;
  }
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

/**
 * Creates an escrow agreement on ArcEscrow.sol.
 * Returns the created agreementId and transaction hash.
 */
export async function createArcEscrowAgreement(params: {
  vendorWallet: string;
  amount: number;
  baselinePrice?: number;
  category: string;
  durationSeconds?: bigint;
  idempotencyKey?: string;
  privateKey?: Hex;
  forceRealChain?: boolean;
}): Promise<{
  isSimulation: boolean;
  agreementId: string;
  txHash: string | null;
}> {
  if (isSimulationMode(params.forceRealChain)) {
    return {
      isSimulation: true,
      agreementId: `sim-${Date.now()}`,
      txHash: null,
    };
  }

  const { walletClient, publicClient } = getArcWalletClient(params.privateKey);
  const escrowAddress = ARC_CONFIG.escrowContractAddress as `0x${string}`;
  const amountUnits = parseUnits(params.amount.toFixed(6), 6);
  const baselineUnits =
    params.baselinePrice !== undefined
      ? parseUnits(params.baselinePrice.toFixed(6), 6)
      : amountUnits;
  const duration = params.durationSeconds || BigInt(2592000); // 30 days
  const idKey = params.idempotencyKey
    ? keccak256(toHex(params.idempotencyKey))
    : keccak256(toHex(`agreement-${Date.now()}`));

  const txHash = await walletClient.writeContract({
    address: escrowAddress,
    abi: ARC_ESCROW_ABI,
    functionName: "createAgreementWithSavings",
    args: [
      params.vendorWallet as `0x${string}`,
      amountUnits,
      baselineUnits,
      params.category,
      duration,
      idKey,
    ],
  });

  const receipt = await publicClient.waitForTransactionReceipt({
    hash: txHash,
  });
  if (receipt.status === "reverted") {
    throw new Error(
      `ArcEscrow createAgreement transaction reverted on-chain: ${txHash}`,
    );
  }

  const nextId = await publicClient.readContract({
    address: escrowAddress,
    abi: ARC_ESCROW_ABI,
    functionName: "nextAgreementId",
  });
  const agreementId = (nextId - BigInt(1)).toString();

  return { isSimulation: false, agreementId, txHash };
}

/**
 * Funds an escrow agreement on ArcEscrow.sol.
 * Transferred USDC leaves the caller and enters the ArcEscrow contract.
 */
export async function fundArcEscrowAgreement(params: {
  agreementId: string | number | bigint;
  amount: number;
  privateKey?: Hex;
  forceRealChain?: boolean;
}): Promise<{ isSimulation: boolean; txHash: string | null }> {
  if (isSimulationMode(params.forceRealChain)) {
    return { isSimulation: true, txHash: null };
  }

  const escrowAddress = ARC_CONFIG.escrowContractAddress as `0x${string}`;
  const requiredAmount = parseUnits(params.amount.toFixed(6), 6);

  await ensureUsdcAllowance({
    spenderAddress: escrowAddress,
    requiredAmount,
    privateKey: params.privateKey,
  });

  const { walletClient, publicClient } = getArcWalletClient(params.privateKey);
  const txHash = await walletClient.writeContract({
    address: escrowAddress,
    abi: ARC_ESCROW_ABI,
    functionName: "fundAgreement",
    args: [BigInt(params.agreementId)],
  });

  const receipt = await publicClient.waitForTransactionReceipt({
    hash: txHash,
  });
  if (receipt.status === "reverted") {
    throw new Error(
      `ArcEscrow fundAgreement transaction reverted on-chain: ${txHash}`,
    );
  }

  return { isSimulation: false, txHash };
}

/**
 * Submits milestone and approves via verifier role on ArcEscrow.sol.
 */
export async function approveArcEscrowMilestone(params: {
  agreementId: string | number | bigint;
  milestoneDescription?: string;
  privateKey?: Hex;
  forceRealChain?: boolean;
}): Promise<{ isSimulation: boolean; txHash: string | null }> {
  if (isSimulationMode(params.forceRealChain)) {
    return { isSimulation: true, txHash: null };
  }

  const escrowAddress = ARC_CONFIG.escrowContractAddress as `0x${string}`;
  const { walletClient, publicClient } = getArcWalletClient(params.privateKey);
  const agId = BigInt(params.agreementId);

  const agreement = await publicClient.readContract({
    address: escrowAddress,
    abi: ARC_ESCROW_ABI,
    functionName: "getAgreement",
    args: [agId],
  });

  // If status is Funded (1), submit milestone
  if (agreement.status === 1) {
    const submitTx = await walletClient.writeContract({
      address: escrowAddress,
      abi: ARC_ESCROW_ABI,
      functionName: "submitMilestone",
      args: [agId, params.milestoneDescription || "SaaS Delivery Verified"],
    });
    await publicClient.waitForTransactionReceipt({ hash: submitTx });
  }

  // Approve milestone as verifier
  const approveTx = await walletClient.writeContract({
    address: escrowAddress,
    abi: ARC_ESCROW_ABI,
    functionName: "approveMilestone",
    args: [agId],
  });
  await publicClient.waitForTransactionReceipt({ hash: approveTx });

  return { isSimulation: false, txHash: approveTx };
}

/**
 * Releases payment from ArcEscrow.sol to the vendor.
 * Calls the contract's release function.
 * If Circle Developer-Controlled Wallet is configured, executes through Circle's
 * contract execution transaction API. Otherwise, uses Viem wallet client on Arc Testnet.
 */
export async function releaseArcEscrowPayment(params: {
  agreementId: string | number | bigint;
  privateKey?: Hex;
  walletId?: string;
  forceRealChain?: boolean;
}): Promise<{ isSimulation: boolean; txHash: string | null }> {
  if (isSimulationMode(params.forceRealChain)) {
    return { isSimulation: true, txHash: null };
  }

  const escrowAddress = ARC_CONFIG.escrowContractAddress as `0x${string}`;
  const agId = BigInt(params.agreementId);
  const targetWalletId = params.walletId || process.env.CIRCLE_WALLET_ID;

  // Prefer Circle SDK contract execution if Circle is configured and wallet ID present
  if (isCircleConfigured() && targetWalletId && !params.privateKey) {
    try {
      const circleRes = await executeCircleContractCall({
        walletId: targetWalletId,
        contractAddress: escrowAddress,
        abiFunctionSignature: "release(uint256)",
        abiParameters: [agId.toString()],
        refId: `release-ag-${agId}`,
      });
      if (circleRes.txHash) {
        return { isSimulation: false, txHash: circleRes.txHash };
      }
    } catch (circleErr) {
      console.warn(
        "[Circle] SDK contract execution fallback to Viem client:",
        circleErr,
      );
    }
  }

  // Viem on-chain execution on Arc Testnet
  const { walletClient, publicClient } = getArcWalletClient(params.privateKey);
  const releaseTx = await walletClient.writeContract({
    address: escrowAddress,
    abi: ARC_ESCROW_ABI,
    functionName: "release",
    args: [agId],
  });

  const receipt = await publicClient.waitForTransactionReceipt({
    hash: releaseTx,
  });
  if (receipt.status === "reverted") {
    throw new Error(
      `ArcEscrow release transaction reverted on-chain: ${releaseTx}`,
    );
  }

  return { isSimulation: false, txHash: releaseTx };
}

/**
 * Refunds deposited funds from ArcEscrow.sol back to depositor after deadline.
 * If Circle Developer-Controlled Wallet is configured, executes through Circle SDK.
 * Otherwise, uses Viem wallet client on Arc Testnet.
 */
export async function refundArcEscrowAgreement(params: {
  agreementId: string | number | bigint;
  privateKey?: Hex;
  walletId?: string;
  forceRealChain?: boolean;
}): Promise<{ isSimulation: boolean; txHash: string | null }> {
  if (isSimulationMode(params.forceRealChain)) {
    return { isSimulation: true, txHash: null };
  }

  const escrowAddress = ARC_CONFIG.escrowContractAddress as `0x${string}`;
  const agId = BigInt(params.agreementId);
  const targetWalletId = params.walletId || process.env.CIRCLE_WALLET_ID;

  if (isCircleConfigured() && targetWalletId && !params.privateKey) {
    try {
      const circleRes = await executeCircleContractCall({
        walletId: targetWalletId,
        contractAddress: escrowAddress,
        abiFunctionSignature: "refund(uint256)",
        abiParameters: [agId.toString()],
        refId: `refund-ag-${agId}`,
      });
      if (circleRes.txHash) {
        return { isSimulation: false, txHash: circleRes.txHash };
      }
    } catch (circleErr) {
      console.warn(
        "[Circle] SDK contract execution fallback to Viem client:",
        circleErr,
      );
    }
  }

  const { walletClient, publicClient } = getArcWalletClient(params.privateKey);
  const refundTx = await walletClient.writeContract({
    address: escrowAddress,
    abi: ARC_ESCROW_ABI,
    functionName: "refund",
    args: [agId],
  });

  const receipt = await publicClient.waitForTransactionReceipt({
    hash: refundTx,
  });
  if (receipt.status === "reverted") {
    throw new Error(
      `ArcEscrow refund transaction reverted on-chain: ${refundTx}`,
    );
  }

  return { isSimulation: false, txHash: refundTx };
}

/**
 * Resolves the on-chain agreementId for an escrow transaction using its idempotencyKey.
 */
export async function getAgreementIdForTransaction(params: {
  idempotencyKey?: string;
  agreementId?: string | number | bigint;
}): Promise<bigint | null> {
  if (params.agreementId) {
    return BigInt(params.agreementId);
  }
  if (!params.idempotencyKey) {
    return null;
  }
  try {
    const publicClient = getArcPublicClient();
    const escrowAddress = ARC_CONFIG.escrowContractAddress as `0x${string}`;
    const idKey = keccak256(toHex(params.idempotencyKey));
    const agreementId = await publicClient.readContract({
      address: escrowAddress,
      abi: ARC_ESCROW_ABI,
      functionName: "agreementByIdempotencyKey",
      args: [idKey],
    });
    if (agreementId > BigInt(0)) {
      return agreementId;
    }
  } catch (err) {
    console.warn("Could not query agreementByIdempotencyKey on-chain:", err);
  }
  return null;
}

/**
 * Reads an agreement from ArcEscrow.sol.
 */
export async function getArcEscrowAgreement(
  agreementId: string | number | bigint,
) {
  const publicClient = getArcPublicClient();
  const escrowAddress = ARC_CONFIG.escrowContractAddress as `0x${string}`;
  return publicClient.readContract({
    address: escrowAddress,
    abi: ARC_ESCROW_ABI,
    functionName: "getAgreement",
    args: [BigInt(agreementId)],
  });
}
