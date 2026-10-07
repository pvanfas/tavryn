export interface FundingResultData {
  businessId: string;
  businessName: string;
  walletAddress: string;
  contractsCount: number;
  fundingInstructions: {
    network: string;
    chainId: number;
    rpcUrl: string;
    token: string;
    tokenAddress: string;
    faucetUrl: string;
    explorerUrl: string;
  };
}

export type IngestMode = "statement_invoice" | "subscriptions_csv" | "manual";
