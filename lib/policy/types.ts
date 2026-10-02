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
  // Treasury runway & liquidity pre-check fields
  upcomingObligations30d?: number;
  daysUntilRenewal?: number;
  monthlyBurnRate?: number;
}

export type PolicyDecision = "approved" | "needs_human" | "rejected";

export interface PolicyCheckItem {
  name: string;
  passed: boolean;
  detail: string;
}

export interface RunwayAnalysis {
  treasuryBalance: number;
  transactionAmount: number;
  projectedLiquidity: number;
  upcomingObligations30d: number;
  daysUntilRenewal: number;
  hasSufficientRunway: boolean;
  recommendation: "execute_now" | "schedule_deferred" | "escalate_low_runway";
}

export interface PolicyEvaluation {
  decision: PolicyDecision;
  checks: PolicyCheckItem[];
  reasons: string[];
  // Backwards compatibility properties
  approved: boolean;
  requiresHumanApproval: boolean;
  runwayAnalysis?: RunwayAnalysis;
}
