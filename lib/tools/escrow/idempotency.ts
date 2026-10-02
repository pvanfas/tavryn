import crypto from "crypto";

import {
  ARC_CONFIG,
  getAgreementIdForTransaction,
  getArcPublicClient,
  isSimulationMode,
} from "@/lib/circle";
import { ARC_ESCROW_ABI } from "@/lib/contracts/arc-escrow";

import { logAgentAction } from "../audit";

/**
 * Computes a deterministic SHA-256 idempotency key for escrow transactions:
 * sha256(business_id | contract_id | negotiation_id | amount)
 */
export function computeEscrowIdempotencyKey(params: {
  businessId: string;
  contractId?: string | null;
  negotiationId?: string | null;
  amount: number | string;
}): string {
  const payload = `${params.businessId}|${params.contractId || ""}|${params.negotiationId || ""}|${params.amount}`;
  return crypto.createHash("sha256").update(payload).digest("hex");
}

/**
 * Distinguishes definitive on-chain/contract failures (reverts, rejections, budget caps)
 * from ambiguous network timeouts, socket hangups, process kills, or unconfirmed states.
 * Only definitive failures may transition a pending transaction to 'failed'.
 */
export function isDefinitiveOnChainFailure(err: unknown): boolean {
  if (!err) return false;
  const msg = err instanceof Error ? err.message : String(err);
  const lower = msg.toLowerCase();

  // Explicit simulation test flag
  if (
    lower.includes("simulated on-chain rpc error") ||
    lower.includes("simulated failure")
  ) {
    return true;
  }

  // Real EVM reverts (contract execution explicitly rejected on-chain)
  if (
    lower.includes("reverted") ||
    lower.includes("execution reverted") ||
    lower.includes("transactionrevertederror") ||
    lower.includes("contractfunctionrevertederror") ||
    lower.includes("agentnotauthorized") ||
    lower.includes("categorybudgetexceeded") ||
    lower.includes("agreementcapexceeded") ||
    lower.includes("insufficient funds") ||
    lower.includes("insufficient balance") ||
    lower.includes("insufficient allowance") ||
    lower.includes("exceeds balance") ||
    lower.includes("only owner") ||
    lower.includes("only verifier") ||
    lower.includes("deadline not reached") ||
    lower.includes("already funded") ||
    lower.includes("agreement does not exist") ||
    lower.includes("invalid agreement")
  ) {
    return true;
  }

  // Circle confirmed terminal rejections
  if (
    lower.includes("state: failed") ||
    lower.includes("state: denied") ||
    lower.includes("state: cancelled") ||
    lower.includes("circle contract execution failed") ||
    lower.includes("circle transaction denied")
  ) {
    return true;
  }

  // Ambiguous network errors, timeouts, process interruptions, or gateway dropouts are NOT definitive
  return false;
}

/**
 * Reconciles an escrow transaction left in 'pending' status due to ambiguous timeout,
 * process interruption, or incomplete write. Checks on-chain ArcEscrow status to confirm
 * whether the agreement was actually funded before allowing any state update.
 */
export async function reconcilePendingEscrow(params: {
  supabase: any;
  businessId: string;
  existingTx: any;
  idempotencyKey: string;
  forceRealChain?: boolean;
}): Promise<{
  success: boolean;
  transactionId: string;
  status: string;
  amount: number;
  escrowAddress: string;
  txHash: string | null;
  explorerUrl?: string;
  idempotencyKey: string;
  agreementId?: string;
  idempotentHit: boolean;
  isSimulation: boolean;
  isSimulated: boolean;
  message: string;
}> {
  const { supabase, businessId, existingTx, idempotencyKey, forceRealChain } =
    params;

  if (isSimulationMode(forceRealChain)) {
    await supabase
      .from("transactions")
      .update({
        status: "simulation-only",
        tx_hash: null,
        escrow_address: ARC_CONFIG.escrowContractAddress,
        is_simulated: true,
      })
      .eq("id", existingTx.id);

    return {
      success: true,
      transactionId: existingTx.id,
      status: "simulation-only",
      amount: Number(existingTx.amount),
      escrowAddress: ARC_CONFIG.escrowContractAddress,
      txHash: null,
      explorerUrl: undefined,
      idempotencyKey,
      idempotentHit: true,
      isSimulation: true,
      isSimulated: true,
      message: "Reconciled pending transaction in simulation mode",
    };
  }

  // Query ArcEscrow.sol for on-chain agreement mapped to this idempotency key
  try {
    const agreementId = await getAgreementIdForTransaction({ idempotencyKey });
    if (agreementId && Number(agreementId) > 0) {
      const publicClient = getArcPublicClient();
      const agreement = (await publicClient.readContract({
        address: ARC_CONFIG.escrowContractAddress as `0x${string}`,
        abi: ARC_ESCROW_ABI,
        functionName: "getAgreement",
        args: [BigInt(agreementId)],
      })) as any;

      // Status: Created = 0, Funded = 1, MilestoneSubmitted = 2, Approved = 3, Released = 4, Refunded = 5, Disputed = 6
      if (agreement.status >= 1) {
        await supabase
          .from("transactions")
          .update({
            status: "funded",
            escrow_address: ARC_CONFIG.escrowContractAddress,
            is_simulated: false,
          })
          .eq("id", existingTx.id);

        await logAgentAction({
          businessId,
          action: "create_escrow",
          reason: `Reconciled pending escrow transaction on-chain: agreement #${agreementId} is funded (status: ${agreement.status})`,
          confidence: 1.0,
          input: {
            transactionId: existingTx.id,
            idempotencyKey,
            agreementId: agreementId.toString(),
          },
          result: {
            status: "funded",
            agreementId: agreementId.toString(),
          },
        });

        const isSimTx =
          existingTx.is_simulated === true ||
          existingTx.status === "simulation-only";
        return {
          success: true,
          transactionId: existingTx.id,
          status: "funded",
          amount: Number(existingTx.amount),
          escrowAddress: ARC_CONFIG.escrowContractAddress,
          txHash: existingTx.tx_hash || null,
          explorerUrl:
            !isSimTx && existingTx.tx_hash
              ? `${ARC_CONFIG.explorerUrl}/tx/${existingTx.tx_hash}`
              : undefined,
          idempotencyKey,
          agreementId: agreementId.toString(),
          idempotentHit: true,
          isSimulation: isSimTx,
          isSimulated: isSimTx,
          message: `Reconciled pending transaction: agreement #${agreementId} is active and funded on-chain`,
        };
      }
    }
  } catch (reconcileErr) {
    throw new Error(
      `Pending escrow transaction requires reconciliation. Unable to verify on-chain status (${(reconcileErr as Error).message}); duplicate payment prohibited. Retry after status confirmation.`,
    );
  }

  // Agreement not found on-chain or still unresolved
  throw new Error(
    "Pending escrow transaction requires reconciliation. Transaction is still pending or undetermined on-chain; duplicate payment prohibited. Retry after status confirmation.",
  );
}
