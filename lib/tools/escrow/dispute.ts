import { tool } from "ai";
import { z } from "zod";

import { record_vendor_memory } from "@/lib/memory";
import { getServiceSupabase } from "@/lib/supabase";

import { logAgentAction } from "../audit";
import { ToolContext } from "../types";

export function buildDisputeEscrowTool(ctx: ToolContext) {
  return tool({
    description:
      "Flag an escrow transaction as disputed due to confirmation discrepancies and request human approval.",
    inputSchema: z.object({
      contractId: z.string(),
      negotiationId: z.string().optional(),
      reason: z.string(),
      discrepancies: z.array(z.string()).optional(),
    }),
    execute: async (input: {
      contractId: string;
      negotiationId?: string;
      reason: string;
      discrepancies?: string[];
    }) => {
      const businessId = await ctx.resolveBusinessId(input.contractId);
      const supabase = getServiceSupabase();

      // 1. Fetch contract & negotiation
      const { data: contract } = await supabase
        .from("contracts")
        .select("vendor_id")
        .eq("id", input.contractId)
        .maybeSingle();

      let negotiationId = input.negotiationId;
      if (!negotiationId) {
        const { data: neg } = await supabase
          .from("negotiations")
          .select("id")
          .eq("contract_id", input.contractId)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        negotiationId = neg?.id;
      }

      // 2. Mark existing transaction as disputed or insert
      const txKey = `escrow-dispute-${input.contractId}-${negotiationId || "def"}`;
      const { data: existingTx } = await supabase
        .from("transactions")
        .select("*")
        .eq("contract_id", input.contractId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (existingTx) {
        await supabase
          .from("transactions")
          .update({ status: "disputed" })
          .eq("id", existingTx.id);
      } else {
        await supabase.from("transactions").insert({
          business_id: businessId,
          vendor_id: contract?.vendor_id || null,
          contract_id: input.contractId,
          negotiation_id: negotiationId || null,
          amount: 0,
          currency: "USDC",
          status: "disputed",
          idempotency_key: txKey,
        });
      }

      // 3. Create Human Approval entry
      let approvalId: string | null = null;
      if (negotiationId) {
        const fullReason = input.discrepancies?.length
          ? `Vendor confirmation discrepancies: ${input.discrepancies.join("; ")}`
          : input.reason;

        const { data: approval } = await supabase
          .from("approvals")
          .insert({
            business_id: businessId,
            negotiation_id: negotiationId,
            status: "pending",
            reason: fullReason,
          })
          .select()
          .single();

        approvalId = approval?.id || null;
      }

      // 3b. Automatically record disputed delivery into vendor memory
      if (contract?.vendor_id) {
        const { data: negData } = negotiationId
          ? await supabase
              .from("negotiations")
              .select("*")
              .eq("id", negotiationId)
              .maybeSingle()
          : { data: null };
        await record_vendor_memory({
          businessId,
          vendorId: contract.vendor_id,
          contractId: input.contractId,
          negotiationId: negotiationId || undefined,
          originalPrice: Number(negData?.original_price || 0),
          finalPrice: Number(negData?.final_price || 0),
          roundsToClose: negData?.rounds || 3,
          outcome: "disputed",
          deliveredOk: false,
        }).catch((err) =>
          console.warn("Failed to record vendor memory on dispute:", err),
        );
      }

      // 4. Log append-only action
      await logAgentAction({
        businessId,
        action: "dispute_escrow",
        reason: input.reason,
        confidence: 1.0,
        input: {
          contractId: input.contractId,
          negotiationId,
          discrepancies: input.discrepancies,
        },
        result: {
          status: "disputed",
          approvalId,
        },
      });

      return {
        success: true,
        status: "disputed",
        approvalId,
      };
    },
  });
}
