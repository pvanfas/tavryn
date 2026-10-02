"use client";

import {
  AlertOctagon,
  AlertTriangle,
  Check,
  CheckCircle2,
  Lock,
  RefreshCw,
  ShieldCheck,
  UserCheck,
  X,
} from "lucide-react";
import React from "react";

import { TransactionHashBadge } from "@/components/TransactionHashBadge";
import { BodySmall, Caption, H2 } from "@/components/ui/text";

import { VerificationData } from "./types";

interface VendorVerificationSectionProps {
  verification: VerificationData | null;
  verifying: boolean;
  releaseLoading: boolean;
  submitting: boolean;
  selectedTamper: null | "price" | "seats";
  verificationError: string | null;
  verificationSuccess: string | null;
  onSelectTamper: (tamper: null | "price" | "seats") => void;
  onRunVerification: (
    tamper: null | "price" | "seats",
    action: "verify" | "release",
  ) => void;
  onEscalateToHuman: () => void;
}

export function VendorVerificationSection({
  verification,
  verifying,
  releaseLoading,
  submitting,
  selectedTamper,
  verificationError,
  verificationSuccess,
  onSelectTamper,
  onRunVerification,
  onEscalateToHuman,
}: VendorVerificationSectionProps) {
  return (
    <div className="mt-8 pt-8 border-t border-slate-100 dark:border-slate-800/70">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
        <div>
          <H2 className="text-slate-900 dark:text-white">
            Vendor Confirmation &amp; Escrow Release
          </H2>
          <BodySmall className="text-slate-500 dark:text-slate-400 mt-0.5">
            LLM extracts confirmation fields into strict schema; deterministic
            code verifies every field before releasing Arc USDC.
          </BodySmall>
        </div>

        {/* Tamper Simulator Selector */}
        <div className="flex flex-wrap sm:flex-nowrap items-center gap-1.5 p-1 rounded-xl bg-slate-100/80 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60 w-full sm:w-auto">
          <button
            type="button"
            onClick={() => {
              onSelectTamper(null);
              onRunVerification(null, "verify");
            }}
            className={`flex-1 sm:flex-none text-center px-2.5 py-1.5 sm:py-1 rounded-lg text-xs font-semibold transition-all ${
              selectedTamper === null
                ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-2xs"
                : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            Exact Match
          </button>
          <button
            type="button"
            onClick={() => {
              onSelectTamper("price");
              onRunVerification("price", "verify");
            }}
            className={`flex-1 sm:flex-none text-center px-2.5 py-1.5 sm:py-1 rounded-lg text-xs font-semibold transition-all ${
              selectedTamper === "price"
                ? "bg-rose-500/10 text-rose-700 dark:text-rose-300 border border-rose-500/20 font-bold"
                : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            Tamper: Price
          </button>
          <button
            type="button"
            onClick={() => {
              onSelectTamper("seats");
              onRunVerification("seats", "verify");
            }}
            className={`flex-1 sm:flex-none text-center px-2.5 py-1.5 sm:py-1 rounded-lg text-xs font-semibold transition-all ${
              selectedTamper === "seats"
                ? "bg-rose-500/10 text-rose-700 dark:text-rose-300 border border-rose-500/20 font-bold"
                : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            Tamper: Seats
          </button>
        </div>
      </div>

      {/* Action Buttons & Status Feedback */}
      {verificationError && (
        <div className="mb-4 p-3.5 rounded-xl border border-rose-200 dark:border-rose-900/60 bg-rose-50/70 dark:bg-rose-950/20 text-rose-700 dark:text-rose-300 text-xs font-semibold flex items-center gap-2">
          <AlertOctagon className="h-4 w-4 shrink-0" />
          <span>{verificationError}</span>
        </div>
      )}

      {verificationSuccess && (
        <div className="mb-4 p-3.5 rounded-xl border border-emerald-200 dark:border-emerald-800/60 bg-emerald-50/70 dark:bg-emerald-950/20 text-[#107e65] dark:text-[#34d399] text-xs font-semibold flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>{verificationSuccess}</span>
        </div>
      )}

      {/* Desktop Verification Checklist Table */}
      <div className="hidden sm:block overflow-x-auto rounded-xl border border-slate-200/70 dark:border-slate-800/60 shadow-2xs">
        <table className="w-full text-left text-xs font-sans border-collapse">
          <thead>
            <tr className="border-b border-slate-200/70 dark:border-slate-800/60 bg-slate-50/70 dark:bg-[#141b18]/60 text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              <Caption as="th" className="py-3.5 px-4 w-28 text-center">
                Status
              </Caption>
              <Caption as="th" className="py-3.5 px-4 min-w-[180px]">
                Contract Term
              </Caption>
              <Caption as="th" className="py-3.5 px-4 min-w-[140px]">
                Negotiated Agreement
              </Caption>
              <Caption as="th" className="py-3.5 px-4 min-w-[140px]">
                Vendor Confirmation
              </Caption>
              <Caption as="th" className="py-3.5 px-4">
                Verification Audit
              </Caption>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50 bg-white/70 dark:bg-[#111714]/70">
            {verification?.checks && verification.checks.length > 0 ? (
              verification.checks.map((chk, i) => (
                <tr
                  key={i}
                  className="hover:bg-emerald-500/[0.03] dark:hover:bg-emerald-500/[0.04] transition-colors"
                >
                  <td className="py-3.5 px-4 text-center">
                    {chk.passed ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-[#107e65] dark:text-[#34d399] border border-emerald-500/20">
                        <Check className="h-3 w-3 stroke-[2.5]" />
                        <span>Match</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-700 dark:text-rose-300 border border-rose-500/20">
                        <X className="h-3 w-3 stroke-[2.5]" />
                        <span>Mismatch</span>
                      </span>
                    )}
                  </td>
                  <td className="py-3.5 px-4 font-bold text-slate-900 dark:text-white">
                    {chk.name}
                  </td>
                  <td className="py-3.5 px-4 font-mono font-semibold text-slate-700 dark:text-slate-300">
                    {chk.field === "price"
                      ? `$${Number(chk.expected).toLocaleString()}`
                      : chk.field === "seats"
                        ? `${chk.expected} seats`
                        : chk.field === "term_months"
                          ? `${chk.expected} months`
                          : String(chk.expected)}
                  </td>
                  <td className="py-3.5 px-4 font-mono font-semibold text-slate-900 dark:text-white">
                    {chk.field === "price"
                      ? `$${Number(chk.actual).toLocaleString()}`
                      : chk.field === "seats"
                        ? `${chk.actual} seats`
                        : chk.field === "term_months"
                          ? `${chk.actual} months`
                          : String(chk.actual)}
                  </td>
                  <td className="py-3.5 px-4 font-medium text-slate-600 dark:text-slate-300">
                    {chk.message}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td
                  colSpan={5}
                  className="py-8 text-center text-slate-400 dark:text-slate-500 font-medium"
                >
                  Click &quot;Verify Vendor Confirmation&quot; below to trigger
                  extraction and comparison.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile Verification Checklist Cards */}
      <div className="sm:hidden space-y-2.5">
        {verification?.checks && verification.checks.length > 0 ? (
          verification.checks.map((chk, i) => (
            <div
              key={i}
              className="p-3.5 rounded-xl border border-slate-200/70 dark:border-slate-800/60 bg-white/70 dark:bg-[#111714]/70 shadow-2xs flex flex-col gap-2.5"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-bold text-xs text-slate-900 dark:text-white">
                  {chk.name}
                </span>
                {chk.passed ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-2xs font-semibold bg-emerald-500/10 text-[#107e65] dark:text-[#34d399] border border-emerald-500/20 shrink-0">
                    <Check className="h-3 w-3 stroke-[2.5]" />
                    <span>Match</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-2xs font-semibold bg-rose-500/10 text-rose-700 dark:text-rose-300 border border-rose-500/20 shrink-0">
                    <X className="h-3 w-3 stroke-[2.5]" />
                    <span>Mismatch</span>
                  </span>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2 p-2.5 rounded-lg bg-slate-50/70 dark:bg-slate-900/40 border border-slate-100 dark:border-slate-800/60 text-xs">
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold mb-0.5">
                    Negotiated
                  </div>
                  <div className="font-mono font-semibold text-slate-700 dark:text-slate-300 truncate">
                    {chk.field === "price"
                      ? `$${Number(chk.expected).toLocaleString()}`
                      : chk.field === "seats"
                        ? `${chk.expected} seats`
                        : chk.field === "term_months"
                          ? `${chk.expected} months`
                          : String(chk.expected)}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold mb-0.5">
                    Vendor Actual
                  </div>
                  <div className="font-mono font-semibold text-slate-900 dark:text-white truncate">
                    {chk.field === "price"
                      ? `$${Number(chk.actual).toLocaleString()}`
                      : chk.field === "seats"
                        ? `${chk.actual} seats`
                        : chk.field === "term_months"
                          ? `${chk.actual} months`
                          : String(chk.actual)}
                  </div>
                </div>
              </div>

              <p className="text-xs font-medium text-slate-600 dark:text-slate-300">
                {chk.message}
              </p>
            </div>
          ))
        ) : (
          <div className="p-6 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 text-center text-xs text-slate-400 font-medium">
            Click &quot;Verify Vendor Confirmation&quot; below to trigger
            extraction and comparison.
          </div>
        )}
      </div>

      {/* Bottom Release / Dispute Action Bar */}
      <div className="mt-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 p-4 rounded-xl border border-slate-200/70 dark:border-slate-800/60 bg-slate-50/60 dark:bg-[#141c18]/60">
        <div className="flex flex-wrap items-center gap-2.5 sm:gap-3 min-w-0">
          {verification?.transaction?.status === "completed" ||
          verification?.transaction?.status === "released" ||
          verification?.transaction?.status === "simulation-only" ? (
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border shrink-0 ${
                  verification?.transaction?.is_simulated ||
                  verification?.transaction?.status === "simulation-only"
                    ? "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20"
                    : "bg-emerald-500/10 text-[#107e65] dark:text-[#34d399] border-emerald-500/20"
                }`}
              >
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                {verification?.transaction?.is_simulated ||
                verification?.transaction?.status === "simulation-only"
                  ? "Simulated Settlement Completed"
                  : "Escrow Released on Arc"}
              </span>
              {verification?.transaction?.tx_hash && (
                <TransactionHashBadge
                  txHash={verification.transaction.tx_hash}
                  isSimulated={verification.transaction.is_simulated}
                  status={verification.transaction.status}
                />
              )}
            </div>
          ) : verification?.allPassed === false ||
            verification?.transaction?.status === "disputed" ? (
            <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-500/10 text-rose-700 dark:text-rose-300 border border-rose-500/20 shrink-0 self-start sm:self-auto">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                Status: Disputed
              </span>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                Requires human supervisor sign-off before releasing funds.
              </span>
            </div>
          ) : verification?.allPassed ? (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-[#107e65] dark:text-[#34d399] border border-emerald-500/20 shrink-0">
              <ShieldCheck className="h-4 w-4 shrink-0" />
              All Checks Cleared
            </span>
          ) : (
            <span className="text-xs text-slate-500 dark:text-slate-400">
              Run verification before releasing escrow payment.
            </span>
          )}
        </div>

        <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-2.5 w-full lg:w-auto">
          <button
            type="button"
            disabled={verifying}
            onClick={() => onRunVerification(selectedTamper, "verify")}
            className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 sm:py-2 rounded-xl border border-slate-200/80 dark:border-slate-700/80 bg-white dark:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shadow-2xs disabled:opacity-50 w-full sm:w-auto cursor-pointer"
          >
            <RefreshCw
              className={`h-3.5 w-3.5 shrink-0 ${verifying ? "animate-spin" : ""}`}
            />
            <span className="truncate">
              {verifying ? "Extracting & Verifying..." : "Verify Confirmation"}
            </span>
          </button>

          {verification?.allPassed === false && (
            <button
              type="button"
              disabled={submitting}
              onClick={onEscalateToHuman}
              className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 sm:py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold transition-colors shadow-2xs disabled:opacity-50 w-full sm:w-auto cursor-pointer"
            >
              <UserCheck className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">Escalate to Human</span>
            </button>
          )}

          <button
            type="button"
            disabled={
              !verification?.allPassed ||
              verification?.transaction?.status === "completed" ||
              releaseLoading
            }
            onClick={() => onRunVerification(selectedTamper, "release")}
            className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 sm:py-2 rounded-xl bg-[#107e65] hover:bg-[#0d6b55] text-white text-xs font-bold transition-colors shadow-2xs disabled:opacity-40 disabled:cursor-not-allowed w-full sm:w-auto cursor-pointer"
          >
            <Lock className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">
              {releaseLoading
                ? "Releasing Arc USDC..."
                : verification?.transaction?.status === "completed"
                  ? "Payment Released"
                  : "Release Escrow (Arc USDC)"}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
