import { ArrowRight, Bot, ShieldCheck } from "lucide-react";
import Link from "next/link";
import React from "react";

import { ApprovalsHeader } from "@/components/ApprovalsHeader";
import { AppShell } from "@/components/AppShell";
import { CircleFaucetButton } from "@/components/CircleFaucetButton";
import { Body, BodySmall, Caption, H2, Mono } from "@/components/ui/text";
import { getActiveBusiness } from "@/lib/active-business";
import { getOnChainUSDCBalance } from "@/lib/circle";
import { getServiceSupabase } from "@/lib/supabase";

export const revalidate = 0;

interface ApprovalItem {
  id: string;
  business_id: string;
  negotiation_id: string | null;
  status: "pending" | "approved" | "rejected";
  reason: string | null;
  decided_at: string | null;
  created_at: string;
  negotiations?: {
    id: string;
    contract_id: string;
    final_price: number | null;
    current_offer: number | null;
    savings: number | null;
    contracts?: {
      id: string;
      service: string;
      category: string;
      vendors?: {
        name: string;
      } | null;
    } | null;
  } | null;
}

interface ApprovalsPageProps {
  searchParams: Promise<{ businessId?: string; filter?: string }>;
}

export default async function ApprovalsPage({
  searchParams,
}: ApprovalsPageProps) {
  const supabase = getServiceSupabase();
  const { businessId, filter: selectedFilter } = await searchParams;

  // 1. Resolve Active Business (Session-aware single organization resolution)
  const business = await getActiveBusiness(businessId);
  const businesses = business ? [business] : [];

  // Real-time on-chain balance & data queries in parallel
  let liveTreasuryBalance = business?.treasury_balance
    ? Number(business.treasury_balance)
    : 0;
  let approvals: ApprovalItem[] = [];
  let policyCeiling = 2000;

  if (business) {
    const approvalsQuery = supabase
      .from("approvals")
      .select("*, negotiations(*, contracts(*, vendors(*)))")
      .eq("business_id", business.id)
      .order("created_at", { ascending: false });

    const policyQuery = supabase
      .from("policies")
      .select("max_auto_transaction")
      .eq("business_id", business.id)
      .maybeSingle();

    const balancePromise = business.wallet_address
      ? getOnChainUSDCBalance(business.wallet_address).catch(() => liveTreasuryBalance)
      : Promise.resolve(liveTreasuryBalance);

    const [aRes, polRes, balRes] = await Promise.all([
      approvalsQuery,
      policyQuery,
      balancePromise,
    ]);

    if (aRes.data) {
      approvals = aRes.data as unknown as ApprovalItem[];
    }
    if (polRes.data?.max_auto_transaction) {
      policyCeiling = Number(polRes.data.max_auto_transaction);
    }
    liveTreasuryBalance = balRes;
  }

  const currentFilter = selectedFilter || "pending";
  const pendingApprovals = approvals.filter((a) => a.status === "pending");
  const pendingCount = pendingApprovals.length;
  const pendingVolume = pendingApprovals.reduce((acc, curr) => {
    const amount = Number(
      curr.negotiations?.final_price || curr.negotiations?.current_offer || 0,
    );
    return acc + amount;
  }, 0);

  const filteredApprovals = approvals.filter((appr) => {
    if (currentFilter === "all") return true;
    return appr.status === currentFilter;
  });

  return (
    <AppShell
      businessName={business?.name || "Demo Co"}
      isReal={business?.is_real ?? false}
      businesses={businesses}
      activeBusinessId={business?.id}
      treasuryBalance={liveTreasuryBalance}
      currency={business?.default_currency || "USDC"}
      breadcrumbs={[{ label: "Overview", href: "/" }, { label: "Approvals" }]}
    >
      <div className="space-y-6">
        {/* Redesigned Approvals Header Component */}
        <ApprovalsHeader
          pendingCount={pendingCount}
          totalCount={approvals.length}
          pendingVolume={pendingVolume}
          policyCeiling={policyCeiling}
          businessId={business?.id}
        />

        {/* Treasury Status & 1-Click Circle Faucet Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-xl border border-slate-200/80 dark:border-slate-800/80 bg-white/60 dark:bg-[#121915]/60 backdrop-blur-xs shadow-2xs">
          <div className="flex items-center gap-3">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Live Treasury USDC:
            </span>
            <span className="font-mono text-sm font-bold text-slate-900 dark:text-white">
              ${liveTreasuryBalance.toLocaleString()} USDC
            </span>
            {liveTreasuryBalance < 100 && (
              <span className="text-[11px] text-amber-700 dark:text-amber-300 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full font-medium">
                Low Balance
              </span>
            )}
          </div>
          <CircleFaucetButton
            businessId={business?.id}
            walletAddress={business?.wallet_address}
            currentBalance={liveTreasuryBalance}
          />
        </div>

        {/* Filter Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 border-b border-slate-200 dark:border-slate-800">
          {[
            {
              id: "pending",
              label: "Pending Review",
              count: pendingCount,
              alert: pendingCount > 0,
            },
            {
              id: "approved",
              label: "Approved",
              count: approvals.filter((a) => a.status === "approved").length,
            },
            {
              id: "rejected",
              label: "Rejected",
              count: approvals.filter((a) => a.status === "rejected").length,
            },
            { id: "all", label: "All Records", count: approvals.length },
          ].map((tab) => {
            const isActive = currentFilter === tab.id;
            const targetUrl =
              tab.id === "pending" ? "/approvals" : `/approvals?filter=${tab.id}`;

            return (
              <Link
                key={tab.id}
                href={targetUrl}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  isActive
                    ? "bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-2xs"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/60"
                }`}
              >
                <span>{tab.label}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                    isActive
                      ? "bg-white/20 dark:bg-slate-900/20 text-white dark:text-slate-900"
                      : tab.alert
                        ? "bg-amber-500/20 text-amber-700 dark:text-amber-300 font-bold"
                        : "bg-slate-200/70 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
                  }`}
                >
                  {tab.count}
                </span>
              </Link>
            );
          })}
        </div>

        {/* List or Empty State */}
        {filteredApprovals.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-800 bg-white/50 dark:bg-[#121915]/50 p-12 text-center space-y-4">
            <div className="h-12 w-12 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 mx-auto flex items-center justify-center text-emerald-600 dark:text-emerald-400">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <div className="space-y-1">
              <H2 className="text-base font-bold text-slate-900 dark:text-white">
                {currentFilter === "pending"
                  ? "No pending approvals"
                  : "No records found"}
              </H2>
              <Body className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
                {currentFilter === "pending"
                  ? "All autonomous renewals are strictly within your deterministic policy parameters. Zero manual intervention required."
                  : `There are currently no approvals matching the "${currentFilter}" filter.`}
              </Body>
            </div>
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-semibold shadow-xs transition-colors"
            >
              <Bot className="h-3.5 w-3.5" />
              <span>Return to Overview</span>
            </Link>
          </div>
        ) : (
          <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800/80 bg-white/90 dark:bg-[#121915]/90 overflow-hidden shadow-xs">
            <div className="divide-y divide-slate-100 dark:divide-slate-800/60 text-xs">
              {filteredApprovals.map((appr) => {
                const contract = appr.negotiations?.contracts;
                const contractId =
                  contract?.id || appr.negotiations?.contract_id;
                const amount = Number(
                  appr.negotiations?.final_price ||
                    appr.negotiations?.current_offer ||
                    0,
                );

                return (
                  <div
                    key={appr.id}
                    className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-colors"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900 dark:text-white text-sm">
                          {contract?.service || "Vendor Commitment"}
                        </span>
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                            appr.status === "approved"
                              ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20"
                              : appr.status === "rejected"
                                ? "bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-500/20"
                                : "bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20"
                          }`}
                        >
                          {appr.status}
                        </span>
                      </div>
                      <BodySmall className="text-slate-500 dark:text-slate-400">
                        {appr.reason ||
                          "Autonomous ceiling limit exceeded. Requires human sign-off."}
                      </BodySmall>
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-3 w-full sm:w-auto">
                      {amount > 0 && (
                        <div className="text-right">
                          <Caption className="text-slate-400 uppercase">
                            Commitment
                          </Caption>
                          <Mono className="text-slate-900 dark:text-white font-bold text-sm">
                            ${amount.toLocaleString()} USDC
                          </Mono>
                        </div>
                      )}

                      {contractId && (
                        <Link
                          href={`/decision/${contractId}`}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs transition-colors shadow-2xs"
                        >
                          <span>Review Decision</span>
                          <ArrowRight className="h-3.5 w-3.5" />
                        </Link>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
