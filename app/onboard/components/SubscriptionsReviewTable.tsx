"use client";

import { Trash2 } from "lucide-react";
import React from "react";

import { ValidatedSubscriptionRow } from "@/lib/schemas";

interface SubscriptionsReviewTableProps {
  rows: ValidatedSubscriptionRow[];
  validActiveRows: ValidatedSubscriptionRow[];
  totalAnnualSpend: number;
  onToggleInclude: (id: string) => void;
  onUpdateRowField: (id: string, field: string, value: string) => void;
  onRemoveRow: (id: string) => void;
}

export function SubscriptionsReviewTable({
  rows,
  validActiveRows,
  totalAnnualSpend,
  onToggleInclude,
  onUpdateRowField,
  onRemoveRow,
}: SubscriptionsReviewTableProps) {
  return (
    <div className="space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <span>Review Detected Subscriptions</span>
            <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
              {validActiveRows.length} of {rows.length} selected
            </span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Verify detected merchants, cadence annualization, and confidence
            levels before committing to contracts ledger.
          </p>
        </div>

        <div className="text-right">
          <span className="text-[10px] uppercase font-bold text-slate-400 block">
            Total Selected Spend
          </span>
          <span className="font-mono text-base font-bold text-slate-900 dark:text-white">
            ${totalAnnualSpend.toLocaleString()} / year
          </span>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="p-8 rounded-xl border border-dashed border-slate-300 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/20 text-center text-xs text-slate-400">
          No subscriptions detected yet. Upload a statement CSV or invoice PDF
          above, or click one of the sample buttons.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200/70 dark:border-slate-800/60 shadow-2xs">
          <table className="w-full text-left text-xs font-sans border-collapse">
            <thead>
              <tr className="border-b border-slate-200/70 dark:border-slate-800/60 bg-slate-50/70 dark:bg-[#141b18]/60 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                <th className="py-3 px-3 w-10 text-center">Inc</th>
                <th className="py-3 px-4 min-w-[180px]">
                  Vendor &amp; Service
                </th>
                <th className="py-3 px-3 min-w-[110px]">Category</th>
                <th className="py-3 px-4 min-w-[130px]">Annual Price ($)</th>
                <th className="py-3 px-3 min-w-[130px]">Renewal Date</th>
                <th className="py-3 px-3 text-center min-w-[110px]">
                  Confidence / Source
                </th>
                <th className="py-3 px-3 text-center w-12">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50 bg-white/70 dark:bg-[#111714]/70">
              {rows.map((r) => {
                const isIncluded = r.included !== false;

                return (
                  <tr
                    key={r.id}
                    className={`transition-colors duration-150 ${
                      isIncluded
                        ? "hover:bg-emerald-500/[0.03] dark:hover:bg-emerald-500/[0.04]"
                        : "opacity-40 bg-slate-50/50 dark:bg-slate-900/30"
                    }`}
                  >
                    {/* Checkbox */}
                    <td className="py-3 px-3 text-center">
                      <input
                        type="checkbox"
                        checked={isIncluded}
                        onChange={() => onToggleInclude(r.id)}
                        className="h-4 w-4 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                      />
                    </td>

                    {/* Editable Vendor & Service */}
                    <td className="py-3 px-4 space-y-1">
                      <input
                        type="text"
                        value={r.raw.service}
                        onChange={(e) =>
                          onUpdateRowField(r.id, "service", e.target.value)
                        }
                        className="w-full text-xs font-bold text-slate-900 dark:text-slate-100 bg-transparent border-b border-transparent hover:border-slate-300 focus:border-emerald-500 focus:outline-hidden"
                      />
                      <input
                        type="text"
                        value={r.raw.vendor}
                        onChange={(e) =>
                          onUpdateRowField(r.id, "vendor", e.target.value)
                        }
                        className="w-full text-[11px] text-slate-500 dark:text-slate-400 bg-transparent border-b border-transparent hover:border-slate-300 focus:border-emerald-500 focus:outline-hidden"
                      />
                    </td>

                    {/* Editable Category */}
                    <td className="py-3 px-3">
                      <select
                        value={r.raw.category}
                        onChange={(e) =>
                          onUpdateRowField(r.id, "category", e.target.value)
                        }
                        className="text-xs rounded px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300"
                      >
                        <option value="software">software</option>
                        <option value="cloud">cloud</option>
                        <option value="contractors">contractors</option>
                      </select>
                    </td>

                    {/* Editable Annual Price */}
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1 font-mono font-bold text-slate-900 dark:text-white">
                        <span>$</span>
                        <input
                          type="number"
                          value={r.raw.annual_price}
                          onChange={(e) =>
                            onUpdateRowField(
                              r.id,
                              "annual_price",
                              e.target.value,
                            )
                          }
                          className="w-24 text-xs font-mono font-bold bg-transparent border-b border-transparent hover:border-slate-300 focus:border-emerald-500 focus:outline-hidden"
                        />
                      </div>
                    </td>

                    {/* Editable Renewal Date */}
                    <td className="py-3 px-3">
                      <input
                        type="date"
                        value={r.raw.renewal_date}
                        onChange={(e) =>
                          onUpdateRowField(r.id, "renewal_date", e.target.value)
                        }
                        className="text-xs font-mono text-slate-700 dark:text-slate-300 bg-transparent border-b border-transparent hover:border-slate-300 focus:border-emerald-500 focus:outline-hidden"
                      />
                    </td>

                    {/* Confidence Badge & Source */}
                    <td className="py-3 px-3 text-center space-y-0.5">
                      {r.confidence != null ? (
                        r.confidence >= 0.85 ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                            <span>{Math.round(r.confidence * 100)}% High</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30">
                            <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                            <span>
                              Verify ({Math.round(r.confidence * 100)}%)
                            </span>
                          </span>
                        )
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                          Standard
                        </span>
                      )}
                      <div className="text-[9px] font-mono text-slate-400 truncate">
                        {r.source || "csv"}
                      </div>
                    </td>

                    {/* Actions */}
                    <td className="py-3 px-3 text-center">
                      <button
                        type="button"
                        onClick={() => onRemoveRow(r.id)}
                        className="text-slate-400 hover:text-rose-600 p-1.5 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                        title="Remove row"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
