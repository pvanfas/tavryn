"use client";

import { Building2, Layers, TrendingDown, Wallet } from "lucide-react";
import React from "react";

import { TractionMetricsResult } from "@/lib/metrics";

interface MetricsHeroGridProps {
  metrics: TractionMetricsResult;
}

export function MetricsHeroGrid({ metrics }: MetricsHeroGridProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* Total USDC Moved */}
      <div className="p-5 rounded-2xl bg-white dark:bg-[#111714] border border-slate-200/80 dark:border-slate-800/80 shadow-2xs relative overflow-hidden group">
        <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-bl-full pointer-events-none group-hover:scale-110 transition-transform" />
        <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 font-semibold mb-2">
          <span>Total USDC Escrowed</span>
          <Wallet className="h-4 w-4 text-[#107e65] dark:text-[#34d399]" />
        </div>
        <div className="flex items-baseline gap-1.5 flex-wrap">
          <span className="text-2xl sm:text-3xl font-extrabold font-mono tracking-tight text-slate-900 dark:text-white">
            $
            {metrics.usdcVolume.escrowed.toLocaleString(undefined, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </span>
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
        <div className="flex items-baseline gap-1.5 flex-wrap">
          <span className="text-2xl sm:text-3xl font-extrabold font-mono tracking-tight text-slate-900 dark:text-white">
            $
            {metrics.savings.realized.toLocaleString(undefined, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </span>
          <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
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
          <span className="text-2xl sm:text-3xl font-extrabold font-mono tracking-tight text-slate-900 dark:text-white">
            {metrics.businesses.totalCount}
          </span>
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
        <div className="flex items-baseline gap-1.5 flex-wrap">
          <span className="text-2xl sm:text-3xl font-extrabold font-mono tracking-tight text-slate-900 dark:text-white">
            {metrics.contractsAndNegotiations.contractsOptimized}
          </span>
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
  );
}
