import { z } from "zod";
import { tool } from "ai";
import { logAgentAction } from "./audit";
import { ToolContext, SavingsCalculation } from "./types";

export function buildCalculationTools(ctx: ToolContext) {
  // calculate_savings
  const calculate_savings = tool({
    description: "Deterministically calculate cost savings, percentage reduction, and run-rate variance between current and target pricing.",
    inputSchema: z.object({
      oldPrice: z.number().positive().describe("Current annual contract price in USDC"),
      newPrice: z.number().nonnegative().describe("Target or proposed annual contract price in USDC"),
      months: z.number().int().positive().default(12).describe("Duration period in months (default 12)"),
    }),
    execute: async ({ oldPrice, newPrice, months }: { oldPrice: number; newPrice: number; months: number }): Promise<SavingsCalculation> => {
      const absoluteSavings = Number((oldPrice - newPrice).toFixed(2));
      const percentageSavings = Number((((oldPrice - newPrice) / oldPrice) * 100).toFixed(1));
      const monthlySavings = Number((absoluteSavings / months).toFixed(2));

      const businessId = await ctx.resolveBusinessId();

      const result: SavingsCalculation = {
        oldPrice,
        newPrice,
        months,
        absoluteSavings,
        percentageSavings,
        monthlySavings,
      };

      await logAgentAction({
        businessId,
        action: "calculate_savings",
        reason: "Deterministic computation of pricing delta and annual savings",
        confidence: 1.0,
        input: { oldPrice, newPrice, months },
        result: result as unknown as Record<string, unknown>,
      });

      return result;
    },
  });

  return {
    calculate_savings,
  };
}
