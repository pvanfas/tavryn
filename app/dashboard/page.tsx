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
import { Caption } from "@/components/ui/text";
import {
  ARC_CONFIG,
  calculateIdleTreasuryUsycYield,
  getCircleGatewayUnifiedBalance,
  getOnChainUSDCBalance,
} from "@/lib/circle";
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
  let treasuryBalance = 0;
  let balanceSource: "chain" | "db_fallback" = "db_fallback";

  try {
    // 1. Fetch all businesses
    const { data: bList, error: bListError } = await supabase
      .from("businesses")
      .select(
        "id, name, is_real, treasury_balance, default_currency, wallet_address",
      )
      .not("name", "ilike", "[Deleted%")
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

    // 3. Fetch Contracts, Latest Transaction, and On-Chain Balance in parallel
    if (business?.id) {
      const contractsPromise = supabase
        .from("contracts")
        .select(
          "*, vendors ( name, category, contact, reputation_score, is_simulated )",
        )
        .eq("business_id", business.id)
        .order("renewal_date", { ascending: true });

      const latestTxPromise = supabase
        .from("transactions")
        .select("id, status, tx_hash, is_simulated")
        .eq("business_id", business.id)
        .not("status", "eq", "failed")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      const balancePromise = business.wallet_address
        ? getOnChainUSDCBalance(business.wallet_address).catch((chainErr) => {
            console.warn(
              "Direct Arc RPC balance check failed, using DB fallback:",
              (chainErr as Error).message,
            );
            return Number(business?.treasury_balance ?? 0);
          })
        : Promise.resolve(Number(business?.treasury_balance ?? 0));

      const [cResult, txResult, liveBal] = await Promise.all([
        contractsPromise,
        latestTxPromise,
        balancePromise,
      ]);

      if (cResult.error) throw cResult.error;
      contracts = (cResult.data as unknown as ContractRecord[]) || [];

      if (txResult.data) {
        latestTx = txResult.data;
      }

      treasuryBalance = liveBal;
      balanceSource = business.wallet_address && liveBal !== Number(business.treasury_balance ?? 0)
        ? "chain"
        : "db_fallback";

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
      }
    }
  } catch (err) {
    console.warn("Database query notice:", (err as Error).message);
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

  // Compute Circle Gateway Multichain Unified Balance and Idle Cash USYC Yield
  const [gatewayUnified, usycYield] = await Promise.all([
    getCircleGatewayUnifiedBalance(business?.wallet_address, treasuryBalance),
    Promise.resolve(
      calculateIdleTreasuryUsycYield({
        treasuryBalance,
        upcomingObligations30d: spendThisMonth,
        contracts: contracts.map((c) => ({
          current_price: Number(c.current_price) || 0,
          renewal_date: c.renewal_date,
        })),
      }),
    ),
  ]);

  return (
    <AppShell
      businessName={business?.name || "Demo Co"}
      isReal={Boolean(business?.is_real)}
      breadcrumbs={[
        { label: "Dashboard", href: "/dashboard" },
        { label: "Overview" },
      ]}
      businesses={businesses}
      activeBusinessId={business?.id}
      treasuryBalance={treasuryBalance}
      currency={currency}
    >
      <div className="space-y-6">
        {/* Header Bar with Collapsed Treasury Chip */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              Autonomous Procurement &amp; Treasury
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Continuous contract auditing, autonomous bargaining, and on-chain Arc USDC settlements.
            </p>
          </div>

          {/* Treasury Balance Collapsed Header Chip */}
          <div className="inline-flex items-center gap-3 px-3.5 py-2 rounded-xl bg-white/90 dark:bg-[#111714]/90 border border-slate-200/80 dark:border-slate-800/80 shadow-2xs self-start sm:self-auto shrink-0">
            <div className="p-1.5 rounded-lg bg-emerald-500/10 text-[#107e65] dark:text-[#34d399]">
              <Wallet className="h-4 w-4" />
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Treasury Balance
                </span>
                {balanceSource === "chain" ? (
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" title="Arc Live RPC" />
                ) : (
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-500" title="Snapshot Balance" />
                )}
              </div>
              <span className="font-mono text-xs font-bold text-slate-900 dark:text-white">
                ${treasuryBalance.toLocaleString(undefined, {
                  minimumFractionDigits: 0,
                  maximumFractionDigits: 2,
                })}{" "}
                {currency}
              </span>
            </div>
            {business?.wallet_address && (
              <a
                href={`${ARC_CONFIG.explorerUrl}/address/${business.wallet_address}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-slate-400 hover:text-[#107e65] dark:hover:text-[#34d399] transition-colors pl-1"
                title="View on ArcScan"
              >
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            )}
          </div>
        </div>

        {/* 1. HERO SAVINGS DISPLAY FIRST */}
        <section
          id="hero-savings"
          aria-label="Discovered and Realized Savings Overview"
          className="rounded-2xl bg-white/95 dark:bg-[#111714]/95 border border-slate-200/80 dark:border-slate-800/80 p-6 sm:p-8 shadow-[0_1px_3px_rgba(0,0,0,0.03),0_8px_24px_rgba(0,0,0,0.03)] dark:shadow-[0_1px_3px_rgba(0,0,0,0.2)]"
        >
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2.5">
                <Caption className="text-slate-500 dark:text-slate-400 uppercase tracking-wider text-xs font-bold">
                  Net Realized Savings
                </Caption>

                {/* Inline Real/Demo Badge */}
                {business?.is_real ? (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    Live Verified (Real Org)
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20">
                    <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                    Demo Co (Simulated)
                  </span>
                )}
              </div>

              {/* Large Display Typography for Hero Savings */}
              <div className="flex flex-wrap items-baseline gap-3">
                <span className="font-mono text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-[#107e65] dark:text-[#34d399]">
                  ${savingsRealized.toLocaleString()}
                </span>
                <span className="text-sm sm:text-base font-semibold text-slate-500 dark:text-slate-400 font-sans">
                  {currency} secured on Arc
                </span>
              </div>

              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 max-w-xl">
                Tavryn autonomously executed {negotiationsCount} renewal concessions, reducing baseline overhead while locking funds into non-custodial smart contracts.
              </p>
            </div>

            {/* Supporting Micro-Metrics */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 border-t lg:border-t-0 lg:border-l border-slate-100 dark:border-slate-800/80 pt-4 lg:pt-0 lg:pl-6 shrink-0">
              <div className="p-3.5 rounded-xl bg-slate-50/70 dark:bg-slate-900/40 border border-slate-200/60 dark:border-slate-800/60">
                <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400 text-[11px] font-semibold">
                  <TrendingDown className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span>Identified Waste</span>
                </div>
                <div className="font-mono text-lg font-bold text-slate-900 dark:text-white mt-1">
                  ${savingsDiscovered.toLocaleString()}
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5">
                  Across {contractOpportunities.filter((o) => o.savings > 0).length} opportunities
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50/70 dark:bg-slate-900/40 border border-slate-200/60 dark:border-slate-800/60">
                <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400 text-[11px] font-semibold">
                  <Layers className="h-3.5 w-3.5 text-slate-600 dark:text-slate-400" />
                  <span>Monthly Spend</span>
                </div>
                <div className="font-mono text-lg font-bold text-slate-900 dark:text-white mt-1">
                  ${spendThisMonth.toLocaleString()}
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5">
                  ${totalAnnualSpend.toLocaleString()} / year
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50/70 dark:bg-slate-900/40 border border-slate-200/60 dark:border-slate-800/60 col-span-2 sm:col-span-1">
                <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400 text-[11px] font-semibold">
                  <CheckCircle2 className="h-3.5 w-3.5 text-[#107e65] dark:text-[#34d399]" />
                  <span>Active Contracts</span>
                </div>
                <div className="font-mono text-lg font-bold text-slate-900 dark:text-white mt-1">
                  {contracts.filter((c) => c.status === "active").length}
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5">
                  {latestTx?.tx_hash ? (
                    <TransactionHashBadge
                      txHash={latestTx.tx_hash}
                      isSimulated={latestTx.is_simulated}
                      status={latestTx.status}
                      compact={true}
                    />
                  ) : (
                    "Audited regularly"
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 2. ACTIVITY TIMELINE SECOND */}
        <section
          id="activity-timeline"
          aria-label="Autonomous Agent Execution Timeline"
          className="space-y-2"
        >
          <ActivityTimeline
            businessId={business?.id}
            businessName={business?.name || "Demo Co"}
          />
        </section>

        {/* 3. OPPORTUNITIES TABLE THIRD */}
        <section
          id="opportunities-ledger"
          aria-label="Contracts and Opportunities Ledger"
          className="space-y-2"
        >
          <OpportunitiesTable
            opportunities={contractOpportunities}
            businessId={business?.id}
          />
        </section>
      </div>
    </AppShell>
  );
}
