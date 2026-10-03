import { ReviewerOutput } from "../reviewer";

export interface NegotiationOptions {
  maxRounds?: number;
  walkAwayCeiling?: number;
  targetPrice?: number;
  commitmentMonths?: number;
}

export interface NegotiationExplanation {
  belowPolicyCeiling: string;
  dollarSavings: string;
  competitorComparison: string;
  serviceLevelsPreserved: string;
  summary: string;
}

export interface NegotiationTurn {
  role: "agent" | "vendor" | "system";
  speaker: string;
  amount?: number;
  message: string;
  round?: number;
  timestamp: string;
  accepted?: boolean;
}

export interface MemoryUsedInfo {
  hasHistory: boolean;
  vendorId?: string;
  vendorName?: string;
  lastPrice?: number | null;
  acceptedDiscountPct?: number | null;
  roundsToClose?: number | null;
  outcome?: string;
  deliveredOk?: boolean;
  reputationScore?: number;
  dealsCount?: number;
  insight: string;
  summarySentence?: string;
}

export interface NegotiationLoopResult {
  contractId: string;
  vendorName: string;
  serviceName: string;
  originalPrice: number;
  targetPrice: number;
  walkAwayCeiling: number;
  finalPrice: number | null;
  savings: number;
  rounds: number;
  status: "agreed" | "walked_away";
  explanation: NegotiationExplanation;
  conversation: NegotiationTurn[];
  memoryUsed?: MemoryUsedInfo;
  reviewer?: ReviewerOutput | null;
}

export interface ContractOutput {
  id: string;
  business_id: string;
  service: string;
  category: string;
  current_price: number;
  renewal_date: string;
  seat_count: number | null;
  active_seats: number | null;
  usage_metric: unknown;
  status: string;
  vendor: {
    id: string;
    name: string;
    category: string;
    reputation_score: number | null;
    is_simulated: boolean | null;
  } | null;
}

export interface UsageOutput {
  contractId: string;
  service: string;
  seat_count: number | null;
  active_seats: number | null;
  unused_seats: number | null;
  utilization_pct: number | null;
  decline_pct: number | null;
  signals: string[];
}

export interface VendorOptionsOutput {
  requirement: string;
  categoryFilter: string;
  matchCount: number;
  options: Array<{
    id: string;
    name: string;
    category: string;
    reputationScore: number;
    isSimulated: boolean;
  }>;
}

export interface PolicyCheckOutput {
  action: string;
  amount: number;
  savings: number;
  category: string;
  approved: boolean;
  requiresHumanApproval: boolean;
  reasons: string[];
}

export interface SendVendorMessageOutput {
  negotiation_id?: string;
  counter_offer: number;
  message: string;
  accepted: boolean;
  round: number;
}

export interface NegotiationStatusOutput {
  exists: boolean;
  negotiation: any;
}
