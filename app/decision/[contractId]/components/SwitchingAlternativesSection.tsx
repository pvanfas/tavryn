"use client";

import { AlertTriangle, ArrowRightLeft, CheckCircle2, RefreshCw } from "lucide-react";
import React from "react";

import { Caption, Mono } from "@/components/ui/text";
import { SwitchDecisionMatrix } from "@/lib/switching";

import { ContractInfo } from "./types";

interface SwitchingAlternativesSectionProps {
  contract?: ContractInfo;
  switchingMatrix: SwitchDecisionMatrix | null;
  loadingSwitching: boolean;
  onRefresh: () => void;
}

export function SwitchingAlternativesSection({
  contract,
  switchingMatrix,
  loadingSwitching,
  onRefresh,
}: SwitchingAlternativesSectionProps) {
  return (
    <div className="mt-8 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 bg-white/95 dark:bg-[#111714] p-5 sm:p-6 shadow-2xs">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800/70 pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
            <ArrowRightLeft className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Market Alternatives: Switch vs. Renegotiate
              </h3>
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-700 dark:text-blue-300 border border-blue-500/20">
                NPV Migration Audit
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Calculates category migration engineering effort, downtime
              risk, and retraining cost vs renegotiated incumbent rates.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onRefresh}
          disabled={loadingSwitching}
          className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-all shadow-2xs disabled:opacity-50 cursor-pointer shrink-0"
        >
          <RefreshCw
            className={`h-3.5 w-3.5 shrink-0 ${loadingSwitching ? "animate-spin" : ""}`}
          />
          <span>
            {loadingSwitching
              ? "Analyzing Alternatives..."
              : "Recalculate Matrix"}
          </span>
        </button>
      </div>

      {switchingMatrix ? (
        <div className="mt-4 space-y-4">
          {/* Recommendation Banner */}
          <div
            className={`p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
              switchingMatrix.recommendation.action === "stay_and_renegotiate"
                ? "border-emerald-200 dark:border-emerald-800/60 bg-emerald-50/60 dark:bg-emerald-950/20"
                : "border-amber-200 dark:border-amber-800/60 bg-amber-50/60 dark:bg-amber-950/20"
            }`}
          >
            <div className="flex items-center gap-3">
              {switchingMatrix.recommendation.action ===
              "stay_and_renegotiate" ? (
                <CheckCircle2 className="h-5 w-5 text-[#107e65] shrink-0" />
              ) : (
                <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0" />
              )}
              <div>
                <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                  {switchingMatrix.recommendation.action ===
                  "stay_and_renegotiate"
                    ? "Recommendation: Stay & Renegotiate with Incumbent"
                    : `Alternative Viable: Migrate to ${switchingMatrix.recommendation.targetVendor}`}
                </h4>
                <p className="text-xs text-slate-700 dark:text-slate-300 mt-0.5">
                  {switchingMatrix.recommendation.rationale}
                </p>
              </div>
            </div>

            <div className="shrink-0 text-right">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                Policy Invariant
              </span>
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Human Approval Required to Migrate
              </span>
            </div>
          </div>

          {/* Mobile Card View (sm:hidden) */}
          <div className="sm:hidden space-y-3">
            {/* Incumbent Card */}
            <div className="p-4 rounded-xl border border-emerald-500/30 bg-emerald-500/[0.04] space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-emerald-500/20">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-sm text-slate-900 dark:text-white">
                    {contract?.vendor?.name || contract?.service}
                  </span>
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20">
                    Incumbent
                  </span>
                </div>
                <span className="text-[11px] font-mono text-slate-400">
                  Immediate
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800">
                  <span className="text-[10px] uppercase text-slate-500 block">
                    Annual Cost
                  </span>
                  <Mono
                    as="span"
                    className="font-bold text-slate-900 dark:text-white"
                  >
                    ${switchingMatrix.renegotiatedPrice.toLocaleString()}
                  </Mono>
                </div>
                <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800">
                  <span className="text-[10px] uppercase text-slate-500 block">
                    Migration Friction
                  </span>
                  <Mono as="span" className="text-slate-400">
                    $0 (None)
                  </Mono>
                </div>
                <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                  <span className="text-[10px] uppercase text-emerald-600 dark:text-emerald-400 block">
                    Year 1 Yield
                  </span>
                  <Mono
                    as="span"
                    className="font-bold text-[#107e65] dark:text-[#34d399]"
                  >
                    +${switchingMatrix.renegotiatedSavings.toLocaleString()}
                  </Mono>
                </div>
                <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                  <span className="text-[10px] uppercase text-emerald-600 dark:text-emerald-400 block">
                    2-Year NPV
                  </span>
                  <Mono
                    as="span"
                    className="font-bold text-[#107e65] dark:text-[#34d399]"
                  >
                    +$
                    {(
                      switchingMatrix.renegotiatedSavings * 2
                    ).toLocaleString()}
                  </Mono>
                </div>
              </div>
            </div>

            {/* Competitor Alternative Cards */}
            {switchingMatrix.competitors.map((comp, idx) => (
              <div
                key={idx}
                className="p-4 rounded-xl border border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-[#141b18]/80 space-y-3 shadow-2xs"
              >
                <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-slate-900 dark:text-white">
                      {comp.vendorName}
                    </span>
                    <span className="text-[10px] text-slate-400">
                      ★ {comp.reputationScore}
                    </span>
                  </div>
                  <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                    {comp.paybackMonths < 99
                      ? `${comp.paybackMonths} mo payback`
                      : "N/A"}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800">
                    <span className="text-[10px] uppercase text-slate-500 block">
                      Annual Cost
                    </span>
                    <Mono
                      as="span"
                      className="font-bold text-slate-900 dark:text-white"
                    >
                      ${comp.estimatedPrice.toLocaleString()}
                    </Mono>
                  </div>
                  <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800">
                    <span className="text-[10px] uppercase text-slate-500 block">
                      Switching Friction
                    </span>
                    <Mono
                      as="span"
                      className="text-rose-600 dark:text-rose-400 font-semibold"
                    >
                      -${comp.switchingCosts.totalSwitchingCost.toLocaleString()}
                    </Mono>
                  </div>
                  <div
                    className={`p-2 rounded-lg border ${
                      comp.netYear1Savings > 0
                        ? "bg-emerald-500/10 border-emerald-500/20"
                        : "bg-rose-500/10 border-rose-500/20"
                    }`}
                  >
                    <span
                      className={`text-[10px] uppercase block ${
                        comp.netYear1Savings > 0
                          ? "text-emerald-600 dark:text-emerald-400"
                          : "text-rose-600 dark:text-rose-400"
                      }`}
                    >
                      Year 1 Yield
                    </span>
                    <Mono
                      as="span"
                      className={`font-bold ${
                        comp.netYear1Savings > 0
                          ? "text-[#107e65] dark:text-[#34d399]"
                          : "text-rose-600 dark:text-rose-400"
                      }`}
                    >
                      {comp.netYear1Savings > 0 ? "+" : ""}$
                      {comp.netYear1Savings.toLocaleString()}
                    </Mono>
                  </div>
                  <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800">
                    <span className="text-[10px] uppercase text-slate-500 block">
                      2-Year NPV
                    </span>
                    <Mono
                      as="span"
                      className={`font-bold ${
                        comp.netYear2Savings >
                        switchingMatrix.renegotiatedSavings * 2
                          ? "text-purple-600 dark:text-purple-400"
                          : "text-slate-800 dark:text-slate-200"
                      }`}
                    >
                      {comp.netYear2Savings > 0 ? "+" : ""}$
                      {comp.netYear2Savings.toLocaleString()}
                    </Mono>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop Competitors & Incumbent Comparison Table */}
          <div className="hidden sm:block overflow-x-auto rounded-xl border border-slate-200/70 dark:border-slate-800/60 shadow-2xs">
            <table className="w-full text-left text-xs font-sans border-collapse">
              <thead>
                <tr className="border-b border-slate-200/70 dark:border-slate-800/60 bg-slate-50/70 dark:bg-[#141b18]/60 text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  <Caption as="th" className="py-3 px-3.5">
                    Vendor Option
                  </Caption>
                  <Caption as="th" className="py-3 px-3.5 text-right">
                    Annual Cost
                  </Caption>
                  <Caption as="th" className="py-3 px-3.5 text-right">
                    Migration Friction
                  </Caption>
                  <Caption as="th" className="py-3 px-3.5 text-right">
                    Net Year 1 Yield
                  </Caption>
                  <Caption as="th" className="py-3 px-3.5 text-right">
                    2-Year Net NPV
                  </Caption>
                  <Caption as="th" className="py-3 px-3.5 text-center">
                    Payback
                  </Caption>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50 bg-white/70 dark:bg-[#111714]/70">
                {/* Incumbent Row */}
                <tr className="bg-emerald-500/[0.04] font-medium">
                  <td className="py-3 px-3.5">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900 dark:text-white">
                        {contract?.vendor?.name || contract?.service}
                      </span>
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20">
                        Incumbent
                      </span>
                    </div>
                  </td>
                  <td className="py-3 px-3.5 text-right font-mono font-bold text-slate-900 dark:text-white">
                    ${switchingMatrix.renegotiatedPrice.toLocaleString()}
                  </td>
                  <td className="py-3 px-3.5 text-right font-mono text-slate-400">
                    $0 (None)
                  </td>
                  <td className="py-3 px-3.5 text-right font-mono font-bold text-[#107e65] dark:text-[#34d399]">
                    +${switchingMatrix.renegotiatedSavings.toLocaleString()}
                  </td>
                  <td className="py-3 px-3.5 text-right font-mono font-bold text-[#107e65] dark:text-[#34d399]">
                    +$
                    {(
                      switchingMatrix.renegotiatedSavings * 2
                    ).toLocaleString()}
                  </td>
                  <td className="py-3 px-3.5 text-center text-slate-400 font-mono">
                    Immediate
                  </td>
                </tr>

                {/* Competitor Alternative Rows */}
                {switchingMatrix.competitors.map((comp, idx) => (
                  <tr
                    key={idx}
                    className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors"
                  >
                    <td className="py-3 px-3.5">
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold text-slate-800 dark:text-slate-200">
                          {comp.vendorName}
                        </span>
                        <span className="text-[10px] text-slate-400">
                          ★ {comp.reputationScore}
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-3.5 text-right font-mono text-slate-700 dark:text-slate-300">
                      ${comp.estimatedPrice.toLocaleString()}
                    </td>
                    <td className="py-3 px-3.5 text-right font-mono text-rose-600 dark:text-rose-400">
                      -$
                      {comp.switchingCosts.totalSwitchingCost.toLocaleString()}
                    </td>
                    <td
                      className={`py-3 px-3.5 text-right font-mono font-semibold ${
                        comp.netYear1Savings > 0
                          ? "text-[#107e65] dark:text-[#34d399]"
                          : "text-rose-600 dark:text-rose-400"
                      }`}
                    >
                      {comp.netYear1Savings > 0 ? "+" : ""}$
                      {comp.netYear1Savings.toLocaleString()}
                    </td>
                    <td
                      className={`py-3 px-3.5 text-right font-mono font-bold ${
                        comp.netYear2Savings >
                        switchingMatrix.renegotiatedSavings * 2
                          ? "text-purple-600 dark:text-purple-400"
                          : "text-slate-700 dark:text-slate-300"
                      }`}
                    >
                      {comp.netYear2Savings > 0 ? "+" : ""}$
                      {comp.netYear2Savings.toLocaleString()}
                    </td>
                    <td className="py-3 px-3.5 text-center font-mono text-slate-600 dark:text-slate-400">
                      {comp.paybackMonths < 99
                        ? `${comp.paybackMonths} mo`
                        : "N/A"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="mt-4 p-4 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 text-center text-xs text-slate-400">
          Loading competitive market alternatives...
        </div>
      )}
    </div>
  );
}
