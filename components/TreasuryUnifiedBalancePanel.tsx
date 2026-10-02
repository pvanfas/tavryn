"use client";

import {
  ArrowUpRight,
  ExternalLink,
  Globe,
  Layers,
  Percent,
  TrendingUp,
} from "lucide-react";
import React, { useState } from "react";

import {
  CircleGatewayUnifiedBalanceResult,
  UsycYieldAllocation,
} from "@/lib/circle/balances";

interface TreasuryUnifiedBalancePanelProps {
  gateway: CircleGatewayUnifiedBalanceResult;
  yieldAllocation: UsycYieldAllocation;
  walletAddress?: string | null;
}

export function TreasuryUnifiedBalancePanel({
  gateway,
  yieldAllocation,
  walletAddress,
}: TreasuryUnifiedBalancePanelProps) {
  const [activeTab, setActiveTab] = useState<"gateway" | "yield">("gateway");
  const [customPrincipal, setCustomPrincipal] = useState<number>(
    yieldAllocation.idleReserveYieldPrincipal,
  );

  // Dynamic recalculation when user adjusts calculator
  const dynamicAnnual = Math.round(
    customPrincipal * (yieldAllocation.usycApyPct / 100),
  );
  const dynamicMonthly = Math.round(dynamicAnnual / 12);
  const dynamic30d = Math.round((dynamicAnnual / 365) * 30);

  return (
    <div className="rounded-2xl bg-white/95 dark:bg-[#111714]/95 border border-slate-200/80 dark:border-slate-800/80 p-5 sm:p-7 shadow-[0_1px_3px_rgba(0,0,0,0.03),0_6px_16px_rgba(0,0,0,0.02)] dark:shadow-[0_1px_3px_rgba(0,0,0,0.2)] font-sans space-y-6">
      {/* Header with Switcher Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800/80">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-emerald-500/10 dark:bg-emerald-500/15 text-[#107e65] dark:text-[#34d399]">
              <Layers className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Treasury Multichain Gateway &amp; USYC Yield
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Consolidated multichain USDC balances &amp; idle treasury reserve yield
              </p>
            </div>
          </div>
        </div>

        {/* Tab Controls */}
        <div className="inline-flex items-center p-1 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 text-xs shadow-2xs">
          <button
            type="button"
            onClick={() => setActiveTab("gateway")}
            className={`px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === "gateway"
                ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            <Globe className="h-3.5 w-3.5 text-[#107e65]" />
            <span>Circle Gateway Unified</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("yield")}
            className={`px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === "yield"
                ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            <TrendingUp className="h-3.5 w-3.5 text-emerald-500" />
            <span>USYC Yield Reserve</span>
          </button>
        </div>
      </div>

      {/* TAB 1: Circle Gateway Unified Multichain Balance View */}
      {activeTab === "gateway" && (
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* Top Aggregate Summary Banner */}
          <div className="rounded-xl p-4 sm:p-5 bg-gradient-to-r from-emerald-500/10 via-emerald-500/5 to-transparent border border-emerald-500/20 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-[#107e65] text-white">
                  Circle Gateway Active
                </span>
                <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                  {gateway.instantMintSpeed}
                </span>
              </div>
              <div className="text-2xl sm:text-3xl font-mono font-bold text-slate-900 dark:text-white mt-1.5">
                ${gateway.totalUnifiedUsdc.toLocaleString()} USDC
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 max-w-xl">
                Permissionless multichain balance pool. Contracts on Arc can instantly draw upon consolidated balances across Base, Ethereum, and Solana via Gateway burn-and-mint attestations.
              </p>
            </div>

            <div className="text-left md:text-right shrink-0 pt-3 md:pt-0 border-t md:border-t-0 border-emerald-500/20">
              <span className="text-[10px] uppercase font-bold text-slate-400 block">
                Gateway Minter Contract
              </span>
              <a
                href={`https://testnet.arcscan.app/address/${gateway.gatewayMinterAddress}`}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono text-xs text-[#107e65] dark:text-[#34d399] hover:underline inline-flex items-center gap-1 mt-0.5"
              >
                <span>
                  {gateway.gatewayMinterAddress.slice(0, 8)}...
                  {gateway.gatewayMinterAddress.slice(-6)}
                </span>
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          </div>

          {/* Chain Breakdown Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
            {gateway.chains.map((c) => (
              <div
                key={c.chain}
                className="rounded-xl p-4 border border-slate-200/80 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-900/40 hover:border-slate-300 dark:hover:border-slate-700 transition-all space-y-2.5"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-emerald-500" />
                    <span className="font-bold text-xs text-slate-900 dark:text-white">
                      {c.chain}
                    </span>
                  </div>
                  <span className="text-[10px] font-mono text-slate-400">
                    {c.fastFinalityLatencyMs}ms
                  </span>
                </div>

                <div className="font-mono text-lg font-bold text-slate-900 dark:text-white">
                  ${c.balance.toLocaleString()}{" "}
                  <span className="text-xs font-normal text-slate-400">USDC</span>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-slate-200/60 dark:border-slate-800/60 text-[11px]">
                  <span className="text-slate-500">Fast Mint Pool:</span>
                  <a
                    href={c.explorerUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-mono text-[#107e65] dark:text-[#34d399] hover:underline inline-flex items-center gap-0.5"
                  >
                    <span>Explorer</span>
                    <ArrowUpRight className="h-3 w-3" />
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 2: Idle Cash to USYC Yield Estimator & Auto-Cliff */}
      {activeTab === "yield" && (
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* Top Yield Allocation Summary */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Card 1: Liquid Working Capital (Arc) */}
            <div className="rounded-xl p-4 border border-slate-200/80 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-900/40 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase font-bold text-slate-400">
                  Operational Working Capital
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                  Liquid on Arc
                </span>
              </div>
              <div className="font-mono text-2xl font-bold text-slate-900 dark:text-white">
                ${yieldAllocation.activeOperationalLiquidity.toLocaleString()}
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                1.5x buffer reserved for immediate 30-day SaaS contract renewals and escrow commitments.
              </p>
            </div>

            {/* Card 2: Idle Reserve Earning USYC Yield */}
            <div className="rounded-xl p-4 border border-emerald-500/30 bg-emerald-500/10 dark:bg-emerald-950/20 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase font-bold text-[#107e65] dark:text-[#34d399]">
                  Surplus Reserve in USYC
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-600 text-white">
                  5.12% Net APY
                </span>
              </div>
              <div className="font-mono text-2xl font-bold text-[#107e65] dark:text-[#34d399]">
                ${customPrincipal.toLocaleString()}
              </div>
              <p className="text-[11px] text-slate-600 dark:text-slate-300">
                Hashnote USYC tokenized short-term US Treasury bills earning daily compound interest.
              </p>
            </div>

            {/* Card 3: 45-Day Renewal Cliff Trigger */}
            <div className="rounded-xl p-4 border border-amber-500/30 bg-amber-500/10 dark:bg-amber-950/20 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase font-bold text-amber-700 dark:text-amber-400">
                  45-Day Renewal Cliff
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-700 dark:text-amber-300">
                  Autonomous
                </span>
              </div>
              <div className="font-mono text-2xl font-bold text-slate-900 dark:text-white">
                {yieldAllocation.cliffRedemptionDays} Days
              </div>
              <p className="text-[11px] text-slate-600 dark:text-slate-300">
                When contracts enter the 45-day window, agent automatically triggers USYC redemption to liquid USDC on Arc.
              </p>
            </div>
          </div>

          {/* Interactive Yield Estimator Slider */}
          <div className="p-5 rounded-xl border border-slate-200/80 dark:border-slate-800/80 bg-slate-50/70 dark:bg-slate-900/60 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                  <Percent className="h-4 w-4 text-[#107e65]" />
                  <span>Interactive USYC Yield Projection Engine</span>
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Simulate interest generated on idle capital earmarked for Q3/Q4 renewals
                </p>
              </div>

              <div className="flex items-center gap-3 font-mono text-xs">
                <div className="text-right">
                  <span className="text-slate-400 text-[10px] uppercase block">
                    30-Day Earnings
                  </span>
                  <span className="font-bold text-[#107e65] dark:text-[#34d399]">
                    +${dynamic30d.toLocaleString()}
                  </span>
                </div>
                <div className="text-right pl-3 border-l border-slate-300 dark:border-slate-700">
                  <span className="text-slate-400 text-[10px] uppercase block">
                    1-Year Annualized
                  </span>
                  <span className="font-bold text-slate-900 dark:text-white">
                    +${dynamicAnnual.toLocaleString()}
                  </span>
                </div>
              </div>
            </div>

            {/* Slider */}
            <div className="space-y-2">
              <input
                type="range"
                min="0"
                max={Math.max(100000, yieldAllocation.totalTreasury * 1.5)}
                step="2500"
                value={customPrincipal}
                onChange={(e) => setCustomPrincipal(Number(e.target.value))}
                className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-[#107e65]"
              />
              <div className="flex justify-between text-[10px] font-mono text-slate-400">
                <span>$0</span>
                <span>Principal Allocated: ${customPrincipal.toLocaleString()} USDC</span>
                <span>${Math.max(100000, yieldAllocation.totalTreasury * 1.5).toLocaleString()}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
