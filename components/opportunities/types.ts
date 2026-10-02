export interface OpportunityItem {
  id: string;
  service: string;
  category: string;
  current_price: number | string;
  renewal_date: string;
  daysRemaining: number;
  savings: number;
  heuristicType: string;
  explanation: string;
  status: string;
  vendors?: {
    name: string;
    category: string;
    contact: string | null;
    reputation_score: number | null;
    is_simulated: boolean | null;
  } | null;
}

export interface OpportunitiesTableProps {
  opportunities: OpportunityItem[];
  businessId?: string;
}
