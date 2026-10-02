"use client";

import Link from "next/link";
import React from "react";

import { Caption } from "@/components/ui/text";

import { OpportunityItem } from "./types";

interface DesktopOpportunitiesTableProps {
  paginatedRows: OpportunityItem[];
  startIndex: number;
  onSelectContract: (contract: {
    id: string;
    service: string;
    currentPrice: number;
  }) => void;
}

export function DesktopOpportunitiesTable({
  paginatedRows,
  startIndex,
  onSelectContract,
}: DesktopOpportunitiesTableProps) {
  return (
    <div className="hidden sm:block overflow-x-auto mt-4 rounded-xl border border-slate-200/70 dark:border-slate-800/60 shadow-2xs">
      <table className="w-full text-left text-xs font-sans border-collapse">
        <thead>
          <tr className="border-b border-slate-200/70 dark:border-slate-800/60 bg-slate-50/70 dark:bg-[#141b18]/60 text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            <Caption
              as="th"
              scope="col"
              className="py-3.5 px-3.5 w-12 text-center"
            >
              #
            </Caption>
            <Caption as="th" scope="col" className="py-3.5 px-4 min-w-[200px]">
              Service &amp; Vendor
            </Caption>
            <Caption as="th" scope="col" className="py-3.5 px-3.5 min-w-[110px]">
              Category
            </Caption>
            <Caption as="th" scope="col" className="py-3.5 px-3.5 min-w-[130px]">
              Contract Ref
            </Caption>
            <Caption
              as="th"
              scope="col"
              className="py-3.5 px-4 text-right min-w-[120px]"
            >
              Annual Spend
            </Caption>
            <Caption as="th" scope="col" className="py-3.5 px-3.5 min-w-[140px]">
              Renewal Date
            </Caption>
            <Caption
              as="th"
              scope="col"
              className="py-3.5 px-4 text-right min-w-[130px]"
            >
              Savings Target
            </Caption>
            <Caption
              as="th"
              scope="col"
              className="py-3.5 px-3.5 text-center min-w-[110px]"
            >
              Status
            </Caption>
            <Caption
              as="th"
              scope="col"
              className="py-3.5 px-4 text-center min-w-[220px]"
            >
              Actions
            </Caption>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50 bg-white/70 dark:bg-[#111714]/70">
          {paginatedRows.length === 0 ? (
            <tr>
              <td
                colSpan={9}
                className="text-center py-12 text-slate-400 dark:text-slate-500 font-medium"
              >
                No matching subscription records found.
              </td>
            </tr>
          ) : (
            paginatedRows.map((opp, idx) => {
              const globalIdx = startIndex + idx + 1;
              const contractCode = `CT-${opp.id.slice(0, 4).toUpperCase()}/${opp.id.slice(-3).toUpperCase()}`;
              const isExpiringSoon = opp.daysRemaining <= 30;

              return (
                <tr
                  key={opp.id}
                  className="hover:bg-emerald-500/[0.03] dark:hover:bg-emerald-500/[0.04] transition-colors duration-150"
                >
                  {/* S.No */}
                  <td className="py-4 px-3.5 text-center text-slate-400 dark:text-slate-500 font-mono text-xs font-medium">
                    {globalIdx}
                  </td>

                  {/* Service & Vendor */}
                  <td className="py-4 px-4">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-xl bg-emerald-500/10 dark:bg-emerald-500/15 border border-emerald-500/15 text-[#107e65] dark:text-[#34d399] font-bold text-xs flex items-center justify-center shrink-0">
                        {opp.service.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <div className="font-bold text-slate-900 dark:text-white text-xs">
                          {opp.service}
                        </div>
                        {opp.vendors?.name &&
                          opp.vendors.name.toLowerCase() !==
                            opp.service.toLowerCase() &&
                          !opp.service
                            .toLowerCase()
                            .startsWith(opp.vendors.name.toLowerCase()) && (
                            <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                              {opp.vendors.name}
                            </div>
                          )}
                      </div>
                    </div>
                  </td>

                  {/* Category */}
                  <td className="py-4 px-3.5">
                    <span className="inline-block px-2.5 py-0.5 rounded-xl capitalize text-slate-600 dark:text-slate-300 bg-slate-100/70 dark:bg-slate-800/60 text-xs font-medium border border-slate-200/50 dark:border-slate-700/50">
                      {opp.category}
                    </span>
                  </td>

                  {/* Contract Ref */}
                  <td className="py-4 px-3.5">
                    <span className="font-mono text-xs font-medium text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/40 px-2 py-0.5 rounded-xl border border-slate-200/60 dark:border-slate-700/60">
                      {contractCode}
                    </span>
                  </td>

                  {/* Annual Spend */}
                  <td className="py-4 px-4 text-right font-mono font-bold text-xs text-slate-900 dark:text-white">
                    $
                    {Number(opp.current_price).toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </td>

                  {/* Renewal Date */}
                  <td className="py-4 px-3.5">
                    <div className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                      {new Date(opp.renewal_date).toLocaleDateString("en-GB", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })}
                    </div>
                    <div className="mt-0.5">
                      {isExpiringSoon ? (
                        <span className="inline-block px-1.5 py-0.2 rounded-xl text-xs font-semibold text-amber-700 dark:text-amber-300 bg-amber-500/10 border border-amber-500/20">
                          {opp.daysRemaining}d remaining
                        </span>
                      ) : (
                        <span className="text-xs font-medium text-slate-400 dark:text-slate-500">
                          {opp.daysRemaining}d remaining
                        </span>
                      )}
                    </div>
                  </td>

                  {/* Savings Target */}
                  <td className="py-4 px-4 text-right">
                    <span className="font-mono font-bold text-xs text-[#107e65] dark:text-[#34d399] bg-emerald-500/10 dark:bg-emerald-500/15 px-2.5 py-1 rounded-xl border border-emerald-500/20 inline-block">
                      $
                      {opp.savings.toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </span>
                  </td>

                  {/* Status */}
                  <td className="py-4 px-3.5 text-center">
                    <span
                      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-xl text-xs font-semibold uppercase tracking-wider ${
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
                      <span>{opp.status}</span>
                    </span>
                  </td>

                  {/* Actions */}
                  <td className="py-4 px-4 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          onSelectContract({
                            id: opp.id,
                            service: opp.service,
                            currentPrice: Number(opp.current_price),
                          })
                        }
                        className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-100/80 hover:bg-slate-200/80 dark:bg-slate-800/60 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200/60 dark:border-slate-700/60 transition-colors shadow-2xs cursor-pointer"
                      >
                        Analyze
                      </button>
                      <Link
                        href={`/negotiate/${opp.id}`}
                        className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-[#142620] hover:bg-[#1b332b] dark:bg-slate-100 dark:hover:bg-white text-white dark:text-slate-900 transition-colors shadow-2xs"
                      >
                        Negotiate
                      </Link>
                      <Link
                        href={`/decision/${opp.id}`}
                        className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-emerald-500/10 hover:bg-emerald-500/15 text-[#107e65] dark:text-[#34d399] border border-emerald-500/20 transition-colors shadow-2xs"
                      >
                        Decision
                      </Link>
                    </div>
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}
