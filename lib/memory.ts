import {
  REPUTATION_DEFAULT_SCORE,
  REPUTATION_DELTA_DISPUTED,
  REPUTATION_DELTA_FAST_CLOSE,
  REPUTATION_DELTA_MODERATE_CLOSE,
  REPUTATION_DELTA_SLOW_CLOSE,
  REPUTATION_DELTA_WALKED_AWAY,
  REPUTATION_MAX,
  REPUTATION_MIN,
} from "@/lib/constants";
import { getServiceSupabase } from "@/lib/supabase";
import { logAgentAction } from "@/lib/tools/audit";

export interface VendorHistory {
  vendor_id: string;
  vendor_name: string;
  has_history: boolean;
  last_price: number | null;
  accepted_discount_pct: number | null;
  rounds_to_close: number | null;
  outcome: "success" | "walked_away" | "disputed" | "pending";
  delivered_ok: boolean;
  reputation_score: number;
  deals_count: number;
  last_updated: string;
  summary_sentence?: string;
}

export interface RecordOutcomeParams {
  businessId: string;
  vendorId: string;
  contractId?: string;
  negotiationId?: string;
  originalPrice: number;
  finalPrice: number;
  roundsToClose: number;
  outcome: "success" | "walked_away" | "disputed";
  deliveredOk?: boolean;
}

/**
 * Documented Reputation Score Formula:
 * - Base starting score: 50 (or vendor's current score)
 * - Success outcome:
 *   - Fast close (<= 2 rounds): +12 points
 *   - Moderate close (3-4 rounds): +8 points
 *   - Slow close (>= 5 rounds): +5 points
 * - Walked away outcome (stubborn / refused concession): -5 points
 * - Disputed outcome (tampered / mismatched delivery): -15 points
 * - Bound strictly within [10, 100]
 */
export function calculateNewReputationScore(
  currentScore: number = REPUTATION_DEFAULT_SCORE,
  outcome: "success" | "walked_away" | "disputed",
  roundsToClose: number = 3,
): number {
  let delta = 0;
  if (outcome === "success") {
    delta =
      roundsToClose <= 2
        ? REPUTATION_DELTA_FAST_CLOSE
        : roundsToClose <= 4
          ? REPUTATION_DELTA_MODERATE_CLOSE
          : REPUTATION_DELTA_SLOW_CLOSE;
  } else if (outcome === "walked_away") {
    delta = REPUTATION_DELTA_WALKED_AWAY;
  } else if (outcome === "disputed") {
    delta = REPUTATION_DELTA_DISPUTED;
  }
  return Math.max(
    REPUTATION_MIN,
    Math.min(REPUTATION_MAX, Math.round(currentScore + delta)),
  );
}

// Local in-process memory cache for fast recall and seamless fallback
const localMemoryCache = new Map<
  string,
  Array<{
    business_id: string;
    vendor_id: string;
    contract_id: string | null;
    negotiation_id: string | null;
    last_price: number;
    accepted_discount_pct: number;
    rounds_to_close: number;
    outcome: string;
    delivered_ok: boolean;
    last_updated: string;
  }>
>();

/**
 * Retrieve vendor negotiation and delivery memory.
 * Reads from vendor_memory table or computes a dynamic view over negotiations and transactions.
 */
