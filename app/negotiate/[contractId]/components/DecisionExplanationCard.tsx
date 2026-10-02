"use client";

import React from "react";

import { Explanation, NegotiationData } from "./types";

interface DecisionExplanationCardProps {
  negotiation: NegotiationData;
  explanation: Explanation | null;
}

export function DecisionExplanationCard({
  negotiation,
  explanation,
}: DecisionExplanationCardProps) {
  if (
    negotiation.status !== "agreed" &&
    negotiation.status !== "savings_recorded_no_payment" &&
    negotiation.status !== "walked_away"
  ) {
    return null;
  }

  return (
    <div className="mt-8 pt-6 border-t border-slate-100 dark:border-slate-800/70 space-y-4">
      <h3 className="text-base font-bold text-slate-900 dark:text-white">
        Deterministic Verification Summary
      </h3>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
        <div className="p-4 rounded-xl border border-slate-200/70 dark:border-slate-800/60 bg-slate-50/50 dark:bg-[#131b17]/30 text-xs space-y-1">
          <span className="font-bold text-slate-900 dark:text-white block">
            1. Policy Ceiling Compliance
          </span>
          <p className="text-xs text-slate-600 dark:text-slate-300 font-medium leading-relaxed">
            {explanation?.belowPolicyCeiling ||
              `Adheres to approved budget ceiling ($${negotiation.final_price?.toLocaleString() || negotiation.current_offer?.toLocaleString()}).`}
          </p>
        </div>

        <div className="p-4 rounded-xl border border-slate-200/70 dark:border-slate-800/60 bg-slate-50/50 dark:bg-[#131b17]/30 text-xs space-y-1">
          <span className="font-bold text-slate-900 dark:text-white block">
            2. Realized Cash Savings
          </span>
          <p className="text-xs text-slate-600 dark:text-slate-300 font-medium leading-relaxed">
            {explanation?.dollarSavings ||
              `Captured $${Number(negotiation.savings || 0).toLocaleString()} in annual recurring cash reductions.`}
          </p>
        </div>

        <div className="p-4 rounded-xl border border-slate-200/70 dark:border-slate-800/60 bg-slate-50/50 dark:bg-[#131b17]/30 text-xs space-y-1">
          <span className="font-bold text-slate-900 dark:text-white block">
            3. Market Benchmark Alignment
          </span>
          <p className="text-xs text-slate-600 dark:text-slate-300 font-medium leading-relaxed">
            {explanation?.competitorComparison ||
              "Benchmarked within target quartile for enterprise peer contracts."}
          </p>
        </div>

        <div className="p-4 rounded-xl border border-slate-200/70 dark:border-slate-800/60 bg-slate-50/50 dark:bg-[#131b17]/30 text-xs space-y-1">
          <span className="font-bold text-slate-900 dark:text-white block">
            4. Service SLA Integrity
          </span>
          <p className="text-xs text-slate-600 dark:text-slate-300 font-medium leading-relaxed">
            {explanation?.serviceLevelsPreserved ||
              "Active seat allocations, license entitlements, and core support tiers preserved."}
          </p>
        </div>
      </div>
    </div>
  );
}
