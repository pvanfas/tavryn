"use client";

import Link from "next/link";
import React from "react";

import { OpportunityItem } from "./types";

interface MobileOpportunitiesListProps {
  paginatedRows: OpportunityItem[];
  startIndex: number;
  onSelectContract: (contract: {
    id: string;
    service: string;
    currentPrice: number;
  }) => void;
}

export function MobileOpportunitiesList({
  paginatedRows,
  onSelectContract,
}: MobileOpportunitiesListProps) {
  return (
    <div className="sm:hidden mt-4 space-y-3">
      {paginatedRows.length === 0 ? (
        <div className="text-center py-12 text-slate-400 dark:text-slate-500 text-xs font-medium">
          No matching subscription records found.
        </div>
      ) : (
        paginatedRows.map((opp) => {
          const contractCode = `CT-${opp.id.slice(0, 4).toUpperCase()}/${opp.id.slice(-3).toUpperCase()}`;
          const isExpiringSoon = opp.daysRemaining <= 30;

          return (
            <div
              key={opp.id}
              className="rounded-xl border border-slate-200/70 dark:border-slate-800/60 bg-white/80 dark:bg-[#111714]/80 p-4 space-y-3"
            >
              {/* Header: Icon + Service + Status */}
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="h-8 w-8 rounded-xl bg-emerald-500/10 dark:bg-emerald-500/15 border border-emerald-500/15 text-[#107e65] dark:text-[#34d399] font-bold text-xs flex items-center justify-center shrink-0">
                    {opp.service.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <div className="font-bold text-sm text-slate-900 dark:text-white truncate">
                      {opp.service}
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400">
                      {opp.vendors?.name || "Direct Vendor"} &middot;{" "}
                      <span className="font-mono">{contractCode}</span>
                    </div>
                  </div>
                </div>
                <span
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider shrink-0 ${
                    opp.status === "active"
                      ? "bg-emerald-500/10 text-[#107e65] dark:text-[#34d399] border border-emerald-500/20"
                      : opp.status === "negotiating"
                        ? "bg-blue-500/10 text-blue-700 dark:text-blue-300 border border-blue-500/20"
                        : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                  }`}
                >
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${
                      opp.status === "active"
                        ? "bg-[#107e65]"
                        : opp.status === "negotiating"
                          ? "bg-blue-500 animate-pulse"
                          : "bg-slate-400"
                    }`}
                  />
                  {opp.status}
                </span>
              </div>

              {/* 2×2 Metrics Grid */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="p-2.5 rounded-lg bg-slate-50/80 dark:bg-slate-900/40 border border-slate-100 dark:border-slate-800/50">
                  <div className="text-[10px] text-slate-400 uppercase font-semibold mb-0.5">
                    Annual Spend
                  </div>
                  <div className="font-mono font-bold text-slate-900 dark:text-white">
                    $
                    {Number(opp.current_price).toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </div>
                </div>
                <div className="p-2.5 rounded-lg bg-slate-50/80 dark:bg-slate-900/40 border border-slate-100 dark:border-slate-800/50">
                  <div className="text-[10px] text-slate-400 uppercase font-semibold mb-0.5">
                    Savings Target
                  </div>
                  <div className="font-mono font-bold text-[#107e65] dark:text-[#34d399]">
                    $
                    {opp.savings.toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </div>
                </div>
                <div className="p-2.5 rounded-lg bg-slate-50/80 dark:bg-slate-900/40 border border-slate-100 dark:border-slate-800/50">
                  <div className="text-[10px] text-slate-400 uppercase font-semibold mb-0.5">
                    Renewal
                  </div>
                  <div className="font-medium text-slate-700 dark:text-slate-200">
                    {new Date(opp.renewal_date).toLocaleDateString("en-GB", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    })}
                  </div>
                </div>
                <div className="p-2.5 rounded-lg bg-slate-50/80 dark:bg-slate-900/40 border border-slate-100 dark:border-slate-800/50">
                  <div className="text-[10px] text-slate-400 uppercase font-semibold mb-0.5">
                    Remaining
                  </div>
                  <div
                    className={`font-semibold ${
                      isExpiringSoon
                        ? "text-amber-700 dark:text-amber-300"
                        : "text-slate-600 dark:text-slate-300"
                    }`}
                  >
                    {opp.daysRemaining}d
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() =>
                    onSelectContract({
                      id: opp.id,
                      service: opp.service,
                      currentPrice: Number(opp.current_price),
                    })
                  }
                  className="flex-1 text-center px-3 py-2 rounded-lg text-xs font-semibold bg-slate-100/80 hover:bg-slate-200/80 dark:bg-slate-800/60 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200/60 dark:border-slate-700/60 transition-colors cursor-pointer"
                >
                  Analyze
                </button>
                <Link
                  href={`/negotiate/${opp.id}`}
                  className="flex-1 text-center px-3 py-2 rounded-lg text-xs font-semibold bg-[#142620] hover:bg-[#1b332b] dark:bg-slate-100 dark:hover:bg-white text-white dark:text-slate-900 transition-colors"
                >
                  Negotiate
                </Link>
                <Link
                  href={`/decision/${opp.id}`}
                  className="flex-1 text-center px-3 py-2 rounded-lg text-xs font-semibold bg-emerald-500/10 hover:bg-emerald-500/15 text-[#107e65] dark:text-[#34d399] border border-emerald-500/20 transition-colors"
                >
                  Decision
                </Link>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
