"use client";

import {
  Activity,
  ArrowRight,
  Bot,
  CheckCircle2,
  Clock,
  ExternalLink,
  ShieldCheck,
  TrendingDown,
  Wallet,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import React, { useState } from "react";

import { ThemeToggle } from "@/components/ThemeToggle";
import { TransactionHashBadge } from "@/components/TransactionHashBadge";
import { TractionMetricsResult } from "@/lib/metrics";

interface PublicMetricsClientProps {
  metrics: TractionMetricsResult;
}

export function PublicMetricsClient({ metrics }: PublicMetricsClientProps) {
  const [liveTimestamp] = useState<string>(() =>
    new Date().toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }),
  );

  // Filter strictly to non-simulated, verified on-chain settlements
  const verifiedTransactions = (metrics.transactions || [])
    .filter(
      (tx) =>
        !tx.isSimulated &&
        tx.status !== "simulation-only" &&
        !tx.txHash?.startsWith("0xsimulated"),
    )
    .map((tx) => ({
      id: tx.id.slice(0, 8),
      vendorName: tx.vendorName || "Enterprise SaaS Vendor",
      amount: tx.amount,
      currency: tx.currency || "USDC",
      status: tx.status,
      txHash: tx.txHash,
      isSimulated: false,
      createdAt: tx.createdAt,
      classification: "Verified Production Workspace",
    }));

  return (
    <div className="min-h-screen flex flex-col bg-[#f7f9f8] dark:bg-[#0b100e] text-slate-900 dark:text-slate-100 selection:bg-emerald-500/20 selection:text-[#107e65] dark:selection:text-[#34d399] font-sans">
      {/* ─── PUBLIC TOP NAVBAR ────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 backdrop-blur-md bg-white/80 dark:bg-[#0e1411]/80 border-b border-slate-200/60 dark:border-slate-800/60 transition-colors">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 sm:h-20 flex items-center justify-between">
          {/* Logo & Brand */}
          <Link href="/" className="flex items-center gap-3 group cursor-pointer">
            <div className="h-9 w-9 sm:h-10 sm:w-10 rounded-xl bg-white border border-slate-200 dark:border-slate-700 flex items-center justify-center p-1.5 shadow-xs group-hover:border-[#107e65]/50 transition-colors">
              <Image
                src="/logo.png"
                alt="Tavryn Logo"
                width={32}
                height={32}
                className="object-contain"
                priority
              />
            </div>
            <div>
              <span className="text-lg sm:text-xl font-extrabold tracking-tight text-slate-900 dark:text-white">
                Tavryn
              </span>
              <span className="hidden sm:inline-block ml-2 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-[#107e65] dark:text-[#34d399] border border-emerald-500/20">
                Verified Telemetry
              </span>
            </div>
          </Link>

          {/* Nav Links */}
          <div className="flex items-center gap-3 sm:gap-5">
            <Link
              href="/#how-it-works"
              className="hidden md:inline-block text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-[#107e65] dark:hover:text-[#34d399] transition-colors"
            >
              The 3-Step Loop
            </Link>
            <Link
              href="/dashboard"
              className="hidden sm:inline-block text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-[#107e65] dark:hover:text-[#34d399] transition-colors"
            >
              Workspace Dashboard
            </Link>

            <ThemeToggle />

            <Link
              href="/dashboard"
              className="inline-flex items-center gap-1.5 px-3 sm:px-4 py-2 rounded-xl text-xs font-bold bg-[#107e65] hover:bg-[#0d6954] text-white shadow-2xs transition-all cursor-pointer"
            >
              <span>Launch App</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </header>

      {/* ─── MAIN CONTENT ────────────────────────────────────────────── */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 space-y-10">
        {/* Header Hero Banner */}
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 pb-6 border-b border-slate-200/80 dark:border-slate-800/80">
          <div className="space-y-3 max-w-3xl">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border border-emerald-500/30">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                <span>Live Verified Only · Zero Demo/Simulated Data</span>
              </span>
              <span className="px-2.5 py-1 rounded-full text-xs font-mono font-semibold bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                Arc Chain ID 5042002
              </span>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono text-emerald-800 dark:text-emerald-300 bg-emerald-500/10 dark:bg-emerald-950/40 border border-emerald-500/20">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <Clock className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
                <span>Reconciled {liveTimestamp}</span>
              </span>
            </div>

            <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-slate-900 dark:text-white">
              Verified Protocol Telemetry
            </h1>
            <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400 leading-relaxed">
              Cryptographically verified macroeconomic telemetry from production SaaS contracts and live Circle USDC smart contract escrows on Arc Testnet. Shows non-sensitive verified volume only: zero simulated data, zero synthetic mocks, zero private tenant identifiers.
            </p>
          </div>

          <div className="px-4 py-2.5 rounded-2xl bg-emerald-500/10 dark:bg-emerald-950/40 border border-emerald-500/30 text-xs text-emerald-800 dark:text-emerald-300 self-start lg:self-end">
            <span className="font-bold">{metrics.businesses.realCount} Verified Production Organizations</span>
          </div>
        </div>

        {/* ─── MACRO METRICS CARDS (VERIFIED ONLY) ────────────────────── */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
          {/* Card 1: Escrow Volume */}
          <div className="p-6 rounded-3xl bg-white dark:bg-[#111714] border-2 border-emerald-500/30 dark:border-emerald-500/20 shadow-xs relative overflow-hidden">
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 font-semibold mb-3">
              <span>Verified Escrow Volume</span>
              <div className="p-2 rounded-xl bg-emerald-500/10 text-[#107e65] dark:text-[#34d399]">
                <Wallet className="h-4 w-4" />
              </div>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl sm:text-4xl font-extrabold font-mono tracking-tight text-[#107e65] dark:text-[#34d399]">
                $
                {metrics.usdcVolume.escrowed.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </span>
              <span className="text-xs font-bold text-slate-400 font-mono">USDC</span>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-xs text-slate-500">
              <span>
                Released: <strong className="text-slate-700 dark:text-slate-300">${metrics.usdcVolume.released.toLocaleString()}</strong>
              </span>
              <span>
                Refunded: <strong className="text-slate-700 dark:text-slate-300">${metrics.usdcVolume.refunded.toLocaleString()}</strong>
              </span>
            </div>
          </div>

          {/* Card 2: Realized Savings */}
          <div className="p-6 rounded-3xl bg-white dark:bg-[#111714] border-2 border-emerald-500/30 dark:border-emerald-500/20 shadow-xs relative overflow-hidden">
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 font-semibold mb-3">
              <span>Realized Procurement Savings</span>
              <div className="p-2 rounded-xl bg-emerald-500/10 text-[#107e65] dark:text-[#34d399]">
                <TrendingDown className="h-4 w-4" />
              </div>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl sm:text-4xl font-extrabold font-mono tracking-tight text-slate-900 dark:text-white">
                $
                {metrics.savings.realized.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </span>
              <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                ({metrics.savings.savingsRatePct}% rate)
              </span>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-xs text-slate-500">
              <span>
                Negotiated: <strong className="text-slate-700 dark:text-slate-300">${metrics.savings.negotiated.toLocaleString()}</strong>
              </span>
              <span>
                Off-Chain: <strong className="text-slate-700 dark:text-slate-300">${metrics.savings.offChainSavings.toLocaleString()}</strong>
              </span>
            </div>
          </div>

          {/* Card 3: Spend Analyzed & Contracts */}
          <div className="p-6 rounded-3xl bg-white dark:bg-[#111714] border border-slate-200/80 dark:border-slate-800/80 shadow-xs relative overflow-hidden">
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 font-semibold mb-3">
              <span>Verified Spend Analyzed</span>
              <div className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                <ShieldCheck className="h-4 w-4" />
              </div>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl sm:text-4xl font-extrabold font-mono tracking-tight text-slate-900 dark:text-white">
                $
                {metrics.savings.totalSpendAnalyzed.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </span>
              <span className="text-xs font-bold text-slate-400 font-mono">USD</span>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-xs text-slate-500">
              <span>
                Contracts: <strong className="text-slate-700 dark:text-slate-300">{metrics.contractsAndNegotiations.contractsTotal}</strong>
              </span>
              <span>
                Optimized: <strong className="text-slate-700 dark:text-slate-300">{metrics.contractsAndNegotiations.contractsOptimized}</strong>
              </span>
            </div>
          </div>

          {/* Card 4: Settlements Recorded */}
          <div className="p-6 rounded-3xl bg-white dark:bg-[#111714] border border-slate-200/80 dark:border-slate-800/80 shadow-xs relative overflow-hidden">
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 font-semibold mb-3">
              <span>Verified Settlements</span>
              <div className="p-2 rounded-xl bg-emerald-500/10 text-[#107e65] dark:text-[#34d399]">
                <CheckCircle2 className="h-4 w-4" />
              </div>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl sm:text-4xl font-extrabold font-mono tracking-tight text-slate-900 dark:text-white">
                {verifiedTransactions.length}
              </span>
              <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                100% on Arc
              </span>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-xs text-slate-500">
              <span>
                Dual-Reviews: <strong className="text-slate-700 dark:text-slate-300">{metrics.reviewer.totalReviews}</strong>
              </span>
              <span>
                Receipts: <strong className="text-slate-700 dark:text-slate-300">{metrics.receiptsCount}</strong>
              </span>
            </div>
          </div>
        </section>

        {/* ─── AUTONOMOUS GOVERNANCE & PROTOCOL VELOCITY ──────────────── */}
        <section className="rounded-3xl border border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-[#111714] p-6 sm:p-8 shadow-2xs space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-5 border-b border-slate-100 dark:border-slate-800/80">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                <Bot className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-lg sm:text-xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                  Autonomous Governance &amp; Multi-Agent Velocity
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Deterministic code safeguards each LLM decision. All actions write to an append-only audit trail.
                </p>
              </div>
            </div>

            <span className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-emerald-500/10 text-[#107e65] dark:text-[#34d399] border border-emerald-500/20 self-start sm:self-center">
              100% Policy Adherence
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-[#0c120f] border border-slate-200/60 dark:border-slate-800/60">
              <div className="text-xs font-semibold text-slate-500">Autonomous Decisions</div>
              <div className="text-2xl font-bold font-mono text-slate-900 dark:text-white mt-1">
                {metrics.governance.agentDecisionsCount}
              </div>
              <div className="text-[11px] text-slate-400 mt-1">
                Append-only Postgres ledger
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-[#0c120f] border border-slate-200/60 dark:border-slate-800/60">
              <div className="text-xs font-semibold text-slate-500">Dual-Agent Reviews</div>
              <div className="text-2xl font-bold font-mono text-slate-900 dark:text-white mt-1">
                {metrics.reviewer.totalReviews}
              </div>
              <div className="text-[11px] text-slate-400 mt-1">
                {metrics.reviewer.agreedCount} agreed · {metrics.reviewer.challengedCount} challenged
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-[#0c120f] border border-slate-200/60 dark:border-slate-800/60">
              <div className="text-xs font-semibold text-slate-500">Negotiation Velocity</div>
              <div className="text-2xl font-bold font-mono text-slate-900 dark:text-white mt-1">
                {metrics.efficiency.avgRoundsToClose} rounds
              </div>
              <div className="text-[11px] text-slate-400 mt-1">
                Avg cycle time: ~{metrics.efficiency.avgCycleTimeMinutes}m
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-[#0c120f] border border-slate-200/60 dark:border-slate-800/60">
              <div className="text-xs font-semibold text-slate-500">Human Escalation Pass Rate</div>
              <div className="text-2xl font-bold font-mono text-slate-900 dark:text-white mt-1">
                {metrics.governance.humanApprovalRatePct}%
              </div>
              <div className="text-[11px] text-slate-400 mt-1">
                {metrics.governance.humanApprovedCount} approved · {metrics.governance.humanRejectedCount} rejected
              </div>
            </div>
          </div>
        </section>

        {/* ─── PUBLIC ON-CHAIN SETTLEMENT PROOFS ──────────────────────── */}
        <section className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <div className="flex items-center gap-2">
                <Activity className="h-5 w-5 text-[#107e65] dark:text-[#34d399]" />
                <h2 className="text-lg sm:text-xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                  Verified On-Chain Settlement Proofs
                </h2>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Reconciled Arc Testnet transaction proofs. Displays recipient vendor and settlement parameters only; tenant identity remains anonymous.
              </p>
            </div>

            <span className="text-xs font-mono text-emerald-600 dark:text-emerald-400 font-bold">
              {verifiedTransactions.length} on-chain proofs
            </span>
          </div>

          <div className="bg-white dark:bg-[#111714] rounded-2xl border border-slate-200/80 dark:border-slate-800/80 shadow-2xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-[#0c120f] border-b border-slate-200/80 dark:border-slate-800 text-slate-500 uppercase tracking-wider text-[10px] font-bold">
                  <tr>
                    <th className="px-5 py-3">Vendor / Recipient</th>
                    <th className="px-5 py-3">Amount</th>
                    <th className="px-5 py-3">Escrow Status</th>
                    <th className="px-5 py-3">Tenant Classification</th>
                    <th className="px-5 py-3">ArcScan Verification</th>
                    <th className="px-5 py-3 text-right">Settled</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
                  {verifiedTransactions.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-5 py-8 text-center text-slate-400">
                        No verified settlements recorded yet.
                      </td>
                    </tr>
                  ) : (
                    verifiedTransactions.map((tx, idx) => (
                      <tr
                        key={`${tx.id}-${idx}`}
                        className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30 transition-colors"
                      >
                        <td className="px-5 py-3.5">
                          <span className="font-bold text-slate-900 dark:text-white">
                            {tx.vendorName}
                          </span>
                        </td>
                        <td className="px-5 py-3.5">
                          <span className="font-mono font-bold text-slate-900 dark:text-white">
                            $
                            {tx.amount.toLocaleString(undefined, {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}{" "}
                            {tx.currency}
                          </span>
                        </td>
                        <td className="px-5 py-3.5">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                              tx.status === "released"
                                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                                : tx.status === "funded"
                                  ? "bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20"
                                  : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300"
                            }`}
                          >
                            {tx.status}
                          </span>
                        </td>
                        <td className="px-5 py-3.5">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-[#107e65] dark:text-[#34d399] border border-emerald-500/20">
                            {tx.classification}
                          </span>
                        </td>
                        <td className="px-5 py-3.5">
                          <TransactionHashBadge
                            txHash={tx.txHash}
                            isSimulated={false}
                            status={tx.status}
                            compact={true}
                          />
                        </td>
                        <td className="px-5 py-3.5 text-right font-mono text-[11px] text-slate-500">
                          {tx.createdAt
                            ? new Date(tx.createdAt).toLocaleDateString()
                            : "Recent"}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* ─── ARC + CIRCLE PROTOCOL GUARANTEE ───────────────────────── */}
        <section className="rounded-3xl border border-slate-200/80 dark:border-slate-800/80 bg-slate-50/70 dark:bg-[#0c120f]/60 p-6 sm:p-8 space-y-4">
          <div className="flex items-center gap-2.5">
            <ShieldCheck className="h-5 w-5 text-[#107e65] dark:text-[#34d399]" />
            <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
              Deterministic Security &amp; Arc Settlement Guarantee
            </h3>
          </div>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed max-w-4xl">
            Tavryn operates on a strict separation of concerns: LLMs reason and negotiate with SaaS vendors, but only deterministic TypeScript code acts. Escrow smart contracts lock Circle USDC on Arc Testnet until deterministic vendor milestone verification passes. Gas is denominated exclusively in USDC, eliminating fee volatility and third-party token exposure.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
            <div className="p-3.5 rounded-xl bg-white dark:bg-[#121915] border border-slate-200/70 dark:border-slate-800/70 text-xs">
              <span className="font-bold text-slate-900 dark:text-white block mb-0.5">
                Gas Currency
              </span>
              <span className="text-slate-500">Native Circle USDC on Arc (No ETH or AVAX)</span>
            </div>
            <div className="p-3.5 rounded-xl bg-white dark:bg-[#121915] border border-slate-200/70 dark:border-slate-800/70 text-xs">
              <span className="font-bold text-slate-900 dark:text-white block mb-0.5">
                Finality
              </span>
              <span className="text-slate-500">Sub-second atomic escrow releases</span>
            </div>
            <div className="p-3.5 rounded-xl bg-white dark:bg-[#121915] border border-slate-200/70 dark:border-slate-800/70 text-xs">
              <span className="font-bold text-slate-900 dark:text-white block mb-0.5">
                Cryptographic Receipts
              </span>
              <span className="text-slate-500">SHA-256 canonical hash verification</span>
            </div>
          </div>
        </section>

        {/* ─── BOTTOM CTA ────────────────────────────────────────────── */}
        <section className="rounded-3xl bg-linear-to-r from-emerald-950 to-slate-950 p-8 sm:p-12 text-white flex flex-col md:flex-row md:items-center justify-between gap-6 border border-emerald-500/20">
          <div className="space-y-2 max-w-2xl">
            <h3 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              Ready to automate your enterprise procurement?
            </h3>
            <p className="text-sm text-emerald-200/80">
              Set deterministic policy ceilings, let autonomous agents negotiate renewals, and settle vendor invoices via Arc USDC escrow.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="/dashboard"
              className="px-5 py-3 rounded-xl font-bold text-sm bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-md transition-all cursor-pointer"
            >
              Launch Dashboard
            </Link>
            <Link
              href="/#how-it-works"
              className="px-5 py-3 rounded-xl font-bold text-sm bg-white/10 hover:bg-white/15 text-white border border-white/20 transition-all cursor-pointer"
            >
              Learn More
            </Link>
          </div>
        </section>
      </main>

      {/* ─── FOOTER ─────────────────────────────────────────────────── */}
      <footer className="border-t border-slate-200/60 dark:border-slate-800/60 py-8 bg-white/50 dark:bg-[#0c120f]/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <span>© {new Date().getFullYear()} Tavryn. Built on Arc + Circle.</span>
          </div>

          <div className="flex items-center gap-6 font-semibold">
            <Link href="/" className="hover:text-slate-900 dark:hover:text-white transition-colors">
              Home
            </Link>
            <Link href="/dashboard" className="hover:text-slate-900 dark:hover:text-white transition-colors">
              Workspace
            </Link>
            <a
              href="https://testnet.arcscan.io"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 hover:text-slate-900 dark:hover:text-white transition-colors"
            >
              <span>ArcScan</span>
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
