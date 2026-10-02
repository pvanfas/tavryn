"use client";

import { TrendingDown } from "lucide-react";
import React from "react";

import { CommandCard } from "@/lib/agent/command";

interface SavingsCardProps {
  card: Extract<CommandCard, { type: "savings" }>;
  onNegotiate: (query: string) => void;
}

export function SavingsCard({ card, onNegotiate }: SavingsCardProps) {
  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#141b18] overflow-hidden shadow-xs">
      <div className="px-4 py-2.5 bg-slate-50 dark:bg-[#18221e] border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
        <span className="font-bold text-[11px] text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
          <TrendingDown className="h-3.5 w-3.5 text-emerald-600" />
          Ranked Savings Opportunities
        </span>
        <span className="text-[10px] text-slate-400 font-mono">
          Ranked by potential cut
        </span>
      </div>
      <div className="divide-y divide-slate-100 dark:divide-slate-800/60">
        {card.data.map((item) => (
          <div
            key={item.id}
            className="p-3 flex items-center justify-between gap-3 hover:bg-slate-50/50 dark:hover:bg-slate-800/20"
          >
            <div className="space-y-0.5">
              <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                <span>{item.service}</span>
                <span className="text-[10px] font-semibold text-slate-400">
                  (${item.currentPrice.toLocaleString()} baseline)
                </span>
              </div>
              <div className="text-[10px] text-slate-500 dark:text-slate-400">
                {item.explanation}
              </div>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <div className="text-right font-mono">
                <div className="font-bold text-emerald-600 dark:text-emerald-400">
                  -${item.potentialSavings.toLocaleString()}
                </div>
                <div className="text-[9px] text-slate-400">
                  {item.savingsPct}% cut
                </div>
              </div>
              <button
                type="button"
                onClick={() => onNegotiate(`Negotiate ${item.service}`)}
                className="px-2.5 py-1 rounded-lg bg-[#107e65] hover:bg-[#0d6b55] text-white text-[10px] font-bold shadow-2xs transition-colors cursor-pointer"
              >
                Negotiate
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
