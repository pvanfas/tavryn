"use client";

import {
  AlertCircle,
  AlertTriangle,
  Building2,
  CheckCircle2,
  Lock,
  ShieldCheck,
} from "lucide-react";
import React, { use, useEffect, useState } from "react";

import { H1, H2, Mono } from "@/components/ui/text";
import { OVERRIDE_REASON_CODES } from "@/lib/override-memory";

interface ApprovalTokenPayload {
  token: string;
  expiresAt: string;
  action: string;
  contract: {
    id: string;
    service: string;
    category: string;
    baselinePrice: number;
    proposedPrice: number;
    annualSavings: number;
    savingsPct: number;
    vendor?: { name: string; is_simulated: boolean } | null;
    business?: { id: string; name: string } | null;
  };
}

export default function OneTapApprovalPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const resolvedParams = use(params);
  const token = resolvedParams.token;

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<ApprovalTokenPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [completedStatus, setCompletedStatus] = useState<
    "approved" | "rejected" | null
  >(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Rejection Form State
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [selectedReasonCode, setSelectedReasonCode] = useState<string>(
    OVERRIDE_REASON_CODES[0],
  );
  const [rejectionNotes, setRejectionNotes] = useState("");

  useEffect(() => {
    let isMounted = true;
    async function loadTokenData() {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch(`/api/approve/${token}`);
        const j = await res.json();
        if (!res.ok) {
          throw new Error(j.error || "Approval link is invalid or expired");
        }
        if (isMounted) {
          setData(j);
        }
      } catch (err) {
        if (isMounted) {
          setError((err as Error).message);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    loadTokenData();
    return () => {
      isMounted = false;
    };
  }, [token]);

  const handleDecision = async (action: "approve" | "reject") => {
    try {
      setSubmitting(true);
      setError(null);
      const res = await fetch(`/api/approve/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          reasonCode: action === "reject" ? selectedReasonCode : undefined,
          reason: action === "reject" ? rejectionNotes : undefined,
        }),
      });

      const j = await res.json();
      if (!res.ok) {
        throw new Error(j.error || `Failed to ${action} transaction`);
      }

      setCompletedStatus(action === "approve" ? "approved" : "rejected");
      setSuccessMessage(j.message);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-6 text-slate-100">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-xs text-slate-400">Verifying signed token...</p>
        </div>
      </div>
    );
  }

  const contract = data?.contract;

  return (
    <div className="min-h-screen bg-[#f7f9f8] dark:bg-[#0b0f0d] text-slate-800 dark:text-slate-100 flex flex-col items-center justify-center p-4 sm:p-6 font-sans transition-colors">
      <div className="w-full max-w-xl space-y-6">
        {/* Brand Header */}
        <div className="text-center space-y-1">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[#107e65] dark:text-emerald-400 text-xs font-semibold">
            <Lock className="h-3.5 w-3.5" />
            <span>Cryptographic One-Tap Authorization</span>
          </div>
          <H1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            Procurement Supervisor Approval
          </H1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Authenticated via single-use signed HMAC link
          </p>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="p-4 rounded-xl border border-rose-500/30 bg-rose-50 dark:bg-rose-950/20 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2.5">
            <AlertCircle className="h-5 w-5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Success Completed Card */}
        {completedStatus ? (
          <div className="p-6 rounded-2xl border border-emerald-500/30 bg-white dark:bg-emerald-950/20 text-center space-y-4 shadow-xl">
            <div className="inline-flex p-3 rounded-full bg-emerald-500/10 dark:bg-emerald-500/20 text-[#107e65] dark:text-emerald-400">
              <CheckCircle2 className="h-8 w-8" />
            </div>
            <H2 className="text-lg font-bold text-slate-900 dark:text-white">
              {completedStatus === "approved"
                ? "Transaction Authorized"
                : "Transaction Rejected"}
            </H2>
            <p className="text-xs text-slate-600 dark:text-slate-300 max-w-md mx-auto">
              {successMessage}
            </p>
            <div className="pt-3 border-t border-slate-200 dark:border-slate-800 text-[11px] text-slate-500 font-mono">
              Action permanently committed to immutable audit trail.
            </div>
          </div>
        ) : contract ? (
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#121915] p-6 space-y-6 shadow-xl">
            {/* Header info */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-base text-slate-900 dark:text-white">
                    {contract.service}
                  </span>
                  <span className="capitalize text-[11px] px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-semibold border border-slate-200 dark:border-slate-700">
                    {contract.category}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 mt-1">
                  <Building2 className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500" />
                  <span>
                    {contract.business?.name || "Organization"} &bull; Vendor:{" "}
                    {contract.vendor?.name || contract.service}
                  </span>
                </div>
              </div>

              <div className="text-right">
                <span className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500 block">
                  Status
                </span>
                <span className="text-xs font-semibold text-amber-600 dark:text-amber-400">
                  Pending Sign-Off
                </span>
              </div>
            </div>

            {/* Price Delta Highlights */}
            <div className="grid grid-cols-3 gap-3">
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-center">
                <span className="text-[10px] uppercase tracking-wider text-slate-400 dark:text-slate-500 block font-semibold">
                  Baseline
                </span>
                <Mono className="text-sm text-slate-400 dark:text-slate-500 line-through mt-0.5">
                  ${contract.baselinePrice.toLocaleString()}
                </Mono>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-center">
                <span className="text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400 block font-semibold">
                  Negotiated
                </span>
                <Mono className="text-sm font-bold text-slate-900 dark:text-white mt-0.5">
                  ${contract.proposedPrice.toLocaleString()}
                </Mono>
              </div>

              <div className="p-3 rounded-xl bg-emerald-500/10 dark:bg-emerald-950/20 border border-emerald-500/20 text-center">
                <span className="text-[10px] uppercase tracking-wider text-[#107e65] dark:text-emerald-400 block font-semibold">
                  Savings
                </span>
                <Mono className="text-sm font-bold text-[#107e65] dark:text-emerald-400 mt-0.5">
                  +${contract.annualSavings.toLocaleString()} (
                  {contract.savingsPct}%)
                </Mono>
              </div>
            </div>

            {/* Policy Check Notice */}
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800/80 text-xs text-slate-600 dark:text-slate-400 flex items-center gap-2.5">
              <ShieldCheck className="h-4 w-4 text-[#107e65] dark:text-emerald-400 shrink-0" />
              <span>
                Deterministic policy verification passed. Amount exceeds auto
                spend ceiling, requiring supervisor confirmation.
              </span>
            </div>

            {/* Action Buttons */}
            {!showRejectForm ? (
              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowRejectForm(true)}
                  disabled={submitting}
                  className="flex-1 py-2.5 rounded-xl border border-rose-300 dark:border-rose-500/30 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/20 text-xs font-bold transition-all disabled:opacity-50 cursor-pointer"
                >
                  Reject Deal...
                </button>

                <button
                  type="button"
                  onClick={() => handleDecision("approve")}
                  disabled={submitting}
                  className="flex-1 py-2.5 rounded-xl bg-[#107e65] hover:bg-[#0d6853] dark:bg-emerald-600 dark:hover:bg-emerald-500 text-white text-xs font-bold transition-all shadow-md flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
                >
                  <Lock className="h-3.5 w-3.5" />
                  <span>
                    {submitting ? "Signing off..." : "Authorize & Lock Escrow"}
                  </span>
                </button>
              </div>
            ) : (
              /* Structured Rejection Feedback Form */
              <div className="space-y-3 pt-2 border-t border-slate-200 dark:border-slate-800">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                    <AlertTriangle className="h-3.5 w-3.5 text-rose-500 dark:text-rose-400" />
                    <span>Supervisor Feedback (Reason Code)</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowRejectForm(false)}
                    className="text-[11px] text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>

                <select
                  value={selectedReasonCode}
                  onChange={(e) => setSelectedReasonCode(e.target.value)}
                  className="w-full text-xs font-medium px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-rose-500"
                >
                  <option value="rate_too_high">Rate Too High</option>
                  <option value="need_longer_commitment">
                    Need Multi-Year Commitment
                  </option>
                  <option value="wrong_seat_count">
                    Wrong Seat Count / Unused Seats
                  </option>
                  <option value="vendor_unreliable">
                    Vendor Unreliable or Poor SLA
                  </option>
                  <option value="budget_freeze">Budget Frozen</option>
                  <option value="switch_preferred">
                    Prefer Competitive Alternative
                  </option>
                  <option value="other">Other</option>
                </select>

                <input
                  type="text"
                  placeholder="Optional guidance notes for future AI negotiations..."
                  value={rejectionNotes}
                  onChange={(e) => setRejectionNotes(e.target.value)}
                  className="w-full text-xs font-medium px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-rose-500"
                />

                <button
                  type="button"
                  onClick={() => handleDecision("reject")}
                  disabled={submitting}
                  className="w-full py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition-all shadow-md disabled:opacity-50 cursor-pointer"
                >
                  {submitting
                    ? "Recording Rejection..."
                    : "Confirm Rejection & Save Feedback"}
                </button>
              </div>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
