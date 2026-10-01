/**
 * Deterministic Policy Engine (/lib/policy.ts)
 *
 * Strict architectural rule: Pure deterministic code. Zero LLM involvement.
 * The LLM cannot approve its own actions or bypass policy constraints.
 * Payment/escrow tools MUST call checkPolicy server-side and refuse if not approved.
 */

export interface PolicyRule {
  id?: string;
  business_id?: string;
  max_auto_transaction: number;
  min_savings: number;
  human_approval_required_above: number;
  allowed_categories: string[];
  category_budgets?: Record<string, number> | null;
}

export interface PolicyContext {
  action?: string;
  amount: number;
  savings?: number;
  category: string;
  treasuryBalance?: number;
  currentPeriodSpent?: number;
  allowHumanOverrideOnLowSavings?: boolean;
  contract_id?: string;
  contractId?: string;
  vendor_id?: string;
  negotiationId?: string;
}

export type PolicyDecision = "approved" | "needs_human" | "rejected";

export interface PolicyCheckItem {
  name: string;
  passed: boolean;
  detail: string;
}

export interface PolicyEvaluation {
  decision: PolicyDecision;
  checks: PolicyCheckItem[];
  reasons: string[];
  // Backwards compatibility properties
  approved: boolean;
  requiresHumanApproval: boolean;
}

/**
 * Pure deterministic evaluation of a proposed transaction against an organization's policy.
 *
 * Overloaded to support both:
 * 1. checkPolicy(action, policy, context)
 * 2. checkPolicy(policy, context)
 */
