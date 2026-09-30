"use client";

import {
  Activity,
  Bot,
  Building2,
  Check,
  Clock,
  Copy,
  ExternalLink,
  Layers,
  Receipt,
  ShieldCheck,
  TrendingDown,
  Wallet,
} from "lucide-react";
import React, { useState } from "react";

import { PageHeader } from "@/components/PageHeader";
import { Display, H2 } from "@/components/ui/text";
import { ARC_CONFIG } from "@/lib/circle";
import { TractionMetricsResult } from "@/lib/metrics";

interface TractionMetricsClientProps {
  initialMetricsAll: TractionMetricsResult;
  initialMetricsReal?: TractionMetricsResult;
}

export function TractionMetricsClient({
  initialMetricsAll,
}: TractionMetricsClientProps) {
  const [copiedTxId, setCopiedTxId] = useState<string | null>(null);

  const metrics = initialMetricsAll;

  const handleCopyTx = async (id: string, hash: string) => {
    try {
      await navigator.clipboard.writeText(hash);
      setCopiedTxId(id);
      setTimeout(() => setCopiedTxId(null), 2000);
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-12">
      {/* Minimal Reusable Page Header */}
      <PageHeader
        badge="Live Protocol Metrics"
        caption="Arc Testnet (Chain ID 5042002)"
        title="Traction & Settlement Metrics"
        description="Auditable Postgres telemetry reconciled with on-chain settlements."
        className="border-b border-slate-200/80 dark:border-slate-800/80 pb-6"
      />

      {/* Hero Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total USDC Moved */}
        <div className="p-5 rounded-2xl bg-white dark:bg-[#111714] border border-slate-200/80 dark:border-slate-800/80 shadow-2xs relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-bl-full pointer-events-none group-hover:scale-110 transition-transform" />
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 font-semibold mb-2">
            <span>Total USDC Escrowed</span>
            <Wallet className="h-4 w-4 text-[#107e65] dark:text-[#34d399]" />
          </div>
          <div className="flex items-baseline gap-1.5">
            <Display className="text-2xl sm:text-3xl text-slate-900 dark:text-white font-extrabold">
              $
              {metrics.usdcVolume.escrowed.toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </Display>
            <span className="text-xs font-bold text-slate-400">USDC</span>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800/60 flex items-center justify-between text-[11px] text-slate-500">
            <span>
              Released:{" "}
              <strong className="text-slate-800 dark:text-slate-200">
                ${metrics.usdcVolume.released.toLocaleString()}
              </strong>
            </span>
            <span>
              Refunded:{" "}
              <strong className="text-slate-800 dark:text-slate-200">
                ${metrics.usdcVolume.refunded.toLocaleString()}
              </strong>
            </span>
          </div>
        </div>

        {/* Realized Savings */}
        <div className="p-5 rounded-2xl bg-white dark:bg-[#111714] border border-slate-200/80 dark:border-slate-800/80 shadow-2xs relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-bl-full pointer-events-none group-hover:scale-110 transition-transform" />
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 font-semibold mb-2">
            <span>Savings Realized</span>
            <TrendingDown className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div className="flex items-baseline gap-1.5">
            <Display className="text-2xl sm:text-3xl text-slate-900 dark:text-white font-extrabold">
              $
              {metrics.savings.realized.toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </Display>
            <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
              ({metrics.savings.savingsRatePct}% rate)
            </span>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800/60 flex items-center justify-between text-[11px] text-slate-500">
            <span>
              Negotiated:{" "}
              <strong className="text-slate-800 dark:text-slate-200">
                ${metrics.savings.negotiated.toLocaleString()}
              </strong>
            </span>
            <span>
              Spend:{" "}
              <strong className="text-slate-800 dark:text-slate-200">
                ${metrics.savings.totalSpendAnalyzed.toLocaleString()}
              </strong>
            </span>
          </div>
        </div>

        {/* Businesses Onboarded */}
        <div className="p-5 rounded-2xl bg-white dark:bg-[#111714] border border-slate-200/80 dark:border-slate-800/80 shadow-2xs relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-bl-full pointer-events-none group-hover:scale-110 transition-transform" />
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 font-semibold mb-2">
            <span>Organizations Onboarded</span>
            <Building2 className="h-4 w-4 text-blue-500" />
          </div>
          <div className="flex items-baseline gap-1.5">
            <Display className="text-2xl sm:text-3xl text-slate-900 dark:text-white font-extrabold">
              {metrics.businesses.totalCount}
            </Display>
            <span className="text-xs font-medium text-slate-400">tenants</span>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800/60 flex items-center justify-between text-[11px] text-slate-500">
            <span>
              Verified Real:{" "}
              <strong className="text-slate-800 dark:text-slate-200">
                {metrics.businesses.realCount}
              </strong>
            </span>
            <span>
              Demo:{" "}
              <strong className="text-slate-800 dark:text-slate-200">
                {metrics.businesses.demoCount}
              </strong>
            </span>
          </div>
        </div>

        {/* Contracts Optimized */}
        <div className="p-5 rounded-2xl bg-white dark:bg-[#111714] border border-slate-200/80 dark:border-slate-800/80 shadow-2xs relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-bl-full pointer-events-none group-hover:scale-110 transition-transform" />
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 font-semibold mb-2">
            <span>Contracts Optimized</span>
            <Layers className="h-4 w-4 text-purple-500" />
          </div>
          <div className="flex items-baseline gap-1.5">
            <Display className="text-2xl sm:text-3xl text-slate-900 dark:text-white font-extrabold">
              {metrics.contractsAndNegotiations.contractsOptimized}
            </Display>
            <span className="text-xs font-medium text-slate-400">
              / {metrics.contractsAndNegotiations.contractsTotal} contracts
            </span>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800/60 flex items-center justify-between text-[11px] text-slate-500">
            <span>
              Sessions:{" "}
              <strong className="text-slate-800 dark:text-slate-200">
                {metrics.contractsAndNegotiations.negotiationsRun}
              </strong>
            </span>
            <span>
              Closed:{" "}
              <strong className="text-slate-800 dark:text-slate-200">
                {metrics.contractsAndNegotiations.negotiationsAccepted}
              </strong>
            </span>
          </div>
        </div>
      </div>

      {/* Middle Grid: Autonomous Governance, Multi-Agent Reviewer, & Velocity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Governance & Decisions Card */}
        <div className="p-6 rounded-2xl bg-white dark:bg-[#111714] border border-slate-200/80 dark:border-slate-800/80 shadow-2xs">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-emerald-500/10 text-[#107e65] dark:text-[#34d399]">
                <ShieldCheck className="h-4 w-4" />
              </div>
              <H2 className="text-base text-slate-900 dark:text-white">
                Autonomous Governance & Approvals
              </H2>
            </div>
            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
              Zero-Trust Policy
            </span>
          </div>

          <div className="grid grid-cols-2 gap-4 my-4">
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-[#0c120f] border border-slate-100 dark:border-slate-800/60">
              <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                Autonomous Decisions
              </p>
              <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
                {metrics.governance.agentDecisionsCount}
              </p>
              <p className="text-[10px] text-slate-400 mt-1">
                Logged into immutable SHA-256 chain
              </p>
            </div>
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-[#0c120f] border border-slate-100 dark:border-slate-800/60">
              <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                Human Escalations
              </p>
              <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
                {metrics.governance.humanEscalationsCount}
              </p>
              <p className="text-[10px] text-slate-400 mt-1">
                Above ceiling or category threshold
              </p>
            </div>
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-[#0c120f] border border-slate-100 dark:border-slate-800/60 col-span-2 flex items-center justify-between">
              <div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                  Public Savings Receipts Generated
                </p>
                <p className="text-2xl font-bold text-slate-900 dark:text-white mt-0.5">
                  {metrics.receiptsCount}
                </p>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  Allow-listed public cryptographic proofs on /r/[token]
                </p>
              </div>
              <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                <Receipt className="h-5 w-5" />
              </div>
            </div>
          </div>

          {/* Ratio bar */}
          <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800/60">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-600 dark:text-slate-300 font-medium">
                Human Approval Conversion Rate
              </span>
              <span className="font-bold text-[#107e65] dark:text-[#34d399]">
                {metrics.governance.humanApprovalRatePct}%
              </span>
            </div>
            <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden flex">
              <div
                className="bg-[#107e65] h-full transition-all"
                style={{ width: `${metrics.governance.humanApprovalRatePct}%` }}
              />
              <div
                className="bg-rose-500 h-full transition-all"
                style={{
                  width: `${100 - metrics.governance.humanApprovalRatePct}%`,
                }}
              />
            </div>
            <div className="flex items-center justify-between text-[11px] text-slate-400">
              <span>Approved: {metrics.governance.humanApprovedCount}</span>
              <span>Rejected: {metrics.governance.humanRejectedCount}</span>
              <span>Pending: {metrics.governance.humanPendingCount}</span>
            </div>
          </div>
        </div>

        {/* Multi-Agent Reviewer Telemetry Card */}
        <div className="p-6 rounded-2xl bg-white dark:bg-[#111714] border border-slate-200/80 dark:border-slate-800/80 shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400">
                  <Bot className="h-4 w-4" />
                </div>
                <H2 className="text-base text-slate-900 dark:text-white">
                  Multi-Agent Audit Telemetry
                </H2>
              </div>
              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-700 dark:text-purple-300 border border-purple-500/20">
                Dual-LLM Cross-Check
              </span>
            </div>

            <div className="grid grid-cols-2 gap-4 my-4">
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-[#0c120f] border border-slate-100 dark:border-slate-800/60">
                <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                  Total Deal Audits
                </p>
                <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
                  {metrics.reviewer.totalReviews}
                </p>
                <p className="text-[10px] text-slate-400 mt-1">
                  Independent cross-checks
                </p>
              </div>
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-[#0c120f] border border-slate-100 dark:border-slate-800/60">
                <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                  Challenge / Veto Rate
                </p>
                <p className="text-2xl font-bold text-purple-600 dark:text-purple-400 mt-1">
                  {metrics.reviewer.challengeRatePct}%
                </p>
                <p className="text-[10px] text-slate-400 mt-1">
                  Deals altered or challenged
                </p>
              </div>
            </div>
          </div>

          {/* Breakdown & Ratio bar */}
          <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800/60">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-600 dark:text-slate-300 font-medium">
                Auditor Agreement Distribution
              </span>
              <span className="font-bold text-slate-900 dark:text-white">
                {metrics.reviewer.totalReviews > 0
                  ? Math.round(
                      (metrics.reviewer.agreedCount /
                        metrics.reviewer.totalReviews) *
                        100,
                    )
                  : 100}
                % Agreed
              </span>
            </div>
            <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden flex">
              <div
                className="bg-[#107e65] h-full transition-all"
                style={{
                  width: `${
                    metrics.reviewer.totalReviews > 0
                      ? (metrics.reviewer.agreedCount /
                          metrics.reviewer.totalReviews) *
                        100
                      : 100
                  }%`,
                }}
              />
              <div
                className="bg-amber-500 h-full transition-all"
                style={{
                  width: `${
                    metrics.reviewer.totalReviews > 0
                      ? (metrics.reviewer.challengedCount /
                          metrics.reviewer.totalReviews) *
                        100
                      : 0
                  }%`,
                }}
              />
              <div
                className="bg-rose-500 h-full transition-all"
                style={{
                  width: `${
                    metrics.reviewer.totalReviews > 0
                      ? (metrics.reviewer.rejectedCount /
                          metrics.reviewer.totalReviews) *
                        100
                      : 0
                  }%`,
                }}
              />
            </div>
            <div className="flex items-center justify-between text-[11px] text-slate-400">
              <span className="text-emerald-600 dark:text-emerald-400">
                Agreed: {metrics.reviewer.agreedCount}
              </span>
              <span className="text-amber-600 dark:text-amber-400">
                Challenged: {metrics.reviewer.challengedCount}
              </span>
              <span className="text-rose-600 dark:text-rose-400">
                Rejected: {metrics.reviewer.rejectedCount}
              </span>
            </div>
          </div>
        </div>

        {/* Velocity & Efficiency Card */}
        <div className="p-6 rounded-2xl bg-white dark:bg-[#111714] border border-slate-200/80 dark:border-slate-800/80 shadow-2xs">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-blue-500/10 text-blue-500">
                <Clock className="h-4 w-4" />
              </div>
              <H2 className="text-base text-slate-900 dark:text-white">
                Velocity & Negotiation Efficiency
              </H2>
            </div>
            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
              Performance
            </span>
          </div>

          <div className="grid grid-cols-2 gap-4 my-4">
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-[#0c120f] border border-slate-100 dark:border-slate-800/60">
              <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                Avg Rounds to Close
              </p>
              <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
                {metrics.efficiency.avgRoundsToClose}
              </p>
              <p className="text-[10px] text-slate-400 mt-1">
                Capped at 5 rounds by policy
              </p>
            </div>
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-[#0c120f] border border-slate-100 dark:border-slate-800/60">
              <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                Detection to Settlement
              </p>
              <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
                ~{metrics.efficiency.avgCycleTimeMinutes}m
              </p>
              <p className="text-[10px] text-slate-400 mt-1">
                Autonomous observe-to-escrow loop
              </p>
            </div>
          </div>

          <div className="pt-2 border-t border-slate-100 dark:border-slate-800/60 space-y-1.5">
            <div className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-300">
              <span>Negotiations Concluded Successfully:</span>
              <strong className="text-slate-900 dark:text-white">
                {metrics.contractsAndNegotiations.negotiationsAccepted} /{" "}
                {metrics.contractsAndNegotiations.negotiationsRun}
              </strong>
            </div>
            <div className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-300">
              <span>Disputed or Tampered Confirmations:</span>
              <strong className="text-slate-900 dark:text-white">
                {metrics.usdcVolume.failedOrDisputed > 0 ? "1 (Blocked)" : "0"}
              </strong>
            </div>
            <div className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-300">
              <span>Walked-Away (Strict Ceilings Preserved):</span>
              <strong className="text-slate-900 dark:text-white">
                {metrics.contractsAndNegotiations.negotiationsWalkedAway}
              </strong>
            </div>
          </div>
        </div>
      </div>

      {/* Onboarded Organizations Table */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-[#107e65] dark:text-[#34d399]" />
            <H2 className="text-base text-slate-900 dark:text-white">
              Onboarded Organizations
            </H2>
          </div>
          <span className="text-xs text-slate-500">
            {metrics.businesses.list.length} organizations registered
          </span>
        </div>

        <div className="bg-white dark:bg-[#111714] rounded-2xl border border-slate-200/80 dark:border-slate-800/80 shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-[#0c120f] border-b border-slate-200/80 dark:border-slate-800 text-slate-500 uppercase tracking-wider text-[10px] font-bold">
                <tr>
                  <th className="px-5 py-3">Business Name</th>
                  <th className="px-5 py-3">Classification</th>
                  <th className="px-5 py-3">Treasury (USDC)</th>
                  <th className="px-5 py-3">Contracts</th>
                  <th className="px-5 py-3">Annual Spend</th>
                  <th className="px-5 py-3">Savings Generated</th>
                  <th className="px-5 py-3">Arc Treasury Wallet</th>
                  <th className="px-5 py-3 text-right">Onboarded Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
                {metrics.businesses.list.map((b) => (
                  <tr
                    key={b.id}
                    className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30 transition-colors"
                  >
                    <td className="px-5 py-3.5">
                      <div className="font-bold text-slate-900 dark:text-white">
                        {b.name}
                      </div>
                      <div className="text-[10px] font-mono text-slate-400">
                        {b.id}
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      {b.isReal ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-[#107e65] dark:text-[#34d399] border border-emerald-500/20">
                          Verified Real
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20">
                          Demo Co
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 font-mono font-bold text-slate-900 dark:text-white">
                      $
                      {b.treasuryBalance.toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </td>
                    <td className="px-5 py-3.5 text-slate-600 dark:text-slate-300">
                      {b.contractsCount} contracts
                    </td>
                    <td className="px-5 py-3.5 text-slate-600 dark:text-slate-300 font-mono">
                      ${b.totalSpend.toLocaleString()}
                    </td>
                    <td className="px-5 py-3.5 text-emerald-600 dark:text-emerald-400 font-mono font-bold">
                      +${b.totalSavings.toLocaleString()}
                    </td>
                    <td className="px-5 py-3.5">
                      {b.walletAddress ? (
                        <a
                          href={`${ARC_CONFIG.explorerUrl}/address/${b.walletAddress}`}
                          target="_blank"
                          rel="noreferrer"
                          className="font-mono text-[11px] text-[#107e65] dark:text-[#34d399] hover:underline flex items-center gap-1"
                        >
                          <span>
                            {b.walletAddress.slice(0, 6)}...
                            {b.walletAddress.slice(-4)}
                          </span>
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      ) : (
                        <span className="text-slate-400 text-[11px]">
                          Unprovisioned
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-right text-slate-500 text-[11px]">
                      {new Date(b.createdAt).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Reconciled Transaction Ledger */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-[#107e65] dark:text-[#34d399]" />
            <H2 className="text-base text-slate-900 dark:text-white">
              Reconciled On-Chain Transactions Ledger
            </H2>
          </div>
          <span className="text-xs text-slate-500">
            {metrics.transactions.length} settlement transactions
          </span>
        </div>

        <div className="bg-white dark:bg-[#111714] rounded-2xl border border-slate-200/80 dark:border-slate-800/80 shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-[#0c120f] border-b border-slate-200/80 dark:border-slate-800 text-slate-500 uppercase tracking-wider text-[10px] font-bold">
                <tr>
                  <th className="px-5 py-3">Transaction</th>
                  <th className="px-5 py-3">Organization</th>
                  <th className="px-5 py-3">Recipient Vendor</th>
                  <th className="px-5 py-3">Settlement Amount</th>
                  <th className="px-5 py-3">Escrow Status</th>
                  <th className="px-5 py-3">ArcScan Verification</th>
                  <th className="px-5 py-3 text-right">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
                {metrics.transactions.map((t) => (
                  <tr
                    key={t.id}
                    className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30 transition-colors"
                  >
                    <td className="px-5 py-3.5 font-mono text-[11px] text-slate-500">
                      {t.id.slice(0, 8)}...
                    </td>
                    <td className="px-5 py-3.5 font-bold text-slate-900 dark:text-white">
                      {t.businessName}
                    </td>
                    <td className="px-5 py-3.5 text-slate-700 dark:text-slate-300">
                      {t.vendorName}
                    </td>
                    <td className="px-5 py-3.5 font-mono font-bold text-slate-900 dark:text-white">
                      $
                      {t.amount.toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}{" "}
                      {t.currency}
                    </td>
                    <td className="px-5 py-3.5">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                          t.status === "released"
                            ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                            : t.status === "funded"
                              ? "bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20"
                              : t.status === "refunded"
                                ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20"
                                : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300"
                        }`}
                      >
                        {t.status}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      {t.txHash ? (
                        <div className="flex items-center gap-1.5">
                          <a
                            href={`${ARC_CONFIG.explorerUrl}/tx/${t.txHash}`}
                            target="_blank"
                            rel="noreferrer"
                            className="font-mono text-[11px] text-[#107e65] dark:text-[#34d399] hover:underline flex items-center gap-1"
                          >
                            <span>{t.txHash.slice(0, 10)}...</span>
                            <ExternalLink className="h-3 w-3" />
                          </a>
                          <button
                            type="button"
                            onClick={() => handleCopyTx(t.id, t.txHash!)}
                            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                            title="Copy Tx Hash"
                          >
                            {copiedTxId === t.id ? (
                              <Check className="h-3 w-3 text-emerald-500" />
                            ) : (
                              <Copy className="h-3 w-3" />
                            )}
                          </button>
                        </div>
                      ) : (
                        <span className="text-slate-400 font-mono text-[11px]">
                          Pending on-chain
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-right text-slate-500 text-[11px]">
                      {new Date(t.createdAt).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
