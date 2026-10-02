import { tool } from "ai";
import { z } from "zod";

import {
  ARC_CONFIG,
  getAgreementIdForTransaction,
  isSimulationMode,
  refundArcEscrowAgreement,
} from "@/lib/circle";
import { getServiceSupabase } from "@/lib/supabase";

import { logAgentAction } from "../audit";
import { ToolContext } from "../types";

export function buildRefundEscrowTool(ctx: ToolContext) {
  return tool({
    description:
      "Claim refund from ArcEscrow contract back to depositor when verification fails or vendor fails to fulfill terms after deadline.",
    inputSchema: z.object({
      contractId: z.string().optional().describe("Associated contract UUID"),
      transactionId: z.string().optional().describe("Transaction UUID"),
      idempotencyKey: z
        .string()
        .optional()
        .describe("Associated idempotency key"),
      reason: z.string().describe("Reason for claiming refund"),
      forceRealChain: z
        .boolean()
        .optional()
        .describe("Force live on-chain execution"),
    }),
    execute: async (input: {
      contractId?: string;
      transactionId?: string;
      idempotencyKey?: string;
      reason: string;
      forceRealChain?: boolean;
    }) => {
      const businessId = await ctx.resolveBusinessId(input.contractId);
      const supabase = getServiceSupabase();

      let targetTx: any = null;
      if (input.transactionId) {
        const { data } = await supabase
          .from("transactions")
          .select("*")
          .eq("id", input.transactionId)
          .maybeSingle();
        targetTx = data;
      } else if (input.idempotencyKey) {
        const { data } = await supabase
          .from("transactions")
          .select("*")
          .eq("idempotency_key", input.idempotencyKey)
          .maybeSingle();
        targetTx = data;
      } else if (input.contractId) {
        const { data } = await supabase
          .from("transactions")
          .select("*")
          .eq("contract_id", input.contractId)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        targetTx = data;
      }

      if (!targetTx) {
        throw new Error("Transaction not found for refund");
      }

      if (targetTx.status === "refunded") {
        return {
          success: true,
          transactionId: targetTx.id,
          status: "refunded",
          txHash: targetTx.tx_hash,
          explorerUrl: targetTx.tx_hash
            ? `${ARC_CONFIG.explorerUrl}/tx/${targetTx.tx_hash}`
            : null,
          message: "Idempotent hit: escrow already refunded",
        };
      }

      // Check simulation mode
      if (isSimulationMode(input.forceRealChain)) {
        await supabase
          .from("transactions")
          .update({
            status: "refunded",
            tx_hash: null,
            is_simulated: true,
          })
          .eq("id", targetTx.id);

        await logAgentAction({
          businessId,
          action: "refund_escrow",
          reason: `Simulation refund: ${input.reason}`,
          confidence: 1.0,
          input: { transactionId: targetTx.id, reason: input.reason },
          result: {
            status: "refunded",
            txHash: null,
            explorerUrl: null,
            isSimulated: true,
          },
        });

        return {
          success: true,
          transactionId: targetTx.id,
          status: "refunded",
          txHash: null,
          explorerUrl: null,
          isSimulation: true,
          isSimulated: true,
          message:
            "Simulation mode: escrow marked refunded without blockchain transaction",
        };
      }

      // On-chain refund
      try {
        const agreementId = await getAgreementIdForTransaction({
          idempotencyKey: targetTx.idempotency_key,
        });

        if (!agreementId) {
          throw new Error("Unable to locate on-chain agreementId for refund");
        }

        const refundRes = await refundArcEscrowAgreement({
          agreementId,
          forceRealChain: input.forceRealChain,
        });

        const realTxHash = refundRes.txHash;
        if (!realTxHash) {
          throw new Error(
            "ArcEscrow refund did not return a valid transaction hash",
          );
        }

        await supabase
          .from("transactions")
          .update({
            status: "refunded",
            tx_hash: realTxHash,
            is_simulated: false,
          })
          .eq("id", targetTx.id);

        await logAgentAction({
          businessId,
          action: "refund_escrow",
          reason: `On-chain refund executed: ${input.reason}`,
          confidence: 1.0,
          input: {
            transactionId: targetTx.id,
            agreementId: agreementId.toString(),
            reason: input.reason,
          },
          result: {
            status: "refunded",
            txHash: realTxHash,
            explorerUrl: `${ARC_CONFIG.explorerUrl}/tx/${realTxHash}`,
            isSimulated: false,
          },
        });

        return {
          success: true,
          transactionId: targetTx.id,
          status: "refunded",
          txHash: realTxHash,
          explorerUrl: `${ARC_CONFIG.explorerUrl}/tx/${realTxHash}`,
          isSimulation: false,
          isSimulated: false,
        };
      } catch (refundErr) {
        const errMsg =
          refundErr instanceof Error
            ? refundErr.message
            : "Refund execution failed";
        await logAgentAction({
          businessId,
          action: "refund_escrow",
          reason: `Refund attempt failed: ${errMsg}`,
          confidence: 1.0,
          input: { transactionId: targetTx.id, reason: input.reason },
          result: { status: "failed", error: errMsg },
        });
        throw new Error(`Refund failed on Arc testnet: ${errMsg}`);
      }
    },
  });
}
