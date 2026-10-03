import { type Hex, keccak256, parseUnits, toHex } from "viem";

import { ARC_ESCROW_ABI } from "../contracts/arc-escrow";
import { ensureUsdcAllowance, getArcPublicClient, getArcWalletClient } from "./balances";
import { executeCircleContractCall } from "./client";
import { ARC_CONFIG, isCircleConfigured, isSimulationMode } from "./config";

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
  decisionHash?: Hex | string;
  privateKey?: Hex;
  walletId?: string;
  forceRealChain?: boolean;
}): Promise<{
  isSimulation: boolean;
  agreementId: string;
  txHash: string | null;
  decisionHash: string;
}> {
  const idKey = params.idempotencyKey
    ? (params.idempotencyKey.startsWith("0x") && params.idempotencyKey.length === 66
        ? (params.idempotencyKey as Hex)
        : keccak256(toHex(params.idempotencyKey)))
    : keccak256(toHex(`agreement-${Date.now()}`));

  const decHash: Hex = params.decisionHash
    ? (params.decisionHash.startsWith("0x") && params.decisionHash.length === 66
        ? (params.decisionHash as Hex)
        : keccak256(toHex(params.decisionHash)))
    : idKey;

  if (isSimulationMode(params.forceRealChain)) {
    return {
      isSimulation: true,
      agreementId: `sim-${Date.now()}`,
      txHash: null,
      decisionHash: decHash,
    };
  }

  const escrowAddress = ARC_CONFIG.escrowContractAddress as `0x${string}`;
  const amountUnits = parseUnits(params.amount.toFixed(6), 6);
  const baselineUnits =
    params.baselinePrice !== undefined
      ? parseUnits(params.baselinePrice.toFixed(6), 6)
      : amountUnits;
  const duration = params.durationSeconds || BigInt(2592000); // 30 days

  const targetWalletId = params.walletId || process.env.CIRCLE_WALLET_ID;

  // Prefer Circle Developer-Controlled Wallets contract execution
  if (isCircleConfigured() && targetWalletId && !params.privateKey) {
    try {
      let circleRes;
      try {
        circleRes = await executeCircleContractCall({
          walletId: targetWalletId,
          contractAddress: escrowAddress,
          abiFunctionSignature:
            "createAgreementWithDecision(address,uint256,uint256,string,uint256,bytes32,bytes32)",
          abiParameters: [
            params.vendorWallet,
            amountUnits.toString(),
            baselineUnits.toString(),
            params.category,
            duration.toString(),
            idKey,
            decHash,
          ],
          idempotencyKey: params.idempotencyKey,
          refId: `create-ag-${Date.now()}`,
        });
      } catch {
        circleRes = await executeCircleContractCall({
          walletId: targetWalletId,
          contractAddress: escrowAddress,
          abiFunctionSignature:
            "createAgreementWithSavings(address,uint256,uint256,string,uint256,bytes32)",
          abiParameters: [
            params.vendorWallet,
            amountUnits.toString(),
            baselineUnits.toString(),
            params.category,
            duration.toString(),
            idKey,
          ],
          idempotencyKey: params.idempotencyKey,
          refId: `create-ag-${Date.now()}`,
        });
      }

      if (circleRes.txHash) {
        const publicClient = getArcPublicClient();
        const nextId = await publicClient.readContract({
          address: escrowAddress,
          abi: ARC_ESCROW_ABI,
          functionName: "nextAgreementId",
        });
        const agreementId = (nextId - BigInt(1)).toString();
        return { isSimulation: false, agreementId, txHash: circleRes.txHash, decisionHash: decHash };
      }
    } catch (circleErr) {
      console.warn(
        "[Circle] SDK createAgreement fallback to Viem client:",
        circleErr,
      );
    }
  }

  const { walletClient, publicClient } = getArcWalletClient(params.privateKey);

  let txHash: `0x${string}`;
  try {
    txHash = await walletClient.writeContract({
      address: escrowAddress,
      abi: ARC_ESCROW_ABI,
      functionName: "createAgreementWithDecision",
      args: [
        params.vendorWallet as `0x${string}`,
        amountUnits,
        baselineUnits,
        params.category,
        duration,
        idKey,
        decHash,
      ],
    });
  } catch (contractErr) {
    // If deployed contract bytecode lacks createAgreementWithDecision, fall back to createAgreementWithSavings
    txHash = await walletClient.writeContract({
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
  }

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

  return { isSimulation: false, agreementId, txHash, decisionHash: decHash };
}

/**
 * Funds an escrow agreement on ArcEscrow.sol.
 * Transferred USDC leaves the caller and enters the ArcEscrow contract.
 */
export async function fundArcEscrowAgreement(params: {
  agreementId: string | number | bigint;
  amount: number;
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

  // Prefer Circle Developer-Controlled Wallets contract execution
  if (isCircleConfigured() && targetWalletId && !params.privateKey) {
    try {
      const circleRes = await executeCircleContractCall({
        walletId: targetWalletId,
        contractAddress: escrowAddress,
        abiFunctionSignature: "fundAgreement(uint256)",
        abiParameters: [agId.toString()],
        refId: `fund-ag-${agId}`,
      });
      if (circleRes.txHash) {
        return { isSimulation: false, txHash: circleRes.txHash };
      }
    } catch (circleErr) {
      console.warn(
        "[Circle] SDK fundAgreement fallback to Viem client:",
        circleErr,
      );
    }
  }

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
    args: [agId],
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
