"use client";

import { Check, CheckCircle2, Loader2, Lock, ShieldAlert } from "lucide-react";
import React from "react";

import { CommandCard } from "@/lib/agent/command";

interface ActionConfirmationCardProps {
  card: Extract<CommandCard, { type: "action_confirmation" }>;
  msgId: string;
  confirmedResult?: string;
  isConfirming: boolean;
  onConfirmAction: (
    msgId: string,
    action: string,
    params: Record<string, any>,
  ) => void;
}

export function ActionConfirmationCard({
  card,
  msgId,
  confirmedResult,
  isConfirming,
  onConfirmAction,
}: ActionConfirmationCardProps) {
  return (
    <div className="rounded-xl border border-amber-200 dark:border-amber-900/70 bg-amber-50/60 dark:bg-amber-950/20 p-4 space-y-3 shadow-xs">
      <div className="flex items-center justify-between border-b border-amber-200/80 dark:border-amber-900/60 pb-2">
        <div className="flex items-center gap-1.5 text-amber-900 dark:text-amber-200 font-bold text-xs">
          <ShieldAlert className="h-4 w-4 text-amber-600" />
          <span>Action Confirmation Required</span>
        </div>
        <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-amber-200/60 dark:bg-amber-900 text-amber-900 dark:text-amber-200">
          Zero-Trust Boundary
        </span>
      </div>

      <p className="text-[11px] text-slate-700 dark:text-slate-300 font-medium leading-relaxed">
        {card.detail}
      </p>

      {/* Confirmation Execution State */}
      {confirmedResult ? (
        <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-[#107e65] dark:text-[#34d399] font-bold text-[11px] flex items-center gap-1.5">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>{confirmedResult}</span>
        </div>
      ) : (
        <div className="pt-2 flex items-center justify-between gap-3">
          <span className="text-[10px] text-slate-500 dark:text-slate-400 flex items-center gap-1">
            <Lock className="h-3 w-3" />
            <span>Actions are never executed automatically from chat.</span>
          </span>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={isConfirming}
              onClick={() => onConfirmAction(msgId, card.action, card.params)}
              className="px-3.5 py-1.5 rounded-xl bg-[#107e65] hover:bg-[#0d6b55] text-white font-bold text-xs shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              {isConfirming ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Check className="h-3.5 w-3.5" />
              )}
              <span>{isConfirming ? "Running..." : "Confirm & Execute"}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
