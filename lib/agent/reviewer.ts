import { generateObject } from "ai";
import { z } from "zod";

import { getAgentLanguageModel } from "@/lib/agent/provider";
import { getServiceSupabase } from "@/lib/supabase";
import { logAgentAction } from "@/lib/tools/audit";

export const ConcernSchema = z.object({
  issue: z.string().describe("Specific procurement or risk concern"),
  severity: z
    .enum(["low", "medium", "high"])
    .describe("Severity level of concern"),
});

export const ReviewerOutputSchema = z.object({
  verdict: z
    .enum(["agree", "challenge", "reject"])
    .describe(
      "Audit verdict: agree (proceed), challenge (revise once), or reject (escalate to human)",
    ),
  concerns: z
    .array(ConcernSchema)
    .describe("List of identified risks or deficiencies"),
  suggestedAction: z
    .string()
    .describe("Concrete recommendation for negotiator or human supervisor"),
  reasoning: z.string().describe("Executive rationale explaining the verdict"),
});

export type ReviewerConcern = z.infer<typeof ConcernSchema>;
export type ReviewerOutput = z.infer<typeof ReviewerOutputSchema>;

export interface ReviewerContext {
  negotiation: {
    id: string;
    contract_id: string;
    original_price: number;
    final_price: number | null;
    current_offer: number;
    rounds: number;
    savings: number;
    conversation?: Array<{ role: string; content: string; round?: number }>;
  };
  contract: {
    id: string;
    service: string;
    current_price: number;
    category: string;
    renewal_date?: string;
    seat_count?: number | null;
    active_seats?: number | null;
  };
  usageData?: {
    seatCount?: number | null;
    activeSeats?: number | null;
    utilizationPct?: number | null;
    declinePct?: number | null;
  };
  vendorMemory?: {
    benchmarkDiscountPct?: number;
    totalDeals?: number;
    avgRounds?: number;
    reputationScore?: number;
  };
  policySummary?: {
    maxAutoTransaction: number;
    minSavings: number;
    categoryBudget?: number;
  };
}

/**
 * Deterministic rule-based audit checks for mock mode and baseline verification.
 */
export function performDeterministicReview(
  ctx: ReviewerContext,
): ReviewerOutput {
  const concerns: ReviewerConcern[] = [];
  const finalPrice =
    ctx.negotiation.final_price || ctx.negotiation.current_offer;
  const originalPrice = ctx.negotiation.original_price;
  const savings = originalPrice - finalPrice;
  const discountPct = originalPrice > 0 ? (savings / originalPrice) * 100 : 0;

  // 1. Fast acceptance / rushed deal check
  if (ctx.negotiation.rounds <= 1 && discountPct < 15) {
    concerns.push({
      issue: `Rushed acceptance: Accepted in round 1 with only ${discountPct.toFixed(1)}% concession without testing vendor floor.`,
      severity: "medium",
    });
  }

  // 2. Telemetry waste check (unused seats ignored)
  if (
    ctx.usageData?.seatCount &&
    ctx.usageData?.activeSeats !== undefined &&
    ctx.usageData.activeSeats !== null
  ) {
    const idleSeats = ctx.usageData.seatCount - ctx.usageData.activeSeats;
    const idlePct = (idleSeats / ctx.usageData.seatCount) * 100;
    if (idlePct >= 25 && discountPct < 20) {
      concerns.push({
        issue: `Unaddressed license waste: Telemetry indicates ${idlePct.toFixed(0)}% idle seats (${idleSeats} seats), but negotiated concession is only ${discountPct.toFixed(1)}%.`,
        severity: "high",
      });
    }
  }

  // 3. Historical benchmark contradiction
  if (
    ctx.vendorMemory?.benchmarkDiscountPct &&
    discountPct < ctx.vendorMemory.benchmarkDiscountPct - 8
  ) {
    concerns.push({
      issue: `Historical underperformance: Past deals with this vendor secured ${ctx.vendorMemory.benchmarkDiscountPct}% discount vs current ${discountPct.toFixed(1)}%.`,
      severity: "medium",
    });
  }

  // 4. Value-destroying or zero-savings deal
  if (savings <= 0) {
    concerns.push({
      issue:
        "Negative or zero annual savings: Deal increases spend above contract baseline.",
      severity: "high",
    });
  }

  // Determine verdict based strictly on concern severity
  if (concerns.some((c) => c.severity === "high")) {
    return {
      verdict: "reject",
      concerns,
      suggestedAction:
        "Escalate to human supervisor for manual procurement review.",
      reasoning:
        "Critical risk vectors identified: potential seat waste or negative financial yield.",
    };
  }

  if (concerns.length > 0) {
    return {
      verdict: "challenge",
      concerns,
      suggestedAction:
        "Send back to negotiator for one additional counter citing telemetry waste.",
      reasoning:
        "Deal is acceptable but leaves substantial leverage unexploited.",
    };
  }

  return {
    verdict: "agree",
    concerns: [],
    suggestedAction: "Proceed to deterministic policy gatekeeper evaluation.",
    reasoning: `Sound concession achieved (${discountPct.toFixed(1)}% savings). Usage citations and pricing align with vendor benchmarks.`,
  };
}

