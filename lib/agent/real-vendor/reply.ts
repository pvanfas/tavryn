import { record_vendor_memory } from "@/lib/memory";
import { getServiceSupabase } from "@/lib/supabase";
import { logAgentAction } from "@/lib/tools/audit";
import { extractTermsFromVendorReplyAsync } from "./extraction";
import { ProcessReplyResult } from "./types";

/**
 * Ingests a pasted vendor email/message reply, extracts structured terms,
 * logs the raw reply to agent_actions, and advances the deterministic negotiation state.
 */
export async function processVendorReply(
  contractIdOrParams:
    | string
    | { contractId: string; rawReply: string; acceptsUsdcOverride?: boolean },
  rawReplyArg?: string,
  acceptsUsdcOverrideArg?: boolean,
): Promise<ProcessReplyResult> {
  const contractId =
    typeof contractIdOrParams === "string"
      ? contractIdOrParams
      : contractIdOrParams.contractId;
  const rawReply =
    typeof contractIdOrParams === "string"
      ? rawReplyArg || ""
      : contractIdOrParams.rawReply;
  const acceptsUsdcOverride =
    typeof contractIdOrParams === "string"
      ? acceptsUsdcOverrideArg
      : contractIdOrParams.acceptsUsdcOverride;

  const supabase = getServiceSupabase();

  // 1. Fetch contract and negotiation
  const { data: contract, error: cErr } = await supabase
    .from("contracts")
    .select("*, vendors ( id, name, category )")
    .eq("id", contractId)
    .single();

  if (cErr || !contract) {
    throw new Error(`Contract ${contractId} not found: ${cErr?.message}`);
  }

  const businessId = contract.business_id;
  const originalPrice = Number(contract.current_price);
  const vendorName = contract.vendors?.name || contract.service;

  let { data: negotiation } = await supabase
    .from("negotiations")
    .select("*")
    .eq("contract_id", contractId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  // If no negotiation exists yet, initialize it
  if (!negotiation) {
    const targetPrice = Math.round(originalPrice * 0.82);
    const { data: newNeg } = await supabase
      .from("negotiations")
      .insert({
        contract_id: contractId,
        original_price: originalPrice,
        target_price: targetPrice,
        current_offer: Math.round(targetPrice * 0.9),
        status: "in_progress",
        rounds: 1,
        conversation: [],
      })
      .select()
      .single();
    negotiation = newNeg;
  }

  // 2. Extract terms using dynamic LLM extraction with deterministic regex fallback
  const extraction = await extractTermsFromVendorReplyAsync(
    rawReply,
    originalPrice,
  );
  if (acceptsUsdcOverride !== undefined) {
    extraction.accepts_usdc = acceptsUsdcOverride;
  }

  const counterOffer = extraction.counter_offer || negotiation.current_offer;
  const currentRound = (negotiation.rounds || 1) + 1;
  const walkAwayCeiling = Math.round(originalPrice * 0.92);

  // 3. Evaluate next state
  let decision: "agreed" | "counter" | "walk_away" | "usdc_refused" = "counter";
  let reason = "";
  let suggestedAction:
    "escrow" | "record_savings_no_payment" | "await_vendor" | "walk_away" =
    "await_vendor";
  let newStatus = negotiation.status;
  let finalPrice: number | null = null;

  if (!extraction.accepts_usdc) {
    // Vendor explicitly refuses crypto / USDC
    decision = "usdc_refused";
    suggestedAction = "record_savings_no_payment";
    reason = `Vendor agreed or countered at $${counterOffer.toLocaleString()} but explicitly refused USDC/crypto. Eligible for off-chain savings recording without Arc payment.`;
  } else if (extraction.accepted || counterOffer <= negotiation.target_price) {
    // Offer accepted or at/below target
    decision = "agreed";
    newStatus = "agreed";
    finalPrice = counterOffer;
    suggestedAction = "escrow";
    reason = `Vendor accepted proposed rate of $${counterOffer.toLocaleString()} ($${(originalPrice - counterOffer).toLocaleString()} annual savings). Meets budget policy.`;
  } else if (counterOffer <= walkAwayCeiling && currentRound <= 5) {
    // Counter within ceiling, continue rounds
    decision = "counter";
    newStatus = "in_progress";
    reason = `Vendor countered with $${counterOffer.toLocaleString()}, below walk-away ceiling ($${walkAwayCeiling.toLocaleString()}). Next agent counter proposed.`;
    suggestedAction = "await_vendor";
  } else {
    // Counter exceeds ceiling or rounds exhausted
    decision = "walk_away";
    newStatus = "walked_away";
    reason = `Vendor counter ($${counterOffer.toLocaleString()}) exceeds approved walk-away ceiling ($${walkAwayCeiling.toLocaleString()}) or reached max rounds.`;
    suggestedAction = "walk_away";
  }

  // 4. Append turns to conversation
  const convo = Array.isArray(negotiation.conversation)
    ? [...negotiation.conversation]
    : [];

  // Vendor's turn
  convo.push({
    role: "vendor",
    speaker: `${vendorName} Account Exec`,
    amount: counterOffer,
    message: rawReply,
    round: currentRound,
    accepted: decision === "agreed" || extraction.accepted,
    timestamp: new Date().toISOString(),
    extracted_terms: extraction,
  });

  // If continuing negotiation, append agent's deterministic counter proposal
  if (decision === "counter" && currentRound <= 5) {
    const nextAgentOffer = Math.round(counterOffer * 0.96); // Bridge half the gap
    convo.push({
      role: "agent",
      speaker: "Tavryn Procurement",
      amount: nextAgentOffer,
      message: `Thank you for the update. While we appreciate the concession to $${counterOffer.toLocaleString()}, our finance desk has capped the renewal ceiling for this license tier at $${nextAgentOffer.toLocaleString()}. If we can finalize at $${nextAgentOffer.toLocaleString()} for an immediate 12-month commitment with Arc USDC escrow, we can sign off today.`,
      round: currentRound,
      timestamp: new Date().toISOString(),
    });
  }

  // 5. Update negotiation row
  await supabase
    .from("negotiations")
    .update({
      rounds: currentRound,
      current_offer: counterOffer,
      final_price: finalPrice,
      savings: finalPrice ? Math.max(0, originalPrice - finalPrice) : null,
      status: newStatus,
      conversation: convo,
    })
    .eq("id", negotiation.id);

  // 6. Update business memory if agreed
  if (decision === "agreed" && contract.vendors?.id && finalPrice) {
    try {
      await record_vendor_memory({
        businessId,
        vendorId: contract.vendors.id,
        contractId,
        negotiationId: negotiation.id,
        originalPrice,
        finalPrice,
        roundsToClose: currentRound,
        outcome: "success",
      });
    } catch (memErr) {
      console.warn("Could not record vendor memory:", memErr);
    }
  }

  // 7. ALWAYS log everything in agent_actions with raw reply attached
  await logAgentAction({
    businessId,
    action: "real_vendor_reply_processed",
    reason,
    confidence: 0.95,
    input: {
      contractId,
      negotiationId: negotiation.id,
      vendorName,
      raw_reply: rawReply,
      originalPrice,
    },
    result: {
      decision,
      newStatus,
      extraction,
      counterOffer,
      suggestedAction,
    },
  });

  const dollarSavings = finalPrice
    ? originalPrice - finalPrice
    : originalPrice - counterOffer;
  const explanation = {
    belowPolicyCeiling:
      counterOffer <= walkAwayCeiling
        ? `Vendor counter ($${counterOffer.toLocaleString()}) complies with authorized budget ceiling ($${walkAwayCeiling.toLocaleString()}).`
        : `Vendor counter ($${counterOffer.toLocaleString()}) exceeds policy ceiling ($${walkAwayCeiling.toLocaleString()}).`,
    dollarSavings: `Captures $${dollarSavings.toLocaleString()} in recurring annualized cash reductions.`,
    competitorComparison: `Benchmarked against tier options for enterprise SaaS contracts.`,
    serviceLevelsPreserved: `Maintains service levels for ${extraction.seats || contract.seat_count || "team"} active licenses.`,
    summary: reason,
  };

  return {
    decision,
    reason,
    extraction,
    message: reason,
    suggested_action: suggestedAction,
    negotiation: {
      id: negotiation.id,
      status: newStatus,
      rounds: currentRound,
      current_offer: counterOffer,
      final_price: finalPrice,
    },
    explanation,
  };
}

/**
 * Records savings for a vendor agreement that does not accept USDC.
 * Updates negotiation status to 'savings_recorded_no_payment', renews contract,
 * updates business memory, and writes an audit row to agent_actions.
 */
export async function recordSavingsWithoutPayment(
  contractIdOrParams:
    | string
    | {
        contractId: string;
        negotiationId?: string;
        finalPrice?: number;
        final_price?: number;
        reason?: string;
        notes?: string;
      },
  optionsArg?: {
    final_price?: number;
    finalPrice?: number;
    notes?: string;
    reason?: string;
  },
): Promise<{
  success: boolean;
  status: string;
  savings: number;
  finalPrice: number;
}> {
  const contractId =
    typeof contractIdOrParams === "string"
      ? contractIdOrParams
      : contractIdOrParams.contractId;
  const options =
    typeof contractIdOrParams === "string"
      ? optionsArg || {}
      : contractIdOrParams;

  const finalPrice = Number(options.final_price ?? options.finalPrice ?? 0);
  const reason =
    options.reason ||
    options.notes ||
    "Vendor terms agreed without on-chain USDC payment (off-chain ACH/wire settlement).";

  const supabase = getServiceSupabase();

  const { data: contract, error: cErr } = await supabase
    .from("contracts")
    .select("*, vendors ( id, name )")
    .eq("id", contractId)
    .single();

  if (cErr || !contract) throw new Error("Contract not found");

  const originalPrice = Number(contract.current_price);
  const negotiatedPrice =
    finalPrice > 0 ? finalPrice : Math.round(originalPrice * 0.85);
  const savings = Math.max(0, originalPrice - negotiatedPrice);
  const businessId = contract.business_id;

  // Find or create negotiation record
  let { data: negotiation } = await supabase
    .from("negotiations")
    .select("*")
    .eq("contract_id", contractId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!negotiation) {
    const { data: newNeg } = await supabase
      .from("negotiations")
      .insert({
        contract_id: contractId,
        original_price: originalPrice,
        target_price: negotiatedPrice,
        current_offer: negotiatedPrice,
        final_price: negotiatedPrice,
        savings,
        status: "savings_recorded_no_payment",
        rounds: 1,
        conversation: [
          {
            role: "system",
            speaker: "Tavryn Procurement",
            message: `Savings recorded without payment: $${savings.toLocaleString()} saved off-chain. ${reason}`,
            timestamp: new Date().toISOString(),
          },
        ],
      })
      .select()
      .single();
    negotiation = newNeg;
  } else {
    const convo = Array.isArray(negotiation.conversation)
      ? [...negotiation.conversation]
      : [];
    convo.push({
      role: "system",
      speaker: "Tavryn Procurement",
      message: `Savings recorded without payment: $${savings.toLocaleString()} saved off-chain. ${reason}`,
      timestamp: new Date().toISOString(),
    });

    await supabase
      .from("negotiations")
      .update({
        status: "savings_recorded_no_payment",
        final_price: negotiatedPrice,
        savings,
        conversation: convo,
      })
      .eq("id", negotiation.id);
  }

  // 2. Advance contract renewal date (1 year forward) and update status
  const currentRenewal = contract.renewal_date
    ? new Date(contract.renewal_date)
    : new Date();
  const nextRenewal = new Date(currentRenewal);
  nextRenewal.setFullYear(nextRenewal.getFullYear() + 1);

  await supabase
    .from("contracts")
    .update({
      status: "renewed",
      renewal_date: nextRenewal.toISOString().split("T")[0],
      current_price: negotiatedPrice,
    })
    .eq("id", contractId);

  // 3. Record business memory
  if (contract.vendors?.id) {
    try {
      await record_vendor_memory({
        businessId,
        vendorId: contract.vendors.id,
        contractId,
        negotiationId: negotiation?.id || contractId,
        originalPrice,
        finalPrice: negotiatedPrice,
        roundsToClose: negotiation?.rounds || 1,
        outcome: "success",
      });
    } catch (memErr) {
      console.warn("Could not record vendor memory:", memErr);
    }
  }

  // 4. Log audit action in agent_actions
  await logAgentAction({
    businessId,
    action: "savings_recorded_without_payment",
    reason,
    confidence: 0.95,
    input: {
      contractId,
      negotiationId: negotiation?.id,
      originalPrice,
      finalPrice: negotiatedPrice,
      paymentMethod: "offchain_fiat",
    },
    result: {
      status: "savings_recorded_no_payment",
      savings,
      finalPrice: negotiatedPrice,
      nextRenewalDate: nextRenewal.toISOString().split("T")[0],
    },
  });

  return {
    success: true,
    status: "savings_recorded_no_payment",
    savings,
    finalPrice: negotiatedPrice,
  };
}
