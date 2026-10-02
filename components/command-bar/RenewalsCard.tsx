"use client";

import { ArrowRight, Calendar } from "lucide-react";
import Link from "next/link";
import React from "react";

import { CommandCard } from "@/lib/agent/command";

interface RenewalsCardProps {
  card: Extract<CommandCard, { type: "renewals" }>;
  onClose: () => void;
}

export function RenewalsCard({ card, onClose }: RenewalsCardProps) {
  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#141b18] overflow-hidden shadow-xs">
      <div className="px-4 py-2.5 bg-slate-50 dark:bg-[#18221e] border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
        <span className="font-bold text-[11px] text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
          <Calendar className="h-3.5 w-3.5 text-[#107e65]" />
          Upcoming Contract Renewals
        </span>
        <Link
          href="/contracts"
          onClick={onClose}
          className="text-[#107e65] dark:text-[#34d399] hover:underline text-[10px] font-bold flex items-center gap-1"
        >
          <span>All Contracts</span>
          <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
      <div className="divide-y divide-slate-100 dark:divide-slate-800/60">
        {card.data.map((item) => (
          <div
            key={item.id}
            className="p-3 flex items-center justify-between gap-3 hover:bg-slate-50/50 dark:hover:bg-slate-800/20"
          >
            <div>
              <div className="font-bold text-slate-900 dark:text-white">
                {item.service}
              </div>
              <div className="text-[10px] text-slate-400">
                Renews{" "}
                {new Date(item.renewalDate).toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
                {item.seatCount && item.activeSeats && (
                  <>
                    {" "}
                    &bull; {item.activeSeats}/{item.seatCount} seats active
                  </>
                )}
              </div>
            </div>
            <div className="text-right">
              <div className="font-mono font-bold text-slate-900 dark:text-white">
                ${item.currentPrice.toLocaleString()}
              </div>
              <span className="text-[9px] uppercase px-1.5 py-0.5 rounded font-bold bg-slate-100 dark:bg-slate-800 text-slate-500">
                {item.status}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
