"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import { AgentIcon } from "@/components/AgentIcon";
import {
  Search,
  ChevronLeft,
  ChevronRight,
  Plus,
  Loader2,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { AnalysisModal } from "./AnalysisModal";
import { H3, Caption } from "@/components/ui/text";

export interface OpportunityItem {
  id: string;
  service: string;
  category: string;
  current_price: number | string;
  renewal_date: string;
  daysRemaining: number;
  savings: number;
  heuristicType: string;
  explanation: string;
  status: string;
  vendors?: {
    name: string;
    category: string;
    contact: string | null;
    reputation_score: number | null;
    is_simulated: boolean | null;
  } | null;
}

interface OpportunitiesTableProps {
  opportunities: OpportunityItem[];
  businessId?: string;
}

export function OpportunitiesTable({ opportunities, businessId }: OpportunitiesTableProps) {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [selectedContract, setSelectedContract] = useState<{
    id: string;
    service: string;
    currentPrice: number;
  } | null>(null);

  const [isRunningAgent, setIsRunningAgent] = useState(false);
  const [agentNotice, setAgentNotice] = useState<string | null>(null);

  const handleRunAgentNow = async () => {
    setIsRunningAgent(true);
    setAgentNotice(null);
    try {
      const res = await fetch("/api/agent/run-now", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessId }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Agent execution failed");
      }

      const started = data.result?.totalNegotiationsStarted ?? 0;
      const notifs = data.result?.totalNotificationsCreated ?? 0;
      setAgentNotice(
        `Autonomous agent completed: ${started} negotiation(s) initiated, ${notifs} notification(s) created.`
      );
      router.refresh();
    } catch (err) {
      setAgentNotice(`Agent run failed: ${(err as Error).message}`);
    } finally {
      setIsRunningAgent(false);
    }
  };

  // Filtered dataset
  const filtered = useMemo(() => {
    return opportunities.filter((item) => {
      const matchesSearch =
        searchQuery === "" ||
        item.service.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (item.vendors?.name || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.category.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesCategory =
        categoryFilter === "all" || item.category.toLowerCase() === categoryFilter.toLowerCase();

      return matchesSearch && matchesCategory;
    });
  }, [opportunities, searchQuery, categoryFilter]);

  const totalRecords = filtered.length;
  const totalPages = Math.max(1, Math.ceil(totalRecords / rowsPerPage));
  const startIndex = (currentPage - 1) * rowsPerPage;
  const paginatedRows = filtered.slice(startIndex, startIndex + rowsPerPage);

  return (
    <>
      <div className="rounded-xl bg-white/90 dark:bg-[#111714]/90 border border-slate-200/70 dark:border-slate-800/60 shadow-[0_1px_3px_rgba(0,0,0,0.03),0_6px_16px_rgba(0,0,0,0.02)] dark:shadow-[0_1px_3px_rgba(0,0,0,0.2)] p-5 sm:p-6 transition-colors">
        {/* Card Header & Controls */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100 dark:border-slate-800/70">
          <H3 as="h2" className="text-slate-900 dark:text-white">
            Contracts Ledger
          </H3>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Search Input Box */}
            <div className="relative">
              <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <input
                type="text"
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-48 sm:w-56 pl-9 pr-7 py-1.5 rounded-xl border border-slate-200/80 dark:border-slate-700/80 bg-slate-50/60 dark:bg-slate-800/50 text-xs font-medium text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#107e65]/20 focus:border-[#107e65] transition-all"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xs font-bold p-0.5"
                  title="Clear search"
                >
                  &times;
                </button>
              )}
            </div>

            {/* Segmented Category Filter Pills */}
            <div className="flex items-center p-0.5 rounded-xl bg-slate-100/70 dark:bg-[#151c19] border border-slate-200/60 dark:border-slate-800/60">
              {(["all", "software", "cloud", "contractors"] as const).map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => {
                    setCategoryFilter(cat);
                    setCurrentPage(1);
                  }}
                  className={`px-2.5 py-1 rounded-xl text-xs capitalize transition-all ${
                    categoryFilter === cat
                      ? "bg-white dark:bg-[#1c2622] text-slate-900 dark:text-white shadow-2xs font-bold"
                      : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white font-medium"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* Run Agent Now Button */}
            <button
              type="button"
              onClick={handleRunAgentNow}
              disabled={isRunningAgent}
              className="inline-flex items-center gap-1.5 h-8 px-3 rounded-xl bg-gradient-to-r from-[#107e65] to-[#0d6b55] hover:from-[#0d6b55] hover:to-[#0a5745] text-white text-xs font-bold shadow-2xs transition-all disabled:opacity-60 cursor-pointer shrink-0"
              title="Run autonomous proactive procurement agent across renewing contracts"
            >
              {isRunningAgent ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>Scanning...</span>
                </>
              ) : (
                <>
                  <AgentIcon className="h-3.5 w-3.5 shrink-0" />
                  <span>Run agent now</span>
                </>
              )}
            </button>

            {/* Primary Action Button (Icon only) */}
            <Link
              href="/onboard"
              className="inline-flex items-center justify-center h-8 w-8 rounded-xl bg-[#107e65] hover:bg-[#0d6b55] text-white shadow-2xs transition-colors shrink-0"
              title="Add Subscription"
              aria-label="Add Subscription"
            >
              <Plus className="h-4 w-4" />
            </Link>
          </div>
        </div>

        {/* Dynamic Agent Notice Banner */}
        {agentNotice && (
          <div className="mt-3 px-3.5 py-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs font-medium text-[#107e65] dark:text-[#34d399] flex items-center justify-between animate-in fade-in duration-200">
            <div className="flex items-center gap-2">
              <AgentIcon className="h-4 w-4 shrink-0" />
              <span>{agentNotice}</span>
            </div>
            <button
              type="button"
              onClick={() => setAgentNotice(null)}
              className="text-xs font-bold text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5 ml-2 cursor-pointer"
            >
              &times;
            </button>
          </div>
        )}

        {/* Ledger Table Container */}
        <div className="overflow-x-auto mt-4 rounded-xl border border-slate-200/70 dark:border-slate-800/60 shadow-2xs">
          <table className="w-full text-left text-xs font-sans border-collapse">
            <thead>
              <tr className="border-b border-slate-200/70 dark:border-slate-800/60 bg-slate-50/70 dark:bg-[#141b18]/60 text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                <Caption as="th" scope="col" className="py-3.5 px-3.5 w-12 text-center">#</Caption>
                <Caption as="th" scope="col" className="py-3.5 px-4 min-w-[200px]">Service &amp; Vendor</Caption>
                <Caption as="th" scope="col" className="py-3.5 px-3.5 min-w-[110px]">Category</Caption>
                <Caption as="th" scope="col" className="py-3.5 px-3.5 min-w-[130px]">Contract Ref</Caption>
                <Caption as="th" scope="col" className="py-3.5 px-4 text-right min-w-[120px]">Annual Spend</Caption>
                <Caption as="th" scope="col" className="py-3.5 px-3.5 min-w-[140px]">Renewal Date</Caption>
                <Caption as="th" scope="col" className="py-3.5 px-4 text-right min-w-[130px]">Savings Target</Caption>
                <Caption as="th" scope="col" className="py-3.5 px-3.5 text-center min-w-[110px]">Status</Caption>
                <Caption as="th" scope="col" className="py-3.5 px-4 text-center min-w-[220px]">Actions</Caption>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50 bg-white/70 dark:bg-[#111714]/70">
              {paginatedRows.length === 0 ? (
                <tr>
                  <td colSpan={9} className="text-center py-12 text-slate-400 dark:text-slate-500 font-medium">
                    No matching subscription records found.
                  </td>
                </tr>
              ) : (
                paginatedRows.map((opp, idx) => {
                  const globalIdx = startIndex + idx + 1;
                  const contractCode = `CT-${opp.id.slice(0, 4).toUpperCase()}/${opp.id.slice(-3).toUpperCase()}`;
                  const isExpiringSoon = opp.daysRemaining <= 30;

                  return (
                    <tr
                      key={opp.id}
                      className="hover:bg-emerald-500/[0.03] dark:hover:bg-emerald-500/[0.04] transition-colors duration-150"
                    >
                      {/* S.No */}
                      <td className="py-4 px-3.5 text-center text-slate-400 dark:text-slate-500 font-mono text-xs font-medium">
                        {globalIdx}
                      </td>

                      {/* Service & Vendor */}
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-xl bg-emerald-500/10 dark:bg-emerald-500/15 border border-emerald-500/15 text-[#107e65] dark:text-[#34d399] font-bold text-xs flex items-center justify-center shrink-0">
                            {opp.service.slice(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <div className="font-bold text-slate-900 dark:text-white text-xs">
                              {opp.service}
                            </div>
                            {opp.vendors?.name &&
                              opp.vendors.name.toLowerCase() !== opp.service.toLowerCase() &&
                              !opp.service.toLowerCase().startsWith(opp.vendors.name.toLowerCase()) && (
                                <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                                  {opp.vendors.name}
                                </div>
                              )}
                          </div>
                        </div>
                      </td>

                      {/* Category */}
                      <td className="py-4 px-3.5">
                        <span className="inline-block px-2.5 py-0.5 rounded-xl capitalize text-slate-600 dark:text-slate-300 bg-slate-100/70 dark:bg-slate-800/60 text-xs font-medium border border-slate-200/50 dark:border-slate-700/50">
                          {opp.category}
                        </span>
                      </td>

                      {/* Contract Ref */}
                      <td className="py-4 px-3.5">
                        <span className="font-mono text-xs font-medium text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/40 px-2 py-0.5 rounded-xl border border-slate-200/60 dark:border-slate-700/60">
                          {contractCode}
                        </span>
                      </td>

                      {/* Annual Spend */}
                      <td className="py-4 px-4 text-right font-mono font-bold text-xs text-slate-900 dark:text-white">
                        ${Number(opp.current_price).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>

                      {/* Renewal Date */}
                      <td className="py-4 px-3.5">
                        <div className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                          {new Date(opp.renewal_date).toLocaleDateString("en-GB", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                          })}
                        </div>
                        <div className="mt-0.5">
                          {isExpiringSoon ? (
                            <span className="inline-block px-1.5 py-0.2 rounded-xl text-xs font-semibold text-amber-700 dark:text-amber-300 bg-amber-500/10 border border-amber-500/20">
                              {opp.daysRemaining}d remaining
                            </span>
                          ) : (
                            <span className="text-xs font-medium text-slate-400 dark:text-slate-500">
                              {opp.daysRemaining}d remaining
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Savings Target */}
                      <td className="py-4 px-4 text-right">
                        <span className="font-mono font-bold text-xs text-[#107e65] dark:text-[#34d399] bg-emerald-500/10 dark:bg-emerald-500/15 px-2.5 py-1 rounded-xl border border-emerald-500/20 inline-block">
                          ${opp.savings.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="py-4 px-3.5 text-center">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-xl text-xs font-semibold uppercase tracking-wider ${
                            opp.status === "active"
                              ? "bg-emerald-500/10 text-[#107e65] dark:text-[#34d399] border border-emerald-500/20"
                              : opp.status === "negotiating"
                              ? "bg-blue-500/10 text-blue-700 dark:text-blue-300 border border-blue-500/20"
                              : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                          }`}
                        >
                          <span
                            className={`h-1.5 w-1.5 rounded-full ${
                              opp.status === "active"
                                ? "bg-[#107e65]"
                                : opp.status === "negotiating"
                                ? "bg-blue-500 animate-pulse"
                                : "bg-slate-400"
                            }`}
                          />
                          <span>{opp.status}</span>
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="py-4 px-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              setSelectedContract({
                                id: opp.id,
                                service: opp.service,
                                currentPrice: Number(opp.current_price),
                              })
                            }
                            className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-100/80 hover:bg-slate-200/80 dark:bg-slate-800/60 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200/60 dark:border-slate-700/60 transition-colors shadow-2xs"
                          >
                            Analyze
                          </button>
                          <Link
                            href={`/negotiate/${opp.id}`}
                            className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-[#142620] hover:bg-[#1b332b] dark:bg-slate-100 dark:hover:bg-white text-white dark:text-slate-900 transition-colors shadow-2xs"
                          >
                            Negotiate
                          </Link>
                          <Link
                            href={`/decision/${opp.id}`}
                            className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-emerald-500/10 hover:bg-emerald-500/15 text-[#107e65] dark:text-[#34d399] border border-emerald-500/20 transition-colors shadow-2xs"
                          >
                            Decision
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Ledger Footer (Pagination & Record Counts) */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-slate-100 dark:border-slate-800/80 text-xs font-medium text-slate-600 dark:text-slate-400">
          <div>
            Showing <span className="font-bold text-slate-900 dark:text-white">{totalRecords > 0 ? startIndex + 1 : 0}</span> to{" "}
            <span className="font-bold text-slate-900 dark:text-white">{Math.min(startIndex + rowsPerPage, totalRecords)}</span> of <span className="font-bold text-slate-900 dark:text-white">{totalRecords}</span> records
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5">
              <span>Rows per page:</span>
              <select
                value={rowsPerPage}
                onChange={(e) => {
                  setRowsPerPage(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="px-2 py-1 rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent text-slate-800 dark:text-slate-200 font-bold focus:outline-none"
              >
                <option value={5}>5</option>
                <option value={10}>10</option>
                <option value={20}>20</option>
              </select>
            </div>

            <div className="flex items-center gap-1 font-bold">
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage <= 1}
                className="p-1.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed text-slate-700 dark:text-slate-300 transition-colors"
                title="Previous page"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="px-2.5 py-1 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white border border-slate-200/60 dark:border-slate-700/60">
                {currentPage} / {totalPages}
              </span>
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage >= totalPages}
                className="p-1.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed text-slate-700 dark:text-slate-300 transition-colors"
                title="Next page"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {selectedContract && (
        <AnalysisModal
          contractId={selectedContract.id}
          serviceName={selectedContract.service}
          currentPrice={selectedContract.currentPrice}
          isOpen={true}
          onClose={() => setSelectedContract(null)}
        />
      )}
    </>
  );
}
