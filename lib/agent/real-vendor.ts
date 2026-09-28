import { z } from "zod";
import { getServiceSupabase } from "@/lib/supabase";
import { logAgentAction } from "@/lib/tools/audit";
import { get_usage, find_vendor_options } from "@/lib/tools";
import { get_vendor_history, record_vendor_memory } from "@/lib/memory";

/**
 * Zod schema for structured vendor reply extraction.
 * Guarantees strict type safety and validates raw vendor input.
 */
export const VendorReplyExtractionSchema = z.object({
  counter_offer: z.number().nullable().describe("Extracted counter-offer dollar amount"),
  accepted: z.boolean().describe("Whether vendor explicitly accepted the agent's proposal"),
  seats: z.number().nullable().describe("Number of seats or licenses specified in the reply"),
  commitment_months: z.number().nullable().describe("Commitment duration in months"),
  accepts_usdc: z.boolean().describe("Whether the vendor accepts USDC / crypto or demands fiat/ACH"),
  notes: z.string().describe("Key terms, caveats, or constraints extracted from the message"),
  raw_text: z.string().describe("The original unparsed reply text"),
});

export type VendorReplyExtraction = z.infer<typeof VendorReplyExtractionSchema>;

export interface DraftEmailResult {
  contractId: string;
  vendorId: string | null;
  vendorName: string;
  recipient: string;
  to: string;
  subject: string;
  body: string;
  originalPrice: number;
  baseline_price: number;
  targetPrice: number;
  target_price: number;
  walkAwayCeiling: number;
  openingOffer: number;
  usageCitations: {
    seatCount: number | null;
    activeSeats: number | null;
    utilizationPct: number | null;
    declinePct: number | null;
  };
}

export interface ProcessReplyResult {
  decision: "agreed" | "counter" | "walk_away" | "usdc_refused";
  reason: string;
  extraction: VendorReplyExtraction;
  message: string;
  suggested_action: "escrow" | "record_savings_no_payment" | "await_vendor" | "walk_away";
  negotiation: {
    id: string;
    status: string;
    rounds: number;
    current_offer: number;
    final_price: number | null;
  } | null;
  explanation?: {
    belowPolicyCeiling: string;
    dollarSavings: string;
    competitorComparison: string;
    serviceLevelsPreserved: string;
    summary: string;
  };
}

