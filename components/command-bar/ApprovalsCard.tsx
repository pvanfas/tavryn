"use client";

import { ArrowRight, UserCheck } from "lucide-react";
import Link from "next/link";
import React from "react";

import { CommandCard } from "@/lib/agent/command";

interface ApprovalsCardProps {
  card: Extract<CommandCard, { type: "approvals" }>;
  onClose: () => void;
}

export function ApprovalsCard({ card, onClose }: ApprovalsCardProps) {
  return (
    <div className="rounded-xl border border-amber-200 dark:border-amber-900/60 bg-amber-50/30 dark:bg-amber-950/20 overflow-hidden shadow-xs">
      <div className="px-4 py-2.5 bg-amber-100/50 dark:bg-amber-900/40 border-b border-amber-200 dark:border-amber-800 flex items-center justify-between">
        <span className="font-bold text-[11px] text-amber-900 dark:text-amber-200 flex items-center gap-1.5">
          <UserCheck className="h-3.5 w-3.5 text-amber-600" />
          Awaiting Supervisor Approval
        </span>
        <Link
          href="/approvals"
          onClick={onClose}
          className="text-amber-800 dark:text-amber-300 hover:underline text-[10px] font-bold flex items-center gap-1"
        >
          <span>Open Approvals</span>
          <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
      <div className="divide-y divide-amber-100 dark:divide-amber-900/40">
        {card.data.map((item) => (
          <div
            key={item.id}
            className="p-3 flex items-center justify-between gap-3"
          >
            <div className="space-y-0.5">
              <div className="font-bold text-slate-900 dark:text-white">
                {item.service}
              </div>
              <div className="text-[10px] text-slate-600 dark:text-slate-400">
                {item.reason}
              </div>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              {item.amount > 0 && (
                <div className="font-mono font-bold text-slate-900 dark:text-white text-right">
                  ${item.amount.toLocaleString()} USDC
                </div>
              )}
              <Link
                href={item.link}
                onClick={onClose}
                className="px-2.5 py-1 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-[10px] font-bold shadow-2xs transition-colors"
              >
                Review
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
