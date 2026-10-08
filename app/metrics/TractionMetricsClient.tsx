"use client";

import {
  Building2,
  CheckCircle2,
  Clock,
  Layers,
  ShieldCheck,
  TrendingDown,
  Wallet,
} from "lucide-react";
import React, { useState } from "react";

import { PageHeader } from "@/components/PageHeader";
import { TractionMetricsResult } from "@/lib/metrics";

import {
  GovernanceAndVelocityGrid,
  OnboardedOrganizationsTable,
  RecentSettlementsTable,
} from "./components";

interface TractionMetricsClientProps {
  initialMetricsAll: TractionMetricsResult;
  initialMetricsReal?: TractionMetricsResult;
}

export function TractionMetricsClient({
  initialMetricsAll,
  initialMetricsReal,
}: TractionMetricsClientProps) {
  const [viewMode, setViewMode] = useState<"all" | "real">("all");
  const [liveTimestamp] = useState<string>(() =>
    new Date().toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }),
  );

  const realMetrics = initialMetricsReal || initialMetricsAll;
  const allMetrics = initialMetricsAll;

  // Selected dataset for tables
  const tableMetrics =
    viewMode === "real" ? realMetrics : allMetrics;

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-12 font-sans">
      {/* Page Header */}
      <PageHeader
        badge="Arc Testnet Telemetry"
        caption="Chain ID 5042002 · Real-Time Reconciliation"
        title="Traction & Settlement Metrics"
        description="Auditable Postgres telemetry reconciled with on-chain Circle USDC escrow settlements on Arc."
        className="border-b border-slate-200/80 dark:border-slate-800/80 pb-6"
      >
        <div className="inline-flex items-center p-1 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs shadow-2xs">
          <button
            type="button"
            onClick={() => setViewMode("all")}
            className={`px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer ${
              viewMode === "all"
                ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            All Activity ({allMetrics.businesses.totalCount} orgs)
          </button>
          <button
            type="button"
            onClick={() => setViewMode("real")}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer ${
              viewMode === "real"
                ? "bg-emerald-600 text-white shadow-2xs"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span>Live Verified ({realMetrics.businesses.realCount} orgs)</span>
          </button>
        </div>
      </PageHeader>

      {/* 1. VISUALLY SEPARATED: Live Verified Real Metrics (Success Color Accent, Live Timestamp) */}
      <section className="rounded-3xl border-2 border-emerald-500/30 dark:border-emerald-500/20 bg-emerald-500/[0.02] dark:bg-emerald-950/[0.12] p-5 sm:p-7 shadow-[0_1px_3px_rgba(16,126,101,0.05),0_12px_28px_rgba(16,126,101,0.04)] space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-emerald-500/20">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <ShieldCheck className="h-4.5 w-4.5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white tracking-tight">
                  Live Verified Real Metrics
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                  realOnly: true
                </span>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-400">
                Production organizations and verified on-chain transactions only. All simulated demo data excluded.
              </p>
            </div>
          </div>

          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-500/10 dark:bg-emerald-950/40 border border-emerald-500/20 text-xs font-mono text-emerald-800 dark:text-emerald-300 shrink-0">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            <Clock className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
            <span>Reconciled {liveTimestamp}</span>
          </div>
        </div>

        {/* Real Metrics Hero Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Real Volume Escrowed */}
          <div className="p-4.5 rounded-2xl bg-white dark:bg-[#111714] border border-emerald-500/20 shadow-xs relative overflow-hidden">
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 font-semibold mb-2">
              <span>Real Escrow Volume</span>
              <Wallet className="h-4 w-4 text-[#107e65] dark:text-[#34d399]" />
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl sm:text-3xl font-extrabold font-mono tracking-tight text-[#107e65] dark:text-[#34d399]">
                $
                {realMetrics.usdcVolume.escrowed.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </span>
              <span className="text-xs font-bold text-slate-400">USDC</span>
            </div>
            <div className="mt-2.5 pt-2.5 border-t border-slate-100 dark:border-slate-800/60 flex items-center justify-between text-[11px] text-slate-500">
              <span>Released: <strong>${realMetrics.usdcVolume.released.toLocaleString()}</strong></span>
              <span>Refunded: <strong>${realMetrics.usdcVolume.refunded.toLocaleString()}</strong></span>
            </div>
          </div>

          {/* Real Realized Savings */}
          <div className="p-4.5 rounded-2xl bg-white dark:bg-[#111714] border border-emerald-500/20 shadow-xs relative overflow-hidden">
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 font-semibold mb-2">
              <span>Real Realized Savings</span>
              <TrendingDown className="h-4 w-4 text-[#107e65] dark:text-[#34d399]" />
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl sm:text-3xl font-extrabold font-mono tracking-tight text-slate-900 dark:text-white">
                $
                {realMetrics.savings.realized.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </span>
              <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                ({realMetrics.savings.savingsRatePct}% rate)
              </span>
            </div>
            <div className="mt-2.5 pt-2.5 border-t border-slate-100 dark:border-slate-800/60 flex items-center justify-between text-[11px] text-slate-500">
              <span>Spend: <strong>${realMetrics.savings.totalSpendAnalyzed.toLocaleString()}</strong></span>
              <span>Negotiated: <strong>${realMetrics.savings.negotiated.toLocaleString()}</strong></span>
            </div>
          </div>

          {/* Real Organizations */}
          <div className="p-4.5 rounded-2xl bg-white dark:bg-[#111714] border border-emerald-500/20 shadow-xs relative overflow-hidden">
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 font-semibold mb-2">
              <span>Production Workspaces</span>
              <Building2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl sm:text-3xl font-extrabold font-mono tracking-tight text-slate-900 dark:text-white">
                {realMetrics.businesses.realCount}
              </span>
              <span className="text-xs font-medium text-slate-400">verified orgs</span>
            </div>
            <div className="mt-2.5 pt-2.5 border-t border-slate-100 dark:border-slate-800/60 flex items-center justify-between text-[11px] text-slate-500">
              <span>Optimized: <strong>{realMetrics.contractsAndNegotiations.contractsOptimized}</strong></span>
              <span>Total Tracked: <strong>{realMetrics.contractsAndNegotiations.contractsTotal}</strong></span>
            </div>
          </div>

          {/* Real Settlements Count */}
          <div className="p-4.5 rounded-2xl bg-white dark:bg-[#111714] border border-emerald-500/20 shadow-xs relative overflow-hidden">
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 font-semibold mb-2">
              <span>Settlements Recorded</span>
              <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl sm:text-3xl font-extrabold font-mono tracking-tight text-slate-900 dark:text-white">
                {realMetrics.transactions.length}
              </span>
              <span className="text-xs font-medium text-slate-400">on-chain txs</span>
            </div>
            <div className="mt-2.5 pt-2.5 border-t border-slate-100 dark:border-slate-800/60 flex items-center justify-between text-[11px] text-slate-500">
              <span>ArcScan Verified: <strong>100%</strong></span>
              <span>Reviews: <strong>{realMetrics.reviewer.totalReviews}</strong></span>
            </div>
          </div>
        </div>
      </section>

      {/* 2. VISUALLY SEPARATED: Platform Totals (Including Demo & Simulations) */}
      <section className="rounded-3xl border border-slate-200/80 dark:border-slate-800/80 bg-slate-50/70 dark:bg-[#0c120f]/60 p-5 sm:p-7 shadow-2xs space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-200/60 dark:border-slate-800/60">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-xl bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 flex items-center justify-center">
              <Layers className="h-4.5 w-4.5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white tracking-tight">
                  Platform Totals (Including Simulated / Demo)
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-300 dark:border-slate-700">
                  All Activity
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Aggregated system volume including demo walk-throughs, agent simulation benchmarks, and test harness execution.
              </p>
            </div>
          </div>

          <span className="text-xs text-slate-400 dark:text-slate-500 font-mono">
            {allMetrics.businesses.totalCount} total tenants ({allMetrics.businesses.realCount} real + {allMetrics.businesses.totalCount - allMetrics.businesses.realCount} demo)
          </span>
        </div>

        {/* Muted Platform Totals Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-4 rounded-2xl bg-white/80 dark:bg-[#121915]/80 border border-slate-200/70 dark:border-slate-800/70">
            <div className="text-[11px] font-semibold text-slate-500 mb-1">Total Platform USDC</div>
            <div className="text-xl sm:text-2xl font-bold font-mono text-slate-700 dark:text-slate-300">
              ${allMetrics.usdcVolume.escrowed.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div className="text-[10px] text-slate-400 mt-1">
              Released: ${allMetrics.usdcVolume.released.toLocaleString()}
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-white/80 dark:bg-[#121915]/80 border border-slate-200/70 dark:border-slate-800/70">
            <div className="text-[11px] font-semibold text-slate-500 mb-1">Platform Realized Savings</div>
            <div className="text-xl sm:text-2xl font-bold font-mono text-slate-700 dark:text-slate-300">
              ${allMetrics.savings.realized.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div className="text-[10px] text-slate-400 mt-1">
              Savings rate: {allMetrics.savings.savingsRatePct}%
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-white/80 dark:bg-[#121915]/80 border border-slate-200/70 dark:border-slate-800/70">
            <div className="text-[11px] font-semibold text-slate-500 mb-1">Platform Contracts Analyzed</div>
            <div className="text-xl sm:text-2xl font-bold font-mono text-slate-700 dark:text-slate-300">
              {allMetrics.contractsAndNegotiations.contractsTotal}
            </div>
            <div className="text-[10px] text-slate-400 mt-1">
              Spend analyzed: ${allMetrics.savings.totalSpendAnalyzed.toLocaleString()}
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-white/80 dark:bg-[#121915]/80 border border-slate-200/70 dark:border-slate-800/70">
            <div className="text-[11px] font-semibold text-slate-500 mb-1">Decisions & Audits</div>
            <div className="text-xl sm:text-2xl font-bold font-mono text-slate-700 dark:text-slate-300">
              {allMetrics.governance.agentDecisionsCount}
            </div>
            <div className="text-[10px] text-slate-400 mt-1">
              Dual-Agent reviews: {allMetrics.reviewer.totalReviews}
            </div>
          </div>
        </div>
      </section>

      {/* Middle Grid: Autonomous Governance, Multi-Agent Reviewer, & Velocity */}
      <GovernanceAndVelocityGrid metrics={tableMetrics} />

      {/* Onboarded Organizations Table */}
      <OnboardedOrganizationsTable businesses={tableMetrics.businesses} />

      {/* Reconciled Transaction Ledger (Shared DataTable) */}
      <RecentSettlementsTable transactions={tableMetrics.transactions} />
    </div>
  );
}