export function checkPolicy(
  actionOrPolicy: string | PolicyRule,
  policyOrContext: PolicyRule | PolicyContext,
  maybeContext?: PolicyContext,
): PolicyEvaluation {
  let _action = "execute";
  let policy: PolicyRule;
  let context: PolicyContext;

  if (typeof actionOrPolicy === "string") {
    _action = actionOrPolicy;
    policy = policyOrContext as PolicyRule;
    context = maybeContext || { amount: 0, category: "" };
  } else {
    policy = actionOrPolicy;
    context = (policyOrContext as PolicyContext) || { amount: 0, category: "" };
    _action = context.action || "execute";
  }

  const checks: PolicyCheckItem[] = [];
  const reasons: string[] = [];

  const rawAmount = context.amount;
  const rawSavings = context.savings ?? 0;
  const amount = Number(rawAmount);
  const savings = Number(rawSavings);
  const category = (context.category || "").trim().toLowerCase();

  let isRejected = false;
  let needsHuman = false;

  // 1. Validate numbers (negative numbers are strictly rejected)
  const isNegative =
    isNaN(amount) || isNaN(savings) || amount < 0 || savings < 0;
  if (isNegative) {
    checks.push({
      name: "valid_numbers",
      passed: false,
      detail: `Transaction amount ($${amount}) and savings ($${savings}) must be non-negative numerical values`,
    });
    reasons.push("Negative or invalid numeric amounts are strictly prohibited");
    isRejected = true;
  } else {
    checks.push({
      name: "valid_numbers",
      passed: true,
      detail:
        "Transaction amount and savings values are valid non-negative numbers",
    });
  }

  // 2. Category validation (disallowed category returns 'rejected')
  const allowed = (policy.allowed_categories || []).map((c) =>
    c.trim().toLowerCase(),
  );
  const categoryAllowed = category.length > 0 && allowed.includes(category);
  if (!categoryAllowed) {
    checks.push({
      name: "category_allowed",
      passed: false,
      detail: `Category '${context.category}' is not authorized. Allowed categories: [${(policy.allowed_categories || []).join(", ")}]`,
    });
    reasons.push(`Category '${context.category}' is not in allowed categories`);
    isRejected = true;
  } else {
    checks.push({
      name: "category_allowed",
      passed: true,
      detail: `Category '${context.category}' is verified in allowed categories`,
    });
  }

  // 3. Minimum savings threshold
  const minSavings = Number(policy.min_savings);
  const savingsPassed = savings >= minSavings;
  if (!savingsPassed) {
    checks.push({
      name: "savings_threshold",
      passed: false,
      detail: `Projected savings of $${savings.toLocaleString()} is below the required policy minimum of $${minSavings.toLocaleString()}`,
    });
    reasons.push(
      `Projected savings ($${savings.toLocaleString()}) does not meet minimum policy threshold ($${minSavings.toLocaleString()})`,
    );
    if (context.allowHumanOverrideOnLowSavings) {
      needsHuman = true;
    } else {
      isRejected = true;
    }
  } else {
    checks.push({
      name: "savings_threshold",
      passed: true,
      detail: `Projected savings ($${savings.toLocaleString()}) meets or exceeds minimum policy requirement ($${minSavings.toLocaleString()})`,
    });
  }

  // 4. Cumulative category budget remaining (if defined)
  if (
    policy.category_budgets &&
    policy.category_budgets[category] !== undefined
  ) {
    const budget = Number(policy.category_budgets[category]);
    const priorSpent = Number(context.currentPeriodSpent || 0);
    const totalProjected = priorSpent + amount;
    if (totalProjected > budget) {
      checks.push({
        name: "category_budget",
        passed: false,
        detail: `Projected spend ($${totalProjected.toLocaleString()} = $${priorSpent.toLocaleString()} prior + $${amount.toLocaleString()}) exceeds defined budget limit for category '${context.category}' ($${budget.toLocaleString()})`,
      });
      reasons.push(
        `Cumulative category spend ($${totalProjected.toLocaleString()}) exceeds defined budget for category '${context.category}' ($${budget.toLocaleString()})`,
      );
      if (amount > budget) {
        isRejected = true;
      } else {
        needsHuman = true;
      }
    } else {
      checks.push({
        name: "category_budget",
        passed: true,
        detail: `Projected cumulative spend ($${totalProjected.toLocaleString()}) is within remaining budget for category '${context.category}' ($${budget.toLocaleString()})`,
      });
    }
  } else {
    checks.push({
      name: "category_budget",
      passed: true,
      detail: `No category-specific budget limit configured for category '${context.category}'`,
    });
  }

  // 5. Treasury balance sufficient
  if (context.treasuryBalance !== undefined) {
    const treasury = Number(context.treasuryBalance);
    if (amount > treasury) {
      checks.push({
        name: "treasury_balance",
        passed: false,
        detail: `Transaction amount ($${amount.toLocaleString()}) exceeds organization treasury balance ($${treasury.toLocaleString()})`,
      });
      reasons.push(
        `Insufficient treasury balance ($${treasury.toLocaleString()}) for amount ($${amount.toLocaleString()})`,
      );
      isRejected = true;
    } else {
      checks.push({
        name: "treasury_balance",
        passed: true,
        detail: `Treasury balance ($${treasury.toLocaleString()}) is sufficient for transaction ($${amount.toLocaleString()})`,
      });
    }
  } else {
    checks.push({
      name: "treasury_balance",
      passed: true,
      detail: "Treasury balance verification not requested in context",
    });
  }

  // 6. Human approval required above threshold
  const humanAbove = Number(policy.human_approval_required_above);
  const withinHumanThreshold = amount <= humanAbove;
  if (!withinHumanThreshold) {
    checks.push({
      name: "human_approval_threshold",
      passed: false,
      detail: `Amount ($${amount.toLocaleString()}) exceeds human approval threshold ($${humanAbove.toLocaleString()})`,
    });
    reasons.push(
      `Amount ($${amount.toLocaleString()}) exceeds human approval threshold ($${humanAbove.toLocaleString()})`,
    );
    needsHuman = true;
  } else {
    checks.push({
      name: "human_approval_threshold",
      passed: true,
      detail: `Amount ($${amount.toLocaleString()}) is below human approval threshold ($${humanAbove.toLocaleString()})`,
    });
  }

  // 7. Autonomous ceiling threshold (amount <= max_auto_transaction)
  const maxAuto = Number(policy.max_auto_transaction);
  const autoPassed = amount <= maxAuto;
  if (!autoPassed) {
    checks.push({
      name: "amount_within_auto_ceiling",
      passed: false,
      detail: `Amount ($${amount.toLocaleString()}) exceeds autonomous transaction ceiling ($${maxAuto.toLocaleString()})`,
    });
    reasons.push(
      `Amount ($${amount.toLocaleString()}) exceeds autonomous transaction ceiling ($${maxAuto.toLocaleString()})`,
    );
    needsHuman = true;
  } else {
    checks.push({
      name: "amount_within_auto_ceiling",
      passed: true,
      detail: `Amount ($${amount.toLocaleString()}) is within autonomous transaction ceiling ($${maxAuto.toLocaleString()})`,
    });
  }

  // Determine final decision based on deterministic priority
  let decision: PolicyDecision = "approved";
  if (isRejected) {
    decision = "rejected";
  } else if (needsHuman) {
    decision = "needs_human";
  } else {
    decision = "approved";
  }

  const approved = decision === "approved";
  const requiresHumanApproval = decision === "needs_human";

  return {
    decision,
    checks,
    reasons:
      reasons.length > 0
        ? reasons
        : ["Transaction complies with all deterministic policy rules"],
    approved,
    requiresHumanApproval,
  };
}

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
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const { data: periodTxs } = await supabase
      .from("transactions")
      .select("amount, contracts(category)")
      .eq("business_id", businessId)
      .in("status", ["funded", "escrowed", "released", "completed"])
      .gte("created_at", startOfMonth);

    if (periodTxs) {
      for (const tx of periodTxs) {
        const txCategory = (tx.contracts as any)?.category || context.category;
        if (txCategory && txCategory.toLowerCase() === (context.category || "").toLowerCase()) {
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
  // Note: If the failure was category_budget overrun or thresholds, escalate to human supervisor as permitted by Item 3.
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
        reason: "Transaction approval was already consumed concurrently by another transaction.",
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
