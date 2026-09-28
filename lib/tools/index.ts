import { getServiceSupabase } from "@/lib/supabase";
import { ToolContext } from "./types";
import { buildContractTools } from "./contract";
import { buildCalculationTools } from "./calculation";
import { buildPolicyTools } from "./policy";
import { buildNegotiationTools } from "./negotiation";
import { buildEscrowTools } from "./escrow";

// Re-export types and individual utilities for consumer convenience
export * from "./types";
export { computeEscrowIdempotencyKey } from "./escrow";
export { logAgentAction } from "./audit";

/**
 * Global or context-bound tool factory for the Business Money Agent.
 * Composes domain-specific tool suites (contract, calculation, policy, negotiation, escrow)
 * with a unified business ID resolution context.
 */
export function createAgentTools(initialContext?: { businessId?: string }) {
  let currentBusinessId = initialContext?.businessId || "";

  // Context resolver passed to all sub-tool builders
  const ctx: ToolContext = {
    resolveBusinessId: async (contractId?: string): Promise<string> => {
      if (currentBusinessId) return currentBusinessId;
      const supabase = getServiceSupabase();
      if (contractId) {
        const { data } = await supabase
          .from("contracts")
          .select("business_id")
          .eq("id", contractId)
          .maybeSingle();
        if (data?.business_id) {
          currentBusinessId = data.business_id;
          return currentBusinessId;
        }
      }
      // Fallback: look up Demo Co or first available business
      const { data: firstB } = await supabase
        .from("businesses")
        .select("id")
        .limit(1)
        .maybeSingle();
      currentBusinessId = firstB?.id || "";
      return currentBusinessId;
    },
    getBusinessId: () => currentBusinessId,
  };

  const contractTools = buildContractTools(ctx);
  const calculationTools = buildCalculationTools(ctx);
  const policyTools = buildPolicyTools(ctx);
  const negotiationTools = buildNegotiationTools(ctx);
  const escrowTools = buildEscrowTools(ctx);

  return {
    ...contractTools,
    ...calculationTools,
    ...policyTools,
    ...negotiationTools,
    ...escrowTools,
  };
}

// Standalone default tools instance for direct server-side calls
export const defaultTools = createAgentTools();

export const {
  get_contract,
  get_usage,
  find_vendor_options,
  calculate_savings,
  check_policy,
  record_outcome,
  send_vendor_message,
  get_negotiation_status,
  create_escrow,
  release_escrow,
  dispute_escrow,
  get_vendor_history,
} = defaultTools;
