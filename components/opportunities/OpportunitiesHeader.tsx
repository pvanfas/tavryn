"use client";

import { Loader2, Plus, Search } from "lucide-react";
import Link from "next/link";
import React from "react";

import { AgentIcon } from "@/components/AgentIcon";
import { H3 } from "@/components/ui/text";

interface OpportunitiesHeaderProps {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  categoryFilter: string;
  setCategoryFilter: (cat: string) => void;
  onResetPage: () => void;
  onRunAgentNow: () => void;
  isRunningAgent: boolean;
  agentNotice: string | null;
  onDismissNotice: () => void;
}

export function OpportunitiesHeader({
  searchQuery,
  setSearchQuery,
  categoryFilter,
  setCategoryFilter,
  onResetPage,
  onRunAgentNow,
  isRunningAgent,
  agentNotice,
  onDismissNotice,
}: OpportunitiesHeaderProps) {
  return (
    <>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100 dark:border-slate-800/70">
        <H3 as="h2" className="text-slate-900 dark:text-white font-semibold">
          Contracts Ledger
        </H3>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Search Input Box */}
          <div className="relative">
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              type="text"
              placeholder="Search contracts..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                onResetPage();
              }}
              className="w-48 sm:w-56 pl-9 pr-7 py-1.5 rounded-lg border border-slate-200/80 dark:border-slate-700/80 bg-slate-50/60 dark:bg-slate-800/50 text-xs font-medium text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-[#107e65] focus:border-[#107e65] transition-colors"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xs font-bold p-0.5 cursor-pointer"
                title="Clear search"
              >
                &times;
              </button>
            )}
          </div>

          {/* Segmented Category Filter */}
          <div className="flex items-center p-0.5 rounded-lg bg-slate-100/70 dark:bg-[#151c19] border border-slate-200/60 dark:border-slate-800/60">
            {(["all", "software", "cloud", "contractors"] as const).map(
              (cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => {
                    setCategoryFilter(cat);
                    onResetPage();
                  }}
                  className={`px-2.5 py-1 rounded-md text-xs capitalize transition-colors cursor-pointer ${
                    categoryFilter === cat
                      ? "bg-white dark:bg-[#1c2622] text-slate-900 dark:text-white shadow-2xs font-semibold"
                      : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white font-medium"
                  }`}
                >
                  {cat}
                </button>
              ),
            )}
          </div>

          {/* Scan for Savings Button */}
          <button
            id="contracts-scan-savings-btn"
            type="button"
            onClick={onRunAgentNow}
            disabled={isRunningAgent}
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg bg-[#107e65] hover:bg-[#0d6954] active:bg-[#0a5644] text-white text-xs font-semibold shadow-xs transition-colors duration-150 disabled:opacity-60 cursor-pointer shrink-0"
            title="Scan renewing contracts for idle seats, usage drops, and autonomous negotiation opportunities"
          >
            {isRunningAgent ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span>Scanning Contracts...</span>
              </>
            ) : (
              <>
                <AgentIcon className="h-3.5 w-3.5 shrink-0" />
                <span>Scan for Savings</span>
              </>
            )}
          </button>

          {/* Primary Action Button (Icon only) */}
          <Link
            href="/import-bills"
            className="inline-flex items-center justify-center h-8 w-8 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200/60 dark:border-slate-700/60 shadow-xs transition-colors shrink-0"
            title="Import Bills"
            aria-label="Import Bills"
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
            onClick={onDismissNotice}
            className="text-xs font-bold text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5 ml-2 cursor-pointer"
          >
            &times;
          </button>
        </div>
      )}
    </>
  );
}
