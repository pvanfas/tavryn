"use client";

import { Building2, Plus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
  const router = useRouter();

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newId = e.target.value;
    if (newId) {
      router.push(`/dashboard?businessId=${newId}`);
    }
  };

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
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-100/70 dark:bg-[#151c19] border border-slate-200/70 dark:border-slate-800/70 text-xs text-slate-700 dark:text-slate-200 shadow-2xs">
          <Building2 className="h-3.5 w-3.5 text-[#107e65] dark:text-[#34d399] shrink-0" />
          <span className="text-slate-500 dark:text-slate-400 font-semibold hidden sm:inline">
            Org:
          </span>
          <select
            value={activeBusinessId}
            onChange={handleChange}
            className="bg-transparent font-bold text-slate-900 dark:text-white focus:outline-none cursor-pointer pr-1 text-xs"
          >
            {displayBusinesses.map((b) => (
              <option
                key={b.id}
                value={b.id}
                className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-medium"
              >
                {formatBusinessName(b.name)}
              </option>
            ))}
          </select>
          {activeBusiness?.is_real ? (
            <span
              className="h-2 w-2 rounded-full bg-[#107e65] animate-pulse ml-0.5"
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
        href="/onboard"
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-[#107e65] hover:bg-[#0d6b55] text-white shadow-2xs transition-colors shrink-0"
      >
        <Plus className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">Onboard Business</span>
        <span className="sm:hidden">New</span>
      </Link>
    </div>
  );
}
