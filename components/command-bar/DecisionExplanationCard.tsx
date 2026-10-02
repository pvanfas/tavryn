"use client";

import { ExternalLink } from "lucide-react";
import Link from "next/link";
import React from "react";

import { CommandCard } from "@/lib/agent/command";

interface DecisionExplanationCardProps {
  card: Extract<CommandCard, { type: "decision_explanation" }>;
  onClose: () => void;
}

export function DecisionExplanationCard({
  card,
  onClose,
}: DecisionExplanationCardProps) {
  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#141b18] p-4 space-y-3 shadow-xs">
      <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2.5">
        <div className="flex items-center gap-2">
          <span className="font-bold text-slate-900 dark:text-white text-xs">
            {card.data.service} Negotiation Breakdown
          </span>
          <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-emerald-500/10 text-[#107e65] uppercase">
            {card.data.status}
          </span>
        </div>
        <span className="text-[10px] text-slate-400 font-mono">
          {card.data.rounds} rounds
        </span>
      </div>

      {/* Price Delta Highlights */}
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800">
          <span className="text-[10px] text-slate-400 uppercase block">
            Baseline
          </span>
          <span className="font-mono font-bold text-slate-400 line-through text-xs">
            ${card.data.originalPrice.toLocaleString()}
          </span>
        </div>
        <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800">
          <span className="text-[10px] text-slate-500 uppercase block">
            Accepted
          </span>
          <span className="font-mono font-bold text-slate-900 dark:text-white text-xs">
            ${card.data.finalPrice.toLocaleString()}
          </span>
        </div>
        <div className="p-2 rounded-lg bg-emerald-500/10 dark:bg-emerald-950/20 border border-emerald-500/20 text-[#107e65] dark:text-[#34d399]">
          <span className="text-[10px] uppercase block font-bold">
            Annual Cut
          </span>
          <span className="font-mono font-bold text-xs">
            -${card.data.savings.toLocaleString()} ({card.data.savingsPct}%)
          </span>
        </div>
      </div>

      {/* Rationale and Signals */}
      <div className="space-y-1.5 pt-1">
        <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed font-medium">
          {card.data.rationale}
        </p>
        <div className="flex flex-wrap gap-1.5 pt-1">
          {card.data.telemetrySignals.map((signal, sIdx) => (
            <span
              key={sIdx}
              className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-[10px] text-slate-600 dark:text-slate-400"
            >
              &bull; {signal}
            </span>
          ))}
        </div>
      </div>

      <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex justify-end">
        <Link
          href={card.data.link}
          onClick={onClose}
          className="inline-flex items-center gap-1 text-[#107e65] dark:text-[#34d399] font-bold text-[11px] hover:underline"
        >
          <span>Inspect Decision Transcript</span>
          <ExternalLink className="h-3 w-3" />
        </Link>
      </div>
    </div>
  );
}
