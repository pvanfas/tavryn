export interface CheckItem {
  name: string;
  passed: boolean;
  detail: string;
}

export interface PolicyData {
  max_auto_transaction: number;
  min_savings: number;
  human_approval_required_above: number;
  allowed_categories: string[];
  category_budgets?: Record<string, number> | null;
}

export interface ContractInfo {
  id: string;
  service: string;
  category: string;
  baselinePrice: number;
  proposedPrice: number;
  annualSavings: number;
  savingsPct: number;
  seat_count: number | null;
  active_seats: number | null;
  daysUntilRenewal?: number;
  upcomingObligations30d?: number;
  vendor?: {
    name: string;
    is_simulated: boolean;
  } | null;
  business?: {
    id: string;
    name: string;
    treasury_balance?: number;
  } | null;
}

export interface DecisionData {
  contract: ContractInfo;
  policy: PolicyData;
  evaluation: {
    decision: "approved" | "needs_human" | "rejected";
    checks: CheckItem[];
    reasons: string[];
    approved: boolean;
    requiresHumanApproval: boolean;
    runwayAnalysis?: {
      activeTreasury: number;
      upcomingObligations30d: number;
      proposedCommitment: number;
      projectedLiquidity: number;
      daysUntilRenewal: number;
      liquidityRatio: number;
      recommendation:
        "execute_now" | "schedule_deferred" | "escalate_low_runway";
      reasoning: string;
    };
  };
  approval: {
    id: string;
    status: "pending" | "approved" | "rejected";
    reason?: string;
    decided_at?: string;
  } | null;
  review?: {
    id: string;
    business_id: string;
    contract_id: string;
    verdict: "agree" | "challenge" | "reject";
    concerns: Array<{
      issue: string;
      severity: "low" | "medium" | "high";
    }>;
    suggested_action: string;
    model: string;
    created_at: string;
  } | null;
}

export interface ReceiptItem {
  id: string;
  token: string;
  created_at: string;
  revoked_at: string | null;
  show_business_name: boolean;
  show_vendor_name: boolean;
}

export interface VerificationCheck {
  field: string;
  name: string;
  expected: string | number;
  actual: string | number;
  passed: boolean;
  message: string;
}

export interface VerificationData {
  verified: boolean;
  allPassed: boolean;
  checks: VerificationCheck[];
  discrepancies: string[];
  confirmationDocument?: string;
  transaction?: {
    id: string;
    status: string;
    tx_hash?: string;
    amount: number;
    is_simulated?: boolean;
  } | null;
  approval?: {
    id: string;
    status: string;
    reason?: string;
  } | null;
}
