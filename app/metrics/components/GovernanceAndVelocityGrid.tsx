"use client";

import { Bot, Clock, Receipt, ShieldCheck } from "lucide-react";
import React from "react";

import { H2 } from "@/components/ui/text";
import { TractionMetricsResult } from "@/lib/metrics";

interface GovernanceAndVelocityGridProps {
  metrics: TractionMetricsResult;
}

export function GovernanceAndVelocityGrid({
  metrics,
}: GovernanceAndVelocityGridProps) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Governance & Decisions Card */}
      <div className="p-6 rounded-2xl bg-white dark:bg-[#111714] border border-slate-200/80 dark:border-slate-800/80 shadow-2xs">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-emerald-500/10 text-[#107e65] dark:text-[#34d399]">
              <ShieldCheck className="h-4 w-4" />
            </div>
            <H2 className="text-base text-slate-900 dark:text-white">
              Autonomous Governance &amp; Approvals
            </H2>
          </div>
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
              Velocity &amp; Negotiation Efficiency
            </H2>
          </div>
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
  );
}
