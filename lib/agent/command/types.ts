// ─── CARD DATA TYPES ────────────────────────────────────────────────────────

export interface RenewalItem {
  id: string;
  service: string;
  vendorName: string;
  currentPrice: number;
  renewalDate: string;
  category: string;
  seatCount: number | null;
  activeSeats: number | null;
  status: string;
  link: string;
}

export interface SavingsItem {
  id: string;
  service: string;
  vendorName: string;
  currentPrice: number;
  potentialSavings: number;
  savingsPct: number;
  heuristicType: string;
  explanation: string;
  link: string;
}

export interface ApprovalItem {
  id: string;
  contractId: string | null;
  service: string;
  vendorName: string;
  amount: number;
  reason: string;
  createdAt: string;
  link: string;
}

export interface DecisionExplanationData {
  service: string;
  vendorName: string;
  originalPrice: number;
  finalPrice: number;
  savings: number;
  savingsPct: number;
  rounds: number;
  status: string;
  rationale: string;
  telemetrySignals: string[];
  link: string;
}

export interface SavingsSummaryData {
  negotiatedSavings: number;
  realizedSavings: number;
  totalSpendAnalyzed: number;
  savingsRatePct: number;
  contractsOptimized: number;
  period: string;
  link: string;
}

export interface ActionConfirmationData {
  type: "action_confirmation";
  action: "start_negotiation" | "request_approval" | "create_receipt";
  service: string;
  contractId?: string;
  detail: string;
  targetPrice?: number;
  currentPrice?: number;
  params: Record<string, unknown>;
}

export type CommandCard =
  | { type: "renewals"; data: RenewalItem[] }
  | { type: "savings"; data: SavingsItem[] }
  | { type: "approvals"; data: ApprovalItem[] }
  | { type: "decision_explanation"; data: DecisionExplanationData }
  | { type: "savings_summary"; data: SavingsSummaryData }
  | ActionConfirmationData;

export interface CommandResponse {
  text: string;
  card?: CommandCard;
  toolCalls: Array<{ tool: string; input: unknown; output?: unknown }>;
  businessId: string;
  success: boolean;
}
