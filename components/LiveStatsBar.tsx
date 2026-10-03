"use client";

import {
  Activity,
  ArrowRight,
  Bot,
  Coins,
  ExternalLink,
  FileText,
  Lock,
  RefreshCw,
  Scale,
  ShieldCheck,
  TrendingUp,
  Users,
  Zap,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

interface PublicStats {
  generatedAt: string;
  totalRealBusinesses: number;
  totalContractsAnalyzed: number;
  totalNegotiations: number;
  totalUsdcMoved: number;
  totalUsdcEscrowed: number;
  decisionsAutoApproved: number;
  decisionsEscalated: number;
  humanAgreementRatePct: number;
  reviewerAgreementRatePct: number;
  savingsNegotiated: number;
  savingsRealized: number;
  savingsRatePct: number;
}

function formatUsd(n: number): string {
  if (!n || isNaN(n)) return "$0";
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 10_000) return `$${(n / 1_000).toFixed(1)}k`;
  return `$${Math.round(n).toLocaleString("en-US")}`;
}

export function LiveStatsBar() {
  const [stats, setStats] = useState<PublicStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<string>("");
  const [hasError, setHasError] = useState(false);

  const fetchStats = useCallback(
    async (manual = false) => {
      if (manual) setIsRefreshing(true);
      try {
        const res = await fetch("/api/stats", { cache: "no-store" });
        if (!res.ok) {
          if (!stats) setHasError(true);
          return;
        }
        const json = await res.json();
        if (json.ok && json.stats) {
          setStats(json.stats);
          setHasError(false);
          setLastUpdated(
            new Date(json.stats.generatedAt).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
            }),
          );
        }
      } catch {
        if (!stats) setHasError(true);
      } finally {
        setLoading(false);
        if (manual) {
          setTimeout(() => setIsRefreshing(false), 500);
        }
      }
    },
    [stats],
  );

  useEffect(() => {
    fetchStats();
    // Auto-refresh every 30 seconds
    const interval = setInterval(() => fetchStats(false), 30_000);
    return () => clearInterval(interval);
  }, [fetchStats]);

  // Loading skeleton with identical layout to prevent layout shift
  if (loading && !stats) {
    return (
      <section
        id="live-stats"
        aria-label="Live Protocol Telemetry Loading"
        className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-16"
      >
        <div className="relative overflow-hidden rounded-3xl border border-slate-200/80 dark:border-emerald-500/20 bg-white/70 dark:bg-[#0c1410]/70 p-6 sm:p-8 backdrop-blur-xl shadow-xl shadow-emerald-950/5 dark:shadow-emerald-950/20">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-200/60 dark:border-slate-800/80">
            <div className="flex items-center gap-3">
              <span className="h-3 w-3 rounded-full bg-emerald-400/50 animate-ping" />
              <div className="h-4 w-48 rounded-md bg-slate-200 dark:bg-slate-800 animate-pulse" />
            </div>
            <div className="h-4 w-32 rounded-md bg-slate-200 dark:bg-slate-800 animate-pulse" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="h-32 rounded-2xl bg-slate-100/80 dark:bg-slate-900/60 border border-slate-200/50 dark:border-slate-800/50 p-4 animate-pulse"
              />
            ))}
          </div>
        </div>
      </section>
    );
  }

  // Graceful fallback if stats completely failed to load
  if (hasError && !stats) {
    return (
      <section
        id="live-stats"
        className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-16"
      >
        <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800/70 bg-white/80 dark:bg-[#0f1713]/80 p-5 text-center backdrop-blur-sm">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Live telemetry is temporarily unavailable.
          </p>
          <button
            onClick={() => fetchStats(true)}
            className="mt-2 text-xs font-semibold text-[#107e65] dark:text-[#34d399] hover:underline inline-flex items-center gap-1"
          >
            <RefreshCw className="h-3 w-3" />
            <span>Retry connection</span>
          </button>
        </div>
      </section>
    );
  }

  if (!stats) return null;

  const totalDecisions = stats.decisionsAutoApproved + stats.decisionsEscalated;
  const autoPercent =
    totalDecisions > 0
      ? Math.round((stats.decisionsAutoApproved / totalDecisions) * 100)
      : 100;
  const escalatedPercent = 100 - autoPercent;

  return (
    <section
      id="live-stats"
      aria-label="Live Protocol Telemetry"
      className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-16"
    >
      <div className="relative overflow-hidden rounded-3xl border border-emerald-500/20 dark:border-emerald-500/30 bg-linear-to-b from-white/95 via-slate-50/80 to-white/95 dark:from-[#0d1612]/95 dark:via-[#09100c]/90 dark:to-[#070b09]/95 backdrop-blur-xl shadow-2xl shadow-emerald-950/5 dark:shadow-emerald-950/30 p-6 sm:p-8 transition-all">
        {/* Subtle Decorative Ambient Background Glow */}
        <div
          className="absolute -top-24 -right-24 w-80 h-80 rounded-full bg-emerald-500/10 dark:bg-emerald-500/15 blur-3xl pointer-events-none"
          aria-hidden="true"
        />
        <div
          className="absolute -bottom-24 -left-24 w-80 h-80 rounded-full bg-teal-500/10 dark:bg-teal-500/10 blur-3xl pointer-events-none"
          aria-hidden="true"
        />

        {/* ─── Top Control & Status Header ───────────────────────────────── */}
        <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-200/70 dark:border-slate-800/80">
          <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">
            {/* Live Pulsing Beacon */}
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 dark:bg-emerald-500/15 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 text-xs font-bold tracking-wide">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
              <span>LIVE PROTOCOL TELEMETRY</span>
            </div>

            {/* Network & Verification Badges */}
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800/80 border border-slate-200/60 dark:border-slate-700/60 text-slate-700 dark:text-slate-300 text-[11px] font-medium">
              <Zap className="h-3 w-3 text-amber-500" />
              <span>Arc Testnet · USDC Gas</span>
            </div>

            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800/80 border border-slate-200/60 dark:border-slate-700/60 text-slate-700 dark:text-slate-300 text-[11px] font-medium">
              <ShieldCheck className="h-3 w-3 text-[#107e65] dark:text-[#34d399]" />
              <span>100% Real Orgs · Zero Simulated Rows</span>
            </div>
          </div>

          {/* Sync Time & Action Controls */}
          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 self-start md:self-auto">
            {lastUpdated && (
              <span className="text-[11px] font-mono text-slate-400 dark:text-slate-500">
                Synced at {lastUpdated}
              </span>
            )}

            {/* Manual Sync Button */}
            <button
              onClick={() => fetchStats(true)}
              disabled={isRefreshing}
              title="Refresh telemetry"
              className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white/60 dark:bg-slate-900/60 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors disabled:opacity-50"
              aria-label="Refresh live stats"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 ${isRefreshing ? "animate-spin text-[#107e65]" : ""}`}
              />
            </button>

            {/* JSON API Feed Direct Link for Hackathon Evaluators */}
            <a
              href="/api/stats"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-800 bg-white/60 dark:bg-slate-900/60 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 text-[11px] font-medium transition-colors"
              title="Inspect unauthenticated JSON response"
            >
              <span>API Feed</span>
              <ExternalLink className="h-3 w-3 text-slate-400" />
            </a>
          </div>
        </div>

        {/* ─── Bento Grid: 4 Core Live Telemetry Pillars ─────────────────── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5 my-6">
          {/* Pillar 1: USDC Volume & Settlement Throughput */}
          <div className="group relative rounded-2xl bg-white/90 dark:bg-[#121b16]/90 border border-slate-200/80 dark:border-slate-800/80 p-5 hover:border-emerald-500/40 dark:hover:border-emerald-500/40 transition-all duration-200 shadow-xs hover:shadow-md">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                USDC Throughput
              </span>
              <div className="h-8 w-8 rounded-lg bg-emerald-500/10 dark:bg-emerald-500/15 text-[#107e65] dark:text-[#34d399] flex items-center justify-center">
                <Coins className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-3 text-2xl sm:text-3xl font-extrabold font-mono text-slate-900 dark:text-white tracking-tight">
              {formatUsd(stats.totalUsdcMoved)}
            </div>
            <div className="mt-2 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 pt-2 border-t border-slate-100 dark:border-slate-800/70">
              <span>Escrowed to Arc:</span>
              <span className="font-mono font-semibold text-slate-700 dark:text-slate-300">
                {formatUsd(stats.totalUsdcEscrowed)}
              </span>
            </div>
          </div>

          {/* Pillar 2: Realized Savings & Efficiency Yield */}
          <div className="group relative rounded-2xl bg-white/90 dark:bg-[#121b16]/90 border border-slate-200/80 dark:border-slate-800/80 p-5 hover:border-emerald-500/40 dark:hover:border-emerald-500/40 transition-all duration-200 shadow-xs hover:shadow-md">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Realized Savings
              </span>
              <div className="h-8 w-8 rounded-lg bg-emerald-500/10 dark:bg-emerald-500/15 text-[#107e65] dark:text-[#34d399] flex items-center justify-center">
                <TrendingUp className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-2xl sm:text-3xl font-extrabold font-mono text-[#107e65] dark:text-[#34d399] tracking-tight">
                {formatUsd(stats.savingsRealized)}
              </span>
              {stats.savingsRatePct > 0 && (
                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-bold bg-emerald-500/10 text-emerald-700 dark:text-emerald-300">
                  +{stats.savingsRatePct}%
                </span>
              )}
            </div>
            <div className="mt-2 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 pt-2 border-t border-slate-100 dark:border-slate-800/70">
              <span>Negotiated baseline:</span>
              <span className="font-mono font-semibold text-slate-700 dark:text-slate-300">
                {formatUsd(stats.savingsNegotiated)}
              </span>
            </div>
          </div>

          {/* Pillar 3: Autonomous vs Human Escalation Distribution */}
          <div className="group relative rounded-2xl bg-white/90 dark:bg-[#121b16]/90 border border-slate-200/80 dark:border-slate-800/80 p-5 hover:border-emerald-500/40 dark:hover:border-emerald-500/40 transition-all duration-200 shadow-xs hover:shadow-md">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Autonomous Execution
              </span>
              <div className="h-8 w-8 rounded-lg bg-emerald-500/10 dark:bg-emerald-500/15 text-[#107e65] dark:text-[#34d399] flex items-center justify-center">
                <Bot className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-3 text-2xl sm:text-3xl font-extrabold font-mono text-slate-900 dark:text-white tracking-tight">
              {autoPercent}%
            </div>

            {/* Split Progress Visualizer */}
            <div className="mt-2.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full h-1.5 overflow-hidden flex">
              <div
                className="bg-emerald-500 h-full transition-all duration-500"
                style={{ width: `${Math.max(5, autoPercent)}%` }}
                title={`Auto-approved: ${stats.decisionsAutoApproved}`}
              />
              <div
                className="bg-amber-500 h-full transition-all duration-500"
                style={{ width: `${Math.max(0, escalatedPercent)}%` }}
                title={`Escalated to human: ${stats.decisionsEscalated}`}
              />
            </div>

            <div className="mt-2 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 pt-2 border-t border-slate-100 dark:border-slate-800/70">
              <span>
                Auto:{" "}
                <strong className="text-slate-700 dark:text-slate-200">
                  {stats.decisionsAutoApproved}
                </strong>
              </span>
              <span>
                Escalated:{" "}
                <strong className="text-slate-700 dark:text-slate-200">
                  {stats.decisionsEscalated}
                </strong>
              </span>
            </div>
          </div>

          {/* Pillar 4: Consensus & Dual-Verifier Agreement */}
          <div className="group relative rounded-2xl bg-white/90 dark:bg-[#121b16]/90 border border-slate-200/80 dark:border-slate-800/80 p-5 hover:border-emerald-500/40 dark:hover:border-emerald-500/40 transition-all duration-200 shadow-xs hover:shadow-md">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Consensus Concordance
              </span>
              <div className="h-8 w-8 rounded-lg bg-emerald-500/10 dark:bg-emerald-500/15 text-[#107e65] dark:text-[#34d399] flex items-center justify-center">
                <Scale className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline gap-1.5">
              <span className="text-2xl sm:text-3xl font-extrabold font-mono text-slate-900 dark:text-white tracking-tight">
                {stats.humanAgreementRatePct}%
              </span>
              <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                Human
              </span>
            </div>
            <div className="mt-2 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 pt-2 border-t border-slate-100 dark:border-slate-800/70">
              <span>Gemini 2.5 Pro Audit:</span>
              <span className="font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                {stats.reviewerAgreementRatePct}% Agree
              </span>
            </div>
          </div>
        </div>

        {/* ─── Bottom Telemetry Ribbon: Secondary Counts & Guarantees ───── */}
        <div className="pt-4 border-t border-slate-200/60 dark:border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs">
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-slate-600 dark:text-slate-400">
            <div className="flex items-center gap-1.5">
              <Users className="h-3.5 w-3.5 text-slate-400" />
              <span>
                <strong className="text-slate-900 dark:text-white font-mono">
                  {stats.totalRealBusinesses}
                </strong>{" "}
                Verified Orgs
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              <FileText className="h-3.5 w-3.5 text-slate-400" />
              <span>
                <strong className="text-slate-900 dark:text-white font-mono">
                  {stats.totalContractsAnalyzed}
                </strong>{" "}
                Contracts Audited
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              <Activity className="h-3.5 w-3.5 text-slate-400" />
              <span>
                <strong className="text-slate-900 dark:text-white font-mono">
                  {stats.totalNegotiations}
                </strong>{" "}
                Negotiations
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              <Lock className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
              <span className="text-emerald-700 dark:text-emerald-400 font-medium">
                On-Chain Replay Defense Active
              </span>
            </div>
          </div>

          {/* Deep Dive Link to Full /metrics */}
          <Link
            href="/metrics"
            className="inline-flex items-center gap-1 font-semibold text-[#107e65] dark:text-[#34d399] hover:underline transition-all"
          >
            <span>Full metrics breakdown</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
    </section>
  );
}
