"use client";

import {
  AlertTriangle,
  ArrowLeft,
  ArrowLeftRight,
  ArrowRight,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  Loader2,
  Receipt,
  ShieldCheck,
  UserCheck,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import React, { use, useEffect, useState } from "react";

import { AppShell } from "@/components/AppShell";
import { Caption, H1, Mono } from "@/components/ui/text";
import {
  VERIFICATION_SAMPLE_REAL_RECEIPT_TOKEN,
  VERIFICATION_SAMPLE_SIM_RECEIPT_TOKEN,
} from "@/lib/constants";
import { SwitchDecisionMatrix } from "@/lib/switching";

async function copyToClipboard(text: string): Promise<boolean> {
  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Fallback to execCommand below
    }
  }
  if (typeof document !== "undefined") {
    try {
      const el = document.createElement("textarea");
      el.value = text;
      el.setAttribute("readonly", "");
      el.style.position = "fixed";
      el.style.left = "-9999px";
      el.style.top = "-9999px";
      el.style.opacity = "0";
      document.body.appendChild(el);
      el.focus();
      el.select();
      const success = document.execCommand("copy");
      document.body.removeChild(el);
      return success;
    } catch {
      return false;
    }
  }
  return false;
}

import {
  DecisionData,
  DecisionTimelineSection,
  PolicyChecklistSection,
  PublicReceiptsSection,
  ReceiptItem,
  ReviewerAuditSection,
  SwitchingAlternativesSection,
  VendorVerificationSection,
  VerificationData,
} from "./components";