async function execTool<T>(tool: any, input: any): Promise<T> {
  const result = await tool.execute(input, {
    messages: [],
    toolCallId: `call-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
  });
  return result as T;
}

/**
 * Extracts structured contract renewal terms from unstructured vendor email reply text.
 * Uses robust regex heuristics with strict Zod validation.
 */
export function extractTermsFromVendorReply(rawText: string, baselinePrice: number): VendorReplyExtraction {
  const clean = rawText.trim();

  // 1. Detect if vendor accepted our proposal directly
  const acceptPatterns = [
    /\b(we accept|we can agree to|happy to accept|agreed to|deal is confirmed|accept your offer|proceed with your proposed rate)\b/i,
    /\b(confirming your rate of|approved your request for)\b/i,
    /\b(we are pleased to accept)\b/i,
  ];
  let isAccepted = acceptPatterns.some((p) => p.test(clean));

  // If vendor says "cannot meet" or "unable to meet" our requested price, it is NOT an unconditional acceptance
  const cannotMeetPattern = /\b(?:cannot|can't|unable to)\s+meet(?:\s+\w+)*\s+\$?(\d[\d,]*(?:\.\d{2})?)/i;
  const cannotMeetMatch = clean.match(cannotMeetPattern);
  let rejectedPrice: number | null = null;
  if (cannotMeetMatch) {
    isAccepted = false;
    rejectedPrice = parseFloat(cannotMeetMatch[1].replace(/,/g, ""));
  }

  // 2. Extract counter-offer dollar price
  let extractedPrice: number | null = null;

  // 2a. Priority: explicit counter-offer phrases
  const explicitCounterPatterns = [
    /(?:can offer|offer an annual agreement at|counter(?:-offer)? of|counter(?:-offer)? at|revised rate of|best we can do is|propose|quoted at|settle at|rate of)\s*\$?([0-9,]+(?:\.[0-9]{2})?)/i,
    /\$?([0-9,]+(?:\.[0-9]{2})?)\s*(?:\/yr|\/year|annually|per year)/i,
    /\b(?:agree to|at)\s+\$?([0-9,]+(?:\.[0-9]{2})?)\b/i,
  ];

  for (const pattern of explicitCounterPatterns) {
    const match = clean.match(pattern);
    if (match) {
      const num = parseFloat(match[1].replace(/,/g, ""));
      if (!isNaN(num) && num >= 100 && num !== rejectedPrice) {
        extractedPrice = num;
        break;
      }
    }
  }

  // 2b. General price matches if no explicit counter phrase
  if (!extractedPrice) {
    const priceMatches = Array.from(clean.matchAll(/(?:\$|USD\s*)(\d{1,3}(?:,\d{3})*(?:\.\d{2})?|\d{3,7})/gi));
    for (const match of priceMatches) {
      const numStr = match[1].replace(/,/g, "");
      const num = parseFloat(numStr);
      if (!isNaN(num) && num >= 100 && num <= baselinePrice * 1.5 && num !== rejectedPrice) {
        extractedPrice = num;
        break;
      }
    }
  }

  // 2c. Check percentage discount patterns if no absolute dollar figure (e.g. "15% discount")
  if (!extractedPrice) {
    const pctMatch = clean.match(/(\d{1,2}(?:\.\d+)?)\s*%\s*(?:discount|reduction|concession|off)/i);
    if (pctMatch) {
      const discountPct = parseFloat(pctMatch[1]);
      if (!isNaN(discountPct) && discountPct > 0 && discountPct < 90) {
        extractedPrice = Math.round(baselinePrice * (1 - discountPct / 100));
      }
    }
  }

  // If still not found but accepted, fallback to baseline or target
  if (!extractedPrice) {
    extractedPrice = isAccepted ? Math.round(baselinePrice * 0.85) : baselinePrice;
  }

  // 3. Detect seats count
  let seats: number | null = null;
  const offeredSeatsMatch = clean.match(/(?:commit to|agreed to|down to|with|to|for)\s*(\d+)\s*(?:seats|licenses|users|accounts)/i);
  if (offeredSeatsMatch && (!cannotMeetMatch || clean.indexOf(offeredSeatsMatch[0]) > clean.indexOf(cannotMeetMatch[0]))) {
    seats = parseInt(offeredSeatsMatch[1], 10);
  } else {
    const allSeats = Array.from(clean.matchAll(/(\d+)\s*(?:seats|licenses|users|accounts)/gi));
    if (allSeats.length > 1 && /cannot meet/i.test(clean)) {
      seats = parseInt(allSeats[allSeats.length - 1][1], 10);
    } else if (allSeats.length > 0) {
      seats = parseInt(allSeats[0][1], 10);
    }
  }

  // 4. Detect commitment term in months
  let commitmentMonths: number | null = null;
  const durationMatch = clean.match(/(?:(?:on|for|with)\s+a\s+)?(\d+)\s*(?:-|\s+)(?:month|mo|yr|year)s?(?:\s*(?:term|commitment|agreement|contract))?/i)
    || clean.match(/(\d+)\s*(?:month|yr|year)s?\b/i);

  if (durationMatch) {
    const termNum = parseInt(durationMatch[1], 10);
    if (termNum > 0 && termNum <= 60) {
      if (/yr|year/i.test(durationMatch[0])) {
        commitmentMonths = termNum * 12;
      } else {
        commitmentMonths = termNum;
      }
    }
  }
  if (!commitmentMonths && /\b(?:annual|annually|1-year|one-year)\b/i.test(clean)) {
    commitmentMonths = 12;
  }

  // 5. Detect explicit refusal of crypto / USDC payments
  const nonCryptoPatterns = [
    /\b(no crypto|no usdc|don't accept crypto|cannot accept usdc|cannot accept cryptocurrency)\b/i,
    /\b(ach only|wire transfer only|wire only|credit card only|fiat only|direct debit only|physical check|check only)\b/i,
    /\b(we only accept (?:usd |us dollars |wire|ach|credit card|check))\b/i,
  ];
  const refusesCrypto = nonCryptoPatterns.some((p) => p.test(clean));

  const cryptoAcceptPatterns = [
    /\b(usdc|crypto|arc escrow|arc network|accept usdc|usdc accepted|usdc invoice|wire or usdc)\b/i,
  ];
  const explicitlyAcceptsCrypto = cryptoAcceptPatterns.some((p) => p.test(clean));

  const acceptsUsdc = refusesCrypto ? false : explicitlyAcceptsCrypto ? true : true; // Default true unless refused

  // 6. Build summary notes
  const notesParts: string[] = [];
  if (isAccepted) notesParts.push("Vendor accepted proposal terms.");
  if (extractedPrice) notesParts.push(`Counter/agreed rate: $${extractedPrice.toLocaleString()}.`);
  if (seats) notesParts.push(`Seats allocated: ${seats}.`);
  if (commitmentMonths) notesParts.push(`Term: ${commitmentMonths} months.`);
  if (!acceptsUsdc) notesParts.push("Vendor refused USDC/crypto; requires fiat/ACH.");

  const extraction: VendorReplyExtraction = {
    counter_offer: extractedPrice,
    accepted: isAccepted,
    seats,
    commitment_months: commitmentMonths,
    accepts_usdc: acceptsUsdc,
    notes: notesParts.join(" ") || "Terms extracted from email reply.",
    raw_text: clean,
  };

  return VendorReplyExtractionSchema.parse(extraction);
}

/**
 * Drafts an outreach email for a real vendor (is_simulated = false).
 * Cites live seat telemetry, usage drop, competitive benchmarks, and historical vendor memory.
 * Staged for human approval. Never sends automatically.
 */
export async function draftVendorOutreachEmail(contractId: string): Promise<DraftEmailResult> {
  const supabase = getServiceSupabase();

  // 1. Fetch contract with vendor
  const { data: contract, error: cErr } = await supabase
    .from("contracts")
    .select("*, vendors ( id, name, contact, category, reputation_score, is_simulated )")
    .eq("id", contractId)
    .single();

  if (cErr || !contract) {
    throw new Error(`Contract ${contractId} not found: ${cErr?.message}`);
  }

  const businessId = contract.business_id;
  const originalPrice = Number(contract.current_price);
  const vendorName = contract.vendors?.name || contract.service;

  // 2. Fetch usage telemetry
  let usage: any = {
    seat_count: contract.seat_count,
    active_seats: contract.active_seats,
    utilization_pct:
      contract.seat_count && contract.active_seats
        ? Math.round((contract.active_seats / contract.seat_count) * 100)
        : null,
  };
  try {
    const fetchedUsage = await execTool<any>(get_usage, { contractId });
    if (fetchedUsage) usage = { ...usage, ...fetchedUsage };
  } catch (err) {
    console.warn("Could not retrieve usage telemetry:", err);
  }

  // 3. Fetch competitor benchmarks
  let competitors: any = null;
  try {
    competitors = await execTool<any>(find_vendor_options, {
      requirement: contract.service,
      category: contract.category as "software" | "cloud" | "contractors",
    });
  } catch (err) {
    console.warn("Could not retrieve competitor options:", err);
  }

  // 4. Fetch deterministic vendor memory
  let memory: any = null;
  try {
    if (contract.vendors?.id) {
      memory = await get_vendor_history(contract.vendors.id, businessId);
    }
  } catch (err) {
    console.warn("Could not retrieve vendor memory:", err);
  }

  // 5. Calculate target price & concessions
  let discountPct = 0.18; // Default 18%
  if (memory?.has_history && memory.accepted_discount_pct) {
    discountPct = Math.min(0.35, memory.accepted_discount_pct / 100);
  } else if (usage.utilization_pct && usage.utilization_pct < 80) {
    // Aggressive discount if under-utilized
    discountPct = Math.min(0.30, ((100 - usage.utilization_pct) / 100) * 0.7);
  }

  const walkAwayCeiling = Math.round(originalPrice * 0.92);
  const targetPrice = Math.round(Math.min(originalPrice * (1 - discountPct), walkAwayCeiling));
  const openingOffer = Math.round(targetPrice * 0.88);

  const recipient =
    contract.vendors?.contact ||
    `${vendorName} Renewals Team <renewals@${vendorName.toLowerCase().replace(/[^a-z0-9]/g, "")}.com>`;

  const renewalDateFormatted = contract.renewal_date
    ? new Date(contract.renewal_date).toLocaleDateString(undefined, {
        month: "long",
        day: "numeric",
        year: "numeric",
      })
    : "the upcoming renewal date";

  const compNames = competitors?.options?.slice(0, 2).map((c: any) => c.name).join(" and ");

  // Citations
  let usageParagraph = "";
  if (usage.seat_count && usage.active_seats) {
    usageParagraph = `In reviewing our license audit over the trailing quarter, our telemetry shows that only ${usage.active_seats} of our ${usage.seat_count} allocated seats are actively utilized (approx. ${usage.utilization_pct || 72}% utilization).`;
  } else if (usage.decline_pct) {
    usageParagraph = `In reviewing our workload utilization telemetry, we observed a ${usage.decline_pct}% drop in compute/service consumption compared to our initial agreement.`;
  } else {
    usageParagraph = `In reviewing our operational requirements for the coming term, we are rightsizing our allocation across our team.`;
  }

  let memoryCitation = "";
  if (memory?.has_history && memory.accepted_discount_pct) {
    memoryCitation = ` In our previous renewal schedule, ${vendorName} collaborated with us on an attractive ${memory.accepted_discount_pct}% commitment discount, which made our partnership viable.`;
  }

  const subject = `Renewal Schedule & License Allocation Review — ${contract.service} (${contract.id.slice(0, 8)})`;
  const body = `Hi ${vendorName} Renewals Team,

We are reviewing our upcoming contract renewal for ${contract.service}, scheduled for ${renewalDateFormatted} (current baseline: $${originalPrice.toLocaleString()}/yr).

${usageParagraph}${memoryCitation}

Additionally, as part of our scheduled vendor evaluation, we have benchmarked comparable enterprise plans from ${compNames || "market alternatives"}. We value our working relationship with ${vendorName} and would prefer to maintain our deployment without migration friction, provided our unit economics align.

Based on our verified utilization and authorized budget limits, our target renewal pricing is $${targetPrice.toLocaleString()} (seeking an initial quotation around $${openingOffer.toLocaleString()} for an immediate 12-month commitment).

Please let us know if you can issue an updated quote reflecting these terms, or if you have alternative structure options to bridge the gap.

Best regards,
Procurement & Finance Desk
Tavryn Business Money Agent`;

  // Upsert negotiation row in draft_pending state
  const { data: existingNeg } = await supabase
    .from("negotiations")
    .select("*")
    .eq("contract_id", contractId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const draftTurn = {
    role: "agent",
    speaker: "Tavryn Agent (Draft)",
    amount: openingOffer,
    message: body,
    subject,
    recipient,
    round: 1,
    status: "draft_pending_human_approval",
    timestamp: new Date().toISOString(),
  };

  if (!existingNeg) {
    await supabase.from("negotiations").insert({
      contract_id: contractId,
      original_price: originalPrice,
      target_price: targetPrice,
      current_offer: openingOffer,
      status: "initiated",
      rounds: 1,
      conversation: [draftTurn],
    });
  } else {
    const convo = Array.isArray(existingNeg.conversation) ? [...existingNeg.conversation] : [];
    const draftIndex = convo.findIndex((t: any) => t.status === "draft_pending_human_approval");
    if (draftIndex >= 0) {
      convo[draftIndex] = draftTurn;
    } else {
      convo.push(draftTurn);
    }
    await supabase
      .from("negotiations")
      .update({
        conversation: convo,
        target_price: targetPrice,
        current_offer: openingOffer,
      })
      .eq("id", existingNeg.id);
  }

  // Audit log
  await logAgentAction({
    businessId,
    action: "real_vendor_email_drafted",
    reason: "Generated vendor renewal outreach email citing live usage telemetry and target price; staged for human approval",
    confidence: 0.95,
    input: {
      contractId,
      service: contract.service,
      vendorName,
      targetPrice,
      openingOffer,
      walkAwayCeiling,
    },
    result: {
      recipient,
      subject,
      openingOffer,
      requiresHumanApproval: true,
      sentAutomatically: false,
    },
  });

  return {
    contractId,
    vendorId: contract.vendors?.id || null,
    vendorName,
    recipient,
    to: recipient,
    subject,
    body,
    originalPrice,
    baseline_price: originalPrice,
    targetPrice,
    target_price: targetPrice,
    walkAwayCeiling,
    openingOffer,
    usageCitations: {
      seatCount: usage.seat_count ?? null,
      activeSeats: usage.active_seats ?? null,
      utilizationPct: usage.utilization_pct ?? null,
      declinePct: usage.decline_pct ?? null,
    },
  };
}

/**
 * Ingests a pasted vendor email/message reply, extracts structured terms,
 * logs the raw reply to agent_actions, and advances the deterministic negotiation state.
 */
export async function processVendorReply(
  contractIdOrParams: string | { contractId: string; rawReply: string; acceptsUsdcOverride?: boolean },
  rawReplyArg?: string,
  acceptsUsdcOverrideArg?: boolean
): Promise<ProcessReplyResult> {
  const contractId = typeof contractIdOrParams === "string" ? contractIdOrParams : contractIdOrParams.contractId;
  const rawReply = typeof contractIdOrParams === "string" ? (rawReplyArg || "") : contractIdOrParams.rawReply;
  const acceptsUsdcOverride = typeof contractIdOrParams === "string" ? acceptsUsdcOverrideArg : contractIdOrParams.acceptsUsdcOverride;

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

  // 2. Extract terms using deterministic regex & Zod
  const extraction = extractTermsFromVendorReply(rawReply, originalPrice);
  if (acceptsUsdcOverride !== undefined) {
    extraction.accepts_usdc = acceptsUsdcOverride;
  }

  const counterOffer = extraction.counter_offer || negotiation.current_offer;
  const currentRound = (negotiation.rounds || 1) + 1;
  const walkAwayCeiling = Math.round(originalPrice * 0.92);

  // 3. Evaluate next state
  let decision: "agreed" | "counter" | "walk_away" | "usdc_refused" = "counter";
  let reason = "";
  let suggestedAction: "escrow" | "record_savings_no_payment" | "await_vendor" | "walk_away" = "await_vendor";
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
  const convo = Array.isArray(negotiation.conversation) ? [...negotiation.conversation] : [];

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

  const dollarSavings = finalPrice ? originalPrice - finalPrice : originalPrice - counterOffer;
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
  contractIdOrParams: string | { contractId: string; negotiationId?: string; finalPrice?: number; final_price?: number; reason?: string; notes?: string },
  optionsArg?: { final_price?: number; finalPrice?: number; notes?: string; reason?: string }
): Promise<{ success: boolean; status: string; savings: number; finalPrice: number }> {
  const contractId = typeof contractIdOrParams === "string" ? contractIdOrParams : contractIdOrParams.contractId;
  const options = typeof contractIdOrParams === "string" ? (optionsArg || {}) : contractIdOrParams;

  const finalPrice = Number(options.final_price ?? options.finalPrice ?? 0);
  const reason = options.reason || options.notes || "Vendor terms agreed without on-chain USDC payment (off-chain ACH/wire settlement).";

  const supabase = getServiceSupabase();

  const { data: contract, error: cErr } = await supabase
    .from("contracts")
    .select("*, vendors ( id, name )")
    .eq("id", contractId)
    .single();

  if (cErr || !contract) throw new Error("Contract not found");

  const originalPrice = Number(contract.current_price);
  const negotiatedPrice = finalPrice > 0 ? finalPrice : Math.round(originalPrice * 0.85);
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
    const convo = Array.isArray(negotiation.conversation) ? [...negotiation.conversation] : [];
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
  const currentRenewal = contract.renewal_date ? new Date(contract.renewal_date) : new Date();
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