/**
 * Runs the Reviewer Agent to challenge or endorse a negotiation decision.
 * Uses REVIEWER_LLM_MODEL when live keys exist; otherwise applies deterministic rules.
 */
export async function runReviewerAgent(
  businessId: string,
  ctx: ReviewerContext,
): Promise<ReviewerOutput> {
  const provider = (process.env.LLM_PROVIDER || "mock").toLowerCase();
  const hasKey = Boolean(
    process.env.OPENAI_API_KEY ||
    process.env.ANTHROPIC_API_KEY ||
    process.env.LLM_API_KEY,
  );

  let output: ReviewerOutput;
  const reviewerModelName =
    process.env.REVIEWER_LLM_MODEL || process.env.LLM_MODEL || "gpt-4o-mini";

  if (hasKey && provider !== "mock") {
    try {
      const model = getAgentLanguageModel();
      const prompt = `You are an adversarial procurement auditor and Chief Commercial Officer reviewing a proposed contract renewal before policy check.
Your job is to catch weak deals, unaddressed seat waste, and rushed concessions. You can only make decisions STRICTER.

CONTRACT:
- Service: ${ctx.contract.service}
- Category: ${ctx.contract.category}
- Baseline Annual Price: $${ctx.contract.current_price}

NEGOTIATION OUTCOME:
- Negotiated Price: $${ctx.negotiation.final_price || ctx.negotiation.current_offer}
- Concession Rounds: ${ctx.negotiation.rounds}
- Projected Annual Savings: $${ctx.negotiation.savings}

TELEMETRY & USAGE:
- Seat Count: ${ctx.usageData?.seatCount ?? "Unknown"}
- Active Seats: ${ctx.usageData?.activeSeats ?? "Unknown"}
- Utilization Rate: ${ctx.usageData?.utilizationPct ? `${ctx.usageData.utilizationPct}%` : "Unknown"}

VENDOR MEMORY:
- Benchmark Historical Discount: ${ctx.vendorMemory?.benchmarkDiscountPct ? `${ctx.vendorMemory.benchmarkDiscountPct}%` : "No prior memory"}
- Vendor Reputation Score: ${ctx.vendorMemory?.reputationScore ?? "Standard"}

INSTRUCTIONS:
1. Verdict options:
   - "agree": Sound deal with verified usage alignment and solid savings.
   - "challenge": Leaves leverage on the table (e.g. high idle seats not cited, rushed 1-round acceptance).
   - "reject": Value-destroying, severe price discrepancy, or contradicts vendor memory.
2. List specific concerns with severity ("low", "medium", "high").
3. Provide concrete suggestedAction and executive reasoning.`;

      const { object } = await generateObject({
        model,
        schema: ReviewerOutputSchema,
        prompt,
      });

      output = object;
    } catch (err) {
      console.warn(
        "[ReviewerAgent] LLM review failed, falling back to deterministic review:",
        err,
      );
      output = performDeterministicReview(ctx);
    }
  } else {
    output = performDeterministicReview(ctx);
  }

  // Persist review to Supabase reviews table
  const supabase = getServiceSupabase();
  try {
    await supabase.from("reviews").insert({
      business_id: businessId,
      negotiation_id: ctx.negotiation.id,
      contract_id: ctx.contract.id,
      verdict: output.verdict,
      concerns: output.concerns,
      suggested_action: output.suggestedAction,
      model: reviewerModelName,
    });
  } catch (dbErr) {
    console.warn(
      "[ReviewerAgent] Failed to persist review row (non-fatal):",
      dbErr,
    );
  }

  // Append to immutable agent_actions
  await logAgentAction({
    businessId,
    action: "reviewer_audit",
    reason: `Reviewer verdict: ${output.verdict.toUpperCase()} — ${output.reasoning}`,
    confidence: output.verdict === "agree" ? 0.95 : 0.85,
    input: {
      negotiationId: ctx.negotiation.id,
      contractId: ctx.contract.id,
      verdict: output.verdict,
      concernsCount: output.concerns.length,
      model: reviewerModelName,
    },
    result: {
      verdict: output.verdict,
      concerns: output.concerns,
      suggestedAction: output.suggestedAction,
    },
  });

  return output;
}
