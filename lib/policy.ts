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
  maybeContext?: PolicyContext
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
  const isNegative = isNaN(amount) || isNaN(savings) || amount < 0 || savings < 0;
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
      detail: "Transaction amount and savings values are valid non-negative numbers",
    });
  }

  // 2. Category validation (disallowed category returns 'rejected')
  const allowed = (policy.allowed_categories || []).map((c) => c.trim().toLowerCase());
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
    reasons.push(`Projected savings ($${savings.toLocaleString()}) does not meet minimum policy threshold ($${minSavings.toLocaleString()})`);
    isRejected = true;
  } else {
    checks.push({
      name: "savings_threshold",
      passed: true,
      detail: `Projected savings ($${savings.toLocaleString()}) meets or exceeds minimum policy requirement ($${minSavings.toLocaleString()})`,
    });
  }

  // 4. Category budget remaining (if defined)
  if (policy.category_budgets && policy.category_budgets[category] !== undefined) {
    const budget = Number(policy.category_budgets[category]);
    if (amount > budget) {
      checks.push({
        name: "category_budget",
        passed: false,
        detail: `Amount ($${amount.toLocaleString()}) exceeds defined budget limit for category '${context.category}' ($${budget.toLocaleString()})`,
      });
      reasons.push(`Amount ($${amount.toLocaleString()}) exceeds defined budget for category '${context.category}' ($${budget.toLocaleString()})`);
      isRejected = true;
    } else {
      checks.push({
        name: "category_budget",
        passed: true,
        detail: `Amount ($${amount.toLocaleString()}) is within remaining budget for category '${context.category}' ($${budget.toLocaleString()})`,
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
      reasons.push(`Insufficient treasury balance ($${treasury.toLocaleString()}) for amount ($${amount.toLocaleString()})`);
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
    reasons.push(`Amount ($${amount.toLocaleString()}) exceeds human approval threshold ($${humanAbove.toLocaleString()})`);
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
    reasons.push(`Amount ($${amount.toLocaleString()}) exceeds autonomous transaction ceiling ($${maxAuto.toLocaleString()})`);
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
    reasons: reasons.length > 0 ? reasons : ["Transaction complies with all deterministic policy rules"],
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
  }
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
        human_approval_required_above: Number(pData.human_approval_required_above),
        allowed_categories: pData.allowed_categories || [],
        category_budgets: pData.category_budgets,
      }
    : {
        max_auto_transaction: 2000,
        min_savings: 200,
        human_approval_required_above: 2000,
        allowed_categories: ["software", "cloud", "contractors"],
      };

  // 2. Fetch business treasury balance
  const { data: bData } = await supabase
    .from("businesses")
    .select("treasury_balance")
    .eq("id", businessId)
    .maybeSingle();

  const treasuryBalance = bData?.treasury_balance !== null && bData?.treasury_balance !== undefined
    ? Number(bData.treasury_balance)
    : undefined;

  // 3. Re-evaluate policy purely deterministically
  const evalResult = checkPolicy(context.action || "payment", policy, {
    amount: context.amount,
    savings: context.savings ?? 0,
    category: context.category,
    treasuryBalance,
    contractId: context.contractId,
    negotiationId: context.negotiationId,
  });

  // If automatically approved, authorize immediately
  if (evalResult.decision === "approved") {
    return {
      authorized: true,
      decision: "approved",
      reason: "Transaction automatically authorized under deterministic spending policy",
    };
  }

  // If rejected by deterministic rules (e.g. unauthorized category, negative numbers), refuse
  if (evalResult.decision === "rejected") {
    return {
      authorized: false,
      decision: "rejected",
      reason: `Transaction rejected by policy: ${evalResult.reasons.join("; ")}`,
    };
  }

  // If decision is 'needs_human', inspect the approvals table
  let approvalQuery = supabase
    .from("approvals")
    .select("*")
    .eq("business_id", businessId)
    .eq("status", "approved");

  if (context.negotiationId) {
    approvalQuery = approvalQuery.eq("negotiation_id", context.negotiationId);
  }

  const { data: approvedRecords } = await approvalQuery.order("created_at", { ascending: false }).limit(1);

  if (approvedRecords && approvedRecords.length > 0) {
    return {
      authorized: true,
      decision: "approved",
      reason: "Transaction authorized via verified human approval record",
      approvalId: approvedRecords[0].id,
    };
  }

  return {
    authorized: false,
    decision: "needs_human",
    reason: `Transaction exceeds autonomous ceiling ($${context.amount.toLocaleString()}) and requires explicit human approval in approvals table.`,
  };
}
