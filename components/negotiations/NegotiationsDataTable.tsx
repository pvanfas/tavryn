"use client";

import { ArrowRight, Bot } from "lucide-react";
import Link from "next/link";
import React from "react";

import { ColumnDef, DataTable } from "@/components/ui/data-table";

export interface NegotiationRow {
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

interface NegotiationsDataTableProps {
  negotiations: NegotiationRow[];
}

export function NegotiationsDataTable({
  negotiations,
}: NegotiationsDataTableProps) {
  // Precompute numeric values for crisp, reliable sorting
  const enrichedNegotiations = React.useMemo(() => {
    return negotiations.map((n) => {
      const baseline = Number(n.original_price || 0);
      const currentPrice = Number(
        n.final_price || n.current_offer || baseline,
      );
      const computedSavings = Number(
        n.savings !== null && n.savings !== undefined
          ? n.savings
          : Math.max(0, baseline - currentPrice),
      );
      return {
        ...n,
        baselineNumber: baseline,
        currentPriceNumber: currentPrice,
        savingsNumber: computedSavings,
      };
    });
  }, [negotiations]);

  type EnrichedRow = (typeof enrichedNegotiations)[number];

  const columns: ColumnDef<EnrichedRow>[] = [
    {
      key: "service",
      header: "Service & Counterparty",
      sortable: true,
      accessor: (row) => row.contracts?.service || "Vendor Agreement",
      cell: (row) => (
        <div>
          <Link
            href={`/decision/${row.contract_id}`}
            className="block font-bold text-slate-900 dark:text-white hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
          >
            {row.contracts?.service || "Vendor Agreement"}
          </Link>
          <div className="text-[11px] text-slate-500 dark:text-slate-400">
            {row.contracts?.vendors?.name || "Direct Vendor"}
          </div>
        </div>
      ),
    },
    {
      key: "original_price",
      header: "Baseline Spend",
      sortable: true,
      accessor: (row) => row.baselineNumber,
      cell: (row) => (
        <span className="font-mono text-slate-600 dark:text-slate-300">
          ${row.baselineNumber.toLocaleString()}
        </span>
      ),
    },
    {
      key: "current_offer",
      header: "Agreed / Offer",
      sortable: true,
      accessor: (row) => row.currentPriceNumber,
      cell: (row) => (
        <span className="font-mono font-semibold text-slate-900 dark:text-white">
          ${row.currentPriceNumber.toLocaleString()}
        </span>
      ),
    },
    {
      key: "savings",
      header: "Realized Savings",
      sortable: true,
      accessor: (row) => row.savingsNumber,
      cell: (row) => (
        row.savingsNumber > 0 ? (
          <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
            +${row.savingsNumber.toLocaleString()}
          </span>
        ) : (
          <span className="text-slate-400 text-[11px]">—</span>
        )
      ),
    },
    {
      key: "rounds",
      header: "Rounds",
      sortable: true,
      accessor: (row) => row.rounds ?? 1,
      cell: (row) => (
        <span className="font-mono text-slate-600 dark:text-slate-400">
          {row.rounds ?? 1} / 3
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      sortable: true,
      accessor: (row) => row.status,
      cell: (row) => {
        const isSuccess = ["agreed", "succeeded", "completed"].includes(
          row.status,
        );
        const isFailed = ["walked_away", "rejected", "failed"].includes(
          row.status,
        );
        return (
          <span
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
              isSuccess
                ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20"
                : isFailed
                  ? "bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-500/20"
                  : "bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20"
            }`}
          >
            {row.status.replace(/_/g, " ")}
          </span>
        );
      },
    },
    {
      key: "actions",
      header: "Decision Detail",
      align: "right",
      cell: (row) => (
        <Link
          href={`/decision/${row.contract_id}`}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 transition-colors"
        >
          <span>Inspect Policy</span>
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      ),
    },
  ];

  const filterChips = [
    {
      id: "all",
      label: "All Negotiations",
      count: enrichedNegotiations.length,
    },
    {
      id: "active",
      label: "In Progress",
      count: enrichedNegotiations.filter((n) =>
        ["initiated", "countered", "in_progress"].includes(n.status),
      ).length,
    },
    {
      id: "agreed",
      label: "Agreed",
      count: enrichedNegotiations.filter((n) =>
        ["agreed", "succeeded", "completed"].includes(n.status),
      ).length,
    },
    {
      id: "failed",
      label: "Walked Away",
      count: enrichedNegotiations.filter((n) =>
        ["walked_away", "rejected", "failed"].includes(n.status),
      ).length,
    },
  ];

  const clientFilterPredicate = (row: EnrichedRow, chipId: string) => {
    if (chipId === "all") return true;
    if (chipId === "active")
      return ["initiated", "countered", "in_progress"].includes(row.status);
    if (chipId === "agreed")
      return ["agreed", "succeeded", "completed"].includes(row.status);
    if (chipId === "failed")
      return ["walked_away", "rejected", "failed"].includes(row.status);
    return true;
  };

  return (
    <DataTable<EnrichedRow>
      data={enrichedNegotiations}
      columns={columns}
      keyExtractor={(row) => row.id}
      searchPlaceholder="Filter negotiations by counterparty or service..."
      searchFilter={(row, query) => {
        const q = query.toLowerCase();
        return (
          (row.contracts?.service || "").toLowerCase().includes(q) ||
          (row.contracts?.vendors?.name || "").toLowerCase().includes(q) ||
          row.status.toLowerCase().includes(q)
        );
      }}
      defaultSort={{ columnKey: "savings", direction: "desc" }}
      filterChips={filterChips}
      clientFilterPredicate={clientFilterPredicate}
      getSimulatedState={(row) => ({
        isSimulated: row.contracts?.vendors?.is_simulated ?? true,
        label:
          row.contracts?.vendors?.is_simulated === false ? "Live" : "Sim",
      })}
      renderMobileCard={(row) => {
        const isSuccess = ["agreed", "succeeded", "completed"].includes(
          row.status,
        );
        const isFailed = ["walked_away", "rejected", "failed"].includes(
          row.status,
        );
        return (
          <div className="space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="font-bold text-sm text-slate-900 dark:text-white truncate">
                  {row.contracts?.service || "Vendor Agreement"}
                </div>
                <div className="text-[11px] text-slate-400">
                  {row.contracts?.vendors?.name || "Direct Vendor"} ·{" "}
                  {row.rounds ?? 1}/3 rounds
                </div>
              </div>
              <span
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider shrink-0 ${
                  isSuccess
                    ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20"
                    : isFailed
                      ? "bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-500/20"
                      : "bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20"
                }`}
              >
                {row.status.replace(/_/g, " ")}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2 text-xs">
              <div className="p-2.5 rounded-lg bg-slate-50/80 dark:bg-slate-900/40 border border-slate-100 dark:border-slate-800/50">
                <div className="text-[10px] text-slate-400 uppercase font-semibold mb-0.5">
                  Baseline
                </div>
                <div className="font-mono font-medium text-slate-600 dark:text-slate-300">
                  ${row.baselineNumber.toLocaleString()}
                </div>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-50/80 dark:bg-slate-900/40 border border-slate-100 dark:border-slate-800/50">
                <div className="text-[10px] text-slate-400 uppercase font-semibold mb-0.5">
                  Agreed
                </div>
                <div className="font-mono font-bold text-slate-900 dark:text-white">
                  ${row.currentPriceNumber.toLocaleString()}
                </div>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-50/80 dark:bg-slate-900/40 border border-slate-100 dark:border-slate-800/50">
                <div className="text-[10px] text-slate-400 uppercase font-semibold mb-0.5">
                  Savings
                </div>
                {row.savingsNumber > 0 ? (
                  <div className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                    +${row.savingsNumber.toLocaleString()}
                  </div>
                ) : (
                  <div className="text-slate-400">—</div>
                )}
              </div>
            </div>

            <Link
              href={`/decision/${row.contract_id}`}
              className="block w-full text-center px-3 py-2 rounded-lg bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-semibold transition-colors"
            >
              Inspect Policy →
            </Link>
          </div>
        );
      }}
      emptyState={{
        title: "No negotiations found",
        description:
          "Run the autonomous agent from the overview or trigger a contract negotiation to begin concessions.",
        icon: <Bot className="h-6 w-6" />,
        action: (
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-xs transition-colors"
          >
            <Bot className="h-3.5 w-3.5" />
            <span>Go to Overview</span>
          </Link>
        ),
      }}
    />
  );
}
