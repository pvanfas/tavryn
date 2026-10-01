"use client";

import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Brain,
  Check,
  CheckCircle2,
  Coins,
  Copy,
  FileText,
  Mail,
  Play,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import React, { use, useEffect, useState } from "react";

import { AgentIcon } from "@/components/AgentIcon";
import { AppShell } from "@/components/AppShell";
import { Body, BodySmall, Caption, H1, H3, Mono } from "@/components/ui/text";

interface Turn {
  role: "agent" | "vendor" | "system";
  speaker: string;
  amount?: number;
  message: string;
  round?: number;
  timestamp: string;
  accepted?: boolean;
}

interface Explanation {
  belowPolicyCeiling: string;
  dollarSavings: string;
  competitorComparison: string;
  serviceLevelsPreserved: string;
  summary: string;
}

interface VendorMemoryData {
  has_history: boolean;
  vendor_id?: string;
  vendor_name?: string;
  last_price?: number | null;
  accepted_discount_pct?: number | null;
  rounds_to_close?: number | null;
  outcome?: string;
  delivered_ok?: boolean;
  reputation_score?: number;
  deals_count?: number;
  last_updated?: string;
  summary_sentence?: string;
  insight?: string;
}

interface NegotiationData {
  id: string;
  contract_id: string;
  original_price: number;
  target_price: number;
  current_offer: number;
  status: string;
  conversation: Turn[];
  final_price: number | null;
  savings: number | null;
  rounds: number;
}

interface ContractData {
  id: string;
  service: string;
  category: string;
  current_price: number;
  seat_count: number | null;
  active_seats: number | null;
  vendors?: {
    name: string;
    category: string;
    contact: string | null;
    reputation_score: number | null;
    is_simulated: boolean | null;
  } | null;
}

interface ExtractedTerms {
  counter_offer: number | null;
  accepted: boolean;
  seats: number | null;
  commitment_months: number | null;
  accepts_usdc: boolean;
  notes: string;
  raw_text: string;
}

interface ReplyProcessResult {
  decision: "agreed" | "counter" | "walk_away" | "usdc_refused";
  reason: string;
  extraction: ExtractedTerms;
  message: string;
  suggested_action:
    "escrow" | "record_savings_no_payment" | "await_vendor" | "walk_away";
}

const SAMPLE_REPLIES = [
  {
    label: "Counter $8,160 (45 seats)",
    text: `Hi team,

Thanks for reaching out regarding the renewal. While we cannot meet your requested target of $7,400 for the full 50 seats, we can offer an annual agreement at $8,160 ($680/mo) if you commit to 45 seats on a 12-month term. Payment via wire or USDC invoice on Arc is accepted.

Best,
Sarah Chen
Enterprise Renewals`,
  },
  {
    label: "Accepted $7,400 (USDC OK)",
    text: `Hello,

We reviewed your usage metrics and active seat decline. We are pleased to accept your proposed renewal terms at $7,400 per year for 42 seats on a 12-month agreement. We accept USDC payment on Arc or standard ACH wire.

Regards,
Dave Miller
Enterprise Account Manager`,
  },
  {
    label: "ACH Only $7,800 (No USDC)",
    text: `Hello,

We accept your renewal proposal at $7,800 annually for the team. However, please note that our corporate treasury only accepts ACH direct deposit or physical check. No crypto or USDC accepted under any circumstances. Please send confirmation.

Best,
Billing Operations`,
  },
];

