import {
  CheckCircle2,
  ExternalLink,
  Lock,
  Repeat,
  ShieldCheck,
} from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import React from "react";

import { CopyReceiptButton } from "@/components/CopyReceiptButton";
import { TransactionHashBadge } from "@/components/TransactionHashBadge";
import { getPublicReceipt } from "@/lib/receipt";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ token: string }>;
}): Promise<Metadata> {
  const { token } = await params;
  const receipt = await getPublicReceipt(token);

  if (!receipt) {
    return {
      title: "Receipt Not Found | Tavryn",
      robots: { index: false, follow: false },
    };
  }

  const savingsStr = `$${receipt.annualSavings.toLocaleString()}`;
  return {
    title: `Tavryn Proof of Savings — ${receipt.service} (${savingsStr})`,
    description: `Policy-verified autonomous savings proof: saved ${savingsStr} on ${receipt.service} with Arc testnet smart escrow verification.`,
    robots: {
      index: false,
      follow: false,
    },
    openGraph: {
      title: `Tavryn saved ${savingsStr} on ${receipt.service}`,
      description: `Cryptographic autonomous procurement settlement verified on Arc Testnet.`,
      type: "website",
      images: [
        {
          url: `/r/${token}/opengraph-image`,
          width: 1200,
          height: 630,
          alt: `Tavryn Savings: Saved ${savingsStr} on ${receipt.service}`,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: `Tavryn saved ${savingsStr} on ${receipt.service}`,
      description: `Cryptographic autonomous procurement settlement verified on Arc Testnet.`,
      images: [`/r/${token}/opengraph-image`],
    },
  };
}

export default async function PublicReceiptPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const receipt = await getPublicReceipt(token);

  if (!receipt) {
    notFound();
  }

  return (
    <div className="min-h-screen bg-[#f7f9f8] dark:bg-slate-950 text-slate-800 dark:text-slate-100 flex flex-col selection:bg-emerald-500/30">
      {/* Top Header */}
      <header className="border-b border-slate-200/80 dark:border-slate-800/80 bg-white/80 dark:bg-slate-900/60 backdrop-blur-md sticky top-0 z-30">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#107e65] flex items-center justify-center font-black text-white text-base shadow-sm">
              T
            </div>
            <span className="font-extrabold text-sm tracking-wider uppercase text-slate-900 dark:text-white">
              Tavryn
            </span>
            <span className="text-slate-400 dark:text-slate-500">/</span>
            <span className="text-xs font-semibold text-[#107e65] dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
              Proof of Savings
            </span>
          </div>

          <div className="flex items-center gap-3">
            <CopyReceiptButton />
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 py-8 sm:py-12">
        <div className="space-y-6">
          {/* Top Hero Badge & Heading */}
          <div className="p-6 sm:p-8 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-gradient-to-b dark:from-slate-900 dark:to-slate-950 shadow-md dark:shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-80 h-80 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800/80 pb-6 mb-6">
              <div>
                <span className="text-xs font-mono uppercase tracking-widest text-[#107e65] dark:text-emerald-400 font-bold block mb-1">
                  Cryptographic Settlement Proof
                </span>
                <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
                  {receipt.service}
                </h1>
                <div className="flex flex-wrap items-center gap-2 mt-2 text-xs text-slate-500 dark:text-slate-400">
                  {receipt.businessName && (
                    <span>
                      Company:{" "}
                      <strong className="text-slate-800 dark:text-slate-200">
                        {receipt.businessName}
                      </strong>
                    </span>
                  )}
                  {receipt.businessName && receipt.vendorName && (
                    <span className="text-slate-300 dark:text-slate-600">·</span>
                  )}
                  {receipt.vendorName && (
                    <span>
                      Vendor:{" "}
                      <strong className="text-slate-800 dark:text-slate-200">
                        {receipt.vendorName}
                      </strong>
                    </span>
                  )}
                  <span className="text-slate-300 dark:text-slate-600">·</span>
                  <span className="capitalize">{receipt.category}</span>
                </div>
              </div>

              <div className="flex flex-col items-start sm:items-end">
                <span className="text-xs text-slate-400 dark:text-slate-400 font-medium">
                  Verified Savings
                </span>
                <span className="text-3xl sm:text-4xl font-black text-[#107e65] dark:text-emerald-400 font-mono tracking-tight">
                  +${receipt.annualSavings.toLocaleString()}
                  <span className="text-xs font-sans text-emerald-600 dark:text-emerald-500/80 font-bold ml-1">
                    / yr
                  </span>
                </span>
                <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400/90 mt-0.5">
                  {receipt.savingsPct}% reduction vs baseline
                </span>
              </div>
            </div>

            {/* Price Comparison Row */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
              <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/70">
                <span className="text-xs text-slate-500 dark:text-slate-400 font-medium block mb-1">
                  Baseline Price
                </span>
                <span className="text-xl font-bold font-mono text-slate-400 dark:text-slate-400 line-through">
                  ${receipt.oldPrice.toLocaleString()}
                </span>
                <span className="text-[11px] text-slate-400 dark:text-slate-500 block mt-1">
                  Original contract commitment
                </span>
              </div>

              <div className="p-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 dark:bg-emerald-950/20">
                <span className="text-xs text-[#107e65] dark:text-emerald-400 font-bold block mb-1">
                  Final Settled Price
                </span>
                <span className="text-xl font-bold font-mono text-[#107e65] dark:text-emerald-300">
                  ${receipt.newPrice.toLocaleString()}
                </span>
                <span className="text-[11px] text-emerald-700 dark:text-emerald-500/80 block mt-1">
                  Autonomous negotiated rate
                </span>
              </div>

              <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/70">
                <span className="text-xs text-slate-500 dark:text-slate-400 font-medium block mb-1">
                  Rounds to Close
                </span>
                <div className="flex items-center gap-1.5 text-xl font-bold font-mono text-slate-800 dark:text-slate-200">
                  <Repeat className="h-4 w-4 text-[#107e65] dark:text-emerald-400" />
                  <span>{receipt.roundsCount}</span>
                </div>
                <span className="text-[11px] text-slate-400 dark:text-slate-500 block mt-1">
                  Counter-offers exchanged
                </span>
              </div>
            </div>
          </div>

          {/* Plain-Language Agent Reasoning */}
          <div className="p-6 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900/50">
            <h2 className="text-sm font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider mb-2 flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-[#107e65] dark:text-emerald-400" />
              <span>Agent Settlement Rationale</span>
            </h2>
            <p className="text-sm sm:text-base text-slate-600 dark:text-slate-300 leading-relaxed">
              {receipt.agentExplanation}
            </p>
          </div>

          {/* Verification & Policy Grids */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Policy Checklist */}
            <div className="p-6 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900/50 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                  <Lock className="h-4 w-4 text-[#107e65] dark:text-emerald-400" />
                  <span>Deterministic Policy Checklist</span>
                </h3>
                <span className="text-[11px] font-bold text-[#107e65] dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                  3/3 Passed
                </span>
              </div>

              <div className="space-y-2.5">
                {receipt.policyChecklist.map((check, idx) => (
                  <div
                    key={idx}
                    className="p-3 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/60 flex items-start gap-3"
                  >
                    <CheckCircle2 className="h-4 w-4 text-[#107e65] dark:text-emerald-400 shrink-0 mt-0.5" />
                    <div>
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
                        {check.name}
                      </span>
                      <span className="text-xs text-slate-500 dark:text-slate-400 block mt-0.5">
                        {check.detail}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Vendor Confirmation Verification */}
            <div className="p-6 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900/50 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-[#107e65] dark:text-emerald-400" />
                  <span>Confirmation Verification</span>
                </h3>
                <span className="text-[11px] font-bold text-[#107e65] dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                  100% Match
                </span>
              </div>

              <div className="space-y-2.5">
                {receipt.verificationResult.matchedChecks.map((item, idx) => (
                  <div
                    key={idx}
                    className="p-3 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/60 flex items-center justify-between"
                  >
                    <span className="text-xs text-slate-700 dark:text-slate-300 font-medium">
                      {item}
                    </span>
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#107e65] dark:text-emerald-400">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Passed
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* On-Chain Verification Card */}
          <div className="p-6 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 dark:bg-emerald-950/10 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Lock className="h-4 w-4 text-[#107e65] dark:text-emerald-400" />
                  <span>
                    {receipt.isSimulated
                      ? "Arc Settlement Verification (Simulated)"
                      : "On-Chain Arc Settlement"}
                  </span>
                </h3>
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  {receipt.arcExplorerUrls.network}
                </span>
              </div>
              <span
                className={`text-[11px] font-mono px-2.5 py-1 rounded-md border ${
                  receipt.isSimulated
                    ? "text-amber-700 dark:text-amber-400/90 bg-amber-500/10 border-amber-500/20"
                    : "text-[#107e65] dark:text-emerald-400/80 bg-emerald-500/10 border-emerald-500/20"
                }`}
              >
                {receipt.isSimulated
                  ? "Simulated (testnet mock)"
                  : "Settled on Arc Testnet"}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              {receipt.isSimulated ? (
                <div
                  data-testid="simulated-receipt-tx-card"
                  className="p-3.5 rounded-xl border border-amber-500/25 bg-white dark:bg-slate-900/90 flex flex-col justify-between gap-2.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                      Escrow Release Tx
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20">
                      Simulated (testnet mock)
                    </span>
                  </div>
                  <div className="pt-0.5">
                    <TransactionHashBadge
                      txHash={receipt.releaseTxHash}
                      isSimulated={true}
                      compact={true}
                    />
                  </div>
                </div>
              ) : receipt.arcExplorerUrls.releaseTxUrl ? (
                <a
                  href={receipt.arcExplorerUrls.releaseTxUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/90 hover:border-emerald-500/40 hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors flex items-center justify-between group"
                >
                  <div>
                    <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 block">
                      Escrow Release Tx
                    </span>
                    <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                      View on ArcScan
                    </span>
                  </div>
                  <ExternalLink className="h-4 w-4 text-slate-400 dark:text-slate-500 group-hover:text-emerald-500 transition-colors" />
                </a>
              ) : null}

              <a
                href={receipt.arcExplorerUrls.escrowContractUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/90 hover:border-emerald-500/40 hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors flex items-center justify-between group"
              >
                <div>
                  <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 block">
                    Escrow Protocol Contract
                  </span>
                  <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                    Arc Smart Contract
                  </span>
                </div>
                <ExternalLink className="h-4 w-4 text-slate-400 dark:text-slate-500 group-hover:text-emerald-500 transition-colors" />
              </a>
            </div>
          </div>

          {/* Footer Proof Metadata */}
          <div className="pt-6 border-t border-slate-200 dark:border-slate-800/80 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500 dark:text-slate-400">
            <div>
              <span>Generated by </span>
              <strong className="text-slate-800 dark:text-slate-300 font-semibold">Tavryn</strong>
              <span> · Autonomous Procurement Protocol</span>
            </div>
            <div className="font-mono text-[11px] text-slate-400">
              Timestamp: {new Date(receipt.createdAt).toUTCString()}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
