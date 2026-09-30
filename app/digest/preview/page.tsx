"use client";

import { AlertCircle, CheckCircle2, Mail, RefreshCw } from "lucide-react";
import React, { useEffect, useState } from "react";

import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { Mono } from "@/components/ui/text";

interface DigestData {
  isoWeek: string;
  generatedAt: string;
  period: string;
  contractsAnalyzed: number;
  negotiationsRun: number;
  totalSavingsRealized: number;
  arcUsdcEscrowed: number;
  arcUsdcReleased: number;
  pendingHumanApprovalsCount: number;
  highlights: Array<{
    service: string;
    vendor: string;
    savings: number;
  }>;
}

export default function WeeklyDigestPreviewPage() {
  const [data, setData] = useState<DigestData | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  const fetchDigest = async (force: boolean = false) => {
    try {
      if (force) setRunning(true);
      else setLoading(true);
      setError(null);
      const res = await fetch(`/api/cron/weekly?force=${force}`);
      const j = await res.json();
      if (!res.ok) {
        throw new Error(j.error || "Failed to load weekly digest");
      }
      if (j.digest) {
        setData(j.digest);
        if (force) {
          setActionSuccess(
            `Weekly executive digest executed for ${j.digest.isoWeek}!`,
          );
        }
      } else if (j.message) {
        setActionSuccess(j.message);
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
      setRunning(false);
    }
  };

  useEffect(() => {
    fetchDigest(false);
  }, []);

  return (
    <AppShell
      breadcrumbs={[
        { label: "Dashboard", href: "/dashboard" },
        { label: "Settings", href: "/settings" },
        { label: "Weekly Digest Preview" },
      ]}
      currency="USDC"
    >
      <div className="space-y-6 max-w-4xl mx-auto pb-12">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200/80 dark:border-slate-800/80 pb-6">
          <PageHeader
            badge="Executive Intelligence"
            caption={`ISO Schedule: 0 9 * * 1 (Mondays at 09:00 UTC)`}
            title="Weekly Procurement & Settlement Digest"
            description="Automated briefing summarizing weekly savings, pending approvals, and on-chain Arc testnet settlements."
          />

          <button
            type="button"
            onClick={() => fetchDigest(true)}
            disabled={running}
            className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#107e65] hover:bg-[#0d6b55] text-white text-xs font-bold transition-all shadow-xs disabled:opacity-50 cursor-pointer shrink-0"
          >
            <RefreshCw
              className={`h-3.5 w-3.5 shrink-0 ${running ? "animate-spin" : ""}`}
            />
            <span>
              {running
                ? "Compiling Digest..."
                : "Trigger Digest Now (Bypass Idempotency)"}
            </span>
          </button>
        </div>

        {error && (
          <div className="p-3.5 rounded-xl border border-rose-200 bg-rose-50 dark:bg-rose-950/20 text-rose-700 dark:text-rose-300 text-xs font-semibold flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {actionSuccess && (
          <div className="p-3.5 rounded-xl border border-emerald-200 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-800 dark:text-emerald-300 text-xs font-semibold flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-[#107e65]" />
            <span>{actionSuccess}</span>
          </div>
        )}

        {loading && !data ? (
          <div className="py-16 text-center text-xs text-slate-500">
            <div className="h-6 w-6 border-2 border-[#107e65] border-t-transparent rounded-full animate-spin mx-auto mb-2" />
            Loading weekly digest snapshot...
          </div>
        ) : data ? (
          <div className="space-y-6">
            {/* Digest Card Container (Email preview style) */}
            <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-[#111714] p-6 sm:p-8 shadow-sm space-y-6">
              {/* Header */}
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800/70 pb-5">
                <div className="flex items-center gap-3">
                  <div className="p-3 rounded-2xl bg-[#107e65]/10 text-[#107e65] dark:text-[#34d399]">
                    <Mail className="h-6 w-6" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-slate-900 dark:text-white">
                      Tavryn Executive Digest &bull; {data.isoWeek}
                    </h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      Period: {data.period} &bull; Generated:{" "}
                      {new Date(data.generatedAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>

                <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20">
                  Ready for Dispatch
                </span>
              </div>

              {/* 4 Primary KPI Tiles */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/40 border border-slate-100 dark:border-slate-800">
                  <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 block">
                    Realized Savings
                  </span>
                  <Mono className="text-xl font-bold text-[#107e65] dark:text-[#34d399] mt-1">
                    ${Math.round(data.totalSavingsRealized).toLocaleString()}
                  </Mono>
                </div>

                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/40 border border-slate-100 dark:border-slate-800">
                  <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 block">
                    Arc USDC Escrowed
                  </span>
                  <Mono className="text-xl font-bold text-slate-900 dark:text-white mt-1">
                    ${Math.round(data.arcUsdcEscrowed).toLocaleString()}
                  </Mono>
                </div>

                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/40 border border-slate-100 dark:border-slate-800">
                  <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 block">
                    Renewals Analyzed
                  </span>
                  <Mono className="text-xl font-bold text-slate-900 dark:text-white mt-1">
                    {data.negotiationsRun}
                  </Mono>
                </div>

                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/40 border border-slate-100 dark:border-slate-800">
                  <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 block">
                    Pending Sign-Offs
                  </span>
                  <Mono
                    className={`text-xl font-bold mt-1 ${
                      data.pendingHumanApprovalsCount > 0
                        ? "text-amber-500"
                        : "text-slate-900 dark:text-white"
                    }`}
                  >
                    {data.pendingHumanApprovalsCount}
                  </Mono>
                </div>
              </div>

              {/* Deal Highlights */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Top Savings Realized This Week
                </h3>
                {data.highlights.length > 0 ? (
                  <div className="divide-y divide-slate-100 dark:divide-slate-800/60 rounded-xl border border-slate-200/70 dark:border-slate-800/60 overflow-hidden">
                    {data.highlights.map((h, i) => (
                      <div
                        key={i}
                        className="p-3.5 flex items-center justify-between text-xs hover:bg-slate-50 dark:hover:bg-slate-900/30 transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="h-4 w-4 text-[#107e65]" />
                          <span className="font-bold text-slate-900 dark:text-white">
                            {h.service}
                          </span>
                          <span className="text-slate-500 dark:text-slate-400">
                            ({h.vendor})
                          </span>
                        </div>
                        <Mono className="font-bold text-[#107e65] dark:text-[#34d399]">
                          +${Math.round(h.savings).toLocaleString()} saved/yr
                        </Mono>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-4 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 text-center text-xs text-slate-400">
                    No negotiations completed in the past 7 days.
                  </div>
                )}
              </div>

              {/* Governance & Settlement Notice */}
              <div className="p-4 rounded-xl bg-slate-50/70 dark:bg-slate-900/30 border border-slate-200/60 dark:border-slate-800/60 text-xs text-slate-600 dark:text-slate-400 space-y-1">
                <p className="font-semibold text-slate-800 dark:text-slate-200">
                  Governance &amp; Settlement Invariants:
                </p>
                <ul className="list-disc list-inside space-y-0.5 text-[11px]">
                  <li>
                    All payments settled exclusively on Arc testnet in native
                    USDC with deterministic policy checks.
                  </li>
                  <li>
                    Weekly digests execute with ISO-week idempotency to prevent
                    duplicate dispatches.
                  </li>
                  <li>
                    Approvals exceeding autonomous spend limits require one-tap
                    supervisor HMAC sign-off.
                  </li>
                </ul>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </AppShell>
  );
}
