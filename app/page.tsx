import {
  ArrowRight,
  CheckCircle2,
  Database,
  ExternalLink,
  FileCheck,
  Layers,
  Lock,
  PlayCircle,
  Receipt,
  ShieldCheck,
  TrendingDown,
  Zap,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import React from "react";

import { AgentIcon } from "@/components/AgentIcon";
import { ThemeToggle } from "@/components/ThemeToggle";
import { ARC_CONFIG } from "@/lib/circle";
import { FOOTER_NAV_LINKS, LANDING_NAV_LINKS } from "@/lib/nav";
import { getServiceSupabase } from "@/lib/supabase";

function GithubIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4" />
      <path d="M9 18c-4.51 2-5-2-7-2" />
    </svg>
  );
}

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function Page(props: {
  searchParams: Promise<{ businessId?: string }>;
}) {
  const cookieStore = await cookies();
  const hasAuth = cookieStore
    .getAll()
    .some((c) => c.name.startsWith("sb-") && c.name.endsWith("-auth-token"));

  if (hasAuth) {
    const { businessId } = await props.searchParams;
    redirect(
      businessId
        ? `/dashboard?businessId=${encodeURIComponent(businessId)}`
        : "/dashboard",
    );
  }

  const supabase = getServiceSupabase();
  const { data: featuredReceipt } = await supabase
    .from("receipts")
    .select("token")
    .is("revoked_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return <LandingPage featuredReceiptToken={featuredReceipt?.token} />;
}

function LandingPage({
  featuredReceiptToken,
}: {
  featuredReceiptToken?: string;
}) {
  return (
    <div className="min-h-screen flex flex-col bg-[#f7f9f8] dark:bg-[#0b100e] text-slate-900 dark:text-slate-100 selection:bg-emerald-500/20 selection:text-[#107e65] dark:selection:text-[#34d399]">
      {/* Top Navbar */}
      <header className="sticky top-0 z-50 backdrop-blur-md bg-white/80 dark:bg-[#0e1411]/80 border-b border-slate-200/60 dark:border-slate-800/60 transition-colors">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 sm:h-20 flex items-center justify-between">
          {/* Logo & Brand */}
          <Link
            href="/"
            className="flex items-center gap-3 group cursor-pointer"
          >
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
                Arc + Circle
              </span>
            </div>
          </Link>

          {/* Navigation Links */}
          <nav className="hidden md:flex items-center gap-6 text-sm font-semibold text-slate-600 dark:text-slate-300">
            {LANDING_NAV_LINKS.map((link) =>
              link.isExternal ? (
                <a
                  key={link.label}
                  href={link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 hover:text-[#107e65] dark:hover:text-[#34d399] transition-colors"
                >
                  <GithubIcon className="h-4 w-4" />
                  <span>{link.label}</span>
                </a>
              ) : (
                <a
                  key={link.label}
                  href={link.href}
                  className="hover:text-[#107e65] dark:hover:text-[#34d399] transition-colors"
                >
                  {link.label}
                </a>
              ),
            )}
          </nav>

          {/* Right Action Buttons */}
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <a
              id="landing-try-demo-btn"
              href="/api/demo/session"
              className="inline-flex items-center gap-2 px-4 py-2 sm:px-5 sm:py-2.5 rounded-xl bg-gradient-to-r from-[#107e65] to-[#0d6b55] hover:from-[#0d6b55] hover:to-[#0a5644] text-white text-xs sm:text-sm font-bold shadow-md shadow-emerald-950/20 transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
            >
              <span>Try the demo</span>
              <ArrowRight className="h-4 w-4" />
            </a>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1">
        <section className="relative overflow-hidden pt-12 pb-20 sm:pt-20 sm:pb-28">
          {/* Subtle Ambient Background Gradients */}
          <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] bg-emerald-500/10 dark:bg-emerald-500/15 rounded-full blur-3xl pointer-events-none -z-10" />

          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            {/* Protocol Pill */}
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white dark:bg-[#121915] border border-slate-200/80 dark:border-slate-800/80 shadow-xs mb-8">
              <span className="h-2 w-2 rounded-full bg-[#107e65] animate-pulse" />
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Autonomous Procurement • Arc & Circle Track
              </span>
            </div>

            {/* Main Catchphrase Headline */}
            <h1 className="text-3xl sm:text-5xl md:text-6xl font-extrabold tracking-tight text-slate-900 dark:text-white leading-[1.15] sm:leading-[1.12]">
              An agent that finds the waste, negotiates it away, and executes
              the financial decision.
            </h1>

            {/* Subtitle */}
            <p className="mt-6 text-base sm:text-xl text-slate-600 dark:text-slate-300 max-w-3xl mx-auto font-normal leading-relaxed">
              Tavryn autonomously monitors SaaS and cloud renewal cliffs,
              negotiates multi-round concession curves, enforces deterministic
              financial policy, and escrows USDC on Arc smart contracts until
              vendor delivery is verified.
            </p>

            {/* Primary Call-to-Action Buttons */}
            <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-3.5 sm:gap-4">
              <a
                id="hero-primary-cta"
                href="/api/demo/session"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-xl bg-gradient-to-r from-[#107e65] to-[#0d6b55] hover:from-[#0d6b55] hover:to-[#0a5644] text-white text-base font-bold shadow-lg shadow-emerald-950/20 hover:shadow-emerald-950/30 transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
              >
                <span>Try the demo</span>
                <ArrowRight className="h-4 w-4 ml-0.5" />
              </a>

              <a
                id="hero-video-cta"
                href="#how-it-works"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-white dark:bg-[#121915] hover:bg-slate-50 dark:hover:bg-[#16201b] border border-slate-200/80 dark:border-slate-800/80 text-slate-800 dark:text-slate-200 text-base font-semibold shadow-xs transition-all duration-200 cursor-pointer"
              >
                <PlayCircle className="h-5 w-5 text-[#107e65] dark:text-[#34d399]" />
                <span>Watch Video Walkthrough</span>
              </a>

              <a
                id="hero-github-cta"
                href="https://github.com/pvanfas/tavryn"
                target="_blank"
                rel="noopener noreferrer"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-white dark:bg-[#121915] hover:bg-slate-50 dark:hover:bg-[#16201b] border border-slate-200/80 dark:border-slate-800/80 text-slate-800 dark:text-slate-200 text-base font-semibold shadow-xs transition-all duration-200 cursor-pointer"
              >
                <GithubIcon className="h-5 w-5 text-slate-700 dark:text-slate-300" />
                <span>GitHub Repo</span>
              </a>

              {featuredReceiptToken && (
                <Link
                  id="hero-receipt-cta"
                  href={`/r/${featuredReceiptToken}`}
                  target="_blank"
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/15 border border-emerald-500/30 text-[#107e65] dark:text-[#34d399] text-base font-semibold shadow-xs transition-all duration-200 cursor-pointer"
                >
                  <Receipt className="h-5 w-5" />
                  <span>Public Proof</span>
                </Link>
              )}
            </div>

            {/* Live Interactive Demo Pill */}
            <div className="mt-8 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-500/5 dark:bg-emerald-500/10 border border-emerald-500/20 text-xs text-slate-600 dark:text-slate-300">
              <span className="font-bold text-[#107e65] dark:text-[#34d399]">
                Live Interactive Demo:
              </span>
              <span>
                Clicking &quot;Try the demo&quot; pre-loads Demo Co with live
                testnet contracts and a 1-click execution button.
              </span>
            </div>
          </div>
        </section>

        {/* Hero Savings Metric Showcase */}
        <section
          id="metrics"
          className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-6 sm:-mt-10 mb-20"
        >
          <div className="rounded-3xl bg-white/95 dark:bg-[#111714]/95 border border-slate-200/80 dark:border-slate-800/70 p-6 sm:p-10 shadow-[0_4px_24px_rgba(0,0,0,0.04)] dark:shadow-[0_4px_24px_rgba(0,0,0,0.3)] backdrop-blur-md">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-8">
              {/* Metric 1 */}
              <div className="p-4 rounded-2xl bg-slate-50/60 dark:bg-slate-900/50 border border-slate-200/50 dark:border-slate-800/50">
                <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-wider">
                  <TrendingDown className="h-4 w-4 text-[#107e65] dark:text-[#34d399]" />
                  <span>Waste Identified</span>
                </div>
                <div className="mt-3 text-3xl sm:text-4xl font-extrabold font-mono text-slate-900 dark:text-white">
                  $28,800+
                </div>
                <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                  Unused seat tiers and steep usage decline detected across
                  seeded contracts.
                </p>
              </div>

              {/* Metric 2 */}
              <div className="p-4 rounded-2xl bg-slate-50/60 dark:bg-slate-900/50 border border-slate-200/50 dark:border-slate-800/50">
                <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-wider">
                  <Zap className="h-4 w-4 text-[#107e65] dark:text-[#34d399]" />
                  <span>Negotiation Yield</span>
                </div>
                <div className="mt-3 text-3xl sm:text-4xl font-extrabold font-mono text-[#107e65] dark:text-[#34d399]">
                  28% Avg
                </div>
                <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                  Concession algorithms negotiate down to vendor minimum reserve
                  prices.
                </p>
              </div>

              {/* Metric 3 */}
              <div className="p-4 rounded-2xl bg-slate-50/60 dark:bg-slate-900/50 border border-slate-200/50 dark:border-slate-800/50">
                <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-wider">
                  <ShieldCheck className="h-4 w-4 text-[#107e65] dark:text-[#34d399]" />
                  <span>Deterministic Policy</span>
                </div>
                <div className="mt-3 text-3xl sm:text-4xl font-extrabold font-mono text-slate-900 dark:text-white">
                  100%
                </div>
                <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                  Zero LLM approval powers. Hard code guards category budgets
                  and limits.
                </p>
              </div>

              {/* Metric 4 */}
              <div className="p-4 rounded-2xl bg-slate-50/60 dark:bg-slate-900/50 border border-slate-200/50 dark:border-slate-800/50">
                <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-wider">
                  <Lock className="h-4 w-4 text-[#107e65] dark:text-[#34d399]" />
                  <span>Arc Escrow</span>
                </div>
                <div className="mt-3 text-3xl sm:text-4xl font-extrabold font-mono text-slate-900 dark:text-white">
                  Settled
                </div>
                <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                  Funds released only upon verified counterparty receipt
                  fulfillment.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* The 3-Step Agent Loop */}
        <section
          id="how-it-works"
          className="py-16 sm:py-24 bg-white/50 dark:bg-[#0e1411]/50 border-y border-slate-200/60 dark:border-slate-800/60"
        >
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-3xl mx-auto mb-16">
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-[#107e65] dark:text-[#34d399] border border-emerald-500/20 uppercase tracking-wider">
                Autonomous Loop
              </span>
              <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-white mt-4 tracking-tight">
                How Tavryn Runs Procurement End-to-End
              </h2>
              <p className="mt-4 text-base text-slate-600 dark:text-slate-400">
                The loop connects real software consumption data directly to
                on-chain capital allocation without human micromanagement.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {/* Step 1 */}
              <div className="rounded-2xl bg-white dark:bg-[#121915] border border-slate-200/80 dark:border-slate-800/70 p-7 shadow-xs hover:border-[#107e65]/40 transition-all">
                <div className="h-12 w-12 rounded-xl bg-emerald-500/10 dark:bg-emerald-500/15 text-[#107e65] dark:text-[#34d399] flex items-center justify-center mb-6">
                  <Layers className="h-6 w-6" />
                </div>
                <div className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                  Step 01
                </div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-white mt-2">
                  Detect Waste & Renewal Cliffs
                </h3>
                <p className="mt-3 text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                  Continuously monitors subscription renewal dates and
                  correlates active user seats against provisioned licenses.
                  Flags underutilized contracts 45 days in advance.
                </p>
                <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800 text-xs font-medium text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5 text-[#107e65]" />
                  <span>Seat audit & usage-decline heuristics</span>
                </div>
              </div>

              {/* Step 2 */}
              <div className="rounded-2xl bg-white dark:bg-[#121915] border border-slate-200/80 dark:border-slate-800/70 p-7 shadow-xs hover:border-[#107e65]/40 transition-all">
                <div className="h-12 w-12 rounded-xl bg-emerald-500/10 dark:bg-emerald-500/15 text-[#107e65] dark:text-[#34d399] flex items-center justify-center mb-6">
                  <AgentIcon className="h-6 w-6" />
                </div>
                <div className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                  Step 02
                </div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-white mt-2">
                  Autonomous Multi-Round Negotiation
                </h3>
                <p className="mt-3 text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                  Engages vendor account reps or API simulators with
                  counter-proposals. Uses business memory of past accepted
                  discounts and strictly enforces walk-away price ceilings.
                </p>
                <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800 text-xs font-medium text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5 text-[#107e65]" />
                  <span>Vendor memory & concession curves</span>
                </div>
              </div>

              {/* Step 3 */}
              <div className="rounded-2xl bg-white dark:bg-[#121915] border border-slate-200/80 dark:border-slate-800/70 p-7 shadow-xs hover:border-[#107e65]/40 transition-all">
                <div className="h-12 w-12 rounded-xl bg-emerald-500/10 dark:bg-emerald-500/15 text-[#107e65] dark:text-[#34d399] flex items-center justify-center mb-6">
                  <Lock className="h-6 w-6" />
                </div>
                <div className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                  Step 03
                </div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-white mt-2">
                  Policy Check & Arc Escrow Release
                </h3>
                <p className="mt-3 text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                  Server-side deterministic code checks company spending
                  policies. Escrows USDC on Arc via Circle developer wallets,
                  audits the order confirmation, and releases payment.
                </p>
                <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800 text-xs font-medium text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5 text-[#107e65]" />
                  <span>Arc Smart Contract + SHA-256 Idempotency</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Architecture & Security Deep Dive */}
        <section
          id="architecture"
          className="py-16 sm:py-24 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8"
        >
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-[#107e65] dark:text-[#34d399] border border-emerald-500/20 uppercase tracking-wider">
                Zero-Trust Security
              </span>
              <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-white mt-4 tracking-tight">
                The LLM Decides. Deterministic Code Acts.
              </h2>
              <p className="mt-4 text-base text-slate-600 dark:text-slate-300 leading-relaxed">
                Tavryn is architected to protect your corporate treasury from
                rogue LLM hallucinations, prompt injections, and API retries:
              </p>

              <div className="mt-8 space-y-4">
                <div className="flex items-start gap-3">
                  <div className="p-1.5 rounded-lg bg-emerald-500/10 text-[#107e65] dark:text-[#34d399] mt-0.5">
                    <ShieldCheck className="h-4 w-4" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                      Deterministic Policy Engine
                    </h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      Pure TypeScript code evaluates transactions against
                      spending ceilings. The agent cannot approve its own
                      disbursements.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="p-1.5 rounded-lg bg-emerald-500/10 text-[#107e65] dark:text-[#34d399] mt-0.5">
                    <Database className="h-4 w-4" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                      Cryptographically Chained Audit Trail
                    </h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      Every tool call and action is hashed with SHA-256 to the
                      previous block and protected by database triggers that
                      reject any UPDATE or DELETE.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="p-1.5 rounded-lg bg-emerald-500/10 text-[#107e65] dark:text-[#34d399] mt-0.5">
                    <FileCheck className="h-4 w-4" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                      Tamper-Proof Escrow Settlement
                    </h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      Payments require 4-field document matching (price, seats,
                      terms, renewal date) before escrow releases funds on Arc.
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-8 flex items-center gap-4">
                <Link
                  href="/audit"
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-[#107e65] dark:text-[#34d399] hover:underline"
                >
                  <span>Explore Cryptographic Audit Ledger</span>
                  <ExternalLink className="h-3.5 w-3.5" />
                </Link>
              </div>
            </div>

            {/* Code / Architecture Display Card */}
            <div className="rounded-2xl bg-slate-900 border border-slate-800 p-5 sm:p-6 text-slate-200 font-mono text-xs shadow-xl overflow-hidden">
              <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-800 text-[11px] text-slate-400">
                <div className="flex items-center gap-2">
                  <div className="h-2.5 w-2.5 rounded-full bg-rose-500" />
                  <div className="h-2.5 w-2.5 rounded-full bg-amber-500" />
                  <div className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                  <span className="ml-2 text-slate-300 font-semibold">
                    Tavryn Verification Pipeline
                  </span>
                </div>
                <span>Arc Testnet</span>
              </div>
              <pre className="text-slate-300 leading-relaxed overflow-x-auto">
                {`// 1. Deterministic Policy Check
const policyDecision = checkPolicy({
  amount: 6912,
  category: "software",
  savings: 2688
}, policy, treasuryBalance);

// 2. Escrow USDC on Arc via Circle Wallet
const escrow = await create_escrow({
  contractId: "slack-renewal-uuid",
  amount: 6912,
  vendorWallet: "0x7099...79C8",
  idempotencyKey: sha256(...)
});
// Tx: ${(ARC_CONFIG.escrowContractAddress || "0x880eF868be").slice(0, 10)}...

// 3. Automated Order Document Verification
const verification = verifyConfirmationTerms(extracted, expected);
// Result: 4/4 checks passed [Price, Seats, Term, Date]

// 4. Release Escrowed Funds to Vendor
await release_escrow({
  transactionId: escrow.id,
  verificationPassed: true
});`}
              </pre>
            </div>
          </div>
        </section>

        {/* Live Interactive Demo Banner */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-24">
          <div className="rounded-3xl bg-gradient-to-r from-emerald-950 via-[#0e1914] to-slate-950 border border-emerald-500/30 p-8 sm:p-12 text-center text-white relative overflow-hidden shadow-2xl">
            <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
            <h2 className="text-2xl sm:text-4xl font-extrabold tracking-tight">
              Ready to see the agent negotiate and escrow live?
            </h2>
            <p className="mt-4 text-sm sm:text-base text-slate-300 max-w-2xl mx-auto">
              Launch Demo Co with one click. No registration required. Click
              &quot;Run full demo&quot; on the dashboard to watch the agent
              analyze, negotiate, escrow, and settle in real time.
            </p>
            <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
              <a
                id="footer-demo-cta"
                href="/api/demo/session"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-4 rounded-xl bg-[#107e65] hover:bg-[#0d6b55] text-white text-base font-bold shadow-lg transition-all duration-200 hover:scale-[1.02] cursor-pointer"
              >
                <span>Launch Demo Co</span>
                <ArrowRight className="h-4 w-4" />
              </a>
              <a
                href="https://github.com/pvanfas/tavryn"
                target="_blank"
                rel="noopener noreferrer"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-4 rounded-xl bg-white/10 hover:bg-white/15 border border-white/20 text-white text-base font-semibold transition-all duration-200 cursor-pointer"
              >
                <GithubIcon className="h-5 w-5" />
                <span>Source Code</span>
              </a>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200/60 dark:border-slate-800/60 bg-white/50 dark:bg-[#0c120f]/50 py-10 transition-colors">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500 dark:text-slate-400">
          <div className="flex items-center gap-3">
            <span className="font-bold text-slate-700 dark:text-slate-300">
              Tavryn
            </span>
            <span>Built with Arc + Circle</span>
          </div>
          <div className="flex items-center gap-6">
            {FOOTER_NAV_LINKS.map((link) =>
              link.isExternal ? (
                <a
                  key={link.label}
                  href={link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-slate-900 dark:hover:text-white transition-colors"
                >
                  {link.label}
                </a>
              ) : (
                <Link
                  key={link.label}
                  href={link.href}
                  className="hover:text-slate-900 dark:hover:text-white transition-colors"
                >
                  {link.label}
                </Link>
              ),
            )}
          </div>
        </div>
      </footer>
    </div>
  );
}
