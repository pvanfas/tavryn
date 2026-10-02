"use client";

import {
  ArrowRight,
  Check,
  CheckCircle2,
  Coins,
  FileText,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import React from "react";

import { AgentIcon } from "@/components/AgentIcon";
import { Caption, Mono } from "@/components/ui/text";

import { SAMPLE_REPLIES } from "./SampleReplies";
import { NegotiationData, ReplyProcessResult } from "./types";

interface InboundReplyCardProps {
  contractId: string;
  replyText: string;
  processingReply: boolean;
  recordingSavings: boolean;
  extractedResult: ReplyProcessResult | null;
  negotiation: NegotiationData | null;
  onReplyTextChange: (text: string) => void;
  onProcessReply: () => void;
  onRecordSavingsWithoutPayment: () => void;
}

export function InboundReplyCard({
  contractId,
  replyText,
  processingReply,
  recordingSavings,
  extractedResult,
  negotiation,
  onReplyTextChange,
  onProcessReply,
  onRecordSavingsWithoutPayment,
}: InboundReplyCardProps) {
  return (
    <div className="rounded-xl border border-slate-200/70 dark:border-slate-800/60 bg-gradient-to-br from-slate-50/50 via-white to-slate-50/30 dark:from-[#111714] dark:via-[#131b17] dark:to-[#0f1412] p-5 shadow-2xs">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800/70">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
            <FileText className="h-4 w-4" />
          </div>
          <div>
            <h3 className="font-bold text-sm text-slate-900 dark:text-white">
              Step 2: Paste Vendor Reply
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Paste the raw email or message received from the vendor. Tavryn
              deterministically extracts counter terms and payment conditions.
            </p>
          </div>
        </div>

        {/* Quick Presets */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[11px] font-semibold text-slate-400 dark:text-slate-500">
            Presets:
          </span>
          {SAMPLE_REPLIES.map((sample, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => onReplyTextChange(sample.text)}
              className="px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-[11px] font-medium text-slate-700 dark:text-slate-300 transition-colors cursor-pointer"
            >
              {sample.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4 space-y-3">
        <textarea
          value={replyText}
          onChange={(e) => onReplyTextChange(e.target.value)}
          placeholder="Paste email response from vendor account executive here..."
          rows={5}
          className="w-full text-xs font-mono p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-[#107e65] resize-y"
        />

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <span className="text-[11px] text-slate-500">
            Extracts price, seat constraints, commitment duration, and USDC
            acceptability.
          </span>

          <button
            type="button"
            onClick={onProcessReply}
            disabled={processingReply || !replyText.trim()}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-[#107e65] hover:bg-[#0d6b55] text-white text-xs font-bold shadow-xs disabled:opacity-50 transition-colors w-full sm:w-auto shrink-0 cursor-pointer"
          >
            {processingReply ? (
              <>
                <div className="h-3 w-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Extracting &amp; Evaluating...</span>
              </>
            ) : (
              <>
                <AgentIcon className="h-3.5 w-3.5" />
                <span>Process &amp; Extract Terms</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Extraction Results & Decision */}
      {extractedResult && (
        <div className="mt-5 pt-4 border-t border-slate-200/60 dark:border-slate-800/60 space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-2">
              <CheckCircle2 className="h-3.5 w-3.5 text-[#107e65]" />
              Deterministic Schema Extraction
            </h4>
            <span
              className={`text-xs font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider ${
                extractedResult.decision === "agreed"
                  ? "bg-emerald-500/10 text-[#107e65] dark:text-[#34d399] border border-emerald-500/20"
                  : extractedResult.decision === "usdc_refused"
                    ? "bg-purple-500/10 text-purple-700 dark:text-purple-300 border border-purple-500/20"
                    : extractedResult.decision === "walk_away"
                      ? "bg-amber-500/10 text-amber-800 dark:text-amber-300 border border-amber-500/20"
                      : "bg-blue-500/10 text-blue-700 dark:text-blue-300 border border-blue-500/20"
              }`}
            >
              Decision: {extractedResult.decision}
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
              <Caption className="text-slate-400">Extracted Counter</Caption>
              <Mono
                as="p"
                className="text-sm font-bold text-slate-900 dark:text-white mt-1"
              >
                {extractedResult.extraction.counter_offer
                  ? `$${extractedResult.extraction.counter_offer.toLocaleString()}`
                  : "None"}
              </Mono>
            </div>

            <div className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
              <Caption className="text-slate-400">Seats & Term</Caption>
              <Mono
                as="p"
                className="text-sm font-bold text-slate-900 dark:text-white mt-1"
              >
                {extractedResult.extraction.seats || "—"} seats /{" "}
                {extractedResult.extraction.commitment_months || 12} mo
              </Mono>
            </div>

            <div className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
              <Caption className="text-slate-400">Accepts USDC</Caption>
              <div className="mt-1">
                {extractedResult.extraction.accepts_usdc ? (
                  <span className="inline-flex items-center gap-1 font-bold text-[#107e65] dark:text-[#34d399]">
                    <Coins className="h-3 w-3" /> Yes (Arc Escrow)
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 font-bold text-purple-600 dark:text-purple-400">
                    <XCircle className="h-3 w-3" /> ACH / Wire Only
                  </span>
                )}
              </div>
            </div>

            <div className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
              <Caption className="text-slate-400">Negotiation Round</Caption>
              <Mono
                as="p"
                className="text-sm font-bold text-slate-900 dark:text-white mt-1"
              >
                Round {negotiation?.rounds || 1} / 5
              </Mono>
            </div>
          </div>

          {/* Agent Assessment Narrative */}
          <div className="p-3.5 rounded-lg bg-slate-50 dark:bg-slate-900/60 border border-slate-200/70 dark:border-slate-800/70 text-xs">
            <span className="font-bold text-slate-900 dark:text-white">
              Agent Reason:{" "}
            </span>
            <span className="text-slate-600 dark:text-slate-300">
              {extractedResult.reason}
            </span>
          </div>

          {/* Decision Next Step Actions */}
          {extractedResult.decision === "agreed" &&
            extractedResult.extraction.accepts_usdc && (
              <div className="p-4 rounded-xl border border-emerald-200 bg-emerald-50/60 dark:bg-emerald-950/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h4 className="text-xs font-bold text-[#107e65] dark:text-[#34d399] flex items-center gap-1.5">
                    <CheckCircle2 className="h-4 w-4" />
                    Terms Agreed With USDC Settlement
                  </h4>
                  <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">
                    Counter-offer adheres to deterministic budget ceiling. Ready
                    for policy check, attestation, Arc escrow, and verified
                    release.
                  </p>
                </div>
                <Link
                  href={`/decision/${contractId}`}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#107e65] hover:bg-[#0d6b55] text-white text-xs font-bold shadow-xs transition-colors shrink-0"
                >
                  <span>Proceed to Escrow &amp; Settlement</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            )}

          {(!extractedResult.extraction.accepts_usdc ||
            extractedResult.decision === "usdc_refused") && (
            <div className="p-4 rounded-xl border border-purple-200 bg-purple-50/60 dark:bg-purple-950/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h4 className="text-xs font-bold text-purple-700 dark:text-purple-300 flex items-center gap-1.5">
                  <Coins className="h-4 w-4" />
                  Non-USDC Vendor (Off-Chain Settlement)
                </h4>
                <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">
                  The vendor agreed to discounted renewal pricing but requires
                  traditional billing (ACH / Wire). Tavryn captures the savings
                  in business traction metrics without locking on-chain funds.
                </p>
              </div>
              <button
                type="button"
                onClick={onRecordSavingsWithoutPayment}
                disabled={
                  recordingSavings ||
                  negotiation?.status === "savings_recorded_no_payment"
                }
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-purple-700 hover:bg-purple-800 text-white text-xs font-bold shadow-xs disabled:opacity-50 transition-colors shrink-0 cursor-pointer"
              >
                {recordingSavings ? (
                  <>
                    <div className="h-3 w-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Recording...</span>
                  </>
                ) : (
                  <>
                    <Check className="h-3.5 w-3.5" />
                    <span>
                      {negotiation?.status === "savings_recorded_no_payment"
                        ? "Savings Recorded"
                        : "Record Savings Without Payment"}
                    </span>
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
