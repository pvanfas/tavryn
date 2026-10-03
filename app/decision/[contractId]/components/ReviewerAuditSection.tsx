"use client";

import { AlertTriangle, Bot, CheckCircle2, RefreshCw, XCircle } from "lucide-react";
import React from "react";

import { DecisionData } from "./types";

interface ReviewerAuditSectionProps {
  review?: DecisionData["review"];
  reviewing: boolean;
  onRunReviewer: () => void;
}

export function ReviewerAuditSection({
  review,
  reviewing,
  onRunReviewer,
}: ReviewerAuditSectionProps) {
  return (
    <div className="mt-8 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 bg-white/95 dark:bg-[#111714] p-5 sm:p-6 shadow-2xs">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800/70 pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400">
            <Bot className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Reviewer Agent: Dual-LLM Cross-Check
              </h3>
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-700 dark:text-purple-300 border border-purple-500/20">
                Independent Auditor
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Adversarial second agent reviews deal terms, seat waste, and
              benchmark fairness before escrow funding.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onRunReviewer}
          disabled={reviewing}
          className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl border border-purple-200 dark:border-purple-800/80 bg-purple-50/50 dark:bg-purple-950/20 hover:bg-purple-100 dark:hover:bg-purple-950/40 text-purple-700 dark:text-purple-300 text-xs font-bold transition-all shadow-2xs disabled:opacity-50 cursor-pointer shrink-0"
        >
          <RefreshCw
            className={`h-3.5 w-3.5 shrink-0 ${reviewing ? "animate-spin" : ""}`}
          />
          <span>
            {reviewing
              ? "Auditing Deal..."
              : review
                ? "Re-Run Audit"
                : "Run Reviewer Cross-Check"}
          </span>
        </button>
      </div>

      {review ? (
        <div className="mt-4 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl border border-slate-200/70 dark:border-slate-800/60 bg-slate-50/60 dark:bg-[#141b18]/60">
            <div className="flex flex-col sm:flex-row sm:items-center gap-2.5 min-w-0">
              {review.verdict === "agree" ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-[#107e65] dark:text-[#34d399] border border-emerald-500/20">
                  <CheckCircle2 className="h-4 w-4" />
                  <span>Verdict: AGREE</span>
                </span>
              ) : review.verdict === "challenge" ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20">
                  <AlertTriangle className="h-4 w-4" />
                  <span>Verdict: CHALLENGE</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-500/10 text-rose-700 dark:text-rose-300 border border-rose-500/20">
                  <XCircle className="h-4 w-4" />
                  <span>Verdict: REJECT / ESCALATE</span>
                </span>
              )}

              <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                {review.verdict === "agree"
                  ? "Deal terms cleared by adversarial auditor without reservation."
                  : review.verdict === "challenge"
                    ? "Auditor recommends re-negotiating before final execution."
                    : "High risk identified — supervisor intervention strongly advised."}
              </span>
            </div>

            <div className="text-[11px] font-mono text-slate-400 dark:text-slate-500 shrink-0">
              Model: {review.model}
            </div>
          </div>

          {review.concerns && review.concerns.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Identified Commercial &amp; Utilization Concerns:
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {review.concerns.map((c, i) => (
                  <div
                    key={i}
                    className="p-3 rounded-xl border border-slate-200/70 dark:border-slate-800/60 bg-white dark:bg-slate-900/40 text-xs space-y-1"
                  >
                    <div className="flex items-center justify-between">
                      <span
                        className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md ${
                          c.severity === "high"
                            ? "bg-rose-500/10 text-rose-700 dark:text-rose-300 border border-rose-500/20"
                            : c.severity === "medium"
                              ? "bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20"
                              : "bg-blue-500/10 text-blue-700 dark:text-blue-300 border border-blue-500/20"
                        }`}
                      >
                        {c.severity} Severity
                      </span>
                    </div>
                    <p className="text-slate-800 dark:text-slate-200 font-medium">
                      {c.issue}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {review.suggested_action && (
            <div className="p-3 rounded-xl bg-purple-50/40 dark:bg-purple-950/20 border border-purple-200/60 dark:border-purple-800/40 text-xs">
              <span className="font-bold text-purple-900 dark:text-purple-300">
                Recommended Supervisor Action:{" "}
              </span>
              <span className="text-purple-800 dark:text-purple-200">
                {review.suggested_action}
              </span>
            </div>
          )}
        </div>
      ) : (
        <div className="mt-4 p-4 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 text-center text-xs text-slate-400">
          No adversarial audit recorded for this negotiation yet. Click &quot;Run
          Reviewer Cross-Check&quot; above to trigger independent verification.
        </div>
      )}
    </div>
  );
}
