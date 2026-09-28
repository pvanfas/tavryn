export interface ToolContext {
  resolveBusinessId: (contractId?: string) => Promise<string>;
  getBusinessId: () => string;
}

export interface ContractDetails {
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

export interface UsageDetails {
  contractId: string;
  service: string;
  seat_count: number | null;
  active_seats: number | null;
  unused_seats: number | null;
  utilization_pct: number | null;
  decline_pct: number | null;
  signals: string[];
}

export interface VendorOption {
  id: string;
  name: string;
  category: string;
  reputationScore: number;
  isSimulated: boolean;
}

export interface SavingsCalculation {
  oldPrice: number;
  newPrice: number;
  months: number;
  absoluteSavings: number;
  percentageSavings: number;
  monthlySavings: number;
}
