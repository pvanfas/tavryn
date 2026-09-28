import { z } from "zod";
import { tool } from "ai";
import { getServiceSupabase } from "@/lib/supabase";
import { logAgentAction } from "./audit";
import { ToolContext, ContractDetails, UsageDetails } from "./types";

export function buildContractTools(ctx: ToolContext) {
  // 1. get_contract
  const get_contract = tool({
    description: "Fetch comprehensive contract details, terms, pricing, and vendor information for a given contract ID.",
    inputSchema: z.object({
      contractId: z.string().describe("The UUID of the contract to inspect"),
    }),
    execute: async ({ contractId }: { contractId: string }): Promise<ContractDetails> => {
      const supabase = getServiceSupabase();
      const { data: contract, error } = await supabase
        .from("contracts")
        .select("*, vendors ( id, name, category, contact, reputation_score, is_simulated )")
        .eq("id", contractId)
        .maybeSingle();

      if (error || !contract) {
        throw new Error(`Contract with ID ${contractId} not found: ${error?.message || "Record missing"}`);
      }

      const businessId = await ctx.resolveBusinessId(contract.business_id);

      await logAgentAction({
        businessId,
        action: "get_contract",
        reason: "Fetch contract details for renewal analysis",
        confidence: 1.0,
        input: { contractId },
        result: {
          id: contract.id,
          service: contract.service,
          category: contract.category,
          current_price: contract.current_price,
          vendor: contract.vendors?.name,
        },
      });

      return {
        id: contract.id as string,
        business_id: contract.business_id as string,
        service: contract.service as string,
        category: contract.category as string,
        current_price: Number(contract.current_price),
        renewal_date: contract.renewal_date as string,
        seat_count: contract.seat_count as number | null,
        active_seats: contract.active_seats as number | null,
        usage_metric: contract.usage_metric,
        status: contract.status as string,
        vendor: contract.vendors
          ? {
              id: contract.vendors.id,
              name: contract.vendors.name,
              category: contract.vendors.category,
              reputation_score: contract.vendors.reputation_score,
              is_simulated: contract.vendors.is_simulated,
            }
          : null,
      };
    },
  });

  // 2. get_usage
  const get_usage = tool({
    description: "Inspect usage telemetry, active seat allocation, idle licenses, and workload drop metrics for a contract.",
    inputSchema: z.object({
      contractId: z.string().describe("The UUID of the contract to analyze usage signals for"),
    }),
    execute: async ({ contractId }: { contractId: string }): Promise<UsageDetails> => {
      const supabase = getServiceSupabase();
      const { data: contract, error } = await supabase
        .from("contracts")
        .select("id, business_id, service, current_price, seat_count, active_seats, usage_metric, status")
        .eq("id", contractId)
        .maybeSingle();

      if (error || !contract) {
        throw new Error(`Contract ${contractId} not found: ${error?.message}`);
      }

      const businessId = await ctx.resolveBusinessId(contract.business_id);

      const seatCount = contract.seat_count != null ? Number(contract.seat_count) : null;
      const activeSeats = contract.active_seats != null ? Number(contract.active_seats) : null;
      let unusedSeats: number | null = null;
      let utilizationPct: number | null = null;

      if (seatCount != null && activeSeats != null && seatCount > 0) {
        unusedSeats = Math.max(0, seatCount - activeSeats);
        utilizationPct = Math.round((activeSeats / seatCount) * 100);
      }

      const usageMetric = contract.usage_metric as { type?: string; decline_pct?: number } | null;
      const declinePct = usageMetric?.decline_pct != null ? Number(usageMetric.decline_pct) : null;

      const signals: string[] = [];
      if (unusedSeats && unusedSeats > 0) {
        signals.push(`${unusedSeats} unallocated / idle seats detected (${100 - (utilizationPct || 0)}% waste)`);
      }
      if (declinePct && declinePct > 0) {
        signals.push(`Telemetry indicates a ${declinePct}% decline in active workload / consumption`);
      }
      if (signals.length === 0) {
        signals.push("Healthy baseline utilization with no idle seats or usage drop detected");
      }

      const result: UsageDetails = {
        contractId: contract.id,
        service: contract.service,
        seat_count: seatCount,
        active_seats: activeSeats,
        unused_seats: unusedSeats,
        utilization_pct: utilizationPct,
        decline_pct: declinePct,
        signals,
      };

      await logAgentAction({
        businessId,
        action: "get_usage",
        reason: "Extract usage telemetry and seat allocation metrics",
        confidence: 1.0,
        input: { contractId },
        result: result as unknown as Record<string, unknown>,
      });

      return result;
    },
  });

  // 3. find_vendor_options
  const find_vendor_options = tool({
    description: "Search for comparable marketplace vendors within the same category to benchmark pricing and alternative leverage.",
    inputSchema: z.object({
      requirement: z.string().describe("Requirement or service description"),
      category: z.enum(["software", "cloud", "contractors"]).optional().describe("Contract category filter"),
    }),
    execute: async ({ requirement, category }: { requirement: string; category?: "software" | "cloud" | "contractors" }) => {
      const supabase = getServiceSupabase();
      let query = supabase.from("vendors").select("id, name, category, reputation_score, is_simulated");

      if (category) {
        query = query.eq("category", category);
      }

      const { data: vendors, error } = await query.order("reputation_score", { ascending: false }).limit(6);

      if (error) {
        throw new Error(`Failed to query vendor options: ${error.message}`);
      }

      const businessId = await ctx.resolveBusinessId();

      const result = {
        requirement,
        categoryFilter: category || "all",
        matchCount: vendors?.length || 0,
        options: (vendors || []).map((v) => ({
          id: v.id,
          name: v.name,
          category: v.category,
          reputationScore: Number(v.reputation_score) || 4.5,
          isSimulated: Boolean(v.is_simulated),
        })),
      };

      await logAgentAction({
        businessId,
        action: "find_vendor_options",
        reason: "Retrieve competitive vendor landscape for price benchmarking",
        confidence: 1.0,
        input: { requirement, category },
        result: { count: result.matchCount, names: result.options.map((o) => o.name) },
      });

      return result;
    },
  });

  return {
    get_contract,
    get_usage,
    find_vendor_options,
  };
}
