"use client";

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
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}k`;
  return `$${n.toFixed(0)}`;
}

export function LiveStatsBar() {
  const [stats, setStats] = useState<PublicStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<string>("");

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch("/api/stats", { cache: "no-store" });
      if (!res.ok) return;
      const json = await res.json();
      if (json.ok && json.stats) {
        setStats(json.stats);
        setLastUpdated(
          new Date(json.stats.generatedAt).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          }),
        );
      }
    } catch {
      // Silent fail — stats are optional
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
    // Refresh every 30 seconds
    const interval = setInterval(fetchStats, 30_000);
    return () => clearInterval(interval);
  }, [fetchStats]);

  if (loading) {
    return (
      <section
        id="live-stats"
        className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-12"
      >
        <div className="rounded-2xl bg-white/80 dark:bg-[#111714]/80 border border-slate-200/60 dark:border-slate-800/60 p-6 backdrop-blur-sm">
          <div className="flex items-center gap-2 text-sm text-slate-400">
            <span className="h-2 w-2 rounded-full bg-slate-300 dark:bg-slate-600 animate-pulse" />
            <span>Loading live stats…</span>
          </div>
        </div>
      </section>
    );
  }

  if (!stats) return null;

  const cells = [
    {
      label: "Real Businesses",
      value: String(stats.totalRealBusinesses),
    },
    {
      label: "Contracts Analyzed",
      value: String(stats.totalContractsAnalyzed),
    },
    {
      label: "Negotiations",
      value: String(stats.totalNegotiations),
    },
    {
      label: "USDC Moved",
      value: formatUsd(stats.totalUsdcMoved),
    },
    {
      label: "Auto-Approved",
      value: String(stats.decisionsAutoApproved),
    },
    {
      label: "Escalated",
      value: String(stats.decisionsEscalated),
    },
    {
      label: "Human Agreement",
      value: `${stats.humanAgreementRatePct}%`,
    },
  ];

  return (
    <section
      id="live-stats"
      className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-12"
    >
      <div className="rounded-2xl bg-white/80 dark:bg-[#111714]/80 border border-slate-200/60 dark:border-slate-800/60 p-5 sm:p-6 backdrop-blur-sm">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
            </span>
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Live Stats
            </span>
            <span className="text-[10px] text-slate-400 dark:text-slate-500">
              (real businesses only • refreshes every 30s)
            </span>
          </div>
          {lastUpdated && (
            <span className="text-[10px] text-slate-400 dark:text-slate-500">
              Updated {lastUpdated}
            </span>
          )}
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 sm:gap-4">
          {cells.map((cell) => (
            <div key={cell.label} className="text-center sm:text-left">
              <div className="text-lg sm:text-xl font-bold font-mono text-slate-900 dark:text-white">
                {cell.value}
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                {cell.label}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800/60 flex items-center gap-2 text-[10px] text-slate-400 dark:text-slate-500">
          <span>
            Sourced from{" "}
            <code className="px-1 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
              /api/stats
            </code>{" "}
            — public, no auth required
          </span>
        </div>
      </div>
    </section>
  );
}
