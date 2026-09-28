import { z } from "zod";
import { tool } from "ai";
import { getServiceSupabase } from "@/lib/supabase";
import { checkPolicy, PolicyRule } from "@/lib/policy";
import { logAgentAction } from "./audit";
import { ToolContext } from "./types";

export function buildPolicyTools(ctx: ToolContext) {
  // check_policy
  const check_policy = tool({
    description: "Validate a proposed financial transaction or renewal against the organization's deterministic spending policy.",
    inputSchema: z.object({
      action: z.string().describe("Proposed action, e.g. 'negotiate', 'renew', 'downsize'"),
      amount: z.number().nonnegative().describe("Proposed new price or transaction amount in USDC"),
      savings: z.number().nonnegative().optional().describe("Projected dollar savings in USDC"),
      category: z.string().describe("Category of the contract, e.g. 'software', 'cloud', 'contractors'"),
      businessId: z.string().optional().describe("Business ID for policy evaluation"),
      contractId: z.string().optional().describe("Associated contract ID"),
      negotiationId: z.string().optional().describe("Associated negotiation ID"),
    }),
    execute: async ({
      action,
      amount,
      savings,
      category,
      businessId: bId,
      contractId,
      negotiationId,
    }: {
      action: string;
      amount: number;
      savings?: number;
      category: string;
      businessId?: string;
      contractId?: string;
      negotiationId?: string;
    }) => {
      const businessId = await ctx.resolveBusinessId(bId || contractId);
      const supabase = getServiceSupabase();

      let policy: PolicyRule | null = null;
      let treasuryBalance: number | undefined = undefined;

      if (businessId) {
        // Fetch policy
        const { data: pData } = await supabase
          .from("policies")
          .select("*")
          .eq("business_id", businessId)
          .maybeSingle();
        if (pData) {
          policy = {
            max_auto_transaction: Number(pData.max_auto_transaction),
            min_savings: Number(pData.min_savings),
            human_approval_required_above: Number(pData.human_approval_required_above),
            allowed_categories: pData.allowed_categories || [],
            category_budgets: pData.category_budgets,
          };
        }

        // Fetch organization treasury balance
        const { data: bData } = await supabase
          .from("businesses")
          .select("treasury_balance")
          .eq("id", businessId)
          .maybeSingle();
        if (bData && bData.treasury_balance !== null && bData.treasury_balance !== undefined) {
          treasuryBalance = Number(bData.treasury_balance);
        }
      }

      // Default fallback policy if none defined in DB
      if (!policy) {
        policy = {
          max_auto_transaction: 2000,
          min_savings: 200,
          human_approval_required_above: 2000,
          allowed_categories: ["software", "cloud", "contractors"],
        };
      }

      const evalResult = checkPolicy(action, policy, {
        amount,
        savings: savings ?? 0,
        category,
        treasuryBalance,
        contractId,
        negotiationId,
      });

      // If decision is 'needs_human', record a pending row in approvals table
      let approvalRow: { id: string } | null = null;
      if (evalResult.decision === "needs_human" && businessId) {
        let negId = negotiationId || null;
        if (!negId && contractId) {
          const { data: existingNeg } = await supabase
            .from("negotiations")
            .select("id")
            .eq("contract_id", contractId)
            .maybeSingle();
          negId = existingNeg?.id || null;
        }

        let approvalQuery = supabase
          .from("approvals")
          .select("id, status")
          .eq("business_id", businessId)
          .eq("status", "pending");

        if (negId) {
          approvalQuery = approvalQuery.eq("negotiation_id", negId);
        }

        const { data: existingApp } = await approvalQuery.maybeSingle();
        if (existingApp) {
          approvalRow = existingApp;
        } else {
          const { data: newApp, error: appErr } = await supabase
            .from("approvals")
            .insert({
              business_id: businessId,
              negotiation_id: negId,
              status: "pending",
              reason: evalResult.reasons.join("; ") || `Amount ($${amount.toLocaleString()}) requires human approval`,
            })
            .select("id")
            .single();

          if (!appErr && newApp) {
            approvalRow = newApp;
          }
        }
      }

      await logAgentAction({
        businessId,
        action: "check_policy",
        reason: "Verify proposed transaction against deterministic policy rules",
        confidence: 1.0,
        input: { action, amount, savings, category, contractId, negotiationId },
        result: {
          decision: evalResult.decision,
          approved: evalResult.approved,
          requiresHumanApproval: evalResult.requiresHumanApproval,
          reasons: evalResult.reasons,
          checks: evalResult.checks,
          approvalId: approvalRow?.id,
        },
      });

      return {
        action,
        amount,
        savings: savings ?? 0,
        category,
        decision: evalResult.decision,
        checks: evalResult.checks,
        reasons: evalResult.reasons,
        approved: evalResult.approved,
        requiresHumanApproval: evalResult.requiresHumanApproval,
        approvalId: approvalRow?.id,
      };
    },
  });

  return {
    check_policy,
  };
}
