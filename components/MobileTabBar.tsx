"use client";

import {
  Activity,
  BarChart3,
  Building2,
  CheckSquare,
  ExternalLink,
  FileText,
  LayoutDashboard,
  MessageSquare,
  MoreHorizontal,
  PlusCircle,
  Settings as SettingsIcon,
  ShieldCheck,
  Wallet,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import React, { useEffect, useState } from "react";

import {
  BOTTOM_NAV_ITEMS,
  isRouteActive,
  MOBILE_MORE_ITEM_IDS,
  MOBILE_PRIMARY_TAB_IDS,
  NavItemConfig,
  WORKSPACE_NAV_SECTIONS,
} from "@/lib/nav";

import { BusinessItem } from "./BusinessSwitcher";
import { formatBusinessName } from "./UserDropdown";

interface MobileTabBarProps {
  businesses?: BusinessItem[];
  activeBusinessId?: string;
  treasuryBalance?: number;
  currency?: string;
  walletAddress?: string | null;
}

export function MobileTabBar({
  businesses = [],
  activeBusinessId,
  treasuryBalance,
  currency = "USDC",
  walletAddress,
}: MobileTabBarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [moreOpen, setMoreOpen] = useState(false);
  const [pendingCount, setPendingCount] = useState<number>(0);

  // Poll pending approvals count
  useEffect(() => {
    let isMounted = true;
    async function loadPending() {
      try {
        const query = activeBusinessId
          ? `?businessId=${encodeURIComponent(activeBusinessId)}`
          : "";
        const res = await fetch(`/api/approvals/count${query}`);
        if (res.ok) {
          const data = await res.json();
          if (isMounted && typeof data.count === "number") {
            setPendingCount(data.count);
          }
        }
      } catch {
        // ignore
      }
    }

    loadPending();
    const interval = setInterval(loadPending, 20000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [activeBusinessId]);

  // Close more sheet on route change
  useEffect(() => {
    setMoreOpen(false);
  }, [pathname]);

  const ICON_MAP: Record<string, React.ElementType> = {
    LayoutDashboard,
    Activity,
    CheckSquare,
    MessageSquare,
    FileText,
    ShieldCheck,
    BarChart3,
    PlusCircle,
    SettingsIcon,
  };

  // Collect all nav items
  const allItems: NavItemConfig[] = [];
  for (const sec of WORKSPACE_NAV_SECTIONS) {
    allItems.push(...sec.items);
  }
  allItems.push(...BOTTOM_NAV_ITEMS);

  const primaryItems = MOBILE_PRIMARY_TAB_IDS.map((id) =>
    allItems.find((i) => i.id === id),
  ).filter(Boolean) as NavItemConfig[];
  const moreItems = MOBILE_MORE_ITEM_IDS.map((id) =>
    allItems.find((i) => i.id === id),
  ).filter(Boolean) as NavItemConfig[];

  const isMoreActive = moreItems.some((item) =>
    isRouteActive(pathname, item.href, item.highlightNestedPrefixes),
  );

  const activeBusiness =
    businesses.find((b) => b.id === activeBusinessId) || businesses[0];
  const arcscanUrl = walletAddress
    ? `https://testnet.arcscan.app/address/${walletAddress}`
    : "https://testnet.arcscan.app";

  return (
    <>
      {/* Fixed Bottom Tab Bar (Visible on screens below md) */}
      <nav
        aria-label="Mobile Bottom Navigation"
        className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-white/95 dark:bg-[#0e1411]/95 backdrop-blur-md border-t border-slate-200/80 dark:border-slate-800/80 pb-safe shadow-[0_-4px_16px_rgba(0,0,0,0.05)] transition-colors"
      >
        <div className="grid grid-cols-5 h-16 max-w-md mx-auto px-1">
          {primaryItems.map((item) => {
            const Icon = ICON_MAP[item.iconName] || LayoutDashboard;
            const active = isRouteActive(
              pathname,
              item.href,
              item.highlightNestedPrefixes,
            );
            const showBadge = item.id === "approvals" && pendingCount > 0;

            return (
              <Link
                key={item.id}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`relative flex flex-col items-center justify-center gap-1 text-[11px] font-semibold transition-colors focus:outline-hidden focus-visible:ring-2 focus-visible:ring-emerald-500 rounded-xl m-1 ${
                  active
                    ? "text-[#107e65] dark:text-[#34d399]"
                    : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                <div className="relative">
                  <Icon
                    className={`h-5 w-5 ${active ? "stroke-[2.5]" : "stroke-[1.75]"}`}
                  />
                  {showBadge && (
                    <span className="absolute -top-1.5 -right-2 px-1 min-w-4 h-4 rounded-full bg-amber-500 text-white text-[9px] font-bold flex items-center justify-center ring-2 ring-white dark:ring-[#0e1411]">
                      {pendingCount > 9 ? "9+" : pendingCount}
                    </span>
                  )}
                </div>
                <span className="truncate max-w-[64px]">{item.label}</span>
                {active && (
                  <span className="absolute bottom-1 w-1.5 h-1.5 rounded-full bg-[#107e65] dark:bg-[#34d399]" />
                )}
              </Link>
            );
          })}

          {/* "More" Trigger Tab */}
          <button
            type="button"
            onClick={() => setMoreOpen(!moreOpen)}
            aria-label="Open more navigation options"
            aria-expanded={moreOpen}
            className={`flex flex-col items-center justify-center gap-1 text-[11px] font-semibold transition-colors focus:outline-hidden focus-visible:ring-2 focus-visible:ring-emerald-500 rounded-xl m-1 cursor-pointer ${
              isMoreActive || moreOpen
                ? "text-[#107e65] dark:text-[#34d399]"
                : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            <MoreHorizontal
              className={`h-5 w-5 ${isMoreActive || moreOpen ? "stroke-[2.5]" : "stroke-[1.75]"}`}
            />
            <span>More</span>
            {isMoreActive && (
              <span className="absolute bottom-1 w-1.5 h-1.5 rounded-full bg-[#107e65] dark:bg-[#34d399]" />
            )}
          </button>
        </div>
      </nav>

      {/* "More" Bottom Sheet Modal */}
      {moreOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex flex-col justify-end bg-black/50 backdrop-blur-xs transition-opacity animate-in fade-in duration-200">
          <div
            className="fixed inset-0"
            onClick={() => setMoreOpen(false)}
            aria-hidden="true"
          />

          <div
            role="dialog"
            aria-label="More navigation items"
            className="relative z-10 bg-white dark:bg-[#111714] border-t border-slate-200 dark:border-slate-800 rounded-t-3xl p-6 shadow-2xl space-y-5 max-h-[85vh] overflow-y-auto"
          >
            {/* Sheet Handle & Close */}
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800/80">
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-900 dark:text-white text-base">
                  Additional Workspaces & Records
                </span>
              </div>
              <button
                type="button"
                onClick={() => setMoreOpen(false)}
                className="p-1.5 rounded-full text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                aria-label="Close menu"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Business Switcher in Sheet */}
            {businesses.length > 0 && (
              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-[#151c19] border border-slate-200/80 dark:border-slate-800/80 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[#107e65] dark:text-[#34d399]">
                    <Building2 className="h-4 w-4" />
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                      Active Business
                    </span>
                    <div className="flex items-center gap-1.5 font-bold text-xs text-slate-900 dark:text-white">
                      <span>
                        {formatBusinessName(activeBusiness?.name || "Demo Co")}
                      </span>
                      {activeBusiness?.is_real ? (
                        <span className="px-1.5 py-0.2 rounded-md bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 text-[9px] font-bold">
                          Real
                        </span>
                      ) : (
                        <span className="px-1.5 py-0.2 rounded-md bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20 text-[9px] font-bold">
                          Demo
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <select
                  value={activeBusinessId}
                  onChange={(e) => {
                    const newId = e.target.value;
                    if (newId) {
                      router.push(`/?businessId=${newId}`);
                      setMoreOpen(false);
                    }
                  }}
                  className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 text-xs font-semibold text-slate-700 dark:text-slate-200 focus:outline-hidden"
                >
                  {businesses.map((b) => (
                    <option key={b.id} value={b.id}>
                      {formatBusinessName(b.name)}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Nav Items List */}
            <div className="space-y-1.5">
              {moreItems.map((item) => {
                const Icon = ICON_MAP[item.iconName] || FileText;
                const active = isRouteActive(
                  pathname,
                  item.href,
                  item.highlightNestedPrefixes,
                );

                return (
                  <Link
                    key={item.id}
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    onClick={() => setMoreOpen(false)}
                    className={`flex items-center justify-between p-3 rounded-xl text-sm font-semibold transition-colors ${
                      active
                        ? "bg-[#107e65]/10 dark:bg-[#107e65]/20 text-[#107e65] dark:text-[#34d399]"
                        : "text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/60"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Icon className="h-5 w-5" />
                      <span>{item.label}</span>
                    </div>
                    {item.badgeText && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                        {item.badgeText}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>

            {/* Treasury Chip linking to ArcScan */}
            <a
              href={arcscanUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between p-3.5 rounded-2xl bg-gradient-to-r from-emerald-500/10 via-emerald-500/5 to-transparent border border-emerald-500/20 text-xs font-bold text-slate-900 dark:text-white hover:border-emerald-500/40 transition-all group"
            >
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-emerald-500/10 text-[#107e65] dark:text-[#34d399]">
                  <Wallet className="h-4 w-4" />
                </div>
                <div>
                  <div className="text-[10px] uppercase font-bold text-slate-400">
                    Arc Testnet Treasury
                  </div>
                  <div className="font-mono text-sm text-[#107e65] dark:text-[#34d399]">
                    ${Number(treasuryBalance || 0).toLocaleString()} {currency}
                  </div>
                </div>
              </div>
              <ExternalLink className="h-4 w-4 text-slate-400 group-hover:text-emerald-500 transition-colors" />
            </a>
          </div>
        </div>
      )}
    </>
  );
}
