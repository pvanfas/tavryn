export interface BusinessMetricItem {
  id: string;
  name: string;
  isReal: boolean;
  walletAddress: string | null;
  treasuryBalance: number;
  contractsCount: number;
  totalSpend: number;
  totalSavings: number;
  createdAt: string;
}

export interface TransactionMetricItem {
  id: string;
  businessId: string;
  businessName: string;
  vendorName: string;
  amount: number;
  currency: string;
  status: string;
  escrowAddress: string | null;
  txHash: string | null;
  isSimulated: boolean;
  createdAt: string;
}

export interface TractionMetricsResult {
  realOnly: boolean;
  generatedAt: string;
  businesses: {
    totalCount: number;
    realCount: number;
    demoCount: number;
    list: BusinessMetricItem[];
  };
  usdcVolume: {
    escrowed: number;
    released: number;
    refunded: number;
    inFlight: number;
    failedOrDisputed: number;
    currency: string;
  };
  savings: {
    negotiated: number;
    realized: number;
    totalRealized?: number;
    offChainSavings: number;
    totalSpendAnalyzed: number;
    savingsRatePct: number;
  };
  contractsAndNegotiations: {
    contractsTotal: number;
    contractsOptimized: number;
    negotiationsRun: number;
    negotiationsAccepted: number;
    negotiationsWalkedAway: number;
    negotiationsActive: number;
  };
  governance: {
    agentDecisionsCount: number;
    humanEscalationsCount: number;
    humanApprovedCount: number;
    humanRejectedCount: number;
    humanPendingCount: number;
    humanApprovalRatePct: number;
  };
  reviewer: {
    totalReviews: number;
    agreedCount: number;
    challengedCount: number;
    rejectedCount: number;
    challengeRatePct: number;
  };
  efficiency: {
    avgRoundsToClose: number;
    avgCycleTimeMinutes: number;
  };
  receiptsCount: number;
  transactions: TransactionMetricItem[];
}
