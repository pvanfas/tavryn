"use client";

import { ArrowRight, Loader2 } from "lucide-react";
import React from "react";

import { PolicyConfig } from "@/lib/schemas";

interface PolicyConfigurationFormProps {
  policy: PolicyConfig;
  setPolicy: React.Dispatch<React.SetStateAction<PolicyConfig>>;
  validActiveRowsCount: number;
  isSubmitting: boolean;
  onCommit: () => void;
}

export function PolicyConfigurationForm({
  policy,
  setPolicy,
  validActiveRowsCount,
  isSubmitting,
  onCommit,
}: PolicyConfigurationFormProps) {
  return (
    <div className="space-y-4 pt-4 border-t border-slate-100 dark:border-slate-800">
      <h2 className="text-sm font-bold text-slate-900 dark:text-white">
        Deterministic Policy Limits
      </h2>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
        <div className="p-4 rounded-xl border border-slate-200/70 dark:border-slate-800/60 bg-slate-50/50 dark:bg-slate-800/40">
          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
            Max Autonomous Transaction ($)
          </label>
          <input
            type="number"
            value={policy.max_auto_transaction}
            onChange={(e) =>
              setPolicy({
                ...policy,
                max_auto_transaction: Number(e.target.value),
              })
            }
            className="w-full text-xs font-bold px-3 py-2 rounded-lg border border-slate-200/80 dark:border-slate-700/80 bg-white dark:bg-slate-900 font-mono text-slate-900 dark:text-white"
          />
        </div>

        <div className="p-4 rounded-xl border border-slate-200/70 dark:border-slate-800/60 bg-slate-50/50 dark:bg-slate-800/40">
          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
            Minimum Savings Threshold ($)
          </label>
          <input
            type="number"
            value={policy.min_savings}
            onChange={(e) =>
              setPolicy({
                ...policy,
                min_savings: Number(e.target.value),
              })
            }
            className="w-full text-xs font-bold px-3 py-2 rounded-lg border border-slate-200/80 dark:border-slate-700/80 bg-white dark:bg-slate-900 font-mono text-slate-900 dark:text-white"
          />
        </div>

        <div className="p-4 rounded-xl border border-slate-200/70 dark:border-slate-800/60 bg-slate-50/50 dark:bg-slate-800/40">
          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
            Human Approval Required Above ($)
          </label>
          <input
            type="number"
            value={policy.human_approval_required_above}
            onChange={(e) =>
              setPolicy({
                ...policy,
                human_approval_required_above: Number(e.target.value),
              })
            }
            className="w-full text-xs font-bold px-3 py-2 rounded-lg border border-slate-200/80 dark:border-slate-700/80 bg-white dark:bg-slate-900 font-mono text-slate-900 dark:text-white"
          />
        </div>
      </div>

      {/* Commit Button */}
      <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
        <span className="text-xs text-slate-500 dark:text-slate-400">
          {validActiveRowsCount} subscription
          {validActiveRowsCount === 1 ? "" : "s"} ready to commit
        </span>

        <button
          type="button"
          onClick={onCommit}
          disabled={isSubmitting || validActiveRowsCount === 0}
          className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs hover:shadow transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Provisioning Organization &amp; Contracts...</span>
            </>
          ) : (
            <>
              <span>Commit Subscriptions &amp; Fund Treasury</span>
              <ArrowRight className="h-4 w-4" />
            </>
          )}
        </button>
      </div>
    </div>
  );
}
