import { checkPolicy } from "./engine";
import { PolicyDecision, PolicyRule } from "./types";

/**
 * Server-Side Policy Enforcement Guard
 *
 * Strict architectural rule: Any execution path (escrow creation, payments) must re-evaluate
 * policy server-side and refuse execution unless automatically 'approved' or backed by an
 * approved row in the 'approvals' table. The agent cannot bypass this via prompt content.
 */
export async function verifyPolicyExecutionAuthorization(
  businessId: string,
  context: {
    contractId?: string;
    negotiationId?: string;
    amount: number;
    savings?: number;
    category: string;
    action?: string;
  },
): Promise<{
  authorized: boolean;
  decision: PolicyDecision;
  reason: string;
  approvalId?: string;
}> {
  const { getServiceSupabase } = await import("@/lib/supabase");
  const supabase = getServiceSupabase();

  // 1. Fetch organization policy directly from DB
  const { data: pData } = await supabase
    .from("policies")
    .select("*")
    .eq("business_id", businessId)
    .maybeSingle();

  const policy: PolicyRule = pData
    ? {
        max_auto_transaction: Number(pData.max_auto_transaction),
        min_savings: Number(pData.min_savings),
        human_approval_required_above: Number(
          pData.human_approval_required_above,
        ),
        allowed_categories: pData.allowed_categories || [],
        category_budgets: pData.category_budgets,
      }
    : {
        max_auto_transaction: 2000,
        min_savings: 200,
        human_approval_required_above: 2000,
        allowed_categories: ["software", "cloud", "contractors"],
      };

  // 2. Fetch business treasury balance (attempt on-chain ground truth if wallet configured, fallback to DB)
  const { data: bData } = await supabase
    .from("businesses")
    .select("treasury_balance, wallet_address")
    .eq("id", businessId)
    .maybeSingle();

  let treasuryBalance =
    bData?.treasury_balance !== null && bData?.treasury_balance !== undefined
      ? Number(bData.treasury_balance)
      : undefined;

  if (bData?.wallet_address && bData.wallet_address.startsWith("0x")) {
    try {
      const { getArcUsdcBalance } = await import("@/lib/circle");
      const liveBal = await getArcUsdcBalance(bData.wallet_address);
      if (liveBal > 0) {
        treasuryBalance = liveBal;
      }
    } catch {
      // Continue with DB fallback
    }
  }

  // Query cumulative period spend for this category to enforce real cumulative budgets
  let currentPeriodSpent = 0;
  try {
    const now = new Date();
    const startOfMonth = new Date(
      now.getFullYear(),
      now.getMonth(),
      1,
    ).toISOString();
    const { data: periodTxs } = await supabase
      .from("transactions")
      .select("amount, contracts(category)")
      .eq("business_id", businessId)
      .in("status", ["funded", "escrowed", "released", "completed"])
      .gte("created_at", startOfMonth);

    if (periodTxs) {
      for (const tx of periodTxs) {
        const txCategory = (tx.contracts as any)?.category || context.category;
        if (
          txCategory &&
          txCategory.toLowerCase() === (context.category || "").toLowerCase()
        ) {
          currentPeriodSpent += Number(tx.amount || 0);
        }
      }
    }
  } catch {
    // Non-fatal, use 0
  }

  // 3. Check for human approval record first if negotiationId is present
  let hasValidApprovalRecord = false;
  let approvedRecord: any = null;

  if (context.negotiationId) {
    const scopedQuery = supabase
      .from("approvals")
      .select("*")
      .eq("business_id", businessId)
      .eq("negotiation_id", context.negotiationId)
      .eq("status", "approved")
      .is("used_at", null)
      .gte("amount", context.amount)
      .order("created_at", { ascending: false });

    const { data: dbData, error: dbErr } = await scopedQuery;

    if (!dbErr && dbData && dbData.length > 0) {
      approvedRecord = dbData[0];
      hasValidApprovalRecord = true;
    } else if (dbErr && (dbErr.code === "42703" || dbErr.code === "PGRST204")) {
      const { data: allApproved } = await supabase
        .from("approvals")
        .select("*")
        .eq("business_id", businessId)
        .eq("negotiation_id", context.negotiationId)
        .eq("status", "approved")
        .order("created_at", { ascending: false });

      if (allApproved) {
        approvedRecord = allApproved.find((r: any) => {
          if (
            r.used_at ||
            (typeof r.reason === "string" && r.reason.startsWith("[USED"))
          ) {
            return false;
          }
          let appAmount = 0;
          if (
            r.amount !== undefined &&
            r.amount !== null &&
            !isNaN(Number(r.amount))
          ) {
            appAmount = Number(r.amount);
          } else if (typeof r.reason === "string") {
            const m = r.reason.match(/\[AMOUNT:\s*(\d+(?:\.\d+)?)\]/);
            if (m) appAmount = Number(m[1]);
          }
          return appAmount >= context.amount;
        });
        if (approvedRecord) hasValidApprovalRecord = true;
      }
    }
  }

  // 4. Re-evaluate policy purely deterministically
  const evalResult = checkPolicy(context.action || "payment", policy, {
    amount: context.amount,
    savings: context.savings ?? 0,
    category: context.category,
    treasuryBalance,
    currentPeriodSpent,
    allowHumanOverrideOnLowSavings: hasValidApprovalRecord,
    contractId: context.contractId,
    negotiationId: context.negotiationId,
  });

  // If automatically approved, authorize immediately
  if (evalResult.decision === "approved") {
    return {
      authorized: true,
      decision: "approved",
      reason:
        "Transaction automatically authorized under deterministic spending policy",
    };
  }

  // If rejected by deterministic hard rules (e.g. unauthorized category, negative numbers, empty treasury), refuse.
  if (evalResult.decision === "rejected") {
    const hardRejections = evalResult.checks.filter(
      (c) =>
        !c.passed &&
        c.name !== "category_budget" &&
        c.name !== "human_approval_threshold" &&
        c.name !== "amount_within_auto_ceiling",
    );
    if (hardRejections.length > 0) {
      return {
        authorized: false,
        decision: "rejected",
        reason: `Transaction rejected by policy: ${evalResult.reasons.join("; ")}`,
      };
    }
  }

  // If decision is 'needs_human', inspect the approvals table
  // Security Invariant: Require negotiationId on every approval lookup; business-wide fallback is prohibited.
  if (!context.negotiationId) {
    return {
      authorized: false,
      decision: "needs_human",
      reason: `Transaction exceeds autonomous ceiling ($${context.amount.toLocaleString()}) and requires explicit human approval; lacks a linked negotiationId. Explicit negotiationId is strictly required for approval lookup; business-wide fallback is prohibited.`,
    };
  }

  if (approvedRecord) {
    // Single-use enforcement: atomic compare-and-swap CAS update to eliminate race conditions
    const usedAt = new Date().toISOString();
    const { data: updatedApp, error: updErr } = await supabase
      .from("approvals")
      .update({ used_at: usedAt })
      .eq("id", approvedRecord.id)
      .is("used_at", null)
      .select("id")
      .maybeSingle();

    if (updErr && (updErr.code === "42703" || updErr.code === "PGRST204")) {
      // Fallback marking if used_at column does not exist on remote DB yet
      await supabase
        .from("approvals")
        .update({
          reason: `[USED ${usedAt}] ${approvedRecord.reason || ""}`.trim(),
        })
        .eq("id", approvedRecord.id);
    } else if (!updatedApp && !updErr) {
      // Concurrency race: another process consumed this approval concurrently
      return {
        authorized: false,
        decision: "needs_human",
        reason:
          "Transaction approval was already consumed concurrently by another transaction.",
      };
    }

    return {
      authorized: true,
      decision: "approved",
      reason:
        "Transaction authorized via verified single-use human approval record",
      approvalId: approvedRecord.id,
    };
  }

  return {
    authorized: false,
    decision: "needs_human",
    reason: `Transaction exceeds autonomous ceiling ($${context.amount.toLocaleString()}) and requires explicit human approval; lacks an unused, valid human approval record with approved amount >= transaction amount for negotiation ${context.negotiationId}.`,
  };
}

