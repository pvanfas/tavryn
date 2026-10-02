"use client";

import { Check, CheckCircle2, Copy, Mail } from "lucide-react";
import React from "react";

import { AgentIcon } from "@/components/AgentIcon";
import { Mono } from "@/components/ui/text";

import { DraftEmailData } from "./types";

interface DraftEmailCardProps {
  draftEmail: DraftEmailData | null;
  draftingEmail: boolean;
  emailApproved: boolean;
  copiedEmail: boolean;
  onDraftEmail: () => void;
  onCopyEmail: () => void;
  onApproveEmail: () => void;
}

export function DraftEmailCard({
  draftEmail,
  draftingEmail,
  emailApproved,
  copiedEmail,
  onDraftEmail,
  onCopyEmail,
  onApproveEmail,
}: DraftEmailCardProps) {
  return (
    <div className="rounded-xl border border-slate-200/70 dark:border-slate-800/60 bg-gradient-to-br from-slate-50/50 via-white to-slate-50/30 dark:from-[#111714] dark:via-[#131b17] dark:to-[#0f1412] p-5 shadow-2xs">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800/70">
        <div className="flex items-start sm:items-center gap-2.5">
          <div className="p-2 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 shrink-0 mt-0.5 sm:mt-0">
            <Mail className="h-4 w-4" />
          </div>
          <div>
            <h3 className="font-bold text-sm text-slate-900 dark:text-white flex flex-wrap items-center gap-1.5 sm:gap-2">
              <span>Step 1: Agent Draft Outreach Email</span>
              <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-blue-500/10 text-blue-700 dark:text-blue-300 border border-blue-500/20">
                Human-in-the-Loop Guardrail
              </span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Agent constructs targeted email citing telemetry and benchmarks.
              Real emails are NEVER dispatched automatically.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onDraftEmail}
          disabled={draftingEmail}
          className="inline-flex items-center justify-center gap-2 px-3.5 py-2 rounded-lg bg-[#107e65] hover:bg-[#0d6b55] text-white text-xs font-bold shadow-xs disabled:opacity-50 transition-colors w-full sm:w-auto shrink-0 cursor-pointer"
        >
          {draftingEmail ? (
            <>
              <div className="h-3 w-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
              <span>Drafting...</span>
            </>
          ) : (
            <>
              <AgentIcon className="h-3.5 w-3.5" />
              <span>
                {draftEmail ? "Regenerate Draft" : "Draft Outreach Email"}
              </span>
            </>
          )}
        </button>
      </div>

      {draftEmail ? (
        <div className="mt-4 space-y-3">
          <div className="rounded-lg border border-slate-200/70 dark:border-slate-800/70 bg-white dark:bg-slate-900/60 p-4 space-y-2 text-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-2 border-b border-slate-100 dark:border-slate-800 text-slate-600 dark:text-slate-400">
              <div className="truncate">
                <span className="font-semibold text-slate-900 dark:text-white">
                  To:{" "}
                </span>
                <Mono as="span">{draftEmail.to}</Mono>
              </div>
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={onCopyEmail}
                  className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1 px-2.5 py-1.5 sm:py-1 rounded border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 font-semibold text-slate-700 dark:text-slate-300 transition-colors cursor-pointer"
                >
                  {copiedEmail ? (
                    <Check className="h-3 w-3 text-emerald-600" />
                  ) : (
                    <Copy className="h-3 w-3" />
                  )}
                  <span>{copiedEmail ? "Copied" : "Copy Email"}</span>
                </button>

                <button
                  type="button"
                  onClick={onApproveEmail}
                  className={`flex-1 sm:flex-none inline-flex items-center justify-center gap-1 px-2.5 py-1.5 sm:py-1 rounded font-semibold text-xs transition-colors cursor-pointer ${
                    emailApproved
                      ? "bg-emerald-500/10 text-[#107e65] dark:text-[#34d399] border border-emerald-500/20"
                      : "bg-[#107e65] text-white hover:bg-[#0d6b55]"
                  }`}
                >
                  <CheckCircle2 className="h-3 w-3" />
                  <span>
                    {emailApproved ? "Approved" : "Approve & Mark Sent"}
                  </span>
                </button>
              </div>
            </div>

            <div>
              <span className="font-semibold text-slate-900 dark:text-white">
                Subject:{" "}
              </span>
              <span className="font-medium text-slate-800 dark:text-slate-200">
                {draftEmail.subject}
              </span>
            </div>

            <div className="pt-2 text-slate-700 dark:text-slate-300 whitespace-pre-line leading-relaxed font-sans bg-slate-50/70 dark:bg-slate-950/40 p-3.5 rounded-lg border border-slate-100 dark:border-slate-800">
              {draftEmail.body}
            </div>
          </div>

          {emailApproved && (
            <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-xs font-medium text-[#107e65] dark:text-[#34d399] flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              <span>
                Outreach email approved by human supervisor. Ready to ingest
                vendor reply below.
              </span>
            </div>
          )}
        </div>
      ) : (
        <div className="mt-4 p-4 text-center border border-dashed border-slate-200 dark:border-slate-800 rounded-lg text-xs text-slate-500">
          Click &quot;Draft Outreach Email&quot; above to have the agent review
          telemetry, calculate the target discount, and compose the opening
          communication.
        </div>
      )}
    </div>
  );
}
