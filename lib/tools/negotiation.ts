import { z } from "zod";
import { tool } from "ai";
import { getServiceSupabase } from "@/lib/supabase";
import { get_vendor_history as fetchVendorHistory, record_vendor_memory } from "@/lib/memory";
import { logAgentAction } from "./audit";
import { ToolContext } from "./types";

export function buildNegotiationTools(ctx: ToolContext) {
  // get_vendor_history (Business Memory)
  const get_vendor_history = tool({
    description: "Fetch historical negotiation outcomes, past accepted discount percentages, and concession speed for a vendor from business memory.",
    inputSchema: z.object({
      vendorId: z.string().describe("Vendor UUID"),
      contractId: z.string().optional().describe("Optional contract UUID to resolve business context"),
    }),
    execute: async ({ vendorId, contractId }: { vendorId: string; contractId?: string }) => {
      const businessId = await ctx.resolveBusinessId(contractId);
      const history = await fetchVendorHistory(vendorId, businessId);

      await logAgentAction({
        businessId,
        action: "get_vendor_history",
        reason: "Consulted business memory for past vendor concessions and reputation",
        confidence: 1.0,
        input: { vendorId, contractId },
        result: {
          hasHistory: history.has_history,
          acceptedDiscountPct: history.accepted_discount_pct,
          roundsToClose: history.rounds_to_close,
          reputationScore: history.reputation_score,
        },
      });

      return history;
    },
  });

  // record_outcome
  const record_outcome = tool({
    description: "Record the analysis conclusion, proposed target price, and strategic reasoning in the audit trail and vendor memory.",
    inputSchema: z.object({
      contractId: z.string().describe("The UUID of the analyzed contract"),
      recommendation: z.string().describe("Core recommendation, e.g. 'negotiate', 'downsize_seats', 'renew_as_is'"),
      targetPrice: z.number().optional().describe("Target price in USDC"),
      finalPrice: z.number().optional().describe("Final agreed price if concluded"),
      roundsToClose: z.number().optional().describe("Rounds taken to finalize"),
      outcomeStatus: z.enum(["success", "walked_away", "disputed"]).optional(),
      savingsEstimate: z.number().optional().describe("Estimated annual savings in USDC"),
      reasoning: z.string().describe("Detailed financial reasoning"),
    }),
    execute: async ({
      contractId,
      recommendation,
      targetPrice,
      finalPrice,
      roundsToClose,
      outcomeStatus,
      savingsEstimate,
      reasoning,
    }: {
      contractId: string;
      recommendation: string;
      targetPrice?: number;
      finalPrice?: number;
      roundsToClose?: number;
      outcomeStatus?: "success" | "walked_away" | "disputed";
      savingsEstimate?: number;
      reasoning: string;
    }) => {
      const businessId = await ctx.resolveBusinessId(contractId);
      const supabase = getServiceSupabase();

      // Fetch contract to get vendorId and original price
      const { data: contract } = await supabase
        .from("contracts")
        .select("vendor_id, current_price")
        .eq("id", contractId)
        .maybeSingle();

      let memoryResult = null;
      if (contract?.vendor_id && finalPrice !== undefined && outcomeStatus) {
        memoryResult = await record_vendor_memory({
          businessId,
          vendorId: contract.vendor_id,
          contractId,
          originalPrice: Number(contract.current_price),
          finalPrice: Number(finalPrice),
          roundsToClose: roundsToClose ?? 1,
          outcome: outcomeStatus,
        });
      }

      const outcome = {
        contractId,
        recommendation,
        targetPrice,
        finalPrice,
        savingsEstimate,
        reasoning,
        memoryRecorded: Boolean(memoryResult),
        newReputationScore: memoryResult?.newReputationScore,
        recordedAt: new Date().toISOString(),
      };

      await logAgentAction({
        businessId,
        action: "record_outcome",
        reason: "Persist autonomous contract evaluation outcome to audit log and business memory",
        confidence: 1.0,
        input: outcome,
        result: { status: "recorded", timestamp: outcome.recordedAt, memoryResult },
      });

      return {
        success: true,
        outcome,
      };
    },
  });

  // send_vendor_message
  const send_vendor_message = tool({
    description: "Submit a price counter-offer and negotiation message to the vendor account manager, logging to negotiations table and audit trail.",
    inputSchema: z.object({
      contractId: z.string().describe("Contract UUID"),
      offer: z.number().positive().describe("Proposed renewal price in USDC"),
      message: z.string().describe("Agent justification or offer message to vendor"),
      round: z.number().int().positive().default(1).describe("Negotiation round index (1 to 5)"),
      commitmentMonths: z.number().int().positive().default(12).optional(),
    }),
    execute: async ({
      contractId,
      offer,
      message,
      round,
      commitmentMonths,
    }: {
      contractId: string;
      offer: number;
      message: string;
      round: number;
      commitmentMonths?: number;
    }) => {
      const supabase = getServiceSupabase();
      const { data: contract, error: contractErr } = await supabase
        .from("contracts")
        .select("*, vendors(*)")
        .eq("id", contractId)
        .single();

      if (contractErr || !contract) {
        throw new Error(`Contract ${contractId} not found: ${contractErr?.message}`);
      }

      const businessId = await ctx.resolveBusinessId(contract.business_id);
      const vendor = contract.vendors;
      const originalPrice = Number(contract.current_price);
      const commitment = commitmentMonths || 12;

      // 1. Fetch or initialize negotiations record
      let { data: negotiation } = await supabase
        .from("negotiations")
        .select("*")
        .eq("contract_id", contractId)
        .eq("status", "negotiating")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!negotiation) {
        const { data: newNeg, error: createNegErr } = await supabase
          .from("negotiations")
          .insert({
            contract_id: contractId,
            original_price: originalPrice,
            target_price: offer,
            current_offer: originalPrice,
            status: "negotiating",
            conversation: [],
            rounds: 0,
          })
          .select("*")
          .single();

        if (createNegErr || !newNeg) {
          throw new Error(`Failed to create negotiation record: ${createNegErr?.message}`);
        }
        negotiation = newNeg;
      }

      const previousCounter = negotiation.current_offer ? Number(negotiation.current_offer) : originalPrice;

      // 2. Invoke vendor simulator engine
      const { getVendorSimulatorConfig, simulateVendorNegotiation } = await import("@/lib/vendor-simulator");
      const vendorConfig = getVendorSimulatorConfig(
        vendor?.id || "sim-vendor",
        vendor?.name || contract.service,
        vendor?.category || contract.category || "software"
      );

      const simResponse = simulateVendorNegotiation(
        {
          contract_id: contractId,
          offer,
          commitment_months: commitment,
          round,
          original_price: originalPrice,
          previous_counter: previousCounter,
        },
        vendorConfig
      );

      // 3. Append to conversation transcript
      const currentConversation = Array.isArray(negotiation.conversation)
        ? [...negotiation.conversation]
        : [];

      const agentTurn = {
        role: "agent",
        speaker: "Tavryn Agent",
        amount: offer,
        message,
        round,
        timestamp: new Date().toISOString(),
      };

      const vendorTurn = {
        role: "vendor",
        speaker: `${vendor?.name || contract.service} Account Manager`,
        amount: simResponse.counter_offer,
        message: simResponse.message,
        accepted: simResponse.accepted,
        round,
        timestamp: new Date().toISOString(),
      };

      currentConversation.push(agentTurn, vendorTurn);

      // 4. Update negotiations record in database
      const isAccepted = simResponse.accepted;
      const finalPrice = isAccepted ? simResponse.counter_offer : null;
      const savings = isAccepted ? originalPrice - simResponse.counter_offer : null;

      const { error: updateNegErr } = await supabase
        .from("negotiations")
        .update({
          conversation: currentConversation,
          rounds: round,
          current_offer: simResponse.counter_offer,
          status: isAccepted ? "agreed" : "negotiating",
          final_price: finalPrice,
          savings: savings,
        })
        .eq("id", negotiation.id);

      if (updateNegErr) {
        console.warn("Failed to update negotiations table:", updateNegErr.message);
      }

      // 5. Append-only audit log in agent_actions
      await logAgentAction({
        businessId,
        action: "send_vendor_message",
        reason: `Execute negotiation round ${round} with vendor ${vendor?.name || contract.service}`,
        confidence: 1.0,
        input: {
          contractId,
          offer,
          message,
          round,
          commitmentMonths: commitment,
        },
        result: {
          counter_offer: simResponse.counter_offer,
          accepted: simResponse.accepted,
          vendor_message: simResponse.message,
        },
      });

      return {
        counter_offer: simResponse.counter_offer,
        message: simResponse.message,
        accepted: simResponse.accepted,
        round,
      };
    },
  });

  // get_negotiation_status
  const get_negotiation_status = tool({
    description: "Retrieve active negotiation state, rounds count, current offer, and conversation history for a contract.",
    inputSchema: z.object({
      contractId: z.string().describe("Contract UUID"),
    }),
    execute: async ({ contractId }: { contractId: string }) => {
      const supabase = getServiceSupabase();
      const { data: neg } = await supabase
        .from("negotiations")
        .select("*")
        .eq("contract_id", contractId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      const businessId = await ctx.resolveBusinessId(contractId);

      await logAgentAction({
        businessId,
        action: "get_negotiation_status",
        reason: "Inspect current negotiation status and conversation history",
        confidence: 1.0,
        input: { contractId },
        result: {
          exists: !!neg,
          status: neg?.status,
          rounds: neg?.rounds,
          current_offer: neg?.current_offer,
        },
      });

      return {
        exists: !!neg,
        negotiation: neg || null,
      };
    },
  });

  return {
    get_vendor_history,
    record_outcome,
    send_vendor_message,
    get_negotiation_status,
  };
}
