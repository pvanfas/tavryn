"use client";

import { Activity, ShieldCheck } from "lucide-react";
import React from "react";

import { TransactionHashBadge } from "@/components/TransactionHashBadge";
import { ColumnDef, DataTable } from "@/components/ui/data-table";
import { TractionMetricsResult } from "@/lib/metrics";

interface RecentSettlementsTableProps {
  transactions: TractionMetricsResult["transactions"];
}

type TransactionItem = TractionMetricsResult["transactions"][number];

export function RecentSettlementsTable({
  transactions,
}: RecentSettlementsTableProps) {
  const columns: ColumnDef<TransactionItem>[] = [
    {
      key: "id",
      header: "Transaction",
      accessor: (t) => t.id,
      cell: (t) => (
        <span className="font-mono text-[11px] text-slate-500">
          {t.id.slice(0, 8)}...
        </span>
      ),
    },
    {
      key: "businessName",
      header: "Organization",
      sortable: true,
      accessor: (t) => t.businessName,
      cell: (t) => (
        <span className="font-bold text-slate-900 dark:text-white">
          {t.businessName}
        </span>
      ),
    },
    {
      key: "vendorName",
      header: "Recipient Vendor",
      sortable: true,
      accessor: (t) => t.vendorName,
      cell: (t) => (
        <span className="text-slate-700 dark:text-slate-300">
          {t.vendorName}
        </span>
      ),
    },
    {
      key: "amount",
      header: "Settlement Amount",
      sortable: true,
      accessor: (t) => t.amount,
      cell: (t) => (
        <span className="font-mono font-bold text-slate-900 dark:text-white">
          $
          {t.amount.toLocaleString(undefined, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}{" "}
          {t.currency}
        </span>
      ),
    },
    {
      key: "status",
      header: "Escrow Status",
      sortable: true,
      accessor: (t) => t.status,
      cell: (t) => (
        <span
          className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
            t.status === "released"
              ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
              : t.status === "funded"
                ? "bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20"
                : t.status === "refunded"
                  ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20"
                  : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300"
          }`}
        >
          {t.status}
        </span>
      ),
    },
    {
      key: "verification",
      header: "ArcScan Verification",
      cell: (t) => (
        <TransactionHashBadge
          txHash={t.txHash}
          isSimulated={t.isSimulated}
          status={t.status}
          compact={true}
        />
      ),
    },
    {
      key: "createdAt",
      header: "Timestamp",
      sortable: true,
      align: "right",
      accessor: (t) => new Date(t.createdAt).getTime(),
      cell: (t) => (
        <span className="text-slate-500 text-[11px] font-mono">
          {new Date(t.createdAt).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </span>
      ),
    },
  ];

  const filterChips = [
    {
      id: "all",
      label: "All Settlements",
      count: transactions.length,
    },
    {
      id: "released",
      label: "Released",
      count: transactions.filter((t) => t.status === "released").length,
    },
    {
      id: "funded",
      label: "Funded",
      count: transactions.filter((t) => t.status === "funded").length,
    },
    {
      id: "refunded",
      label: "Refunded",
      count: transactions.filter((t) => t.status === "refunded").length,
    },
  ];

  const clientFilterPredicate = (t: TransactionItem, chipId: string) => {
    if (chipId === "all") return true;
    return t.status === chipId;
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 sm:gap-2">
        <div className="flex items-center gap-2">
          <Activity className="h-5 w-5 text-[#107e65] dark:text-[#34d399] shrink-0" />
          <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white tracking-tight">
            Reconciled On-Chain Transactions Ledger
          </h2>
        </div>
        <span className="text-xs text-slate-500 pl-7 sm:pl-0">
          {transactions.length} settlement transactions
        </span>
      </div>

      <DataTable<TransactionItem>
        data={transactions}
        columns={columns}
        keyExtractor={(t) => t.id}
        searchPlaceholder="Filter settlements by vendor, org, or hash..."
        searchFilter={(t, query) => {
          const q = query.toLowerCase();
          return (
            t.businessName.toLowerCase().includes(q) ||
            t.vendorName.toLowerCase().includes(q) ||
            (t.txHash || "").toLowerCase().includes(q) ||
            t.status.toLowerCase().includes(q)
          );
        }}
        defaultSort={{ columnKey: "createdAt", direction: "desc" }}
        filterChips={filterChips}
        clientFilterPredicate={clientFilterPredicate}
        getSimulatedState={(t) => ({
          isSimulated: t.isSimulated,
          label: t.isSimulated ? "Sim" : "Live",
        })}
        renderMobileCard={(t) => (
          <div className="space-y-2.5">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="font-bold text-sm text-slate-900 dark:text-white truncate">
                  {t.businessName}
                </div>
                <div className="text-[11px] text-slate-500">
                  &rarr; {t.vendorName}
                </div>
              </div>
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase shrink-0 ${
                  t.status === "released"
                    ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                    : t.status === "funded"
                      ? "bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20"
                      : t.status === "refunded"
                        ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20"
                        : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300"
                }`}
              >
                {t.status}
              </span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <div className="font-mono font-bold text-slate-900 dark:text-white">
                $
                {t.amount.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}{" "}
                {t.currency}
              </div>
              <div className="text-[11px] text-slate-500 font-mono">
                {new Date(t.createdAt).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </div>
            </div>
            <TransactionHashBadge
              txHash={t.txHash}
              isSimulated={t.isSimulated}
              status={t.status}
              compact={true}
            />
          </div>
        )}
        emptyState={{
          title: "No settlements recorded",
          description:
            "Settlements and escrow releases executed through Arc appear here automatically.",
          icon: <ShieldCheck className="h-6 w-6" />,
        }}
      />
    </div>
  );
}
