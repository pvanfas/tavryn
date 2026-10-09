"use client";

import { ArrowRight, Check, CheckCircle2, Copy } from "lucide-react";
import Link from "next/link";
import React, { useState } from "react";

import { FundingResultData } from "./types";

interface FundingResultCardProps {
  fundingResult: FundingResultData;
}

export function FundingResultCard({ fundingResult }: FundingResultCardProps) {
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const handleCopy = (text: string, field: string) => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(text);
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
    }
  };

  return (
    <div className="rounded-2xl bg-white/95 dark:bg-[#111714]/95 border border-slate-200/80 dark:border-slate-800/70 p-6 sm:p-8 shadow-xl space-y-6">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-emerald-500/10 text-[#107e65] dark:text-[#34d399] flex items-center justify-center">
          <CheckCircle2 className="h-6 w-6" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">
            Organization Provisioned Successfully
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Created <strong>{fundingResult.businessName}</strong> with{" "}
            {fundingResult.contractsCount} verified contracts
          </p>
        </div>
      </div>

      <div className="p-4 rounded-xl bg-slate-50 dark:bg-[#151c19] border border-slate-200 dark:border-slate-800 space-y-3">
        <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
          Provisioned Arc Treasury Wallet
        </span>
        <div className="flex items-center justify-between gap-2 p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-mono text-xs">
          <span className="truncate text-slate-800 dark:text-slate-200">
            {fundingResult.walletAddress}
          </span>
          <button
            type="button"
            onClick={() => handleCopy(fundingResult.walletAddress, "address")}
            className="px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-[11px] font-semibold flex items-center gap-1 shrink-0 cursor-pointer"
          >
            {copiedField === "address" ? (
              <Check className="h-3 w-3 text-emerald-500" />
            ) : (
              <Copy className="h-3 w-3" />
            )}
            <span>{copiedField === "address" ? "Copied" : "Copy"}</span>
          </button>
        </div>
      </div>

      <div className="flex justify-end pt-2">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs transition-colors"
        >
          <span>Go to Overview</span>
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </div>
  );
}
