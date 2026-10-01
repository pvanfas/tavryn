import {
  CheckCircle2,
  ExternalLink,
  Layers,
  TrendingDown,
  Wallet,
} from "lucide-react";
import React from "react";

import { ActivityTimeline } from "@/components/ActivityTimeline";
import { AppShell } from "@/components/AppShell";
import { OpportunitiesTable } from "@/components/OpportunitiesTable";
import { TransactionHashBadge } from "@/components/TransactionHashBadge";
import { BodySmall, Caption, H2 } from "@/components/ui/text";
import { ARC_CONFIG, getOnChainUSDCBalance } from "@/lib/circle";
import { ContractLike, evaluateContractOpportunity } from "@/lib/heuristics";
import { getServiceSupabase } from "@/lib/supabase";

export const revalidate = 0; // Fresh data on each request

interface VendorRel {
  name: string;
  category: string;
  contact: string | null;
  reputation_score: number | null;
  is_simulated: boolean | null;
}

interface ContractRecord extends ContractLike {
  id: string;
  business_id: string;
  vendor_id: string | null;
  vendors?: VendorRel | null;
}

interface DashboardPageProps {
  searchParams: Promise<{ businessId?: string }>;
}

export default async function DashboardPage({
  searchParams,
}: DashboardPageProps) {
  const supabase = getServiceSupabase();
  const { businessId } = await searchParams;

  let businesses: Array<{
    id: string;
    name: string;
    is_real: boolean | null;
    treasury_balance: number | null;
    default_currency: string | null;
    wallet_address: string | null;
  }> = [];

  let business: {
    id: string;
    name: string;
    is_real: boolean | null;
    treasury_balance: number | null;
    default_currency: string | null;
    wallet_address: string | null;
  } | null = null;

  let contracts: ContractRecord[] = [];
  let negotiationsCount = 0;
  let savingsRealized = 0;
  let latestTx: {
    id: string;
    status: string;
    tx_hash: string | null;
    is_simulated: boolean | null;
  } | null = null;

  try {
    // 1. Fetch all businesses
    const { data: bList, error: bListError } = await supabase
      .from("businesses")
      .select(
        "id, name, is_real, treasury_balance, default_currency, wallet_address",
      )
      .order("created_at", { ascending: false });

    if (bListError) throw bListError;
    businesses = bList || [];

    // 2. Resolve Active Business (Default to Demo Co for reviewers)
    if (businessId) {
      business = businesses.find((b) => b.id === businessId) || null;
    }
    if (!business && businesses.length > 0) {
      business = businesses.find((b) => b.name === "Demo Co") || businesses[0];
    }

    // 3. Fetch Contracts for the active business
    if (business?.id) {
      const { data: cData, error: cError } = await supabase
        .from("contracts")
        .select(
          "*, vendors ( name, category, contact, reputation_score, is_simulated )",
        )
        .eq("business_id", business.id)
        .order("renewal_date", { ascending: true });

      if (cError) throw cError;
      contracts = (cData as unknown as ContractRecord[]) || [];

      // 4. Fetch Realized Savings from Negotiations
      if (contracts.length > 0) {
        const contractIds = contracts.map((c) => c.id);
        const { data: nData, error: nError } = await supabase
          .from("negotiations")
          .select("savings, status")
          .in("contract_id", contractIds);

        if (!nError && nData) {
          negotiationsCount = nData.length;
          savingsRealized = nData.reduce(
            (acc, row) => acc + (Number(row.savings) || 0),
            0,
          );
        }

        // Fetch latest settlement transaction for honest status display
        const { data: tRow } = await supabase
          .from("transactions")
          .select("id, status, tx_hash, is_simulated")
          .eq("business_id", business.id)
          .not("status", "eq", "failed")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (tRow) {
          latestTx = tRow;
        }
      }
    }
  } catch (err) {
    console.warn("Database query notice:", (err as Error).message);
  }

  // Live On-Chain Balance with DB Fallback
  let treasuryBalance = Number(business?.treasury_balance ?? 0);
  let balanceSource: "chain" | "db_fallback" = "db_fallback";

  if (business?.wallet_address) {
    try {
      treasuryBalance = await getOnChainUSDCBalance(business.wallet_address);
      balanceSource = "chain";
    } catch (chainErr) {
      console.warn(
        "Direct Arc RPC balance check failed, using DB fallback:",
        (chainErr as Error).message,
      );
      treasuryBalance = Number(business?.treasury_balance ?? 0);
      balanceSource = "db_fallback";
    }
  }
  const currency = business?.default_currency || "USDC";

  // Calculations
  const totalAnnualSpend = contracts.reduce(
    (acc, c) => acc + (c.status === "active" ? Number(c.current_price) : 0),
    0,
  );
  const spendThisMonth = Math.round(totalAnnualSpend / 12);

  const contractOpportunities = contracts.map((c) => {
    const opp = evaluateContractOpportunity(c);
    const renewalDate = new Date(c.renewal_date);
    // eslint-disable-next-line react-hooks/purity
    const msDiff = renewalDate.getTime() - Date.now();
    const daysRemaining = Math.max(
      0,
      Math.ceil(msDiff / (1000 * 60 * 60 * 24)),
    );

    return {
      ...c,
      savings: opp.saving,
      heuristicType: opp.heuristicType,
      explanation: opp.explanation,
      daysRemaining,
    };
  });

  const savingsDiscovered = contractOpportunities.reduce(
    (acc, opp) => acc + (opp.status === "active" ? opp.savings : 0),
    0,
  );

  return (
    <AppShell
      businessName={business?.name || "Demo Co"}
      isReal={Boolean(business?.is_real)}
      breadcrumbs={[
        { label: "Dashboard", href: "/dashboard" },
        { label: "Contracts Ledger" },
      ]}
      businesses={businesses}
      activeBusinessId={business?.id}
      treasuryBalance={treasuryBalance}
      currency={currency}
    >
      {/* Top Metric Cards */}
      <div
        id="treasury"
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4.5"
      >
        {/* Card 1: Treasury */}
        <div className="rounded-2xl bg-white/90 dark:bg-[#111714]/90 p-5 sm:p-6 border border-slate-200/70 dark:border-slate-800/60 shadow-[0_1px_3px_rgba(0,0,0,0.03),0_4px_12px_rgba(0,0,0,0.02)] dark:shadow-[0_1px_3px_rgba(0,0,0,0.2)] hover:border-slate-300 dark:hover:border-slate-700/80 transition-all duration-200">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-emerald-500/10 dark:bg-emerald-500/15 text-[#107e65] dark:text-[#34d399]">
                <Wallet className="h-4 w-4" />
              </div>
              <Caption className="text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Treasury
              </Caption>
            </div>
            {balanceSource === "chain" ? (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-500/10 text-[#107e65] dark:text-emerald-300 border border-emerald-500/20 flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-[#107e65] animate-pulse" />
                Arc
              </span>
            ) : (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20">
                Snapshot
              </span>
            )}
          </div>
          <H2
            as="div"
            className="font-mono text-slate-900 dark:text-white mt-1"
          >
            $
            {treasuryBalance.toLocaleString(undefined, {
              minimumFractionDigits: 0,
              maximumFractionDigits: 2,
            })}
          </H2>
          <BodySmall
            as="div"
            className="mt-2 text-slate-500 dark:text-slate-400"
          >
            {business?.wallet_address ? (
              <a
                href={`${ARC_CONFIG.explorerUrl}/address/${business.wallet_address}`}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono hover:text-[#107e65] inline-flex items-center gap-1 transition-colors"
              >
                <span>
                  {business.wallet_address.slice(0, 6)}...
                  {business.wallet_address.slice(-4)}
                </span>
                <ExternalLink className="h-3 w-3" />
              </a>
            ) : (
              <span>Arc Testnet</span>
            )}
          </BodySmall>
        </div>

        {/* Card 2: Spend This Month */}
        <div className="rounded-2xl bg-white/90 dark:bg-[#111714]/90 p-5 sm:p-6 border border-slate-200/70 dark:border-slate-800/60 shadow-[0_1px_3px_rgba(0,0,0,0.03),0_4px_12px_rgba(0,0,0,0.02)] dark:shadow-[0_1px_3px_rgba(0,0,0,0.2)] hover:border-slate-300 dark:hover:border-slate-700/80 transition-all duration-200">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300">
                <Layers className="h-4 w-4" />
              </div>
              <Caption className="text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Monthly Spend
              </Caption>
            </div>
          </div>
          <H2
            as="div"
            className="font-mono text-slate-900 dark:text-white mt-1"
          >
            ${spendThisMonth.toLocaleString()}
          </H2>
          <BodySmall
            as="div"
            className="mt-2 text-slate-500 dark:text-slate-400"
          >
            ${totalAnnualSpend.toLocaleString()} / year
          </BodySmall>
        </div>

        {/* Card 3: Projected Savings */}
        <div className="rounded-2xl bg-white/90 dark:bg-[#111714]/90 p-5 sm:p-6 border border-slate-200/70 dark:border-slate-800/60 shadow-[0_1px_3px_rgba(0,0,0,0.03),0_4px_12px_rgba(0,0,0,0.02)] dark:shadow-[0_1px_3px_rgba(0,0,0,0.2)] hover:border-slate-300 dark:hover:border-slate-700/80 transition-all duration-200">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-emerald-500/10 dark:bg-emerald-500/15 text-[#107e65] dark:text-[#34d399]">
                <TrendingDown className="h-4 w-4" />
              </div>
              <Caption className="text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Identified Savings
              </Caption>
            </div>
            {totalAnnualSpend > 0 && (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-500/10 text-[#107e65] dark:text-emerald-300 border border-emerald-500/20">
                {Math.round((savingsDiscovered / totalAnnualSpend) * 100)}%
              </span>
            )}
          </div>
          <H2
            as="div"
            className="font-mono text-[#107e65] dark:text-[#34d399] mt-1"
          >
            ${savingsDiscovered.toLocaleString()}
          </H2>
          <BodySmall
            as="div"
            className="mt-2 text-slate-500 dark:text-slate-400"
          >
            {contractOpportunities.filter((o) => o.savings > 0).length}{" "}
            opportunities
          </BodySmall>
        </div>

        {/* Card 4: Realized Savings */}
        <div className="rounded-2xl bg-white/90 dark:bg-[#111714]/90 p-5 sm:p-6 border border-slate-200/70 dark:border-slate-800/60 shadow-[0_1px_3px_rgba(0,0,0,0.03),0_4px_12px_rgba(0,0,0,0.02)] dark:shadow-[0_1px_3px_rgba(0,0,0,0.2)] hover:border-slate-300 dark:hover:border-slate-700/80 transition-all duration-200">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-emerald-500/10 dark:bg-emerald-500/15 text-[#107e65] dark:text-[#34d399]">
                <CheckCircle2 className="h-4 w-4" />
              </div>
              <Caption className="text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Realized Savings
              </Caption>
            </div>
            {latestTx && (
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                  latestTx.is_simulated || latestTx.status === "simulation-only"
                    ? "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20"
                    : "bg-emerald-500/10 text-[#107e65] dark:text-emerald-300 border-emerald-500/20"
                }`}
              >
                {latestTx.is_simulated || latestTx.status === "simulation-only"
                  ? "Simulated Mock"
                  : "Arc Confirmed"}
              </span>
            )}
          </div>
          <H2
            as="div"
            className="font-mono text-slate-900 dark:text-white mt-1"
          >
            ${savingsRealized.toLocaleString()}
          </H2>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-1.5">
            <BodySmall as="div" className="text-slate-500 dark:text-slate-400">
              {negotiationsCount} settled
            </BodySmall>
            {latestTx?.tx_hash && (
              <TransactionHashBadge
                txHash={latestTx.tx_hash}
                isSimulated={latestTx.is_simulated}
                status={latestTx.status}
                compact={true}
              />
            )}
          </div>
        </div>
      </div>

      {/* Real-Time Agent Activity Timeline */}
      <section
        id="negotiations"
        aria-label="Autonomous Agent Execution Timeline"
      >
        <ActivityTimeline
          businessId={business?.id}
          businessName={business?.name || "Demo Co"}
        />
      </section>

      {/* Primary Ledger Card */}
      <section id="contracts" aria-label="Contracts and Opportunities Ledger">
        <OpportunitiesTable
          opportunities={contractOpportunities}
          businessId={business?.id}
        />
      </section>
    </AppShell>
  );
}
