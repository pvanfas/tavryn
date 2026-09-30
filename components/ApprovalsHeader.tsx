"use client";

import { SlidersHorizontal } from "lucide-react";
import Link from "next/link";
import React from "react";

import { PageHeader } from "@/components/PageHeader";

export interface ApprovalsHeaderProps {
  pendingCount: number;
  totalCount?: number;
  pendingVolume?: number;
  policyCeiling?: number;
  businessId?: string;
  className?: string;
}

/**
 * Approvals page header leveraging the common minimal PageHeader component.
 */
export function ApprovalsHeader({
  pendingCount,
  policyCeiling = 2000,
  businessId,
  className = "",
}: ApprovalsHeaderProps) {
  const hasPending = pendingCount > 0;
  const settingsUrl = businessId
    ? `/settings?businessId=${businessId}`
    : "/settings";

  return (
    <PageHeader
      badge="Workspace"
      caption="Human Governance"
      title="Policy Approvals"
      description="Transactions exceeding deterministic auto-execution ceilings requiring executive or finance team review."
      status={
        hasPending ? (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-500/15 text-amber-800 dark:text-amber-300 border border-amber-500/30">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
            </span>
            <span>{pendingCount} Awaiting Authorization</span>
          </span>
        ) : null
      }
      className={className}
    >
      <Link
        href={settingsUrl}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/80 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-medium transition-colors shadow-2xs"
        title="Configure spending policy"
      >
        <SlidersHorizontal className="h-3.5 w-3.5 text-slate-400" />
        <span>Policy Rules (≤ ${policyCeiling.toLocaleString()})</span>
      </Link>
    </PageHeader>
  );
}
