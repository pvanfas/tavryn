"use client";

import {
  Activity,
  BarChart3,
  Building2,
  CheckSquare,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  FileText,
  LayoutDashboard,
  Loader2,
  type LucideIcon,
  MessageSquare,
  PlusCircle,
  Settings as SettingsIcon,
  ShieldCheck,
  Wallet,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import React, { useEffect, useState } from "react";

import { getCurrentUser } from "@/lib/auth";
import { ARC_CONFIG } from "@/lib/circle";
import {
  BOTTOM_NAV_ITEMS,
  isRouteActive,
  WORKSPACE_NAV_SECTIONS,
} from "@/lib/nav";

import { BusinessItem } from "./BusinessSwitcher";
import { startTopLineLoader } from "./TopLineLoader";
import { formatBusinessName } from "./UserDropdown";

interface AppSidebarProps {
  businessName?: string;
  isReal?: boolean;
  businesses?: BusinessItem[];
  activeBusinessId?: string;
  treasuryBalance?: number;
  currency?: string;
  walletAddress?: string | null;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

export function AppSidebar({
  businessName = "Demo Co",
  isReal = false,
  businesses = [],
  activeBusinessId,
  treasuryBalance = 0,
  currency = "USDC",
  walletAddress,
  collapsed: controlledCollapsed,
  onToggleCollapse,
}: AppSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [internalCollapsed, setInternalCollapsed] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [userInitials, setUserInitials] = useState("??");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [fullName, setFullName] = useState<string | null>(null);
  const [pendingApprovalsCount, setPendingApprovalsCount] = useState<number>(0);
  const [isSwitchingOrg, setIsSwitchingOrg] = useState(false);

  useEffect(() => {
    setIsSwitchingOrg(false);
  }, [activeBusinessId]);

  const collapsed =
    controlledCollapsed !== undefined ? controlledCollapsed : internalCollapsed;
  const toggleCollapse =
    onToggleCollapse || (() => setInternalCollapsed(!internalCollapsed));

  // Load current user profile
  useEffect(() => {
    async function loadUser() {
      try {
        const user = await getCurrentUser();
        if (user) {
          setUserEmail(user.email || null);
          const meta = user.user_metadata || {};
          const name =
            meta.full_name ||
            meta.name ||
            user.email?.split("@")[0] ||
            "Operator";
          setFullName(name);
          setAvatarUrl(meta.avatar_url || meta.picture || null);

          const parts = name.trim().split(" ");
          if (parts.length >= 2) {
            setUserInitials(`${parts[0][0]}${parts[1][0]}`.toUpperCase());
          } else if (parts[0]) {
            setUserInitials(parts[0].slice(0, 2).toUpperCase());
          }
        }
      } catch {
        // Fallback
      }
    }
    loadUser();
  }, []);

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
            setPendingApprovalsCount(data.count);
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

  // Keyboard shortcut: Cmd/Ctrl + B toggles sidebar
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "b") {
        e.preventDefault();
        toggleCollapse();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [toggleCollapse]);

  const ICON_MAP: Record<string, LucideIcon> = {
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

  const visibleBusinesses = businesses.filter(
    (b) => (b.is_real || b.name === "Demo Co") && !b.name?.startsWith("[Deleted"),
  );
  const activeBusiness =
    visibleBusinesses.find((b) => b.id === activeBusinessId) ||
    visibleBusinesses[0] ||
    businesses.find((b) => b.id === activeBusinessId) ||
    businesses[0];
  const arcscanUrl = walletAddress
    ? `${ARC_CONFIG.explorerUrl}/address/${walletAddress}`
    : ARC_CONFIG.explorerUrl;

  return (
    <aside
      aria-label="Application Sidebar"
      className={`hidden md:flex flex-col fixed inset-y-0 left-0 z-30 bg-white/95 dark:bg-[#0c120f]/95 backdrop-blur-md border-r border-slate-200/80 dark:border-slate-800/80 transition-all duration-300 select-none ${
        collapsed ? "w-20" : "w-64"
      }`}
    >
      {/* 1. TOP SECTION: Logo & Collapse Button */}
      <div className="h-16 px-4 flex items-center justify-between border-b border-slate-200/70 dark:border-slate-800/70 shrink-0">
        <Link
          href="/dashboard"
          className={`flex items-center gap-3 transition-opacity ${
            collapsed ? "justify-center w-full" : ""
          }`}
          title="Tavryn Overview"
        >
          <div className="h-9 w-9 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 flex items-center justify-center p-1.5 shadow-2xs shrink-0">
            <Image
              src="/logo.png"
              alt="Tavryn"
              width={26}
              height={26}
              className="object-contain"
              priority
            />
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 leading-none">
                <span className="font-extrabold text-sm tracking-tight text-slate-900 dark:text-white">
                  Tavryn
                </span>
                <span className="text-[0.625rem] font-bold px-1.5 py-0.5 rounded-md bg-emerald-500/10 text-[#107e65] dark:text-[#34d399] border border-emerald-500/20">
                  Arc
                </span>
              </div>
              <span className="block text-[0.6875rem] font-medium text-slate-400 dark:text-slate-500 mt-0.5 truncate">
                Autonomous Treasury
              </span>
            </div>
          )}
        </Link>

        {!collapsed && (
          <button
            type="button"
            onClick={toggleCollapse}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/70 transition-colors cursor-pointer"
            title="Collapse sidebar (Ctrl+B)"
            aria-label="Collapse sidebar"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* 2. BUSINESS SWITCHER (Top of sidebar under logo with "Real" badge) */}
      {!collapsed ? (
        <div className="px-3 pt-3.5 pb-2 shrink-0">
          <div className="p-2.5 rounded-xl bg-slate-50/80 dark:bg-[#121915]/80 border border-slate-200/70 dark:border-slate-800/70 flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Active Organization
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

            <div className="flex items-center gap-2">
              {isSwitchingOrg ? (
                <Loader2 className="h-3.5 w-3.5 text-[#107e65] dark:text-[#34d399] animate-spin shrink-0" />
              ) : (
                <Building2 className="h-3.5 w-3.5 text-[#107e65] dark:text-[#34d399] shrink-0" />
              )}
              <select
                value={activeBusinessId || activeBusiness?.id || ""}
                disabled={isSwitchingOrg}
                onChange={(e) => {
                  const newId = e.target.value;
                  if (newId && newId !== activeBusinessId) {
                    setIsSwitchingOrg(true);
                    startTopLineLoader();
                    const targetPath = pathname && pathname !== "/" ? pathname : "/dashboard";
                    router.push(`${targetPath}?businessId=${newId}`);
                  }
                }}
                className="bg-transparent font-bold text-xs text-slate-900 dark:text-white focus:outline-hidden cursor-pointer w-full truncate pr-1 disabled:opacity-60"
                aria-label="Select Active Organization"
              >
                {visibleBusinesses.map((b) => (
                  <option
                    key={b.id}
                    value={b.id}
                    className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                  >
                    {formatBusinessName(b.name)}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      ) : (
        <div className="p-2 flex justify-center shrink-0">
          <button
            type="button"
            onClick={toggleCollapse}
            className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-emerald-500"
            title={`Active: ${activeBusiness?.name || "Demo Co"} (${activeBusiness?.is_real ? "Real" : "Demo"})`}
            aria-label="Active Organization"
          >
            <Building2 className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* 3. NAVIGATION SECTIONS (Workspace, Records, Insights) */}
      <nav
        aria-label="Sidebar Navigation"
        className="flex-1 px-3 py-3 overflow-y-auto space-y-5 focus:outline-hidden"
      >
        {WORKSPACE_NAV_SECTIONS.map((section) => (
          <div key={section.title} className="space-y-1">
            {!collapsed && (
              <p className="px-3 mb-1.5 text-[0.625rem] font-extrabold uppercase tracking-widest text-slate-400 dark:text-slate-500 select-none">
                {section.title}
              </p>
            )}

            {section.items.map((item) => {
              const Icon = ICON_MAP[item.iconName] || LayoutDashboard;
              const active = isRouteActive(
                pathname,
                item.href,
                item.highlightNestedPrefixes,
              );
              const showBadge =
                item.badgeKey === "approvals" && pendingApprovalsCount > 0;

              const navHref =
                activeBusinessId && item.href !== "/onboard"
                  ? `${item.href}?businessId=${encodeURIComponent(activeBusinessId)}`
                  : item.href;

              return (
                <div key={item.id} className="relative group">
                  <Link
                    href={navHref}
                    aria-current={active ? "page" : undefined}
                    className={`flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold transition-all focus:outline-hidden focus-visible:ring-2 focus-visible:ring-emerald-500 ${
                      collapsed ? "justify-center px-0 py-2.5" : ""
                    } ${
                      active
                        ? "bg-[#107e65]/10 dark:bg-[#107e65]/20 text-[#107e65] dark:text-[#34d399] font-bold shadow-2xs"
                        : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100/70 dark:hover:bg-slate-800/50"
                    }`}
                  >
                    <div className="relative shrink-0">
                      <Icon
                        className={`h-4 w-4 ${active ? "stroke-[2.5]" : "stroke-[1.75]"}`}
                      />
                      {showBadge && collapsed && (
                        <span className="absolute -top-1 -right-1.5 h-2 w-2 rounded-full bg-amber-500 ring-2 ring-white dark:ring-[#0c120f]" />
                      )}
                    </div>

                    {!collapsed && (
                      <span className="truncate flex-1">{item.label}</span>
                    )}

                    {!collapsed && showBadge && (
                      <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold font-mono bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30">
                        {pendingApprovalsCount}
                      </span>
                    )}

                    {!collapsed && item.badgeText && (
                      <span className="px-1.5 py-0.2 rounded-md text-[9px] font-extrabold uppercase tracking-wider bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                        {item.badgeText}
                      </span>
                    )}

                    {active && (
                      <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 rounded-r-full bg-[#107e65] dark:bg-[#34d399]" />
                    )}
                  </Link>

                  {/* Tooltip on Collapsed Mode */}
                  {collapsed && (
                    <div className="fixed left-20 ml-2 hidden group-hover:flex items-center z-50 pointer-events-none">
                      <div className="px-2.5 py-1.5 rounded-lg bg-slate-900 dark:bg-slate-800 text-white text-xs font-semibold shadow-lg whitespace-nowrap">
                        {item.label}
                        {showBadge && ` (${pendingApprovalsCount} pending)`}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </nav>

      {/* 4. BOTTOM SECTION: Add business, Settings, Treasury Chip, User Profile */}
      <div className="p-3 border-t border-slate-200/70 dark:border-slate-800/70 space-y-2 shrink-0">
        {/* Secondary Links: Add business & Settings */}
        <div className="space-y-0.5">
          {BOTTOM_NAV_ITEMS.map((item) => {
            const Icon = ICON_MAP[item.iconName] || PlusCircle;
            const active = isRouteActive(pathname, item.href);

            const bottomHref =
              activeBusinessId && item.href !== "/onboard"
                ? `${item.href}?businessId=${encodeURIComponent(activeBusinessId)}`
                : item.href;

            return (
              <div key={item.id} className="relative group">
                <Link
                  href={bottomHref}
                  aria-current={active ? "page" : undefined}
                  className={`flex items-center gap-3 px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors focus:outline-hidden focus-visible:ring-2 focus-visible:ring-emerald-500 ${
                    collapsed ? "justify-center px-0 py-2" : ""
                  } ${
                    active
                      ? "bg-[#107e65]/10 dark:bg-[#107e65]/20 text-[#107e65] dark:text-[#34d399] font-bold"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100/70 dark:hover:bg-slate-800/50"
                  }`}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {!collapsed && <span className="truncate">{item.label}</span>}
                </Link>

                {collapsed && (
                  <div className="fixed left-20 ml-2 hidden group-hover:flex items-center z-50 pointer-events-none">
                    <div className="px-2.5 py-1.5 rounded-lg bg-slate-900 dark:bg-slate-800 text-white text-xs font-semibold shadow-lg whitespace-nowrap">
                      {item.label}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Treasury Chip (USDC balance linking to ArcScan) */}
        {!collapsed ? (
          <a
            href={arcscanUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-[#121915] border border-slate-200/70 dark:border-slate-800/70 hover:border-emerald-500/40 transition-all group cursor-pointer"
            title="View smart contract treasury on ArcScan"
          >
            <div className="flex items-center gap-2 min-w-0">
              <div className="p-1.5 rounded-lg bg-emerald-500/10 text-[#107e65] dark:text-[#34d399] shrink-0">
                <Wallet className="h-3.5 w-3.5" />
              </div>
              <div className="min-w-0">
                <div className="text-[9px] uppercase font-bold text-slate-400 leading-none">
                  Arc Treasury
                </div>
                <div className="font-mono text-xs font-bold text-slate-900 dark:text-white truncate mt-0.5">
                  ${Number(treasuryBalance || 0).toLocaleString()} {currency}
                </div>
              </div>
            </div>
            <ExternalLink className="h-3 w-3 text-slate-400 group-hover:text-emerald-500 shrink-0 transition-colors" />
          </a>
        ) : (
          <div className="flex justify-center group relative">
            <a
              href={arcscanUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-[#107e65] dark:text-[#34d399] hover:bg-emerald-500/10 transition-colors"
              aria-label="View Treasury on ArcScan"
            >
              <Wallet className="h-4 w-4" />
            </a>
            <div className="fixed left-20 ml-2 hidden group-hover:flex items-center z-50 pointer-events-none">
              <div className="px-2.5 py-1.5 rounded-lg bg-slate-900 dark:bg-slate-800 text-white text-xs font-semibold shadow-lg whitespace-nowrap">
                Treasury: ${Number(treasuryBalance || 0).toLocaleString()}{" "}
                {currency} (ArcScan)
              </div>
            </div>
          </div>
        )}

        {/* Collapsed Expand Toggle */}
        {collapsed && (
          <div className="flex justify-center pt-1">
            <button
              type="button"
              onClick={toggleCollapse}
              className="p-2 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              title="Expand sidebar"
              aria-label="Expand sidebar"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}
