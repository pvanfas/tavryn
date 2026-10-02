"use client";

import { Check, X } from "lucide-react";
import React from "react";

import { Caption, H2 } from "@/components/ui/text";

import { DecisionData, PolicyData } from "./types";

interface PolicyChecklistSectionProps {
  evaluation?: DecisionData["evaluation"];
  policy?: PolicyData;
}

export function PolicyChecklistSection({
  evaluation,
  policy,
}: PolicyChecklistSectionProps) {
  const getCheckTitle = (name: string): string => {
    switch (name) {
      case "category_allowed":
        return "Category Authorization";
      case "amount_within_auto_ceiling":
        return `Autonomous Spend Ceiling (≤ $${policy?.max_auto_transaction.toLocaleString()})`;
      case "savings_threshold":
        return `Minimum Savings Requirement (≥ $${policy?.min_savings.toLocaleString()})`;
      case "category_budget":
        return "Category Budget Allocation";
      case "treasury_balance":
        return "Treasury Liquidity";
      case "human_approval_threshold":
        return `Human Boundary Ceiling (≤ $${policy?.human_approval_required_above.toLocaleString()})`;
      case "valid_numbers":
        return "Numerical Integrity Validation";
      default:
        return name.replace(/_/g, " ");
    }
  };

  return (
    <div className="mt-8">
      <H2 className="text-slate-900 dark:text-white mb-3">
        Deterministic Policy Checklist
      </H2>

      {/* Desktop Table View */}
      <div className="hidden sm:block overflow-x-auto rounded-xl border border-slate-200/70 dark:border-slate-800/60 shadow-2xs">
        <table className="w-full text-left text-xs font-sans border-collapse">
          <thead>
            <tr className="border-b border-slate-200/70 dark:border-slate-800/60 bg-slate-50/70 dark:bg-[#141b18]/60 text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              <Caption as="th" className="py-3.5 px-4 w-28 text-center">
                Status
              </Caption>
              <Caption as="th" className="py-3.5 px-4 min-w-[220px]">
                Rule Specification
              </Caption>
              <Caption as="th" className="py-3.5 px-4">
                Evaluation Detail
              </Caption>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50 bg-white/70 dark:bg-[#111714]/70">
            {evaluation?.checks.map((chk, i) => (
              <tr
                key={i}
                className="hover:bg-emerald-500/[0.03] dark:hover:bg-emerald-500/[0.04] transition-colors duration-150"
              >
                <td className="py-3.5 px-4 text-center">
                  {chk.passed ? (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-[#107e65] dark:text-[#34d399] border border-emerald-500/20">
                      <Check className="h-3.5 w-3.5 stroke-[2.5]" />
                      <span>Passed</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-700 dark:text-rose-300 border border-rose-500/20">
                      <X className="h-3.5 w-3.5 stroke-[2.5]" />
                      <span>Refused</span>
                    </span>
                  )}
                </td>
                <td className="py-3.5 px-4 font-bold text-slate-900 dark:text-white">
                  {getCheckTitle(chk.name)}
                </td>
                <td className="py-3.5 px-4 font-medium text-slate-600 dark:text-slate-300">
                  {chk.detail}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile Card View */}
      <div className="sm:hidden space-y-2.5">
        {evaluation?.checks.map((chk, i) => (
          <div
            key={i}
            className="p-3.5 rounded-xl border border-slate-200/70 dark:border-slate-800/60 bg-white/70 dark:bg-[#111714]/70 shadow-2xs flex flex-col gap-2"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="font-bold text-xs text-slate-900 dark:text-white">
                {getCheckTitle(chk.name)}
              </span>
              {chk.passed ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-2xs font-semibold bg-emerald-500/10 text-[#107e65] dark:text-[#34d399] border border-emerald-500/20 shrink-0">
                  <Check className="h-3 w-3 stroke-[2.5]" />
                  <span>Passed</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-2xs font-semibold bg-rose-500/10 text-rose-700 dark:text-rose-300 border border-rose-500/20 shrink-0">
                  <X className="h-3 w-3 stroke-[2.5]" />
                  <span>Refused</span>
                </span>
              )}
            </div>
            <p className="text-xs font-medium text-slate-600 dark:text-slate-300">
              {chk.detail}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
