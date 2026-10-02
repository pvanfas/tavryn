"use client";

import { Building2, ExternalLink } from "lucide-react";
import React from "react";

import { H2 } from "@/components/ui/text";
import { ARC_CONFIG } from "@/lib/circle";
import { TractionMetricsResult } from "@/lib/metrics";

interface OnboardedOrganizationsTableProps {
  businesses: TractionMetricsResult["businesses"];
}

export function OnboardedOrganizationsTable({
  businesses,
}: OnboardedOrganizationsTableProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Building2 className="h-5 w-5 text-[#107e65] dark:text-[#34d399]" />
          <H2 className="text-base text-slate-900 dark:text-white">
            Onboarded Organizations
          </H2>
        </div>
        <span className="text-xs text-slate-500">
          {businesses.list.length} organizations registered
        </span>
      </div>

      <div className="bg-white dark:bg-[#111714] rounded-2xl border border-slate-200/80 dark:border-slate-800/80 shadow-2xs overflow-hidden">
        {/* Desktop Table */}
        <div className="hidden sm:block overflow-x-auto">
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
              {businesses.list.map((b) => (
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

        {/* Mobile Card View */}
        <div className="sm:hidden divide-y divide-slate-100 dark:divide-slate-800/60">
          {businesses.list.map((b) => (
            <div key={b.id} className="p-4 space-y-2.5">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-bold text-sm text-slate-900 dark:text-white truncate">
                    {b.name}
                  </div>
                  <div className="text-[10px] font-mono text-slate-400 truncate">
                    {b.id}
                  </div>
                </div>
                {b.isReal ? (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-[#107e65] dark:text-[#34d399] border border-emerald-500/20 shrink-0">
                    Real
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20 shrink-0">
                    Demo
                  </span>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="p-2 rounded-lg bg-slate-50/80 dark:bg-slate-900/40 border border-slate-100 dark:border-slate-800/50">
                  <div className="text-[10px] text-slate-400 uppercase font-semibold mb-0.5">
                    Treasury
                  </div>
                  <div className="font-mono font-bold text-slate-900 dark:text-white">
                    $
                    {b.treasuryBalance.toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </div>
                </div>
                <div className="p-2 rounded-lg bg-slate-50/80 dark:bg-slate-900/40 border border-slate-100 dark:border-slate-800/50">
                  <div className="text-[10px] text-slate-400 uppercase font-semibold mb-0.5">
                    Savings
                  </div>
                  <div className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                    +${b.totalSavings.toLocaleString()}
                  </div>
                </div>
                <div className="p-2 rounded-lg bg-slate-50/80 dark:bg-slate-900/40 border border-slate-100 dark:border-slate-800/50">
                  <div className="text-[10px] text-slate-400 uppercase font-semibold mb-0.5">
                    Contracts
                  </div>
                  <div className="font-medium text-slate-700 dark:text-slate-200">
                    {b.contractsCount}
                  </div>
                </div>
                <div className="p-2 rounded-lg bg-slate-50/80 dark:bg-slate-900/40 border border-slate-100 dark:border-slate-800/50">
                  <div className="text-[10px] text-slate-400 uppercase font-semibold mb-0.5">
                    Spend
                  </div>
                  <div className="font-mono font-medium text-slate-600 dark:text-slate-300">
                    ${b.totalSpend.toLocaleString()}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
