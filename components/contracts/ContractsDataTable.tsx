"use client";

import { ArrowRight, FileText, PlusCircle } from "lucide-react";
import Link from "next/link";
import React from "react";

import { ColumnDef, DataTable } from "@/components/ui/data-table";
import { VendorLogo } from "@/components/VendorLogo";
import { evaluateContractOpportunity, UsageMetric } from "@/lib/heuristics";

export interface ContractRow {
  id: string;
  business_id: string;
  service: string;
  category: string;
  renewal_date: string;
  current_price: number | string;
  status: string;
  vendor_id: string | null;
  seat_count?: number | null;
  active_seats?: number | null;
  usage_metric?: UsageMetric | null;
  usage_history?: number[] | null;
  vendors?: {
    id?: string;
    name: string;
    category?: string;
    contact?: string | null;
    reputation_score?: number | null;
    is_simulated?: boolean | null;
    logo_url?: string | null;
  } | null;
  savings?: number;
}

interface ContractsDataTableProps {
  contracts: ContractRow[];
  businessId?: string;
}

export function ContractsDataTable({
  contracts,
}: ContractsDataTableProps) {
  // Enrich contracts with precomputed savings for high-performance sorting
  const enrichedContracts = React.useMemo(() => {
    return contracts.map((c) => {
      const opp = evaluateContractOpportunity(c);
      return {
        ...c,
        savings: opp.saving,
      };
    });
  }, [contracts]);

  const columns: ColumnDef<ContractRow>[] = [
    {
      key: "service",
      header: "Service & Vendor",
      sortable: true,
      sortAccessor: (r) => r.service,
      cell: (contract) => (
        <div className="flex items-center gap-3">
          <VendorLogo
            vendorId={contract.vendor_id}
            vendorName={contract.vendors?.name || contract.service}
            logoUrl={contract.vendors?.logo_url}
            editable={true}
            size="md"
          />
          <div>
            <div className="font-bold text-slate-900 dark:text-white">
              {contract.service}
            </div>
            <div className="text-[11px] text-slate-400">
              {contract.vendors?.name || "Direct Vendor"}
            </div>
          </div>
        </div>
      ),
    },
    {
      key: "category",
      header: "Category",
      sortable: true,
      sortAccessor: (r) => r.category,
      cell: (contract) => (
        <span className="inline-block px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-[11px] font-medium text-slate-600 dark:text-slate-300">
          {contract.category}
        </span>
      ),
    },
    {
      key: "renewal_date",
      header: "Renewal Date",
      sortable: true,
      sortAccessor: (r) => new Date(r.renewal_date).getTime(),
      cell: (contract) => {
        const renewalDate = new Date(contract.renewal_date);
        return (
          <span className="font-mono text-[11px] text-slate-600 dark:text-slate-300">
            {renewalDate.toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
            })}
          </span>
        );
      },
    },
    {
      key: "current_price",
      header: "Current Spend",
      sortable: true,
      sortAccessor: (r) => Number(r.current_price) || 0,
      cell: (contract) => (
        <span className="font-mono font-semibold text-slate-900 dark:text-white">
          ${Number(contract.current_price).toLocaleString()}
        </span>
      ),
    },
    {
      key: "savings",
      header: "Potential Savings",
      sortable: true,
      sortAccessor: (r) => r.savings || 0,
      cell: (contract) => {
        const saving = contract.savings || 0;
        const currentPrice = Number(contract.current_price) || 1;
        if (saving <= 0) {
          return <span className="text-slate-400 text-[11px]">—</span>;
        }
        return (
          <div className="flex items-center gap-1 font-mono font-semibold text-emerald-600 dark:text-emerald-400">
            <span>${saving.toLocaleString()}</span>
            <span className="text-[10px] text-emerald-700 dark:text-emerald-500 font-sans font-bold">
              ({Math.round((saving / currentPrice) * 100)}%)
            </span>
          </div>
        );
      },
    },
    {
      key: "status",
      header: "Status",
      sortable: true,
      sortAccessor: (r) => r.status,
      cell: (contract) => (
        <span
          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold capitalize ${
            contract.status === "negotiating"
              ? "bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20"
              : contract.status === "renewed"
                ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20"
                : contract.status === "cancelled"
                  ? "bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-500/20"
                  : "bg-blue-500/10 text-blue-700 dark:text-blue-400 border border-blue-500/20"
          }`}
        >
          <span
            className={`h-1.5 w-1.5 rounded-full ${
              contract.status === "negotiating"
                ? "bg-amber-500 animate-pulse"
                : contract.status === "renewed"
                  ? "bg-emerald-500"
                  : contract.status === "cancelled"
                    ? "bg-rose-500"
                    : "bg-blue-500"
            }`}
          />
          <span>{contract.status}</span>
        </span>
      ),
    },
    {
      key: "actions",
      header: "Actions",
      align: "right",
      cell: (contract) => (
        <div className="inline-flex items-center gap-2">
          <Link
            href={`/negotiate/${contract.id}`}
            className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-[11px] font-semibold text-slate-700 dark:text-slate-200 transition-colors"
          >
            Negotiate
          </Link>
          <Link
            href={`/decision/${contract.id}`}
            className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors"
            title="Inspect Decision"
          >
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      ),
    },
  ];

  return (
    <DataTable<ContractRow>
      data={enrichedContracts}
      columns={columns}
      keyExtractor={(r) => r.id}
      getSimulatedState={(r) => ({
        isSimulated: Boolean(r.vendors?.is_simulated),
        label: r.vendors?.is_simulated ? "Simulated" : "Real",
      })}
      defaultSort={{
        columnKey: "savings",
        direction: "desc",
      }}
      filterChips={[
        { id: "all", label: "All Contracts", count: enrichedContracts.length },
        {
          id: "active",
          label: "Active",
          count: enrichedContracts.filter((c) => c.status === "active").length,
        },
        {
          id: "negotiating",
          label: "Negotiating",
          count: enrichedContracts.filter((c) => c.status === "negotiating").length,
        },
        {
          id: "renewed",
          label: "Renewed",
          count: enrichedContracts.filter((c) => c.status === "renewed").length,
        },
        {
          id: "cancelled",
          label: "Cancelled",
          count: enrichedContracts.filter((c) => c.status === "cancelled").length,
        },
      ]}
      clientFilterPredicate={(row, filter) => {
        if (filter === "all") return true;
        return row.status === filter;
      }}
      emptyState={{
        icon: <FileText className="h-8 w-8 text-slate-400" />,
        title: "No contracts found",
        description:
          "Import your subscription statements or bills to automatically detect renewal cliffs and waste.",
        action: (
          <Link
            href="/import-bills"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-xs transition-colors"
          >
            <PlusCircle className="h-3.5 w-3.5" />
            <span>Import Bills</span>
          </Link>
        ),
      }}
    />
  );
}