export async function get_vendor_history(
  vendorId: string,
  businessId?: string,
): Promise<VendorHistory> {
  const supabase = getServiceSupabase();

  // 1. Fetch vendor record for current name and reputation score
  const { data: vendor } = await supabase
    .from("vendors")
    .select("id, name, reputation_score, category")
    .eq("id", vendorId)
    .maybeSingle();

  const vendorName = vendor?.name || "Vendor";
  const currentReputation =
    vendor?.reputation_score ?? REPUTATION_DEFAULT_SCORE;

  // 2. Attempt to query dedicated vendor_memory table
  let memoryRow: {
    last_price: number | null;
    accepted_discount_pct: number | null;
    rounds_to_close: number | null;
    outcome: string;
    delivered_ok: boolean | null;
    last_updated: string;
  } | null = null;

  let totalDeals = 0;

  try {
    let query = supabase
      .from("vendor_memory")
      .select("*")
      .eq("vendor_id", vendorId);

    if (businessId) {
      query = query.eq("business_id", businessId);
    }

    const { data: rows, error: memoryTableErr } = await query.order(
      "last_updated",
      { ascending: false },
    );
    if (!memoryTableErr && rows && rows.length > 0) {
      memoryRow = rows[0];
      totalDeals = rows.length;
    }
  } catch {
    // If vendor_memory table does not exist or fails, fall back
  }

  // 2b. Check local memory cache if database table did not return rows
  if (!memoryRow && localMemoryCache.has(vendorId)) {
    const cached = localMemoryCache.get(vendorId) || [];
    if (cached.length > 0) {
      memoryRow = cached[0];
      totalDeals = cached.length;
    }
  }

  // 3. Fallback: Aggregate dynamic view over negotiations and transactions
  if (!memoryRow) {
    try {
      // Find negotiations through contracts
      const { data: contracts } = await supabase
        .from("contracts")
        .select("id, current_price")
        .eq("vendor_id", vendorId);

      const contractIds = contracts?.map((c) => c.id) || [];

      if (contractIds.length > 0) {
        const { data: negs } = await supabase
          .from("negotiations")
          .select("*")
          .in("contract_id", contractIds)
          .order("created_at", { ascending: false });

        if (negs && negs.length > 0) {
          totalDeals = negs.length;
          const latestNeg = negs[0];

          // Check if there is a completed or disputed transaction
          const { data: tx } = await supabase
            .from("transactions")
            .select("status, amount")
            .eq("vendor_id", vendorId)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();

          const origPrice = Number(
            latestNeg.original_price || contracts?.[0]?.current_price || 0,
          );
          const finalPrice = Number(
            latestNeg.final_price || latestNeg.current_offer || origPrice,
          );
          const discountPct =
            origPrice > 0
              ? Math.max(0, ((origPrice - finalPrice) / origPrice) * 100)
              : 0;

          let outcome: "success" | "walked_away" | "disputed" | "pending" =
            "pending";
          if (tx?.status === "completed" || latestNeg.status === "agreed") {
            outcome = "success";
          } else if (tx?.status === "disputed") {
            outcome = "disputed";
          } else if (latestNeg.status === "walked_away") {
            outcome = "walked_away";
          }

          memoryRow = {
            last_price: finalPrice,
            accepted_discount_pct: Math.round(discountPct * 10) / 10,
            rounds_to_close: latestNeg.rounds || 3,
            outcome,
            delivered_ok: tx?.status !== "disputed",
            last_updated: latestNeg.created_at || new Date().toISOString(),
          };
        }
      }
    } catch (e) {
      console.warn("Dynamic memory view aggregation error:", e);
    }
  }

  // 4. Construct clean VendorHistory response
  if (memoryRow && memoryRow.last_price !== null) {
    const discountStr = memoryRow.accepted_discount_pct
      ? `${memoryRow.accepted_discount_pct.toFixed(1)}%`
      : "standard";
    const roundsStr = memoryRow.rounds_to_close
      ? ` in ${memoryRow.rounds_to_close} rounds`
      : "";

    const summarySentence = `${vendorName} previously accepted a ${discountStr} discount for a 12-month commitment${roundsStr}, establishing an anchor benchmark for future renewals.`;

    return {
      vendor_id: vendorId,
      vendor_name: vendorName,
      has_history: true,
      last_price: Number(memoryRow.last_price),
      accepted_discount_pct: Number(memoryRow.accepted_discount_pct),
      rounds_to_close: memoryRow.rounds_to_close,
      outcome: (memoryRow.outcome as any) || "success",
      delivered_ok: Boolean(memoryRow.delivered_ok),
      reputation_score: currentReputation,
      deals_count: totalDeals,
      last_updated: memoryRow.last_updated,
      summary_sentence: summarySentence,
    };
  }

  // No past history on record
  return {
    vendor_id: vendorId,
    vendor_name: vendorName,
    has_history: false,
    last_price: null,
    accepted_discount_pct: null,
    rounds_to_close: null,
    outcome: "pending",
    delivered_ok: true,
    reputation_score: currentReputation,
    deals_count: 0,
    last_updated: new Date().toISOString(),
    summary_sentence: `No prior negotiation memory found for ${vendorName}. Defaulting to market heuristic target.`,
  };
}

