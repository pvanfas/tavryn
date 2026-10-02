"use client";

import React, { useState } from "react";

import { PageHeader } from "@/components/PageHeader";
import { TractionMetricsResult } from "@/lib/metrics";

import {
  GovernanceAndVelocityGrid,
  MetricsHeroGrid,
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

  const metrics =
    viewMode === "real" && initialMetricsReal
      ? initialMetricsReal
      : initialMetricsAll;

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-12">
      {/* Minimal Reusable Page Header with Live Verified vs Demo Toggle */}
      <PageHeader
        badge={
          viewMode === "real"
            ? "Production Businesses Only"
            : "Live Protocol Metrics"
        }
        caption="Arc Testnet (Chain ID 5042002)"
        title="Traction & Settlement Metrics"
        description="Auditable Postgres telemetry reconciled with on-chain settlements."
        className="border-b border-slate-200/80 dark:border-slate-800/80 pb-6"
      >
        <div className="inline-flex items-center p-1 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs shadow-2xs">
          <button
            onClick={() => setViewMode("all")}
            className={`px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer ${
              viewMode === "all"
                ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            All Activity ({initialMetricsAll.businesses.totalCount} orgs)
          </button>
          <button
            onClick={() => setViewMode("real")}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer ${
              viewMode === "real"
                ? "bg-emerald-600 text-white shadow-2xs"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span>
              Live Verified Only (
              {initialMetricsReal?.businesses.realCount ||
                initialMetricsAll.businesses.realCount}{" "}
              orgs)
            </span>
          </button>
        </div>
      </PageHeader>

      {viewMode === "real" && (
        <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-between text-xs text-emerald-800 dark:text-emerald-300">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            <span>
              <strong>Filtered for Verified Production Workspaces</strong> —
              Showing only real onboarded businesses with live Arc Testnet USDC
              contracts. Simulated demo accounts are excluded.
            </span>
          </div>
          <button
            onClick={() => setViewMode("all")}
            className="underline font-semibold hover:text-emerald-950 dark:hover:text-white cursor-pointer ml-4"
          >
            Show All
          </button>
        </div>
      )}

      {/* Hero Stats Grid */}
      <MetricsHeroGrid metrics={metrics} />

      {/* Middle Grid: Autonomous Governance, Multi-Agent Reviewer, & Velocity */}
      <GovernanceAndVelocityGrid metrics={metrics} />

      {/* Onboarded Organizations Table */}
      <OnboardedOrganizationsTable businesses={metrics.businesses} />

      {/* Reconciled Transaction Ledger */}
      <RecentSettlementsTable transactions={metrics.transactions} />
    </div>
  );
}
