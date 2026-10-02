"use client";

import { ArrowRight, Wallet } from "lucide-react";
import Link from "next/link";
import React from "react";

import { CommandCard } from "@/lib/agent/command";

interface SavingsSummaryCardProps {
  card: Extract<CommandCard, { type: "savings_summary" }>;
  onClose: () => void;
}

export function SavingsSummaryCard({
  card,
  onClose,
}: SavingsSummaryCardProps) {
  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#141b18] p-4 space-y-3 shadow-xs">
      <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
        <span className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
          <Wallet className="h-3.5 w-3.5 text-[#107e65]" />
          Cumulative Procurement Savings ({card.data.period})
        </span>
        <Link
          href={card.data.link}
          onClick={onClose}
          className="text-[#107e65] dark:text-[#34d399] hover:underline text-[10px] font-bold flex items-center gap-1"
        >
          <span>Full Telemetry</span>
          <ArrowRight className="h-3 w-3" />
        </Link>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-center">
        <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-[#107e65] dark:text-[#34d399]">
          <span className="text-[10px] uppercase font-bold block">
            Negotiated Savings
          </span>
          <span className="font-mono font-bold text-base">
            ${card.data.negotiatedSavings.toLocaleString()}
          </span>
        </div>
        <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800">
          <span className="text-[10px] text-slate-500 uppercase block">
            Settled On-Chain
          </span>
          <span className="font-mono font-bold text-slate-900 dark:text-white text-base">
            ${card.data.realizedSavings.toLocaleString()}
          </span>
        </div>
        <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800 col-span-2 sm:col-span-1">
          <span className="text-[10px] text-slate-500 uppercase block">
            Savings Rate
          </span>
          <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 text-base">
            {card.data.savingsRatePct}%
          </span>
        </div>
      </div>
    </div>
  );
}
