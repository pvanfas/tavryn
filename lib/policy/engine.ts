import {
  PolicyCheckItem,
  PolicyContext,
  PolicyDecision,
  PolicyEvaluation,
  PolicyRule,
} from "./types";

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
