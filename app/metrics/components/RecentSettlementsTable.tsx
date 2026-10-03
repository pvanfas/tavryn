"use client";

import { Activity } from "lucide-react";
import React from "react";

import { TransactionHashBadge } from "@/components/TransactionHashBadge";
import { TractionMetricsResult } from "@/lib/metrics";

interface RecentSettlementsTableProps {
  transactions: TractionMetricsResult["transactions"];
}

export function RecentSettlementsTable({
  transactions,
}: RecentSettlementsTableProps) {
  return (
    <div className="space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 sm:gap-2">
        <div className="flex items-center gap-2">
          <Activity className="h-5 w-5 text-[#107e65] dark:text-[#34d399] shrink-0" />
          <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white tracking-tight">
            Reconciled On-Chain Transactions Ledger
          </h2>
        </div>
        <span className="text-xs text-slate-500 pl-7 sm:pl-0">
          {transactions.length} settlement transactions
        </span>
      </div>

      <div className="bg-white dark:bg-[#111714] rounded-2xl border border-slate-200/80 dark:border-slate-800/80 shadow-2xs overflow-hidden">
        {/* Desktop Table */}
        <div className="hidden sm:block overflow-x-auto">
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
              {transactions.map((t) => (
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
                    <TransactionHashBadge
                      txHash={t.txHash}
                      isSimulated={t.isSimulated}
                      status={t.status}
                      compact={true}
                    />
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

        {/* Mobile Card View */}
        <div className="sm:hidden divide-y divide-slate-100 dark:divide-slate-800/60">
          {transactions.map((t) => (
            <div key={t.id} className="p-4 space-y-2.5">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-bold text-sm text-slate-900 dark:text-white truncate">
                    {t.businessName}
                  </div>
                  <div className="text-[11px] text-slate-500">
                    &rarr; {t.vendorName}
                  </div>
                </div>
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase shrink-0 ${
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
              </div>
              <div className="flex items-center justify-between text-xs">
                <div className="font-mono font-bold text-slate-900 dark:text-white">
                  $
                  {t.amount.toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}{" "}
                  {t.currency}
                </div>
                <div className="text-[11px] text-slate-500">
                  {new Date(t.createdAt).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </div>
              </div>
              <TransactionHashBadge
                txHash={t.txHash}
                isSimulated={t.isSimulated}
                status={t.status}
                compact={true}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
