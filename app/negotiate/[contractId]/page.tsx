"use client";

import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Play,
} from "lucide-react";
import Link from "next/link";
import React, { use, useEffect, useState } from "react";

import { AppShell } from "@/components/AppShell";
import { Caption, H1, Mono } from "@/components/ui/text";

import {
  ContractData,
  DecisionExplanationCard,
  DraftEmailCard,
  DraftEmailData,
  Explanation,
  InboundReplyCard,
  NegotiationData,
  NegotiationTranscript,
  ReplyProcessResult,
  VendorMemoryCard,
  VendorMemoryData,
} from "./components";

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
  const [explanation, setExplanation] = useState<Explanation | null>(null);
  const [running, setRunning] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Negotiation Mode: "simulated" (autonomous loop) or "real" (human email + reply paste)
  const [mode, setMode] = useState<"simulated" | "real">("real");

  // Real-Vendor Mode State
  const [draftEmail, setDraftEmail] = useState<DraftEmailData | null>(null);
  const [draftingEmail, setDraftingEmail] = useState(false);
  const [emailApproved, setEmailApproved] = useState(false);
  const [copiedEmail, setCopiedEmail] = useState(false);

  // Inbound Reply Ingestion State
  const [replyText, setReplyText] = useState("");
  const [processingReply, setProcessingReply] = useState(false);
  const [extractedResult, setExtractedResult] =
    useState<ReplyProcessResult | null>(null);
  const [recordingSavings, setRecordingSavings] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      const res = await fetch(`/api/agent/negotiate/${contractId}`);
      const contentType = res.headers.get("content-type") || "";
      let json: Record<string, any> | null = null;

      if (contentType.includes("application/json")) {
        try {
          json = await res.json();
        } catch {
          json = null;
        }
      }

      if (!res.ok) {
        throw new Error(
          json?.error ||
            `Failed to load negotiation data (HTTP ${res.status})`,
        );
      }

      if (!json) {
        throw new Error("Invalid response format received from server");
      }

      setContract(json.contract);
      setNegotiation(json.negotiation);
      setVendorMemory(json.vendor_memory || json.memory || null);

      const activeVendor = json.contract?.vendor || json.contract?.vendors;
      if (activeVendor?.is_simulated) {
        setMode("simulated");
      } else {
        setMode("real");
      }
    } catch (err) {
      console.error("fetchData error:", err);
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [contractId]);

  const handleStartNegotiation = async () => {
    try {
      setRunning(true);
      setError(null);

      const res = await fetch(`/api/agent/negotiate/${contractId}`, {
        method: "POST",
      });

      const contentType = res.headers.get("content-type") || "";
      let payload: Record<string, any> | null = null;
      if (contentType.includes("application/json")) {
        try {
          payload = await res.json();
        } catch {
          payload = null;
        }
      }

      if (!res.ok) {
        throw new Error(
          payload?.error ||
            `Negotiation execution failed (HTTP ${res.status})`,
        );
      }

      const result = payload?.result || payload;
      if (result?.negotiation) {
        setNegotiation(result.negotiation);
      } else if (result?.conversation) {
        setNegotiation((prev) =>
          prev
            ? {
                ...prev,
                status: result.status,
                final_price: result.finalPrice,
                savings: result.savings,
                rounds: result.rounds,
                conversation: result.conversation,
              }
            : null,
        );
      }
      setExplanation(result?.explanation || null);
      if (result?.vendor_memory || result?.memoryUsed) {
        setVendorMemory(result.vendor_memory || result.memoryUsed);
      }
      await fetchData();
    } catch (err) {
      console.error("handleStartNegotiation error:", err);
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

      const contentType = res.headers.get("content-type") || "";
      let data: Record<string, any> | null = null;
      if (contentType.includes("application/json")) {
        try {
          data = await res.json();
        } catch {
          data = null;
        }
      }

      if (!res.ok) {
        throw new Error(
          data?.error ||
            `Failed to draft outreach email (HTTP ${res.status})`,
        );
      }

      setDraftEmail(data?.draft || null);
      setEmailApproved(false);
    } catch (err) {
      console.error("handleDraftEmail error:", err);
      setError((err as Error).message);
    } finally {
      setDraftingEmail(false);
    }
  };

  const handleCopyEmail = () => {
    if (!draftEmail) return;
    const fullText = `To: ${draftEmail.to}\nSubject: ${draftEmail.subject}\n\n${draftEmail.body}`;
    navigator.clipboard.writeText(fullText);
    setCopiedEmail(true);
    setTimeout(() => setCopiedEmail(false), 2000);
  };

  const handleProcessReply = async () => {
    if (!replyText.trim()) return;
    try {
      setProcessingReply(true);
      setError(null);
      setSaveSuccess(null);

      const res = await fetch(`/api/agent/negotiate/${contractId}/reply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rawReply: replyText }),
      });

      const contentType = res.headers.get("content-type") || "";
      let data: Record<string, any> | null = null;
      if (contentType.includes("application/json")) {
        try {
          data = await res.json();
        } catch {
          data = null;
        }
      }

      if (!res.ok) {
        throw new Error(
          data?.error ||
            `Failed to process vendor reply (HTTP ${res.status})`,
        );
      }

      if (data?.result) {
        setExtractedResult(data.result);
        if (data.result.negotiation) {
          setNegotiation(data.result.negotiation);
        }
        if (data.result.explanation) {
          setExplanation(data.result.explanation);
        }
      }
      await fetchData();
    } catch (err) {
      console.error("handleProcessReply error:", err);
      setError((err as Error).message);
    } finally {
      setProcessingReply(false);
    }
  };

  const handleRecordSavingsWithoutPayment = async () => {
    if (!extractedResult) return;
    try {
      setRecordingSavings(true);
      setError(null);

      const res = await fetch(
        `/api/agent/negotiate/${contractId}/record-savings`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            negotiationId: negotiation?.id,
            finalPrice:
              extractedResult.extraction.counter_offer ||
              negotiation?.current_offer,
            reason: extractedResult.reason,
            notes: extractedResult.extraction.notes,
          }),
        },
      );

      const contentType = res.headers.get("content-type") || "";
      let data: Record<string, any> | null = null;
      if (contentType.includes("application/json")) {
        try {
          data = await res.json();
        } catch {
          data = null;
        }
      }

      if (!res.ok) {
        throw new Error(
          data?.error || `Failed to record savings (HTTP ${res.status})`,
        );
      }

      const savedAmount =
        data?.result?.savings || data?.savings || extractedResult.extraction.counter_offer || 0;
      setSaveSuccess(
        `Successfully captured $${Number(savedAmount).toLocaleString()} in annual recurring savings off-chain. Traction metrics updated!`,
      );
      await fetchData();
    } catch (err) {
      console.error("handleRecordSavingsWithoutPayment error:", err);
      setError((err as Error).message);
    } finally {
      setRecordingSavings(false);
    }
  };

  if (loading && !contract) {
    return (
      <div className="min-h-screen bg-slate-100/60 dark:bg-slate-950 flex items-center justify-center p-6 font-sans">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 border-2 border-[#107e65] border-t-transparent rounded-full animate-spin" />
          <p className="text-xs text-slate-500 font-medium">
            Loading negotiation room...
          </p>
        </div>
      </div>
    );
  }

  const baselinePrice =
    negotiation?.original_price ?? contract?.current_price ?? 0;
  const currentOffer =
    negotiation?.final_price ?? negotiation?.current_offer ?? baselinePrice;
  const savings = baselinePrice - currentOffer;
  const savingsPct = baselinePrice > 0 ? (savings / baselinePrice) * 100 : 0;
  const activeVendor = contract?.vendor || contract?.vendors;
  const isSimulated = Boolean(activeVendor?.is_simulated);

  return (
    <AppShell
      businessName="Tavryn Demo Co"
      isReal={!isSimulated}
      breadcrumbs={[
        { label: "Overview", href: "/" },
        { label: "Negotiations", href: "/negotiations" },
        { label: `${contract?.service || "Contract"} Details` },
      ]}
      currency="USDC"
    >
      {/* Top Action Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <Link
          href="/negotiations"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Back to Negotiations</span>
        </Link>

        {negotiation &&
          (negotiation.status === "agreed" ||
            negotiation.status === "savings_recorded_no_payment") && (
            <Link
              href={`/decision/${contractId}`}
              className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 transition-colors shadow-2xs w-full sm:w-auto"
            >
              <span>View Policy &amp; Escrow Verification</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          )}
      </div>

      {/* Main Negotiation Container */}
      <div className="rounded-2xl bg-white/90 dark:bg-[#111714]/90 border border-slate-200/70 dark:border-slate-800/60 p-6 sm:p-7 shadow-[0_1px_3px_rgba(0,0,0,0.03),0_6px_16px_rgba(0,0,0,0.02)] dark:shadow-[0_1px_3px_rgba(0,0,0,0.2)]">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-slate-100 dark:border-slate-800/70">
          <div>
            <div className="flex items-center gap-2">
              <H1 className="text-slate-900 dark:text-white">
                {contract?.service || "Contract"}
              </H1>
              <span className="capitalize text-xs font-semibold px-2.5 py-0.5 rounded-md bg-slate-100/80 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200/60 dark:border-slate-700/60">
                {contract?.category ||
                  activeVendor?.category ||
                  "Subscription"}
              </span>
              {activeVendor ? (
                activeVendor.is_simulated ? (
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
                {activeVendor?.name || contract?.service}
              </span>
              {activeVendor?.contact && ` (${activeVendor.contact})`}
            </p>
          </div>

          {/* Price Stats */}
          <div className="grid grid-cols-3 gap-2 sm:flex sm:items-center sm:gap-3 w-full sm:w-auto">
            <div className="rounded-xl border border-slate-200/70 dark:border-slate-800/60 bg-slate-50/50 dark:bg-slate-800/40 px-2 sm:px-4 py-2 sm:py-2.5 text-center sm:text-right">
              <Caption className="uppercase text-slate-400 dark:text-slate-500 block text-[10px] sm:text-xs">
                Original Rate
              </Caption>
              <Mono
                as="p"
                className="text-xs sm:text-base text-slate-400 line-through"
              >
                ${baselinePrice.toLocaleString()}
              </Mono>
            </div>

            <div className="rounded-xl border border-slate-200/70 dark:border-slate-800/60 bg-slate-50/50 dark:bg-slate-800/40 px-2 sm:px-4 py-2 sm:py-2.5 text-center sm:text-right">
              <Caption className="uppercase text-slate-500 dark:text-slate-400 block text-[10px] sm:text-xs">
                Current Counter
              </Caption>
              <Mono
                as="p"
                className="text-xs sm:text-base text-slate-900 dark:text-white font-semibold"
              >
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
                ${savings > 0 ? savings.toLocaleString() : 0} (
                {savingsPct.toFixed(1)}%)
              </Mono>
            </div>
          </div>
        </div>

        {/* Error Notification */}
        {error && (
          <div className="mt-4 p-3.5 rounded-xl border border-rose-200 bg-rose-50 dark:bg-rose-950/20 text-rose-700 dark:text-rose-300 text-xs font-semibold flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {saveSuccess && (
          <div className="mt-4 p-3.5 rounded-xl border border-purple-200 bg-purple-50 dark:bg-purple-950/20 text-purple-800 dark:text-purple-300 text-xs font-semibold flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-purple-600 dark:text-purple-400" />
            <span>{saveSuccess}</span>
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
            <DraftEmailCard
              draftEmail={draftEmail}
              draftingEmail={draftingEmail}
              emailApproved={emailApproved}
              copiedEmail={copiedEmail}
              onDraftEmail={handleDraftEmail}
              onCopyEmail={handleCopyEmail}
              onApproveEmail={() => setEmailApproved(true)}
            />

            {/* Step 2: Paste Vendor Reply */}
            <InboundReplyCard
              contractId={contractId}
              replyText={replyText}
              processingReply={processingReply}
              recordingSavings={recordingSavings}
              extractedResult={extractedResult}
              negotiation={negotiation}
              onReplyTextChange={setReplyText}
              onProcessReply={handleProcessReply}
              onRecordSavingsWithoutPayment={handleRecordSavingsWithoutPayment}
            />
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
        <VendorMemoryCard
          vendorMemory={vendorMemory}
          contract={contract}
          baselinePrice={baselinePrice}
        />

        {/* Timeline of Rounds */}
        <NegotiationTranscript
          conversation={negotiation?.conversation || []}
        />

        {/* Outcome Justification Grid */}
        {negotiation && (
          <DecisionExplanationCard
            negotiation={negotiation}
            explanation={explanation}
          />
        )}
      </div>
    </AppShell>
  );
}
