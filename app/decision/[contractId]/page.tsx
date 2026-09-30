"use client";

import {
  AlertOctagon,
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Copy,
  ExternalLink,
  Eye,
  EyeOff,
  Lock,
  Receipt,
  RefreshCw,
  ShieldCheck,
  Trash2,
  UserCheck,
  X,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import React, { use, useEffect, useState } from "react";

import { AppShell } from "@/components/AppShell";
import { BodySmall, Caption, H1, H2, Mono } from "@/components/ui/text";
import { ARC_CONFIG } from "@/lib/circle";

interface CheckItem {
  name: string;
  passed: boolean;
  detail: string;
}

interface PolicyData {
  max_auto_transaction: number;
  min_savings: number;
  human_approval_required_above: number;
  allowed_categories: string[];
  category_budgets?: Record<string, number> | null;
}

interface ContractInfo {
  id: string;
  service: string;
  category: string;
  baselinePrice: number;
  proposedPrice: number;
  annualSavings: number;
  savingsPct: number;
  seat_count: number | null;
  active_seats: number | null;
  vendor?: {
    name: string;
    is_simulated: boolean;
  } | null;
  business?: {
    id: string;
    name: string;
    treasury_balance?: number;
  } | null;
}

interface DecisionData {
  contract: ContractInfo;
  policy: PolicyData;
  evaluation: {
    decision: "approved" | "needs_human" | "rejected";
    checks: CheckItem[];
    reasons: string[];
    approved: boolean;
    requiresHumanApproval: boolean;
  };
  approval: {
    id: string;
    status: "pending" | "approved" | "rejected";
    reason?: string;
    decided_at?: string;
  } | null;
}

interface ReceiptItem {
  id: string;
  token: string;
  created_at: string;
  revoked_at: string | null;
  show_business_name: boolean;
  show_vendor_name: boolean;
}

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

  const [verification, setVerification] = useState<{
    verified: boolean;
    allPassed: boolean;
    checks: Array<{
      field: string;
      name: string;
      expected: string | number;
      actual: string | number;
      passed: boolean;
      message: string;
    }>;
    discrepancies: string[];
    confirmationDocument?: string;
    transaction?: {
      id: string;
      status: string;
      tx_hash?: string;
      amount: number;
    } | null;
    approval?: {
      id: string;
      status: string;
      reason?: string;
    } | null;
  } | null>(null);
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

  useEffect(() => {
    fetchDecisionData();
    fetchVerificationStatus();
    fetchReceipts();
  }, [contractId]);

  const handleDecision = async (action: "approve" | "reject") => {
    if (!data) return;
    try {
      setSubmitting(true);
      setError(null);
      setActionSuccess(null);

      const res = await fetch(`/api/decision/${contractId}/approve`, {
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

  const getCheckTitle = (name: string): string => {
    switch (name) {
      case "category_allowed":
        return "Category Authorization";
      case "amount_within_auto_ceiling":
        return `Autonomous Spend Ceiling (≤ $${data?.policy.max_auto_transaction.toLocaleString()})`;
      case "savings_threshold":
        return `Minimum Savings Requirement (≥ $${data?.policy.min_savings.toLocaleString()})`;
      case "category_budget":
        return "Category Budget Allocation";
      case "treasury_balance":
        return "Treasury Liquidity";
      case "human_approval_threshold":
        return `Human Boundary Ceiling (≤ $${data?.policy.human_approval_required_above.toLocaleString()})`;
      case "valid_numbers":
        return "Numerical Integrity Validation";
      default:
        return name.replace(/_/g, " ");
    }
  };

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
      <div className="flex items-center justify-between">
        <Link
          href="/negotiations"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Back to Negotiations</span>
        </Link>

        <Link
          href={`/negotiate/${contractId}`}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 transition-colors shadow-2xs"
        >
          <span>View Negotiation Transcript</span>
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      {/* Contract Overview Card */}
      <div className="rounded-2xl bg-white/90 dark:bg-[#111714]/90 border border-slate-200/70 dark:border-slate-800/60 p-6 sm:p-7 shadow-[0_1px_3px_rgba(0,0,0,0.03),0_6px_16px_rgba(0,0,0,0.02)] dark:shadow-[0_1px_3px_rgba(0,0,0,0.2)]">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-slate-100 dark:border-slate-800/70">
          <div>
            <div className="flex items-center gap-2">
              <H1 className="text-slate-900 dark:text-white">
                {contract?.service}
              </H1>
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
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-1">
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
          <div className="flex items-center gap-3">
            <div className="rounded-xl border border-slate-200/70 dark:border-slate-800/60 bg-slate-50/50 dark:bg-slate-800/40 px-4 py-2.5 text-right">
              <Caption className="uppercase text-slate-400 dark:text-slate-500 block">
                Baseline
              </Caption>
              <Mono as="p" className="text-base text-slate-400 line-through">
                ${contract?.baselinePrice.toLocaleString()}
              </Mono>
            </div>

            <div className="rounded-xl border border-slate-200/70 dark:border-slate-800/60 bg-slate-50/50 dark:bg-slate-800/40 px-4 py-2.5 text-right">
              <Caption className="uppercase text-slate-500 dark:text-slate-400 block">
                Negotiated
              </Caption>
              <Mono as="p" className="text-base text-slate-900 dark:text-white">
                ${contract?.proposedPrice.toLocaleString()}
              </Mono>
            </div>

            <div className="rounded-xl border border-emerald-500/20 dark:border-emerald-900/40 bg-emerald-500/10 dark:bg-emerald-950/20 px-4 py-2.5 text-right">
              <Caption className="uppercase text-[#107e65] dark:text-[#34d399] block">
                Annual Cut
              </Caption>
              <Mono
                as="p"
                className="text-base text-[#107e65] dark:text-[#34d399]"
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

                <div className="flex items-center justify-end gap-2.5">
                  <button
                    type="button"
                    onClick={() => handleDecision("reject")}
                    disabled={submitting}
                    className="px-4 py-2 rounded-lg border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-xs font-bold disabled:opacity-50"
                  >
                    Reject Proposal
                  </button>

                  <button
                    type="button"
                    onClick={() => handleDecision("approve")}
                    disabled={submitting}
                    className="px-4 py-2 rounded-lg bg-[#107e65] hover:bg-[#0d6b55] text-white text-xs font-bold shadow-xs disabled:opacity-50"
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

        {/* Checklist Table */}
        <div className="mt-8">
          <H2 className="text-slate-900 dark:text-white mb-3">
            Deterministic Policy Checklist
          </H2>

          <div className="overflow-x-auto rounded-xl border border-slate-200/70 dark:border-slate-800/60 shadow-2xs">
            <table className="w-full text-left text-xs font-sans border-collapse">
              <thead>
                <tr className="border-b border-slate-200/70 dark:border-slate-800/60 bg-slate-50/70 dark:bg-[#141b18]/60 text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  <Caption as="th" className="py-3.5 px-4 w-28 text-center">
                    Status
                  </Caption>
                  <Caption as="th" className="py-3.5 px-4 min-w-[220px]">
                    Rule Specification
                  </Caption>
                  <Caption as="th" className="py-3.5 px-4">
                    Evaluation Detail
                  </Caption>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50 bg-white/70 dark:bg-[#111714]/70">
                {evaluation?.checks.map((chk, i) => (
                  <tr
                    key={i}
                    className="hover:bg-emerald-500/[0.03] dark:hover:bg-emerald-500/[0.04] transition-colors duration-150"
                  >
                    <td className="py-3.5 px-4 text-center">
                      {chk.passed ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-[#107e65] dark:text-[#34d399] border border-emerald-500/20">
                          <Check className="h-3.5 w-3.5 stroke-[2.5]" />
                          <span>Passed</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-700 dark:text-rose-300 border border-rose-500/20">
                          <X className="h-3.5 w-3.5 stroke-[2.5]" />
                          <span>Refused</span>
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 font-bold text-slate-900 dark:text-white">
                      {getCheckTitle(chk.name)}
                    </td>
                    <td className="py-3.5 px-4 font-medium text-slate-600 dark:text-slate-300">
                      {chk.detail}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Vendor Confirmation Verification & Escrow Release Section */}
        <div className="mt-8 pt-8 border-t border-slate-100 dark:border-slate-800/70">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
            <div>
              <H2 className="text-slate-900 dark:text-white">
                Vendor Confirmation &amp; Escrow Release
              </H2>
              <BodySmall className="text-slate-500 dark:text-slate-400 mt-0.5">
                LLM extracts confirmation fields into strict schema;
                deterministic code verifies every field before releasing Arc
                USDC.
              </BodySmall>
            </div>

            {/* Tamper Simulator Selector */}
            <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-100/80 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60 shrink-0">
              <button
                type="button"
                onClick={() => {
                  setSelectedTamper(null);
                  handleRunVerification(null, "verify");
                }}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
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
                  setSelectedTamper("price");
                  handleRunVerification("price", "verify");
                }}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
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
                  setSelectedTamper("seats");
                  handleRunVerification("seats", "verify");
                }}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
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

          {/* Verification Checklist Table */}
          <div className="overflow-x-auto rounded-xl border border-slate-200/70 dark:border-slate-800/60 shadow-2xs">
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
                      Click &quot;Verify Vendor Confirmation&quot; below to
                      trigger extraction and comparison.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Bottom Release / Dispute Action Bar */}
          <div className="mt-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 p-4 rounded-xl border border-slate-200/70 dark:border-slate-800/60 bg-slate-50/60 dark:bg-[#141c18]/60">
            <div className="flex flex-wrap items-center gap-2.5 sm:gap-3 min-w-0">
              {verification?.transaction?.status === "completed" ? (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-[#107e65] dark:text-[#34d399] border border-emerald-500/20 shrink-0">
                    <CheckCircle2 className="h-4 w-4 shrink-0" />
                    Escrow Released on Arc
                  </span>
                  {verification?.transaction?.tx_hash && (
                    <a
                      href={`${ARC_CONFIG.explorerUrl}/tx/${verification.transaction.tx_hash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-mono text-xs text-[#107e65] dark:text-emerald-400 hover:underline inline-flex items-center gap-1 shrink-0"
                    >
                      <span>
                        {verification.transaction.tx_hash.slice(0, 10)}...
                      </span>
                      <ExternalLink className="h-3 w-3" />
                    </a>
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
                onClick={() => handleRunVerification(selectedTamper, "verify")}
                className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 sm:py-2 rounded-xl border border-slate-200/80 dark:border-slate-700/80 bg-white dark:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shadow-2xs disabled:opacity-50 w-full sm:w-auto cursor-pointer"
              >
                <RefreshCw
                  className={`h-3.5 w-3.5 shrink-0 ${verifying ? "animate-spin" : ""}`}
                />
                <span className="truncate">
                  {verifying
                    ? "Extracting & Verifying..."
                    : "Verify Confirmation"}
                </span>
              </button>

              {verification?.allPassed === false && (
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => handleDecision("approve")}
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
                onClick={() => handleRunVerification(selectedTamper, "release")}
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

          {/* Public Verified Receipts Section */}
          <div className="mt-8 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-[#111714] p-5 sm:p-6 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800/70 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-emerald-500/10 text-[#107e65] dark:text-[#34d399]">
                  <Receipt className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <span>Public Savings Receipts</span>
                    <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20">
                      Arc Verified
                    </span>
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Generate an unguessable, read-only proof page for customers
                    or auditors without logging in.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleCreateReceipt}
                disabled={
                  creatingReceipt ||
                  (verification?.transaction?.status !== "completed" &&
                    receipts.length === 0)
                }
                className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-[#107e65] hover:bg-[#0d6b55] text-white text-xs font-bold transition-all shadow-xs disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shrink-0"
              >
                <Receipt className="h-3.5 w-3.5" />
                <span>
                  {creatingReceipt
                    ? "Generating Proof..."
                    : "Create Public Receipt"}
                </span>
              </button>
            </div>

            {/* Receipts List */}
            {receipts.length > 0 ? (
              <div className="mt-4 divide-y divide-slate-100 dark:divide-slate-800/60">
                {receipts.map((rcpt) => {
                  const receiptUrl = `${typeof window !== "undefined" ? window.location.origin : ""}/r/${rcpt.token}`;
                  const isRevoked = Boolean(rcpt.revoked_at);

                  return (
                    <div
                      key={rcpt.id}
                      className="py-3.5 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            isRevoked
                              ? "bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20"
                              : "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20"
                          }`}
                        >
                          {isRevoked ? "Revoked" : "Active Proof"}
                        </span>
                        <span className="font-mono text-slate-700 dark:text-slate-300 truncate max-w-xs">
                          /r/{rcpt.token}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        {!isRevoked && (
                          <>
                            <a
                              href={`/r/${rcpt.token}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 font-medium"
                            >
                              <span>Open Proof</span>
                              <ExternalLink className="h-3 w-3" />
                            </a>

                            <button
                              type="button"
                              onClick={() => {
                                navigator.clipboard.writeText(receiptUrl);
                                setReceiptCopiedToken(rcpt.token);
                                setTimeout(
                                  () => setReceiptCopiedToken(null),
                                  2000,
                                );
                              }}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 font-medium cursor-pointer"
                            >
                              {receiptCopiedToken === rcpt.token ? (
                                <>
                                  <Check className="h-3 w-3 text-emerald-500" />
                                  <span className="text-emerald-600 font-bold">
                                    Copied
                                  </span>
                                </>
                              ) : (
                                <>
                                  <Copy className="h-3 w-3 text-slate-400" />
                                  <span>Copy Link</span>
                                </>
                              )}
                            </button>

                            <button
                              type="button"
                              onClick={() =>
                                handleToggleReceipt(rcpt.token, {
                                  showBusinessName: !rcpt.show_business_name,
                                })
                              }
                              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border text-[11px] font-medium transition-colors cursor-pointer ${
                                rcpt.show_business_name
                                  ? "border-emerald-500/30 text-[#107e65] dark:text-[#34d399] bg-emerald-500/5"
                                  : "border-slate-200 dark:border-slate-700 text-slate-400 bg-slate-50 dark:bg-slate-800"
                              }`}
                            >
                              {rcpt.show_business_name ? (
                                <Eye className="h-3 w-3" />
                              ) : (
                                <EyeOff className="h-3 w-3" />
                              )}
                              <span>Co Name</span>
                            </button>

                            <button
                              type="button"
                              onClick={() =>
                                handleToggleReceipt(rcpt.token, {
                                  showVendorName: !rcpt.show_vendor_name,
                                })
                              }
                              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border text-[11px] font-medium transition-colors cursor-pointer ${
                                rcpt.show_vendor_name
                                  ? "border-emerald-500/30 text-[#107e65] dark:text-[#34d399] bg-emerald-500/5"
                                  : "border-slate-200 dark:border-slate-700 text-slate-400 bg-slate-50 dark:bg-slate-800"
                              }`}
                            >
                              {rcpt.show_vendor_name ? (
                                <Eye className="h-3 w-3" />
                              ) : (
                                <EyeOff className="h-3 w-3" />
                              )}
                              <span>Vendor Name</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                if (
                                  confirm(
                                    "Are you sure you want to revoke this public receipt? It will immediately return 404.",
                                  )
                                ) {
                                  handleToggleReceipt(rcpt.token, {
                                    revoke: true,
                                  });
                                }
                              }}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-rose-200 dark:border-rose-900/60 bg-rose-50/50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-950/40 text-[11px] font-semibold transition-colors cursor-pointer"
                            >
                              <Trash2 className="h-3 w-3" />
                              <span>Revoke</span>
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="mt-4 p-4 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 text-center text-xs text-slate-400">
                {verification?.transaction?.status === "completed"
                  ? "No public receipts generated yet. Click 'Create Public Receipt' above to share cryptographic proof."
                  : "Receipts become available once escrow payment has been released on Arc."}
              </div>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
