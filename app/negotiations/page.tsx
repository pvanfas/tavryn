import { ArrowRight, Bot, MessageSquare } from "lucide-react";
import Link from "next/link";
import React from "react";

import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { Body, H2 } from "@/components/ui/text";
import { getOnChainUSDCBalance } from "@/lib/circle";
import { getServiceSupabase } from "@/lib/supabase";

export const revalidate = 0;

interface NegotiationRecord {
  id: string;
  contract_id: string;
  original_price: number;
  target_price: number | null;
  current_offer: number | null;
  final_price: number | null;
  savings: number | null;
  rounds: number | null;
  status: string;
  created_at: string;
  contracts?: {
    id: string;
    service: string;
    category: string;
    vendors?: {
      name: string;
      is_simulated: boolean | null;
    } | null;
  } | null;
}

interface NegotiationsPageProps {
  searchParams: Promise<{ businessId?: string; filter?: string }>;
}

export default async function NegotiationsPage({
  searchParams,
}: NegotiationsPageProps) {
  const supabase = getServiceSupabase();
  const { businessId, filter: selectedFilter } = await searchParams;

  // 1. Fetch businesses
  const { data: bData } = await supabase
    .from("businesses")
    .select(
      "id, name, is_real, treasury_balance, default_currency, wallet_address",
    )
    .order("created_at", { ascending: true });

  const businesses = bData || [];
  const business =
    businesses.find((b) => b.id === businessId) || businesses[0] || null;

  // Real-time on-chain balance
  let liveTreasuryBalance = business?.treasury_balance
    ? Number(business.treasury_balance)
    : 0;
  if (business?.wallet_address) {
    try {
      liveTreasuryBalance = await getOnChainUSDCBalance(
        business.wallet_address,
      );
    } catch {
      // fallback
    }
  }

  // 2. Fetch negotiations
  let negotiations: NegotiationRecord[] = [];
  if (business) {
    const { data: nData } = await supabase
      .from("negotiations")
      .select("*, contracts!inner(*, vendors(*))")
      .eq("contracts.business_id", business.id)
      .order("created_at", { ascending: false });

    if (nData) {
      negotiations = nData as unknown as NegotiationRecord[];
    }
  }

  // Filter logic
  const currentFilter = selectedFilter || "all";
  const filteredNegotiations = negotiations.filter((neg) => {
    if (currentFilter === "all") return true;
    if (currentFilter === "active")
      return ["initiated", "countered", "in_progress"].includes(neg.status);
    if (currentFilter === "agreed")
      return ["agreed", "succeeded", "completed"].includes(neg.status);
    if (currentFilter === "failed")
      return ["walked_away", "rejected", "failed"].includes(neg.status);
    return true;
  });

  return (
    <AppShell
      businessName={business?.name || "Demo Co"}
      isReal={business?.is_real ?? false}
      businesses={businesses}
      activeBusinessId={business?.id}
      treasuryBalance={liveTreasuryBalance}
      currency={business?.default_currency || "USDC"}
      breadcrumbs={[
        { label: "Overview", href: "/" },
        { label: "Negotiations" },
      ]}
    >
      <div className="space-y-6">
        {/* Minimal Reusable Page Header */}
        <PageHeader
          badge="Workspace"
          caption="Autonomous Procurement"
          title="Vendor Negotiations"
          description="Multi-round agent concession dialogues, pricing concessions, and decision checklists."
        />

        {/* Filter Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 border-b border-slate-200 dark:border-slate-800">
          {[
            {
              id: "all",
              label: "All Negotiations",
              count: negotiations.length,
            },
            {
              id: "active",
              label: "In Progress",
              count: negotiations.filter((n) =>
                ["initiated", "countered", "in_progress"].includes(n.status),
              ).length,
            },
            {
              id: "agreed",
              label: "Agreed",
              count: negotiations.filter((n) =>
                ["agreed", "succeeded", "completed"].includes(n.status),
              ).length,
            },
            {
              id: "failed",
              label: "Walked Away",
              count: negotiations.filter((n) =>
                ["walked_away", "rejected", "failed"].includes(n.status),
              ).length,
            },
          ].map((tab) => {
            const isActive = currentFilter === tab.id;
            const targetUrl = business
              ? `/negotiations?businessId=${business.id}&filter=${tab.id}`
              : `/negotiations?filter=${tab.id}`;

            return (
              <Link
                key={tab.id}
                href={targetUrl}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  isActive
                    ? "bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-2xs"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/60"
                }`}
              >
                <span>{tab.label}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                    isActive
                      ? "bg-white/20 dark:bg-slate-900/20 text-white dark:text-slate-900"
                      : "bg-slate-200/70 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
                  }`}
                >
                  {tab.count}
                </span>
              </Link>
            );
          })}
        </div>

        {/* Negotiations List or Empty State */}
        {filteredNegotiations.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-800 bg-white/50 dark:bg-[#121915]/50 p-12 text-center space-y-4">
            <div className="h-12 w-12 rounded-2xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 mx-auto flex items-center justify-center text-slate-400">
              <MessageSquare className="h-6 w-6" />
            </div>
            <div className="space-y-1">
              <H2 className="text-base font-bold text-slate-900 dark:text-white">
                No negotiations found
              </H2>
              <Body className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
                {currentFilter !== "all"
                  ? `There are no negotiations matching the "${currentFilter}" filter.`
                  : "Run the autonomous agent from the overview or trigger a contract negotiation to begin."}
              </Body>
            </div>
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-xs transition-colors"
            >
              <Bot className="h-3.5 w-3.5" />
              <span>Go to Overview</span>
            </Link>
          </div>
        ) : (
          <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800/80 bg-white/90 dark:bg-[#121915]/90 overflow-hidden shadow-xs">
            {/* Desktop Table */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200/80 dark:border-slate-800/80 bg-slate-50/70 dark:bg-slate-900/40 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    <th className="py-3.5 px-4">Service & Counterparty</th>
                    <th className="py-3.5 px-4">Baseline Price</th>
                    <th className="py-3.5 px-4">Current / Agreed Offer</th>
                    <th className="py-3.5 px-4">Realized Savings</th>
                    <th className="py-3.5 px-4">Rounds</th>
                    <th className="py-3.5 px-4">Status</th>
                    <th className="py-3.5 px-4 text-right">Decision Detail</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-xs">
                  {filteredNegotiations.map((neg) => {
                    const baseline = Number(neg.original_price);
                    const currentPrice = Number(
                      neg.final_price || neg.current_offer || baseline,
                    );
                    const savings = Number(
                      neg.savings || baseline - currentPrice,
                    );
                    const isSuccess = [
                      "agreed",
                      "succeeded",
                      "completed",
                    ].includes(neg.status);

                    return (
                      <tr
                        key={neg.id}
                        className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30 transition-colors group"
                      >
                        <td className="py-3.5 px-4">
                          <Link
                            href={`/decision/${neg.contract_id}`}
                            className="block font-bold text-slate-900 dark:text-white group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors"
                          >
                            {neg.contracts?.service || "Vendor Agreement"}
                          </Link>
                          <div className="text-[11px] text-slate-400">
                            {neg.contracts?.vendors?.name || "Direct Vendor"}
                          </div>
                        </td>
                        <td className="py-3.5 px-4 font-mono text-slate-600 dark:text-slate-300">
                          ${baseline.toLocaleString()}
                        </td>
                        <td className="py-3.5 px-4 font-mono font-semibold text-slate-900 dark:text-white">
                          ${currentPrice.toLocaleString()}
                        </td>
                        <td className="py-3.5 px-4">
                          {savings > 0 ? (
                            <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                              +${savings.toLocaleString()}
                            </span>
                          ) : (
                            <span className="text-slate-400 text-[11px]">
                              —
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 font-mono text-slate-600 dark:text-slate-400">
                          {neg.rounds ?? 1} / 3
                        </td>
                        <td className="py-3.5 px-4">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                              isSuccess
                                ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20"
                                : neg.status === "walked_away"
                                  ? "bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-500/20"
                                  : "bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20"
                            }`}
                          >
                            {neg.status.replace(/_/g, " ")}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <Link
                            href={`/decision/${neg.contract_id}`}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 transition-colors"
                          >
                            <span>Inspect Policy</span>
                            <ArrowRight className="h-3.5 w-3.5" />
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Card View */}
            <div className="sm:hidden divide-y divide-slate-100 dark:divide-slate-800/60">
              {filteredNegotiations.map((neg) => {
                const baseline = Number(neg.original_price);
                const currentPrice = Number(
                  neg.final_price || neg.current_offer || baseline,
                );
                const savings = Number(
                  neg.savings || baseline - currentPrice,
                );
                const isSuccess = [
                  "agreed",
                  "succeeded",
                  "completed",
                ].includes(neg.status);

                return (
                  <div key={neg.id} className="p-4 space-y-3">
                    {/* Header: Service + Status */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="font-bold text-sm text-slate-900 dark:text-white truncate">
                          {neg.contracts?.service || "Vendor Agreement"}
                        </div>
                        <div className="text-[11px] text-slate-400">
                          {neg.contracts?.vendors?.name || "Direct Vendor"} · {neg.rounds ?? 1}/3 rounds
                        </div>
                      </div>
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider shrink-0 ${
                          isSuccess
                            ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20"
                            : neg.status === "walked_away"
                              ? "bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-500/20"
                              : "bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20"
                        }`}
                      >
                        {neg.status.replace(/_/g, " ")}
                      </span>
                    </div>

                    {/* Metrics Row */}
                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <div className="p-2.5 rounded-lg bg-slate-50/80 dark:bg-slate-900/40 border border-slate-100 dark:border-slate-800/50">
                        <div className="text-[10px] text-slate-400 uppercase font-semibold mb-0.5">Baseline</div>
                        <div className="font-mono font-medium text-slate-600 dark:text-slate-300">${baseline.toLocaleString()}</div>
                      </div>
                      <div className="p-2.5 rounded-lg bg-slate-50/80 dark:bg-slate-900/40 border border-slate-100 dark:border-slate-800/50">
                        <div className="text-[10px] text-slate-400 uppercase font-semibold mb-0.5">Agreed</div>
                        <div className="font-mono font-bold text-slate-900 dark:text-white">${currentPrice.toLocaleString()}</div>
                      </div>
                      <div className="p-2.5 rounded-lg bg-slate-50/80 dark:bg-slate-900/40 border border-slate-100 dark:border-slate-800/50">
                        <div className="text-[10px] text-slate-400 uppercase font-semibold mb-0.5">Savings</div>
                        {savings > 0 ? (
                          <div className="font-mono font-bold text-emerald-600 dark:text-emerald-400">+${savings.toLocaleString()}</div>
                        ) : (
                          <div className="text-slate-400">—</div>
                        )}
                      </div>
                    </div>

                    {/* Action */}
                    <Link
                      href={`/decision/${neg.contract_id}`}
                      className="block w-full text-center px-3 py-2 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-semibold transition-colors"
                    >
                      Inspect Policy →
                    </Link>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