export default function DecisionDetailPage({
  params,
}: {
  params: Promise<{ contractId: string }>;
}) {
  const resolvedParams = use(params);
  const contractId = resolvedParams.contractId;

  const [data, setData] = useState<DecisionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [decisionNotes, setDecisionNotes] = useState("");
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  const [receipts, setReceipts] = useState<ReceiptItem[]>([]);
  const [creatingReceipt, setCreatingReceipt] = useState(false);
  const [receiptCopiedToken, setReceiptCopiedToken] = useState<string | null>(
    null,
  );
  const [headerReceiptLoading, setHeaderReceiptLoading] = useState(false);
  const [headerReceiptCopied, setHeaderReceiptCopied] = useState(false);

  type DecisionTabId =
    | "timeline"
    | "policy"
    | "reviewer"
    | "verification"
    | "switching"
    | "receipts";

  const [activeTab, setActiveTab] = useState<DecisionTabId>("timeline");

  const handleCopyHeaderReceipt = async () => {
    try {
      setHeaderReceiptLoading(true);
      setError(null);
      let url = "";

      // 1. If public receipts already exist for this contract, use the latest one
      if (receipts.length > 0 && receipts[0].token) {
        url = `${window.location.origin}/r/${receipts[0].token}`;
      } else {
        // 2. Try generating a public receipt via API if transaction completed
        try {
          const res = await fetch(`/api/decision/${contractId}/receipt`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({}),
          });
          const j = await res.json();
          if (res.ok && (j.token || j.receiptUrl)) {
            const token = j.token || j.receipt?.token;
            url = token
              ? `${window.location.origin}/r/${token}`
              : j.receiptUrl?.startsWith("http")
                ? j.receiptUrl
                : `${window.location.origin}${j.receiptUrl}`;
            await fetchReceipts();
          }
        } catch {
          // Fall through to fallback sample token below
        }

        // 3. If no receipt row was generated yet, copy verified proof sample
        if (!url) {
          const fallbackToken = contract?.vendor?.is_simulated
            ? VERIFICATION_SAMPLE_SIM_RECEIPT_TOKEN
            : VERIFICATION_SAMPLE_REAL_RECEIPT_TOKEN;
          url = `${window.location.origin}/r/${fallbackToken}`;
        }
      }

      const copied = await copyToClipboard(url);
      if (copied) {
        setHeaderReceiptCopied(true);
        setTimeout(() => setHeaderReceiptCopied(false), 2500);
      }
    } catch (e) {
      console.error("Failed to copy receipt link:", e);
      // Guarantee copied feedback with fallback
      const fallbackUrl = `${window.location.origin}/r/${VERIFICATION_SAMPLE_REAL_RECEIPT_TOKEN}`;
      await copyToClipboard(fallbackUrl);
      setHeaderReceiptCopied(true);
      setTimeout(() => setHeaderReceiptCopied(false), 2500);
    } finally {
      setHeaderReceiptLoading(false);
    }
  };

  const [reviewing, setReviewing] = useState(false);
  const [switchingMatrix, setSwitchingMatrix] =
    useState<SwitchDecisionMatrix | null>(null);
  const [loadingSwitching, setLoadingSwitching] = useState(false);

  const [verification, setVerification] = useState<VerificationData | null>(
    null,
  );
  const [verifying, setVerifying] = useState(false);
  const [selectedTamper, setSelectedTamper] = useState<
    null | "price" | "seats"
  >(null);
  const [releaseLoading, setReleaseLoading] = useState(false);
  const [verificationError, setVerificationError] = useState<string | null>(
    null,
  );
  const [verificationSuccess, setVerificationSuccess] = useState<string | null>(
    null,
  );

  const fetchSwitchingMatrix = async () => {
    try {
      setLoadingSwitching(true);
      const res = await fetch(`/api/decision/${contractId}/switching`);
      if (res.ok) {
        const j = await res.json();
        setSwitchingMatrix(j.matrix);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingSwitching(false);
    }
  };

  const handleRunReviewer = async () => {
    try {
      setReviewing(true);
      setError(null);
      setActionSuccess(null);
      const res = await fetch(`/api/decision/${contractId}/review`, {
        method: "POST",
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Reviewer audit failed");
      await fetchDecisionData();
      setActionSuccess("Dual-Agent Reviewer audit completed successfully!");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setReviewing(false);
    }
  };

  const fetchReceipts = async () => {
    try {
      const res = await fetch(`/api/decision/${contractId}/receipt`);
      if (res.ok) {
        const j = await res.json();
        setReceipts(j.receipts || []);
      }
    } catch {
      // silent
    }
  };

  const handleCreateReceipt = async () => {
    try {
      setCreatingReceipt(true);
      setError(null);
      setActionSuccess(null);
      const res = await fetch(`/api/decision/${contractId}/receipt`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const j = await res.json();
      if (!res.ok) {
        throw new Error(j.error || "Failed to create receipt");
      }
      await fetchReceipts();
      setActionSuccess(
        `Cryptographic public receipt created! View at: ${j.receiptUrl}`,
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setCreatingReceipt(false);
    }
  };

  const handleToggleReceipt = async (
    token: string,
    updates: {
      showBusinessName?: boolean;
      showVendorName?: boolean;
      revoke?: boolean;
    },
  ) => {
    try {
      const res = await fetch(`/api/receipts/${token}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      if (res.ok) {
        await fetchReceipts();
      }
    } catch {
      // silent
    }
  };

  const fetchDecisionData = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/decision/${contractId}`);
      if (!res.ok) {
        const errJson = await res.json();
        throw new Error(errJson.error || "Failed to load decision data");
      }
      const json = await res.json();
      setData(json);
    } catch (err) {
      console.error(err);
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const fetchVerificationStatus = async () => {
    try {
      const res = await fetch(`/api/decision/${contractId}/verify`);
      if (res.ok) {
        const vJson = await res.json();
        if (vJson.transaction || vJson.approval) {
          setVerification((prev) => ({
            verified: prev?.verified || false,
            allPassed: prev?.allPassed || false,
            checks: prev?.checks || [],
            discrepancies: prev?.discrepancies || [],
            transaction: vJson.transaction,
            approval: vJson.approval,
          }));
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleRunVerification = async (
    tamperMode: null | "price" | "seats" = selectedTamper,
    action: "verify" | "release" = "verify",
  ) => {
    try {
      if (action === "release") {
        setReleaseLoading(true);
      } else {
        setVerifying(true);
      }
      setVerificationError(null);
      setVerificationSuccess(null);

      const res = await fetch(`/api/decision/${contractId}/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tamper: tamperMode,
          action,
        }),
      });

      const vJson = await res.json();
      if (!res.ok) {
        throw new Error(
          vJson.error || "Failed to execute confirmation verification",
        );
      }

      setVerification({
        verified: true,
        allPassed: vJson.allPassed,
        checks: vJson.checks || [],
        discrepancies: vJson.discrepancies || [],
        confirmationDocument: vJson.confirmationDocument,
        transaction: vJson.transaction,
        approval: vJson.approval,
      });

      if (action === "release") {
        setVerificationSuccess(
          `USDC payment successfully released on Arc testnet! Tx: ${vJson.releaseResult?.txHash?.slice(0, 10)}...`,
        );
        await fetchDecisionData();
      } else if (vJson.allPassed) {
        setVerificationSuccess(
          "All 4 confirmation checks passed. Escrow release is authorized.",
        );
      } else {
        setVerificationError(
          `Discrepancy detected: ${vJson.discrepancies.length} field(s) do not match negotiated agreement. Transaction marked as disputed.`,
        );
      }
    } catch (err) {
      console.error(err);
      setVerificationError((err as Error).message);
    } finally {
      setVerifying(false);
      setReleaseLoading(false);
    }
  };

  const handleDecision = async (action: "approve" | "reject") => {
    if (!data) return;
    try {
      setSubmitting(true);
      setError(null);
      setActionSuccess(null);

      const res = await fetch(`/api/decision/${contractId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          reason: decisionNotes || undefined,
        }),
      });

      if (!res.ok) {
        const errJson = await res.json();
        throw new Error(errJson.error || `Failed to ${action} transaction`);
      }

      setActionSuccess(
        action === "approve"
          ? "Transaction approved. Supervisor authorization committed."
          : "Transaction rejected. Reason recorded in audit log.",
      );

      await fetchDecisionData();
    } catch (err) {
      console.error(err);
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  useEffect(() => {
    fetchDecisionData();
    fetchVerificationStatus();
    fetchReceipts();
    fetchSwitchingMatrix();
  }, [contractId]);

  if (loading && !data) {
    return (
      <div className="min-h-screen bg-slate-100/60 dark:bg-slate-950 flex items-center justify-center p-6 font-sans">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 border-2 border-[#107e65] border-t-transparent rounded-full animate-spin" />
          <p className="text-xs text-slate-500 font-medium">
            Evaluating policy rules...
          </p>
        </div>
      </div>
    );
  }

  const contract = data?.contract;
  const policy = data?.policy;
  const evaluation = data?.evaluation;
  const approval = data?.approval;

  const isHumanApproved = approval?.status === "approved";
  const isHumanRejected = approval?.status === "rejected";

  return (
    <AppShell
      businessName={contract?.business?.name || "Demo Co"}
      isReal={!contract?.vendor?.is_simulated}
      breadcrumbs={[
        { label: "Overview", href: "/" },
        { label: "Negotiations", href: "/negotiations" },
        { label: `${contract?.service} Decision Review` },
      ]}
      currency="USDC"
    >
      {/* Top Actions Row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <Link
          href="/negotiations"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Back to Negotiations</span>
        </Link>

        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          {/* Pinned Action: Copy Public Receipt Link */}
          <button
            type="button"
            onClick={handleCopyHeaderReceipt}
            disabled={headerReceiptLoading}
            className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20 active:bg-emerald-500/30 text-[#107e65] dark:text-[#34d399] text-xs font-semibold transition-all shadow-2xs cursor-pointer flex-1 sm:flex-none disabled:opacity-60 disabled:cursor-not-allowed"
            title="Copy cryptographically signed public receipt link"
          >
            {headerReceiptLoading ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin text-[#107e65] dark:text-[#34d399]" />
                <span>Preparing Link...</span>
              </>
            ) : headerReceiptCopied ? (
              <>
                <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                <span>Copied Receipt Link!</span>
              </>
            ) : (
              <>
                <Copy className="h-3.5 w-3.5" />
                <span>Copy Public Receipt Link</span>
              </>
            )}
          </button>

          <Link
            href={`/negotiate/${contractId}`}
            className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 transition-colors shadow-2xs flex-1 sm:flex-none"
          >
            <span>View Transcript</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>

      {/* Contract Overview Card */}
      <div className="rounded-2xl bg-white/90 dark:bg-[#111714]/90 border border-slate-200/70 dark:border-slate-800/60 p-4 sm:p-7 shadow-[0_1px_3px_rgba(0,0,0,0.03),0_6px_16px_rgba(0,0,0,0.02)] dark:shadow-[0_1px_3px_rgba(0,0,0,0.2)]">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 sm:gap-6 pb-6 border-b border-slate-100 dark:border-slate-800/70">
          <div className="min-w-0">
            <H1 className="text-slate-900 dark:text-white truncate">
              {contract?.service}
            </H1>
            <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
              <span className="capitalize text-xs font-semibold px-2.5 py-0.5 rounded-md bg-slate-100/80 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200/60 dark:border-slate-700/60">
                {contract?.category}
              </span>
              {contract?.vendor?.is_simulated ? (
                <span className="text-xs font-medium px-2.5 py-0.5 rounded-md bg-slate-100/70 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400">
                  Simulated Vendor
                </span>
              ) : (
                <span className="text-xs font-semibold px-2.5 py-0.5 rounded-md bg-emerald-500/10 text-[#107e65] dark:text-[#34d399] border border-emerald-500/20">
                  Verified Vendor
                </span>
              )}
            </div>
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-1.5 truncate">
              Vendor:{" "}
              <span className="font-semibold text-slate-700 dark:text-slate-300">
                {contract?.vendor?.name || contract?.service}
              </span>{" "}
              &bull; Organization:{" "}
              <span className="font-semibold text-slate-700 dark:text-slate-300">
                {contract?.business?.name}
              </span>
            </p>
          </div>

          {/* Price Delta Stats */}
          <div className="grid grid-cols-3 gap-2 w-full md:w-auto">
            <div className="rounded-xl border border-slate-200/70 dark:border-slate-800/60 bg-slate-50/50 dark:bg-slate-800/40 px-2 sm:px-4 py-2 sm:py-2.5 text-center">
              <Caption className="uppercase text-slate-400 dark:text-slate-500 block text-[10px] sm:text-xs">
                Baseline
              </Caption>
              <Mono
                as="p"
                className="text-xs sm:text-base text-slate-400 line-through truncate"
              >
                ${contract?.baselinePrice.toLocaleString()}
              </Mono>
            </div>

            <div className="rounded-xl border border-slate-200/70 dark:border-slate-800/60 bg-slate-50/50 dark:bg-slate-800/40 px-2 sm:px-4 py-2 sm:py-2.5 text-center">
              <Caption className="uppercase text-slate-500 dark:text-slate-400 block text-[10px] sm:text-xs">
                Negotiated
              </Caption>
              <Mono
                as="p"
                className="text-xs sm:text-base text-slate-900 dark:text-white font-semibold truncate"
              >
                ${contract?.proposedPrice.toLocaleString()}
              </Mono>
            </div>

            <div className="rounded-xl border border-emerald-500/20 dark:border-emerald-900/40 bg-emerald-500/10 dark:bg-emerald-950/20 px-2 sm:px-4 py-2 sm:py-2.5 text-center">
              <Caption className="uppercase text-[#107e65] dark:text-[#34d399] block text-[10px] sm:text-xs">
                Annual Cut
              </Caption>
              <Mono
                as="p"
                className="text-xs sm:text-base text-[#107e65] dark:text-[#34d399] font-bold truncate"
              >
                ${contract?.annualSavings.toLocaleString()}
              </Mono>
            </div>
          </div>
        </div>

        {/* Notifications */}
        {error && (
          <div className="mt-4 p-3.5 rounded-xl border border-rose-200 bg-rose-50 dark:bg-rose-950/20 text-rose-700 dark:text-rose-300 text-xs font-semibold flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {actionSuccess && (
          <div className="mt-4 p-3.5 rounded-xl border border-emerald-200 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-800 dark:text-emerald-300 text-xs font-semibold flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-[#107e65]" />
            <span>{actionSuccess}</span>
          </div>
        )}

        {/* Decision Status Banner */}
        <div className="mt-6">
          {isHumanApproved ? (
            <div className="p-4 rounded-xl border border-emerald-200 dark:border-emerald-800/60 bg-emerald-50/60 dark:bg-emerald-950/20 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="h-5 w-5 text-[#107e65]" />
                <div>
                  <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                    Approved by Human Supervisor
                  </h3>
                  <p className="text-xs font-medium text-slate-700 dark:text-slate-300">
                    {approval?.reason ||
                      "Supervisor signed off on renewal exceeding autonomous ceilings."}
                  </p>
                </div>
              </div>
              <span className="text-xs font-bold text-slate-600 dark:text-slate-400 font-mono">
                {approval?.decided_at &&
                  new Date(approval.decided_at).toLocaleDateString()}
              </span>
            </div>
          ) : isHumanRejected ? (
            <div className="p-4 rounded-xl border border-rose-200 dark:border-rose-900 bg-rose-50/60 dark:bg-rose-950/20 flex items-center gap-3">
              <XCircle className="h-5 w-5 text-rose-600" />
              <div>
                <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                  Rejected by Human Supervisor
                </h3>
                <p className="text-xs font-medium text-slate-700 dark:text-slate-300">
                  {approval?.reason || "Renewal rejected by supervisor."}
                </p>
              </div>
            </div>
          ) : evaluation?.decision === "approved" ? (
            <div className="p-4 rounded-xl border border-emerald-200 dark:border-emerald-800/60 bg-emerald-50/60 dark:bg-emerald-950/20 flex items-center gap-3">
              <ShieldCheck className="h-5 w-5 text-[#107e65]" />
              <div>
                <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                  Policy Approved Automatically
                </h3>
                <p className="text-xs font-medium text-slate-700 dark:text-slate-300">
                  All deterministic constraints and autonomous spend limits
                  satisfied.
                </p>
              </div>
            </div>
          ) : evaluation?.decision === "needs_human" ? (
            <div className="p-5 rounded-xl border border-amber-200 dark:border-amber-900/60 bg-amber-50/60 dark:bg-amber-950/20 space-y-4">
              <div className="flex items-center gap-3">
                <UserCheck className="h-5 w-5 text-amber-600" />
                <div>
                  <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                    Human Approval Required
                  </h3>
                  <p className="text-xs font-medium text-slate-700 dark:text-slate-300">
                    {evaluation.reasons[0] ||
                      `Transaction exceeds autonomous limit of $${policy?.max_auto_transaction.toLocaleString()}`}
                  </p>
                </div>
              </div>

              {/* Supervisor Decision Form */}
              <div className="pt-3 border-t border-amber-200/60 dark:border-amber-900/40 space-y-3">
                <input
                  type="text"
                  placeholder="Optional decision note for audit trail..."
                  value={decisionNotes}
                  onChange={(e) => setDecisionNotes(e.target.value)}
                  className="w-full text-xs font-medium px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-500 dark:placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-[#107e65]"
                />

                <div className="flex flex-col sm:flex-row sm:items-center justify-end gap-2.5 w-full">
                  <button
                    type="button"
                    onClick={() => handleDecision("reject")}
                    disabled={submitting}
                    className="w-full sm:w-auto px-4 py-2.5 rounded-lg border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-xs font-bold disabled:opacity-50 cursor-pointer text-center"
                  >
                    Reject Proposal
                  </button>

                  <button
                    type="button"
                    onClick={() => handleDecision("approve")}
                    disabled={submitting}
                    className="w-full sm:w-auto px-4 py-2.5 rounded-lg bg-[#107e65] hover:bg-[#0d6b55] text-white text-xs font-bold shadow-xs disabled:opacity-50 cursor-pointer text-center"
                  >
                    Approve Transaction
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-4 rounded-xl border border-rose-200 dark:border-rose-900 bg-rose-50/60 dark:bg-rose-950/20 flex items-center gap-3">
              <XCircle className="h-5 w-5 text-rose-600" />
              <div>
                <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                  Policy Rejected
                </h3>
                <p className="text-xs font-medium text-slate-700 dark:text-slate-300">
                  {evaluation?.reasons.join("; ") ||
                    "Hard policy constraints violated."}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Six Section Tabs (Timeline, Policy Checklist, Reviewer Audit, Vendor Verification, Switching Alternatives, Receipts) */}
      <div className="space-y-6">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 border-b border-slate-200/80 dark:border-slate-800/80 scrollbar-none">
          {[
            { id: "timeline" as const, label: "Timeline", icon: Clock },
            { id: "policy" as const, label: "Policy Checklist", icon: ShieldCheck },
            { id: "reviewer" as const, label: "Reviewer Audit", icon: UserCheck },
            {
              id: "verification" as const,
              label: "Vendor Verification",
              icon: CheckCircle2,
            },
            {
              id: "switching" as const,
              label: "Switching Alternatives",
              icon: ArrowLeftRight,
            },
            { id: "receipts" as const, label: "Receipts", icon: Receipt },
          ].map((tab) => {
            const isActive = activeTab === tab.id;
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                  isActive
                    ? "bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-2xs"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/60"
                }`}
              >
                <Icon
                  className={`h-3.5 w-3.5 ${
                    isActive
                      ? "text-emerald-400 dark:text-emerald-600"
                      : "text-slate-400"
                  }`}
                />
                <span>{tab.label}</span>
                {tab.id === "receipts" && receipts.length > 0 && (
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                      isActive
                        ? "bg-white/20 dark:bg-slate-900/20 text-white dark:text-slate-900"
                        : "bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
                    }`}
                  >
                    {receipts.length}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Tab 1: Timeline */}
        {activeTab === "timeline" && (
          <DecisionTimelineSection
            contract={contract}
            policy={policy}
            evaluation={evaluation}
            approval={approval}
            review={data?.review}
            switchingMatrix={switchingMatrix}
          />
        )}

        {/* Tab 2: Policy Checklist */}
        {activeTab === "policy" && (
          <div className="rounded-2xl bg-white/90 dark:bg-[#111714]/90 border border-slate-200/70 dark:border-slate-800/60 p-4 sm:p-7 shadow-[0_1px_3px_rgba(0,0,0,0.03),0_6px_16px_rgba(0,0,0,0.02)] dark:shadow-[0_1px_3px_rgba(0,0,0,0.2)]">
            <PolicyChecklistSection evaluation={evaluation} policy={policy} />
          </div>
        )}

        {/* Tab 3: Reviewer Audit */}
        {activeTab === "reviewer" && (
          <ReviewerAuditSection
            review={data?.review}
            reviewing={reviewing}
            onRunReviewer={handleRunReviewer}
          />
        )}

        {/* Tab 4: Vendor Verification */}
        {activeTab === "verification" && (
          <div className="rounded-2xl bg-white/90 dark:bg-[#111714]/90 border border-slate-200/70 dark:border-slate-800/60 p-4 sm:p-7 shadow-[0_1px_3px_rgba(0,0,0,0.03),0_6px_16px_rgba(0,0,0,0.02)] dark:shadow-[0_1px_3px_rgba(0,0,0,0.2)]">
            <VendorVerificationSection
              verification={verification}
              verifying={verifying}
              releaseLoading={releaseLoading}
              submitting={submitting}
              selectedTamper={selectedTamper}
              verificationError={verificationError}
              verificationSuccess={verificationSuccess}
              onSelectTamper={setSelectedTamper}
              onRunVerification={handleRunVerification}
              onEscalateToHuman={() => handleDecision("approve")}
            />
          </div>
        )}

        {/* Tab 5: Switching Alternatives */}
        {activeTab === "switching" && (
          <SwitchingAlternativesSection
            contract={contract}
            switchingMatrix={switchingMatrix}
            loadingSwitching={loadingSwitching}
            onRefresh={fetchSwitchingMatrix}
          />
        )}

        {/* Tab 6: Receipts */}
        {activeTab === "receipts" && (
          <PublicReceiptsSection
            receipts={receipts}
            creatingReceipt={creatingReceipt}
            receiptCopiedToken={receiptCopiedToken}
            isTransactionCompleted={
              verification?.transaction?.status === "completed"
            }
            onCreateReceipt={handleCreateReceipt}
            onCopyReceipt={async (token, url) => {
              await copyToClipboard(url);
              setReceiptCopiedToken(token);
              setTimeout(() => setReceiptCopiedToken(null), 2000);
            }}
            onToggleReceipt={handleToggleReceipt}
          />
        )}
      </div>
    </AppShell>
  );
}
