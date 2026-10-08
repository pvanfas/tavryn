"use client";

import {
  ArrowRight,
  Building2,
  CheckCircle2,
  Clock,
  ShieldCheck,
  TrendingDown,
  Wallet,
} from "lucide-react";
import Link from "next/link";
import React, { useState } from "react";

import { PageHeader } from "@/components/PageHeader";
import { TractionMetricsResult } from "@/lib/metrics";

import {
  GovernanceAndVelocityGrid,
  OnboardedOrganizationsTable,
  RecentSettlementsTable,
} from "./components";

interface TractionMetricsClientProps {
  business?: {
    id: string;
    name: string;
    is_real: boolean | null;
    treasury_balance?: number | null;
    wallet_address?: string | null;
  } | null;
  initialMetricsAll: TractionMetricsResult;
  initialMetricsReal?: TractionMetricsResult;
}

export function TractionMetricsClient({
  business,
  initialMetricsAll,
  initialMetricsReal,
}: TractionMetricsClientProps) {
  const isReal = Boolean(business?.is_real);
  const [viewMode, setViewMode] = useState<"verified" | "all">("verified");
  const [liveTimestamp] = useState<string>(() =>
    new Date().toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }),
  );

  // When viewMode is verified, use verified real metrics; otherwise all activity
  const rawOrgMetrics =
    viewMode === "verified"
      ? (initialMetricsReal || initialMetricsAll)
      : initialMetricsAll;

  // Filter transactions strictly to verified if viewMode is verified
  const displayedTransactions = (rawOrgMetrics.transactions || []).filter(
    (tx) => {
      if (viewMode === "verified") {
        return (
          !tx.isSimulated &&
          tx.status !== "simulation-only" &&
          !tx.txHash?.startsWith("0xsimulated")
        );
      }
      return true;
    },
  );

  const orgMetrics: TractionMetricsResult = {
    ...rawOrgMetrics,
    transactions: displayedTransactions,
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-12 font-sans">
      {/* Page Header */}
      <PageHeader
        badge={viewMode === "verified" ? "Verified Telemetry Only" : "All Workspace Activity"}
        caption={`Tenant: ${business?.name || "Active Workspace"} · Arc Testnet`}
        title={`${business?.name || "Organization"} · Metrics & Settlements`}
        description={`Audit trail and Arc USDC escrow reconciliation scoped specifically to ${business?.name || "your organization"}. Zero cross-tenant data leakage.`}
        className="border-b border-slate-200/80 dark:border-slate-800/80 pb-6"
      >
        <div className="flex flex-wrap items-center gap-3">
          {/* Mode Switcher: Verified Only (Default) vs All */}
          <div className="inline-flex items-center p-1 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs shadow-2xs">
            <button
              type="button"
              onClick={() => setViewMode("verified")}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                viewMode === "verified"
                  ? "bg-emerald-600 text-white shadow-2xs"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-300 animate-pulse" />
              <span>Verified Only</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode("all")}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer ${
                viewMode === "all"
                  ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              <span>Include Sandbox</span>
            </button>
          </div>

          <Link
            href="/public-metrics"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 transition-colors shadow-2xs cursor-pointer"
          >
            <span>Public Macro Telemetry</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-500/10 dark:bg-emerald-950/40 border border-emerald-500/20 text-xs font-mono text-emerald-800 dark:text-emerald-300 shrink-0">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            <Clock className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
            <span>Reconciled {liveTimestamp}</span>
          </div>
        </div>
      </PageHeader>

      {/* 1. Organization Performance Hero Section */}
      <section className={`rounded-3xl border-2 ${
        viewMode === "verified"
          ? "border-emerald-500/30 dark:border-emerald-500/20 bg-emerald-500/[0.02] dark:bg-emerald-950/[0.12]"
          : "border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111714]"
      } p-5 sm:p-7 shadow-[0_1px_3px_rgba(16,126,101,0.05),0_12px_28px_rgba(16,126,101,0.04)] space-y-5`}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-200/60 dark:border-slate-800/60">
          <div className="flex items-center gap-2.5">
            <div className={`h-8 w-8 rounded-xl ${
              viewMode === "verified"
                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
            } flex items-center justify-center`}>
              <ShieldCheck className="h-4.5 w-4.5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white tracking-tight">
                  {business?.name || "Organization"} Settlement Summary
                </h2>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                  viewMode === "verified"
                    ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30"
                    : "bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30"
                }`}>
                  {viewMode === "verified" ? "Verified Real Only" : "Sandbox Included"}
                </span>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-400">
                On-chain USDC escrows, realized savings, and contract velocity strictly for this organization.
              </p>
            </div>
          </div>

          <div className="text-xs text-slate-500 font-mono">
            Tenant ID: <span className="font-semibold text-slate-700 dark:text-slate-300">{business?.id ? business.id.slice(0, 8) + "..." : "Active"}</span>
          </div>
        </div>

        {/* Hero Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Escrow Volume */}
          <div className="p-4.5 rounded-2xl bg-white dark:bg-[#111714] border border-slate-200/80 dark:border-slate-800/80 shadow-xs relative overflow-hidden">
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 font-semibold mb-2">
              <span>{viewMode === "verified" ? "Verified Escrow Volume" : "Escrow Volume"}</span>
              <Wallet className="h-4 w-4 text-[#107e65] dark:text-[#34d399]" />
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl sm:text-3xl font-extrabold font-mono tracking-tight text-[#107e65] dark:text-[#34d399]">
                $
                {orgMetrics.usdcVolume.escrowed.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </span>
              <span className="text-xs font-bold text-slate-400">USDC</span>
            </div>
            <div className="mt-2.5 pt-2.5 border-t border-slate-100 dark:border-slate-800/60 flex items-center justify-between text-[11px] text-slate-500">
              <span>Released: <strong>${orgMetrics.usdcVolume.released.toLocaleString()}</strong></span>
              <span>Refunded: <strong>${orgMetrics.usdcVolume.refunded.toLocaleString()}</strong></span>
            </div>
          </div>

          {/* Realized Savings */}
          <div className="p-4.5 rounded-2xl bg-white dark:bg-[#111714] border border-slate-200/80 dark:border-slate-800/80 shadow-xs relative overflow-hidden">
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 font-semibold mb-2">
              <span>Realized Savings</span>
              <TrendingDown className="h-4 w-4 text-[#107e65] dark:text-[#34d399]" />
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl sm:text-3xl font-extrabold font-mono tracking-tight text-slate-900 dark:text-white">
                $
                {orgMetrics.savings.realized.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </span>
              <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                ({orgMetrics.savings.savingsRatePct}% rate)
              </span>
            </div>
            <div className="mt-2.5 pt-2.5 border-t border-slate-100 dark:border-slate-800/60 flex items-center justify-between text-[11px] text-slate-500">
              <span>Spend: <strong>${orgMetrics.savings.totalSpendAnalyzed.toLocaleString()}</strong></span>
              <span>Negotiated: <strong>${orgMetrics.savings.negotiated.toLocaleString()}</strong></span>
            </div>
          </div>

          {/* Contracts Tracked */}
          <div className="p-4.5 rounded-2xl bg-white dark:bg-[#111714] border border-slate-200/80 dark:border-slate-800/80 shadow-xs relative overflow-hidden">
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 font-semibold mb-2">
              <span>Contracts Tracked</span>
              <Building2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl sm:text-3xl font-extrabold font-mono tracking-tight text-slate-900 dark:text-white">
                {orgMetrics.contractsAndNegotiations.contractsTotal}
              </span>
              <span className="text-xs font-medium text-slate-400">total contracts</span>
            </div>
            <div className="mt-2.5 pt-2.5 border-t border-slate-100 dark:border-slate-800/60 flex items-center justify-between text-[11px] text-slate-500">
              <span>Optimized: <strong>{orgMetrics.contractsAndNegotiations.contractsOptimized}</strong></span>
              <span>Active: <strong>{orgMetrics.contractsAndNegotiations.negotiationsActive}</strong></span>
            </div>
          </div>

          {/* Settlements Count */}
          <div className="p-4.5 rounded-2xl bg-white dark:bg-[#111714] border border-slate-200/80 dark:border-slate-800/80 shadow-xs relative overflow-hidden">
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 font-semibold mb-2">
              <span>Settlements Recorded</span>
              <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl sm:text-3xl font-extrabold font-mono tracking-tight text-slate-900 dark:text-white">
                {displayedTransactions.length}
              </span>
              <span className="text-xs font-medium text-slate-400">
                {viewMode === "verified" ? "verified on-chain" : "total txs"}
              </span>
            </div>
            <div className="mt-2.5 pt-2.5 border-t border-slate-100 dark:border-slate-800/60 flex items-center justify-between text-[11px] text-slate-500">
              <span>ArcScan Verified: <strong>100%</strong></span>
              <span>Receipts: <strong>{orgMetrics.receiptsCount}</strong></span>
            </div>
          </div>
        </div>
      </section>

      {/* 2. Autonomous Governance & Multi-Agent Velocity Grid */}
      <GovernanceAndVelocityGrid metrics={orgMetrics} />

      {/* 3. Organization Profile (Strictly 1 Tenant) */}
      <OnboardedOrganizationsTable businesses={orgMetrics.businesses} />

      {/* 4. Reconciled Transaction Ledger for THIS Organization */}
      <RecentSettlementsTable transactions={displayedTransactions} />
    </div>
  );
}