/**
 * Safely inserts an approval record with exact requested amount.
 * Handles both migrated schema (amount column) and pre-migration fallback ([AMOUNT: X] tag in reason).
 */
export async function createApprovalRecord(
  supabase: any,
  payload: {
    businessId: string;
    negotiationId?: string | null;
    status: "pending" | "approved" | "rejected";
    reason: string;
    amount?: number | null;
    decidedAt?: string | null;
  },
): Promise<{ id?: string; error?: any }> {
  const insertObj: any = {
    business_id: payload.businessId,
    negotiation_id: payload.negotiationId || null,
    status: payload.status,
    reason: payload.reason,
    decided_at: payload.decidedAt || null,
  };

  if (payload.amount !== undefined && payload.amount !== null) {
    insertObj.amount = payload.amount;
  }

  const { data, error } = await supabase
    .from("approvals")
    .insert(insertObj)
    .select("id")
    .maybeSingle();

  if (error && (error.code === "42703" || error.code === "PGRST204")) {
    delete insertObj.amount;
    if (payload.amount !== undefined && payload.amount !== null) {
      insertObj.reason =
        `[AMOUNT: ${payload.amount}] ${payload.reason || ""}`.trim();
    }
    const fallbackRes = await supabase
      .from("approvals")
      .insert(insertObj)
      .select("id")
      .maybeSingle();
    return { id: fallbackRes.data?.id, error: fallbackRes.error };
  }

  const resId = data?.id;

  if (!error && payload.status === "pending") {
    // Asynchronously dispatch rich notification and live Discord/Slack webhook
    (async () => {
      try {
        const { createNotification } = await import("@/lib/notifications");
        await createNotification({
          businessId: payload.businessId,
          negotiationId: payload.negotiationId,
          category: "policy",
          title: "Supervisor Approval Required",
          message:
            payload.reason ||
            `Transaction${payload.amount ? ` ($${payload.amount.toLocaleString()})` : ""} requires supervisor authorization.`,
          link: "/approvals",
          linkLabel: "Review & Authorize",
        });
      } catch (notifErr) {
        console.warn(
          "[createApprovalRecord] Failed to dispatch webhook notification:",
          notifErr,
        );
      }
    })();
  }

  return { id: resId, error };
}