/**
 * Record negotiation outcome into persistent memory and update vendor reputation.
 * Executed deterministically by code — never by the LLM.
 */
export async function record_vendor_memory(
  params: RecordOutcomeParams,
): Promise<{
  success: boolean;
  newReputationScore: number;
  acceptedDiscountPct: number;
}> {
  const supabase = getServiceSupabase();

  // 1. Calculate discount percentage
  const origPrice = Number(params.originalPrice);
  const finPrice = Number(params.finalPrice);
  const discountPct =
    origPrice > 0
      ? Math.max(
          0,
          Math.round(((origPrice - finPrice) / origPrice) * 1000) / 10,
        )
      : 0;

  // 2. Fetch current vendor reputation
  const { data: vendor } = await supabase
    .from("vendors")
    .select("reputation_score")
    .eq("id", params.vendorId)
    .maybeSingle();

  const currentScore = vendor?.reputation_score ?? REPUTATION_DEFAULT_SCORE;

  // 3. Compute new reputation score using documented formula
  const newScore = calculateNewReputationScore(
    currentScore,
    params.outcome,
    params.roundsToClose,
  );

  // 4. Update vendor reputation score in database
  await supabase
    .from("vendors")
    .update({ reputation_score: newScore })
    .eq("id", params.vendorId);

  // 5. Store in local memory cache for immediate recall
  const cachedRecords = localMemoryCache.get(params.vendorId) || [];
  cachedRecords.unshift({
    business_id: params.businessId,
    vendor_id: params.vendorId,
    contract_id: params.contractId || null,
    negotiation_id: params.negotiationId || null,
    last_price: finPrice,
    accepted_discount_pct: discountPct,
    rounds_to_close: params.roundsToClose,
    outcome: params.outcome,
    delivered_ok: params.deliveredOk ?? params.outcome !== "disputed",
    last_updated: new Date().toISOString(),
  });
  localMemoryCache.set(params.vendorId, cachedRecords);

  // 5b. Upsert into vendor_memory table
  try {
    await supabase.from("vendor_memory").insert({
      business_id: params.businessId,
      vendor_id: params.vendorId,
      contract_id: params.contractId || null,
      negotiation_id: params.negotiationId || null,
      last_price: finPrice,
      accepted_discount_pct: discountPct,
      rounds_to_close: params.roundsToClose,
      outcome: params.outcome,
      delivered_ok: params.deliveredOk ?? params.outcome !== "disputed",
      last_updated: new Date().toISOString(),
    });
  } catch {
    // Graceful fallback if vendor_memory table is not yet migrated on remote db
  }

  // 6. Log immutable action to agent_actions audit log
  try {
    await logAgentAction({
      businessId: params.businessId,
      action: "record_vendor_memory",
      reason: `Recorded negotiation outcome for vendor: ${params.outcome} with ${discountPct}% discount; updated reputation score to ${newScore}`,
      confidence: 1.0,
      input: {
        vendorId: params.vendorId,
        contractId: params.contractId,
        negotiationId: params.negotiationId,
        originalPrice: origPrice,
        finalPrice: finPrice,
        outcome: params.outcome,
        roundsToClose: params.roundsToClose,
      },
      result: {
        discountPct,
        previousReputationScore: currentScore,
        newReputationScore: newScore,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (err) {
    console.warn(
      "[agent_actions] Failed to append log for action 'record_vendor_memory':",
      (err as Error).message,
    );
  }

  return {
    success: true,
    newReputationScore: newScore,
    acceptedDiscountPct: discountPct,
  };
}
