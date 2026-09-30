import { getServiceSupabase } from "@/lib/supabase";
import { logAgentAction } from "@/lib/tools/audit";

export const OVERRIDE_REASON_CODES = [
  "need_longer_commitment",
  "vendor_unreliable",
  "wrong_seat_count",
  "rate_too_high",
  "budget_freeze",
  "switch_preferred",
  "other",
] as const;

export type OverrideReasonCode = (typeof OVERRIDE_REASON_CODES)[number];

export interface RecordOverrideInput {
  businessId: string;
  vendorId?: string | null;
  contractId?: string | null;
  category: string;
  reasonCode: OverrideReasonCode | string;
  notes?: string;
}

export interface OverrideMemoryItem {
  id: string;
  businessId: string;
  vendorId: string | null;
  contractId: string | null;
  category: string;
  reasonCode: string;
  notes: string | null;
  createdAt: string;
}

/**
 * Persists supervisor rejection reason code and notes into override memory table and audit log.
 */
export async function recordOverrideMemory(input: RecordOverrideInput) {
  const supabase = getServiceSupabase();

  const { data, error } = await supabase
    .from("override_memory")
    .insert({
      business_id: input.businessId,
      vendor_id: input.vendorId || null,
      contract_id: input.contractId || null,
      category: input.category,
      reason_code: input.reasonCode,
      notes: input.notes || null,
    })
    .select("id")
    .single();

  if (error) {
    console.warn(
      "[OverrideMemory] Failed to insert override_memory row:",
      error,
    );
  }

  await logAgentAction({
    businessId: input.businessId,
    action: "record_override_memory",
    reason: `Supervisor rejection feedback captured: ${input.reasonCode} — ${input.notes || "No extra note"}`,
    confidence: 1.0,
    input: {
      category: input.category,
      reasonCode: input.reasonCode,
      vendorId: input.vendorId,
      contractId: input.contractId,
    },
    result: {
      overrideId: data?.id,
      recordedAt: new Date().toISOString(),
    },
  });

  return { success: true, id: data?.id };
}

/**
 * Retrieves past human override feedback for a vendor or category to condition the negotiation agent.
 */
export async function getOverrideGuidancePrompt(
  businessId: string,
  vendorId?: string | null,
  category?: string,
): Promise<string> {
  const supabase = getServiceSupabase();

  let query = supabase
    .from("override_memory")
    .select("reason_code, notes, created_at, category")
    .eq("business_id", businessId)
    .order("created_at", { ascending: false })
    .limit(5);

  if (vendorId) {
    query = query.or(`vendor_id.eq.${vendorId},category.eq.${category || ""}`);
  } else if (category) {
    query = query.eq("category", category);
  }

  const { data: records } = await query;
  if (!records || records.length === 0) {
    return "";
  }

  const summaries = records.map((r, i) => {
    return `${i + 1}. [${r.reason_code.toUpperCase()}] ${r.notes || "Supervisor rejected deal terms"}`;
  });

  return `
PAST HUMAN SUPERVISOR FEEDBACK & CONSTRAINTS (DO NOT REPEAT PAST MISTAKES):
The human supervisor has previously rejected contract proposals with the following specific guidance:
${summaries.join("\n")}
Ensure your negotiation strategy strictly respects these constraints before concluding agreement.
`;
}