export default function NegotiationDetailPage({
  params,
}: {
  params: Promise<{ contractId: string }>;
}) {
  const resolvedParams = use(params);
  const contractId = resolvedParams.contractId;

  const [contract, setContract] = useState<ContractData | null>(null);
  const [negotiation, setNegotiation] = useState<NegotiationData | null>(null);
  const [vendorMemory, setVendorMemory] = useState<VendorMemoryData | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [explanation, setExplanation] = useState<Explanation | null>(null);

  // Real vendor mode states
  const [mode, setMode] = useState<"simulated" | "real">("simulated");
  const [draftEmail, setDraftEmail] = useState<{
    subject: string;
    body: string;
    to: string;
    target_price: number;
    baseline_price: number;
  } | null>(null);
  const [draftingEmail, setDraftingEmail] = useState(false);
  const [emailApproved, setEmailApproved] = useState(false);
  const [copiedEmail, setCopiedEmail] = useState(false);

  const [replyText, setReplyText] = useState("");
  const [processingReply, setProcessingReply] = useState(false);
  const [extractedResult, setExtractedResult] =
    useState<ReplyProcessResult | null>(null);

  const [recordingSavings, setRecordingSavings] = useState(false);
  const [savingsSuccess, setSavingsSuccess] = useState<string | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      let rawContract: any = null;

      try {
        const res = await fetch(`/api/agent/negotiate/${contractId}`);
        if (res.ok) {
          const negData = await res.json();
          if (negData.negotiation) {
            setNegotiation(negData.negotiation);
          }
          if (negData.memory) {
            setVendorMemory(negData.memory);
          }
          if (negData.contract) {
            rawContract = negData.contract;
          }
        }
      } catch (negErr) {
        console.warn("Failed to load negotiation status:", negErr);
      }

      // If contract is not yet resolved, query decision endpoint
      if (!rawContract) {
        try {
          const decRes = await fetch(`/api/decision/${contractId}`);
          if (decRes.ok) {
            const decData = await decRes.json();
            if (decData.contract) {
              rawContract = decData.contract;
            }
          }
        } catch (decErr) {
          console.warn("Failed to load fallback decision contract:", decErr);
        }
      }

      // Process resolved contract data
      if (rawContract) {
        const vendorData = rawContract.vendors || rawContract.vendor;
        const cData: ContractData = {
          id: rawContract.id,
          service: rawContract.service || "Contract",
          category: rawContract.category || vendorData?.category || "software",
          current_price: Number(rawContract.current_price || 0),
          seat_count: rawContract.seat_count ?? null,
          active_seats: rawContract.active_seats ?? null,
          vendors: vendorData
            ? {
                name: vendorData.name,
                category:
                  vendorData.category || rawContract.category || "software",
                contact: vendorData.contact ?? null,
                reputation_score: vendorData.reputation_score ?? null,
                is_simulated: vendorData.is_simulated ?? null,
              }
            : null,
        };
        setContract(cData);
        if (vendorData && vendorData.is_simulated === false) {
          setMode("real");
        }
      }
    } catch (err) {
      console.error(err);
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [contractId]);

  const handleStartNegotiation = async () => {
    try {
      setRunning(true);
      setError(null);

      const res = await fetch(`/api/agent/negotiate/${contractId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ maxRounds: 5 }),
      });

      if (!res.ok) {
        const errJson = await res.json();
        throw new Error(errJson.error || "Negotiation execution failed");
      }

      const data = await res.json();
      if (data.result) {
        setExplanation(data.result.explanation);
        if (data.result.memoryUsed) {
          setVendorMemory({
            has_history: data.result.memoryUsed.hasHistory,
            vendor_id: data.result.memoryUsed.vendorId,
            vendor_name: data.result.memoryUsed.vendorName,
            last_price: data.result.memoryUsed.lastPrice,
            accepted_discount_pct: data.result.memoryUsed.acceptedDiscountPct,
            rounds_to_close: data.result.memoryUsed.roundsToClose,
            outcome: data.result.memoryUsed.outcome,
            delivered_ok: data.result.memoryUsed.deliveredOk,
            reputation_score: data.result.memoryUsed.reputationScore,
            deals_count: data.result.memoryUsed.dealsCount,
            insight: data.result.memoryUsed.insight,
            summary_sentence: data.result.memoryUsed.summarySentence,
          });
        }
        await loadData();
      }
    } catch (err) {
      console.error(err);
      setError((err as Error).message);
    } finally {
      setRunning(false);
    }
  };

  const handleDraftEmail = async () => {
    try {
      setDraftingEmail(true);
      setError(null);

      const res = await fetch(`/api/agent/negotiate/${contractId}/outreach`, {
        method: "POST",
      });

      if (!res.ok) {
        const errJson = await res.json();
        throw new Error(errJson.error || "Failed to draft outreach email");
      }

      const data = await res.json();
      setDraftEmail(data.draft);
      setEmailApproved(false);
    } catch (err) {
      console.error(err);
      setError((err as Error).message);
    } finally {
      setDraftingEmail(false);
    }
  };

  const handleCopyEmail = () => {
    if (!draftEmail) return;
    const text = `Subject: ${draftEmail.subject}\nTo: ${draftEmail.to}\n\n${draftEmail.body}`;
    navigator.clipboard.writeText(text);
    setCopiedEmail(true);
    setTimeout(() => setCopiedEmail(false), 2500);
  };

  const handleProcessReply = async () => {
    if (!replyText.trim()) return;
    try {
      setProcessingReply(true);
      setError(null);
      setSavingsSuccess(null);

      const res = await fetch(`/api/agent/negotiate/${contractId}/reply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ raw_reply: replyText }),
      });

      if (!res.ok) {
        const errJson = await res.json();
        throw new Error(errJson.error || "Failed to process vendor reply");
      }

      const data: ReplyProcessResult = await res.json();
      setExtractedResult(data);
      await loadData();
    } catch (err) {
      console.error(err);
      setError((err as Error).message);
    } finally {
      setProcessingReply(false);
    }
  };

  const handleRecordSavingsWithoutPayment = async () => {
    try {
      setRecordingSavings(true);
      setError(null);

      const res = await fetch(
        `/api/agent/negotiate/${contractId}/record-savings`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            final_price:
              extractedResult?.extraction?.counter_offer ||
              negotiation?.current_offer,
            notes:
              extractedResult?.extraction?.notes ||
              "Vendor terms agreed without on-chain USDC payment.",
          }),
        },
      );

      if (!res.ok) {
        const errJson = await res.json();
        throw new Error(errJson.error || "Failed to record off-chain savings");
      }

      const data = await res.json();
      setSavingsSuccess(
        data.message || "Savings recorded successfully without payment.",
      );
      await loadData();
    } catch (err) {
      console.error(err);
      setError((err as Error).message);
    } finally {
      setRecordingSavings(false);
    }
  };

  const turns = negotiation?.conversation || [];
  const roundsMap = new Map<number, Turn[]>();
  turns.forEach((turn) => {
    if (turn.round) {
      const list = roundsMap.get(turn.round) || [];
      list.push(turn);
      roundsMap.set(turn.round, list);
    }
  });

  const sortedRoundNumbers = Array.from(roundsMap.keys()).sort((a, b) => a - b);

  if (loading && !contract && !negotiation) {
    return (
      <div className="min-h-screen bg-slate-100/60 dark:bg-slate-950 flex items-center justify-center p-6 font-sans">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 border-2 border-[#107e65] border-t-transparent rounded-full animate-spin" />
          <p className="text-xs text-slate-500 font-medium">
            Loading negotiation session...
          </p>
        </div>
      </div>
    );
  }

  const baselinePrice = Number(
    negotiation?.original_price || contract?.current_price || 0,
  );
  const currentOffer = Number(
    negotiation?.current_offer || negotiation?.final_price || baselinePrice,
  );
  const savings = baselinePrice - currentOffer;

  return (
    <AppShell
      businessName="Demo Co"
      isReal={!contract?.vendors?.is_simulated}
      breadcrumbs={[
        { label: "Overview", href: "/" },
        { label: "Negotiations", href: "/negotiations" },
        { label: `${contract?.service || "Vendor"} Negotiation` },
      ]}
      currency="USDC"
    >
      {/* Top Actions Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <Link
          href="/negotiations"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Back to Negotiations</span>
        </Link>

        <Link
          href={`/decision/${contractId}`}
          className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 transition-colors shadow-2xs w-full sm:w-auto"
        >
          <span>Inspect Policy Checklist</span>
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      {/* Negotiation Overview Card */}
      <div className="rounded-2xl bg-white/90 dark:bg-[#111714]/90 border border-slate-200/70 dark:border-slate-800/60 p-6 sm:p-7 shadow-[0_1px_3px_rgba(0,0,0,0.03),0_6px_16px_rgba(0,0,0,0.02)] dark:shadow-[0_1px_3px_rgba(0,0,0,0.2)]">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-slate-100 dark:border-slate-800/70">
          <div>
            <div className="flex items-center gap-2">
              <H1 className="text-slate-900 dark:text-white">
                {contract?.service || "Contract"}
              </H1>
              <span className="capitalize text-xs font-semibold px-2.5 py-0.5 rounded-md bg-slate-100/80 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200/60 dark:border-slate-700/60">
                {contract?.category ||
                  contract?.vendors?.category ||
                  "Subscription"}
              </span>
              {contract?.vendors ? (
                contract.vendors.is_simulated ? (
                  <span className="text-xs font-medium px-2.5 py-0.5 rounded-md bg-slate-100/70 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400">
                    Simulated Vendor
                  </span>
                ) : (
                  <span className="text-xs font-semibold px-2.5 py-0.5 rounded-md bg-emerald-500/10 text-[#107e65] dark:text-[#34d399] border border-emerald-500/20">
                    Verified Real Vendor
                  </span>
                )
              ) : null}
            </div>
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-1">
              Account Executive:{" "}
              <span className="font-semibold text-slate-700 dark:text-slate-300">
                {contract?.vendors?.name || contract?.service}
              </span>
              {contract?.vendors?.contact && ` (${contract.vendors.contact})`}
            </p>
          </div>

          {/* Price Stats */}
          <div className="grid grid-cols-3 gap-2 sm:flex sm:items-center sm:gap-3 w-full sm:w-auto">
            <div className="rounded-xl border border-slate-200/70 dark:border-slate-800/60 bg-slate-50/50 dark:bg-slate-800/40 px-2 sm:px-4 py-2 sm:py-2.5 text-center sm:text-right">
              <Caption className="uppercase text-slate-400 dark:text-slate-500 block text-[10px] sm:text-xs">
                Original Rate
              </Caption>
              <Mono as="p" className="text-xs sm:text-base text-slate-400 line-through">
                ${baselinePrice.toLocaleString()}
              </Mono>
            </div>

            <div className="rounded-xl border border-slate-200/70 dark:border-slate-800/60 bg-slate-50/50 dark:bg-slate-800/40 px-2 sm:px-4 py-2 sm:py-2.5 text-center sm:text-right">
              <Caption className="uppercase text-slate-500 dark:text-slate-400 block text-[10px] sm:text-xs">
                Current Counter
              </Caption>
              <Mono as="p" className="text-xs sm:text-base text-slate-900 dark:text-white font-semibold">
                ${currentOffer.toLocaleString()}
              </Mono>
            </div>

            <div className="rounded-xl border border-emerald-500/20 dark:border-emerald-900/40 bg-emerald-500/10 dark:bg-emerald-950/20 px-2 sm:px-4 py-2 sm:py-2.5 text-center sm:text-right">
              <Caption className="uppercase text-[#107e65] dark:text-[#34d399] block text-[10px] sm:text-xs">
                Achieved Cut
              </Caption>
              <Mono
                as="p"
                className="text-xs sm:text-base text-[#107e65] dark:text-[#34d399] font-bold"
              >
                ${Math.max(0, savings).toLocaleString()}
              </Mono>
            </div>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mt-4 p-3.5 rounded-xl border border-rose-200 bg-rose-50 dark:bg-rose-950/20 text-rose-700 dark:text-rose-300 text-xs font-semibold flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Savings Recorded Success Banner */}
        {savingsSuccess && (
          <div className="mt-4 p-3.5 rounded-xl border border-purple-200 bg-purple-50 dark:bg-purple-950/20 text-purple-800 dark:text-purple-300 text-xs font-semibold flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-purple-600" />
            <span>
              {savingsSuccess} (Off-chain savings captured in executive
              metrics).
            </span>
          </div>
        )}

        {/* Mode Switcher & Status Bar */}
        <div className="mt-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-800/60">
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 w-full sm:w-auto">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              Mode:
            </span>
            <div className="grid grid-cols-2 sm:inline-flex rounded-lg border border-slate-200 dark:border-slate-700 p-0.5 bg-white dark:bg-slate-800 w-full sm:w-auto">
              <button
                type="button"
                onClick={() => setMode("real")}
                className={`px-2 sm:px-3 py-1.5 sm:py-1 rounded-md text-xs font-bold transition-all text-center ${
                  mode === "real"
                    ? "bg-[#107e65] text-white shadow-2xs"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                Real Vendor
              </button>
              <button
                type="button"
                onClick={() => setMode("simulated")}
                className={`px-2 sm:px-3 py-1.5 sm:py-1 rounded-md text-xs font-bold transition-all text-center ${
                  mode === "simulated"
                    ? "bg-[#107e65] text-white shadow-2xs"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                Autonomous
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between sm:justify-start gap-2 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-200/60 dark:border-slate-800/60">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                Status:
              </span>
              <span
                className={`inline-block px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider ${
                  negotiation?.status === "agreed"
                    ? "bg-emerald-500/10 text-[#107e65] dark:text-[#34d399] border border-emerald-500/20"
                    : negotiation?.status === "savings_recorded_no_payment"
                      ? "bg-purple-500/10 text-purple-700 dark:text-purple-300 border border-purple-500/20"
                      : negotiation?.status === "walked_away"
                        ? "bg-amber-500/10 text-amber-800 dark:text-amber-300 border border-amber-500/20"
                        : "bg-blue-500/10 text-blue-700 dark:text-blue-300 border border-blue-500/20"
                }`}
              >
                {negotiation?.status === "savings_recorded_no_payment"
                  ? "Savings Recorded (Off-Chain)"
                  : negotiation?.status || "Ready to Negotiate"}
              </span>
            </div>
            <span className="text-xs text-slate-500 dark:text-slate-400 font-mono font-medium ml-2">
              Rounds: {negotiation?.rounds || 0} / 5
            </span>
          </div>
        </div>

        {/* Real Vendor Mode Interactive Panels */}
        {mode === "real" ? (
          <div className="mt-6 space-y-6">
            {/* Step 1: Draft Outreach Email */}
            <div className="rounded-xl border border-slate-200/70 dark:border-slate-800/60 bg-gradient-to-br from-slate-50/50 via-white to-slate-50/30 dark:from-[#111714] dark:to-[#0f1412] p-5 shadow-2xs">
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
                      Agent constructs targeted email citing telemetry and
                      benchmarks. Real emails are NEVER dispatched
                      automatically.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleDraftEmail}
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
                        {draftEmail
                          ? "Regenerate Draft"
                          : "Draft Outreach Email"}
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
                          onClick={handleCopyEmail}
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
                          onClick={() => setEmailApproved(true)}
                          className={`flex-1 sm:flex-none inline-flex items-center justify-center gap-1 px-2.5 py-1.5 sm:py-1 rounded font-semibold text-xs transition-colors cursor-pointer ${
                            emailApproved
                              ? "bg-emerald-500/10 text-[#107e65] dark:text-[#34d399] border border-emerald-500/20"
                              : "bg-[#107e65] text-white hover:bg-[#0d6b55]"
                          }`}
                        >
                          <CheckCircle2 className="h-3 w-3" />
                          <span>
                            {emailApproved
                              ? "Approved"
                              : "Approve & Mark Sent"}
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
                        Outreach email approved by human supervisor. Ready to
                        ingest vendor reply below.
                      </span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="mt-4 p-4 text-center border border-dashed border-slate-200 dark:border-slate-800 rounded-lg text-xs text-slate-500">
                  Click &quot;Draft Outreach Email&quot; above to have the agent
                  review telemetry, calculate the target discount, and compose
                  the opening communication.
                </div>
              )}
            </div>

            {/* Step 2: Paste Vendor Reply */}
            <div className="rounded-xl border border-slate-200/70 dark:border-slate-800/60 bg-gradient-to-br from-slate-50/50 via-white to-slate-50/30 dark:from-[#111714] dark:to-[#0f1412] p-5 shadow-2xs">
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
                      Paste the raw email or message received from the vendor.
                      Tavryn deterministically extracts counter terms and
                      payment conditions.
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
                      onClick={() => setReplyText(sample.text)}
                      className="px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-[11px] font-medium text-slate-700 dark:text-slate-300 transition-colors"
                    >
                      {sample.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mt-4 space-y-3">
                <textarea
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  placeholder="Paste email response from vendor account executive here..."
                  rows={5}
                  className="w-full text-xs font-mono p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-[#107e65] resize-y"
                />

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <span className="text-[11px] text-slate-500">
                    Extracts price, seat constraints, commitment duration, and
                    USDC acceptability.
                  </span>

                  <button
                    type="button"
                    onClick={handleProcessReply}
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
                      <Caption className="text-slate-400">
                        Extracted Counter
                      </Caption>
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
                      <Caption className="text-slate-400">
                        Negotiation Round
                      </Caption>
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
                            Counter-offer adheres to deterministic budget
                            ceiling. Ready for policy check, attestation, Arc
                            escrow, and verified release.
                          </p>
                        </div>
                        <Link
                          href={`/decision/${contractId}`}
                          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#107e65] hover:bg-[#0d6b55] text-white text-xs font-bold shadow-xs transition-colors shrink-0"
                        >
                          <span>Proceed to Escrow & Settlement</span>
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
                          The vendor agreed to discounted renewal pricing but
                          requires traditional billing (ACH / Wire). Tavryn
                          captures the savings in business traction metrics
                          without locking on-chain funds.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={handleRecordSavingsWithoutPayment}
                        disabled={
                          recordingSavings ||
                          negotiation?.status === "savings_recorded_no_payment"
                        }
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-purple-700 hover:bg-purple-800 text-white text-xs font-bold shadow-xs disabled:opacity-50 transition-colors shrink-0"
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
                              {negotiation?.status ===
                              "savings_recorded_no_payment"
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
          </div>
        ) : (
          /* Simulated Autonomous Mode Action Bar */
          <div className="mt-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <span className="text-xs text-slate-500">
              Agent will simulate multi-round counter-offers deterministically
              based on market benchmarks.
            </span>

            {(!negotiation ||
              negotiation.status === "in_progress" ||
              negotiation.status === "initiated") && (
              <button
                type="button"
                onClick={handleStartNegotiation}
                disabled={running}
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 sm:py-2 rounded-lg bg-[#107e65] hover:bg-[#0d6b55] text-white text-xs font-bold shadow-xs disabled:opacity-50 transition-colors w-full sm:w-auto shrink-0 cursor-pointer"
              >
                {running ? (
                  <>
                    <div className="h-3.5 w-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Negotiating...</span>
                  </>
                ) : (
                  <>
                    <Play className="h-3.5 w-3.5 fill-current" />
                    <span>Execute Autonomous Rounds</span>
                  </>
                )}
              </button>
            )}
          </div>
        )}

        {/* Business Memory Used Panel */}
        <div className="mt-6 rounded-xl border border-slate-200/70 dark:border-slate-800/60 bg-gradient-to-br from-slate-50/70 via-white to-slate-50/40 dark:from-[#111714] dark:via-[#131b17] dark:to-[#0f1412] p-5 sm:p-6 shadow-2xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-200/60 dark:border-slate-800/60">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-[#107e65]/10 text-[#107e65] dark:text-[#34d399] border border-[#107e65]/20">
                <Brain className="h-4 w-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <H3 className="text-slate-900 dark:text-white">
                    Business Memory Used
                  </H3>
                  {vendorMemory?.has_history ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-[#107e65] dark:text-[#34d399] border border-emerald-500/20">
                      <AgentIcon className="h-3 w-3" />
                      Prior Deal Anchored
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                      Initial Baseline (No prior deal)
                    </span>
                  )}
                </div>
                <Caption className="text-slate-500 dark:text-slate-400 mt-0.5">
                  Deterministic memory injected into autonomous negotiation
                  intelligence
                </Caption>
              </div>
            </div>

            <div className="flex items-center gap-2 self-start sm:self-auto">
              <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                Reputation Score:
              </span>
              <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700">
                {vendorMemory?.reputation_score ??
                  contract?.vendors?.reputation_score ??
                  50}{" "}
                / 100
              </span>
            </div>
          </div>

          {/* Memory Metrics Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-4">
            <div className="rounded-lg border border-slate-200/60 dark:border-slate-800/60 bg-white/60 dark:bg-slate-900/40 p-3">
              <Caption className="uppercase text-slate-400 dark:text-slate-500 font-bold block">
                Last Accepted Discount
              </Caption>
              <Mono
                as="p"
                className="text-sm font-bold text-slate-900 dark:text-white mt-1"
              >
                {vendorMemory?.accepted_discount_pct !== null &&
                vendorMemory?.accepted_discount_pct !== undefined
                  ? `${vendorMemory.accepted_discount_pct.toFixed(1)}%`
                  : "22.0% (Default)"}
              </Mono>
              <span className="text-[11px] text-slate-500 dark:text-slate-400">
                {vendorMemory?.has_history
                  ? "Anchored target price"
                  : "Telemetry estimate"}
              </span>
            </div>

            <div className="rounded-lg border border-slate-200/60 dark:border-slate-800/60 bg-white/60 dark:bg-slate-900/40 p-3">
              <Caption className="uppercase text-slate-400 dark:text-slate-500 font-bold block">
                Pace to Close
              </Caption>
              <Mono
                as="p"
                className="text-sm font-bold text-slate-900 dark:text-white mt-1"
              >
                {vendorMemory?.rounds_to_close
                  ? `${vendorMemory.rounds_to_close} rounds`
                  : "3 rounds (avg)"}
              </Mono>
              <span className="text-[11px] text-slate-500 dark:text-slate-400">
                Historical negotiation velocity
              </span>
            </div>

            <div className="rounded-lg border border-slate-200/60 dark:border-slate-800/60 bg-white/60 dark:bg-slate-900/40 p-3">
              <Caption className="uppercase text-slate-400 dark:text-slate-500 font-bold block">
                Last Final Price
              </Caption>
              <Mono
                as="p"
                className="text-sm font-bold text-slate-900 dark:text-white mt-1"
              >
                {vendorMemory?.last_price
                  ? `$${vendorMemory.last_price.toLocaleString()}`
                  : `$${baselinePrice.toLocaleString()}`}
              </Mono>
              <span className="text-[11px] text-slate-500 dark:text-slate-400">
                Prior renewal rate
              </span>
            </div>

            <div className="rounded-lg border border-slate-200/60 dark:border-slate-800/60 bg-white/60 dark:bg-slate-900/40 p-3">
              <Caption className="uppercase text-slate-400 dark:text-slate-500 font-bold block">
                Contract Delivery
              </Caption>
              <div className="flex items-center gap-1.5 mt-1">
                {vendorMemory?.delivered_ok !== false ? (
                  <span className="inline-flex items-center gap-1 text-xs font-bold text-[#107e65] dark:text-[#34d399]">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Verified Clean
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-600 dark:text-amber-400">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    Disputed
                  </span>
                )}
              </div>
              <span className="text-[11px] text-slate-500 dark:text-slate-400">
                Escrow release status
              </span>
            </div>
          </div>

          {/* Memory Insight Quote */}
          <div className="mt-3.5 p-3 rounded-lg bg-emerald-500/5 dark:bg-emerald-950/20 border border-emerald-500/15 dark:border-emerald-900/30 flex items-start gap-2.5">
            <AgentIcon className="h-4 w-4 text-[#107e65] dark:text-[#34d399] shrink-0 mt-0.5" />
            <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
              <span className="font-semibold text-slate-900 dark:text-white">
                Active Agent Strategy:{" "}
              </span>
              {vendorMemory?.summary_sentence ||
                vendorMemory?.insight ||
                (vendorMemory?.has_history
                  ? `${contract?.vendors?.name || contract?.service || "Vendor"} previously accepted a ${vendorMemory?.accepted_discount_pct?.toFixed(1) || "22.6"}% discount for a 12-month commitment, so a similar target is reasonable.`
                  : "First negotiation cycle for this vendor. Telemetry metrics will determine opening concessions, and final terms will be committed to vendor memory for future renewals.")}
            </p>
          </div>
        </div>

        {/* Timeline of Rounds */}
        <div className="mt-6 space-y-4">
          <H3 className="text-slate-900 dark:text-white">
            Exchange Transcript
          </H3>

          {sortedRoundNumbers.length === 0 ? (
            <div className="py-10 text-center text-xs font-medium text-slate-500 dark:text-slate-400 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
              No rounds exchanged yet. Use either the Real Vendor email outreach
              or Autonomous Rounds above.
            </div>
          ) : (
            sortedRoundNumbers.map((rnd) => {
              const roundTurns = roundsMap.get(rnd) || [];
              const agentTurn = roundTurns.find((t) => t.role === "agent");
              const vendorTurn = roundTurns.find((t) => t.role === "vendor");

              return (
                <div
                  key={rnd}
                  className="rounded-xl border border-slate-200/70 dark:border-slate-800/60 p-4 sm:p-5 space-y-3.5 bg-slate-50/50 dark:bg-[#131b17]/40"
                >
                  <div className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300 pb-2 border-b border-slate-200/60 dark:border-slate-800/60">
                    <Mono className="px-2.5 py-0.5 rounded-md bg-white dark:bg-slate-800 border border-slate-200/70 dark:border-slate-700/70 text-slate-700 dark:text-slate-300">
                      Round 0{rnd}
                    </Mono>
                    {vendorTurn?.accepted && (
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-[#107e65] dark:text-[#34d399] border border-emerald-500/20 flex items-center gap-1.5">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Offer Accepted by Vendor
                      </span>
                    )}
                  </div>

                  {/* Agent Proposal */}
                  {agentTurn && (
                    <div className="text-xs space-y-1.5 pl-3 border-l-2 border-[#107e65]/80">
                      <div className="flex items-center justify-between font-bold text-slate-900 dark:text-slate-100">
                        <div className="flex items-center gap-2">
                          <BodySmall
                            as="span"
                            className="font-bold text-slate-900 dark:text-white"
                          >
                            Tavryn Procurement
                          </BodySmall>
                          <Caption className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-[#107e65] dark:text-emerald-400">
                            Autonomous Agent
                          </Caption>
                        </div>
                        <Mono className="text-[#107e65] dark:text-[#34d399] bg-emerald-500/10 dark:bg-emerald-950/40 px-2 py-0.5 rounded-md border border-emerald-500/20">
                          Offer: ${agentTurn.amount?.toLocaleString()}
                        </Mono>
                      </div>
                      <Body className="text-slate-600 dark:text-slate-300 leading-relaxed bg-white/90 dark:bg-[#111714]/90 p-3.5 rounded-xl border border-slate-200/70 dark:border-slate-800/60 shadow-2xs">
                        {agentTurn.message}
                      </Body>
                    </div>
                  )}

                  {/* Vendor Counter */}
                  {vendorTurn && (
                    <div className="text-xs space-y-1.5 pl-3 border-l-2 border-slate-400 dark:border-slate-600">
                      <div className="flex items-center justify-between font-bold text-slate-900 dark:text-slate-100">
                        <div className="flex items-center gap-2">
                          <BodySmall
                            as="span"
                            className="font-bold text-slate-900 dark:text-white"
                          >
                            {vendorTurn.speaker}
                          </BodySmall>
                          <Caption className="px-1.5 py-0.5 rounded bg-slate-200/60 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                            Vendor Account Exec
                          </Caption>
                        </div>
                        <Mono className="text-slate-900 dark:text-slate-100 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md border border-slate-200/70 dark:border-slate-700/70">
                          {vendorTurn.accepted ? "Agreed:" : "Counter:"} $
                          {vendorTurn.amount?.toLocaleString()}
                        </Mono>
                      </div>
                      <Body className="text-slate-600 dark:text-slate-300 leading-relaxed bg-white/90 dark:bg-[#111714]/90 p-3.5 rounded-xl border border-slate-200/70 dark:border-slate-800/60 shadow-2xs">
                        {vendorTurn.message}
                      </Body>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Outcome Justification Grid */}
        {negotiation &&
          (negotiation.status === "agreed" ||
            negotiation.status === "savings_recorded_no_payment" ||
            negotiation.status === "walked_away") && (
            <div className="mt-8 pt-6 border-t border-slate-100 dark:border-slate-800/70 space-y-4">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Deterministic Verification Summary
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                <div className="p-4 rounded-xl border border-slate-200/70 dark:border-slate-800/60 bg-slate-50/50 dark:bg-[#131b17]/30 text-xs space-y-1">
                  <span className="font-bold text-slate-900 dark:text-white block">
                    1. Policy Ceiling Compliance
                  </span>
                  <p className="text-xs text-slate-600 dark:text-slate-300 font-medium leading-relaxed">
                    {explanation?.belowPolicyCeiling ||
                      `Adheres to approved budget ceiling ($${negotiation.final_price?.toLocaleString() || negotiation.current_offer?.toLocaleString()}).`}
                  </p>
                </div>

                <div className="p-4 rounded-xl border border-slate-200/70 dark:border-slate-800/60 bg-slate-50/50 dark:bg-[#131b17]/30 text-xs space-y-1">
                  <span className="font-bold text-slate-900 dark:text-white block">
                    2. Realized Cash Savings
                  </span>
                  <p className="text-xs text-slate-600 dark:text-slate-300 font-medium leading-relaxed">
                    {explanation?.dollarSavings ||
                      `Captured $${Number(negotiation.savings || 0).toLocaleString()} in annual recurring cash reductions.`}
                  </p>
                </div>

                <div className="p-4 rounded-xl border border-slate-200/70 dark:border-slate-800/60 bg-slate-50/50 dark:bg-[#131b17]/30 text-xs space-y-1">
                  <span className="font-bold text-slate-900 dark:text-white block">
                    3. Market Benchmark Alignment
                  </span>
                  <p className="text-xs text-slate-600 dark:text-slate-300 font-medium leading-relaxed">
                    {explanation?.competitorComparison ||
                      "Benchmarked within target quartile for enterprise peer contracts."}
                  </p>
                </div>

                <div className="p-4 rounded-xl border border-slate-200/70 dark:border-slate-800/60 bg-slate-50/50 dark:bg-[#131b17]/30 text-xs space-y-1">
                  <span className="font-bold text-slate-900 dark:text-white block">
                    4. Service SLA Integrity
                  </span>
                  <p className="text-xs text-slate-600 dark:text-slate-300 font-medium leading-relaxed">
                    {explanation?.serviceLevelsPreserved ||
                      "Active seat allocations, license entitlements, and core support tiers preserved."}
                  </p>
                </div>
              </div>
            </div>
          )}
      </div>
    </AppShell>
  );
}
