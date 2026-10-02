export interface Turn {
  role: "agent" | "vendor" | "system";
  speaker: string;
  amount?: number;
  message: string;
  round?: number;
  timestamp: string;
  accepted?: boolean;
}

export interface Explanation {
  belowPolicyCeiling: string;
  dollarSavings: string;
  competitorComparison: string;
  serviceLevelsPreserved: string;
  summary: string;
}

export interface VendorMemoryData {
  has_history: boolean;
  vendor_id?: string;
  vendor_name?: string;
  last_price?: number | null;
  accepted_discount_pct?: number | null;
  rounds_to_close?: number | null;
  outcome?: string;
  delivered_ok?: boolean;
  reputation_score?: number;
  deals_count?: number;
  last_updated?: string;
  summary_sentence?: string;
  insight?: string;
}

export interface NegotiationData {
  id: string;
  contract_id: string;
  original_price: number;
  target_price: number;
  current_offer: number;
  status: string;
  conversation: Turn[];
  final_price: number | null;
  savings: number | null;
  rounds: number;
}

export interface ContractData {
  id: string;
  service: string;
  category: string;
  current_price: number;
  seat_count: number | null;
  active_seats: number | null;
  vendors?: {
    name: string;
    category: string;
    contact: string | null;
    reputation_score: number | null;
    is_simulated: boolean | null;
  } | null;
}

export interface ExtractedTerms {
  counter_offer: number | null;
  accepted: boolean;
  seats: number | null;
  commitment_months: number | null;
  accepts_usdc: boolean;
  notes: string;
  raw_text: string;
}

export interface ReplyProcessResult {
  decision: "agreed" | "counter" | "walk_away" | "usdc_refused";
  reason: string;
  extraction: ExtractedTerms;
  message: string;
  suggested_action:
    | "escrow"
    | "record_savings_no_payment"
    | "await_vendor"
    | "walk_away";
}

export interface DraftEmailData {
  to: string;
  recipient: string;
  subject: string;
  body: string;
  baseline_price: number;
  target_price: number;
  walkAwayCeiling: number;
  openingOffer: number;
  usageCitations?: {
    seatCount: number | null;
    activeSeats: number | null;
    utilizationPct: number | null;
    declinePct: number | null;
  };
}
