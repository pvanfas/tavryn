"use client";

import { AlertTriangle, Brain, CheckCircle2 } from "lucide-react";
import React from "react";

import { AgentIcon } from "@/components/AgentIcon";
import { Caption, Mono } from "@/components/ui/text";

import { ContractData, VendorMemoryData } from "./types";

interface VendorMemoryCardProps {
  vendorMemory: VendorMemoryData | null;
  contract: ContractData | null;
  baselinePrice: number;
}

export function VendorMemoryCard({
  vendorMemory,
  contract,
  baselinePrice,
}: VendorMemoryCardProps) {
  return (
    <div className="mt-6 rounded-xl border border-slate-200/70 dark:border-slate-800/60 bg-gradient-to-br from-slate-50/70 via-white to-slate-50/40 dark:from-[#111714] dark:via-[#131b17] dark:to-[#0f1412] p-4 sm:p-6 shadow-2xs">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-200/60 dark:border-slate-800/60">
        <div className="flex items-start gap-2.5 min-w-0">
          <div className="p-2 rounded-lg bg-[#107e65]/10 text-[#107e65] dark:text-[#34d399] border border-[#107e65]/20 shrink-0 mt-0.5">
            <Brain className="h-4 w-4" />
          </div>
          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-base sm:text-h3 font-bold text-slate-900 dark:text-white leading-tight">
                Business Memory Used
              </h3>
              {vendorMemory?.has_history ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-semibold bg-emerald-500/10 text-[#107e65] dark:text-[#34d399] border border-emerald-500/20 shrink-0">
                  <AgentIcon className="h-3 w-3" />
                  Prior Deal Anchored
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 shrink-0">
                  Initial Baseline
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-snug">
              Deterministic memory injected into autonomous negotiation
              intelligence
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto shrink-0 pl-10 sm:pl-0">
          <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
            Reputation:
          </span>
          <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700">
            {vendorMemory?.reputation_score ??
              contract?.vendors?.reputation_score ??
              50}{" "}
            / 100
          </span>
        </div>
      </div>

      {/* Memory Metrics Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-3 pt-4">
        <div className="rounded-lg border border-slate-200/60 dark:border-slate-800/60 bg-white/60 dark:bg-slate-900/40 p-2.5 sm:p-3">
          <Caption className="uppercase text-slate-400 dark:text-slate-500 font-bold block text-[10px] sm:text-xs leading-tight">
            Last Accepted Discount
          </Caption>
          <Mono
            as="p"
            className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white mt-1 truncate"
          >
            {vendorMemory?.accepted_discount_pct !== null &&
            vendorMemory?.accepted_discount_pct !== undefined
              ? `${vendorMemory.accepted_discount_pct.toFixed(1)}%`
              : "22.0% (Default)"}
          </Mono>
          <span className="text-[10px] sm:text-[11px] text-slate-500 dark:text-slate-400">
            {vendorMemory?.has_history
              ? "Anchored target price"
              : "Telemetry estimate"}
          </span>
        </div>

        <div className="rounded-lg border border-slate-200/60 dark:border-slate-800/60 bg-white/60 dark:bg-slate-900/40 p-2.5 sm:p-3">
          <Caption className="uppercase text-slate-400 dark:text-slate-500 font-bold block text-[10px] sm:text-xs leading-tight">
            Pace to Close
          </Caption>
          <Mono
            as="p"
            className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white mt-1 truncate"
          >
            {vendorMemory?.rounds_to_close
              ? `${vendorMemory.rounds_to_close} rounds`
              : "3 rounds (avg)"}
          </Mono>
          <span className="text-[10px] sm:text-[11px] text-slate-500 dark:text-slate-400">
            Historical velocity
          </span>
        </div>

        <div className="rounded-lg border border-slate-200/60 dark:border-slate-800/60 bg-white/60 dark:bg-slate-900/40 p-2.5 sm:p-3">
          <Caption className="uppercase text-slate-400 dark:text-slate-500 font-bold block text-[10px] sm:text-xs leading-tight">
            Last Final Price
          </Caption>
          <Mono
            as="p"
            className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white mt-1 truncate"
          >
            {vendorMemory?.last_price
              ? `$${vendorMemory.last_price.toLocaleString()}`
              : `$${baselinePrice.toLocaleString()}`}
          </Mono>
          <span className="text-[10px] sm:text-[11px] text-slate-500 dark:text-slate-400">
            Prior renewal rate
          </span>
        </div>

        <div className="rounded-lg border border-slate-200/60 dark:border-slate-800/60 bg-white/60 dark:bg-slate-900/40 p-2.5 sm:p-3">
          <Caption className="uppercase text-slate-400 dark:text-slate-500 font-bold block text-[10px] sm:text-xs leading-tight">
            Contract Delivery
          </Caption>
          <div className="flex items-center gap-1 mt-1">
            {vendorMemory?.delivered_ok !== false ? (
              <span className="inline-flex items-center gap-1 text-[11px] sm:text-xs font-bold text-[#107e65] dark:text-[#34d399]">
                <CheckCircle2 className="h-3 w-3 sm:h-3.5 sm:w-3.5 shrink-0" />
                Verified Clean
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-[11px] sm:text-xs font-bold text-amber-600 dark:text-amber-400">
                <AlertTriangle className="h-3 w-3 sm:h-3.5 sm:w-3.5 shrink-0" />
                Disputed
              </span>
            )}
          </div>
          <span className="text-[10px] sm:text-[11px] text-slate-500 dark:text-slate-400">
            Escrow release status
          </span>
        </div>
      </div>

      {/* Memory Insight Quote */}
      <div className="mt-3 sm:mt-3.5 p-2.5 sm:p-3 rounded-lg bg-emerald-500/5 dark:bg-emerald-950/20 border border-emerald-500/15 dark:border-emerald-900/30 flex items-start gap-2">
        <AgentIcon className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-[#107e65] dark:text-[#34d399] shrink-0 mt-0.5" />
        <p className="text-[11px] sm:text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
          <span className="font-semibold text-slate-900 dark:text-white">
            Strategy:{" "}
          </span>
          {vendorMemory?.summary_sentence ||
            vendorMemory?.insight ||
            (vendorMemory?.has_history
              ? `${contract?.vendors?.name || contract?.service || "Vendor"} previously accepted a ${vendorMemory?.accepted_discount_pct?.toFixed(1) || "22.6"}% discount for a 12-month commitment, so a similar target is reasonable.`
              : "First negotiation cycle for this vendor. Telemetry metrics will determine opening concessions, and final terms will be committed to vendor memory for future renewals.")}
        </p>
      </div>
    </div>
  );
}
