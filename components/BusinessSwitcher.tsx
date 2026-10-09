"use client";

import { Building2, Plus } from "lucide-react";
import Link from "next/link";
import React from "react";

import { formatBusinessName } from "./UserDropdown";

export interface BusinessItem {
  id: string;
  name: string;
  is_real: boolean | null;
  treasury_balance: number | null;
  default_currency: string | null;
  wallet_address?: string | null;
}

interface BusinessSwitcherProps {
  businesses: BusinessItem[];
  activeBusinessId: string;
}

export function BusinessSwitcher({
  businesses,
  activeBusinessId,
}: BusinessSwitcherProps) {

  // Strictly enforce only 1 demo organization ("Demo Co") alongside verified real businesses
  const displayBusinesses = businesses.filter(
    (b) => b.is_real || b.name === "Demo Co",
  );

  const activeBusiness =
    displayBusinesses.find((b) => b.id === activeBusinessId) ||
    displayBusinesses[0];

  return (
    <div className="flex items-center gap-2">
      <div className="relative flex items-center">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-100/70 dark:bg-[#151c19] border border-slate-200/70 dark:border-slate-800/70 text-xs text-slate-700 dark:text-slate-200 shadow-2xs">
          <Building2 className="h-3.5 w-3.5 text-[#107e65] dark:text-[#34d399] shrink-0" />
          <span className="font-bold text-slate-900 dark:text-white text-xs truncate max-w-[150px]">
            {formatBusinessName(activeBusiness?.name || "Demo Co")}
          </span>
          {activeBusiness?.is_real ? (
            <span
              className="h-2 w-2 rounded-full bg-[#107e65] ml-0.5"
              title="Verified Real Business"
            />
          ) : (
            <span
              className="h-2 w-2 rounded-full bg-amber-500 ml-0.5"
              title="Demo / Simulated"
            />
          )}
        </div>
      </div>

      <Link
        href="/import-bills"
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#107e65] hover:bg-[#0d6b55] text-white shadow-2xs transition-colors shrink-0"
      >
        <Plus className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">Import Bills</span>
        <span className="sm:hidden">Import</span>
      </Link>
    </div>
  );
}
