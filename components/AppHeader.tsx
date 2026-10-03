"use client";

import {
  AlertTriangle,
  Bell,
  ExternalLink,
  Menu,
  Search,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import React, { useEffect, useState } from "react";

import { AgentIcon } from "@/components/AgentIcon";
import { CommandBar } from "@/components/CommandBar";

import { BusinessItem } from "./BusinessSwitcher";
import { NotificationPanel } from "./NotificationPanel";
import { ThemeToggle } from "./ThemeToggle";
import { UserDropdown } from "./UserDropdown";

interface AppHeaderProps {
  breadcrumbs?: Array<{ label: string; href?: string }>;
  businesses?: BusinessItem[];
  activeBusinessId?: string;
  treasuryBalance?: number;
  currency?: string;
  isReal?: boolean;
  businessName?: string;
  onOpenMobileMenu?: () => void;
}

export function AppHeader({
  breadcrumbs = [
    { label: "Dashboard", href: "/dashboard" },
    { label: "Contracts Ledger" },
  ],
  businesses = [],
  activeBusinessId,
  treasuryBalance: _treasuryBalance,
  currency: _currency = "USDC",
  isReal = false,
  businessName = "Demo Co",
  onOpenMobileMenu,
}: AppHeaderProps) {
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [commandBarOpen, setCommandBarOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [walletBalance, setWalletBalance] = useState<{
    balance: number;
    isLow: boolean;
    faucetUrl: string;
  } | null>(null);

  // Global keyboard shortcut for Cmd+K / Ctrl+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setCommandBarOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Poll or fetch initial unread count for the active business
  useEffect(() => {
    if (!activeBusinessId) return;

    let isMounted = true;
    async function loadUnread() {
      try {
        const res = await fetch(
          `/api/notifications?businessId=${encodeURIComponent(activeBusinessId!)}&limit=20`,
        );
        if (res.ok) {
          const data = await res.json();
          if (isMounted && typeof data.unreadCount === "number") {
            setUnreadCount(data.unreadCount);
          }
        }
      } catch {
        // Ignore network hiccups
      }
    }

    loadUnread();
    const interval = setInterval(loadUnread, 30000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [activeBusinessId]);

  // Poll Arc USDC balance for active business
  useEffect(() => {
    if (!activeBusinessId) return;
    let isMounted = true;
    async function loadBalance() {
      try {
        const res = await fetch(
          `/api/wallet/balance?businessId=${encodeURIComponent(activeBusinessId!)}`,
        );
        if (res.ok) {
          const j = await res.json();
          if (isMounted) {
            setWalletBalance({
              balance: j.balance,
              isLow: j.isLow,
              faucetUrl: j.faucetUrl,
            });
          }
        }
      } catch {
        // silent
      }
    }
    loadBalance();
    const interval = setInterval(loadBalance, 45000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [activeBusinessId]);

  return (
    <>
      {walletBalance?.isLow && (
        <div className="bg-amber-500/10 dark:bg-amber-950/40 border-b border-amber-500/20 px-3 sm:px-6 py-1.5 text-xs text-amber-800 dark:text-amber-300 flex items-center justify-between transition-colors z-40 relative">
          <div className="flex items-center gap-2 min-w-0">
            <AlertTriangle className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
            <span className="truncate">
              Low Arc Testnet USDC Liquidity ($
              {walletBalance.balance.toFixed(2)} USDC). Top up to maintain
              automated renewals.
            </span>
          </div>
          <a
            href={walletBalance.faucetUrl || "https://faucet.circle.com"}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 font-bold text-amber-700 dark:text-amber-300 hover:underline shrink-0 ml-3 text-[11px]"
          >
            <span>Circle Arc Faucet</span>
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      )}
      <header className="h-14 sm:h-16 px-3 sm:px-6 bg-white/80 dark:bg-[#0e1411]/80 backdrop-blur-md border-b border-slate-200/60 dark:border-slate-800/60 flex items-center justify-between sticky top-0 z-30 transition-colors">
        {/* Mobile Menu Button + Breadcrumbs */}
        <div className="flex items-center gap-1.5 sm:gap-2 min-w-0 flex-1 mr-2">
          {onOpenMobileMenu && (
            <button
              type="button"
              onClick={onOpenMobileMenu}
              className="lg:hidden p-1.5 -ml-1 rounded-xl text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100/80 dark:hover:bg-slate-800/60 transition-colors cursor-pointer shrink-0"
              title="Open navigation menu"
              aria-label="Open navigation menu"
            >
              <Menu className="h-5 w-5" />
            </button>
          )}

          <nav
            aria-label="Breadcrumb"
            className="flex items-center gap-1.5 text-xs font-medium text-slate-500 dark:text-slate-400 min-w-0"
          >
            {/* Desktop: full breadcrumb trail */}
            <div className="hidden sm:flex items-center gap-1.5 min-w-0">
              {breadcrumbs.map((crumb, idx) => {
                const isLast = idx === breadcrumbs.length - 1;
                return (
                  <React.Fragment key={crumb.label}>
                    {idx > 0 && (
                      <span className="text-slate-300 dark:text-slate-700 font-normal shrink-0">
                        /
                      </span>
                    )}
                    {crumb.href && !isLast ? (
                      <Link
                        href={crumb.href}
                        className="text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition-colors font-medium truncate max-w-[140px]"
                      >
                        {crumb.label}
                      </Link>
                    ) : (
                      <span className="font-bold text-slate-900 dark:text-slate-100 text-xs truncate">
                        {crumb.label}
                      </span>
                    )}
                  </React.Fragment>
                );
              })}
            </div>

            {/* Mobile: concise active page title */}
            <div className="flex sm:hidden items-center min-w-0">
              <span className="font-bold text-slate-900 dark:text-slate-100 text-xs truncate max-w-[130px]">
                {breadcrumbs[breadcrumbs.length - 1]?.label || "Dashboard"}
              </span>
            </div>
          </nav>
        </div>

        {/* Right Actions: Run Agent Now, Dark Mode, Bell, User Dropdown */}
        <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
          {/* Ask Tavryn Command Bar Trigger (Desktop) */}
          <button
            id="header-ask-tavryn-btn"
            type="button"
            onClick={() => setCommandBarOpen(true)}
            className="hidden md:inline-flex items-center gap-2 px-2.5 sm:px-3 h-8 rounded-lg border border-slate-200/90 dark:border-slate-800 bg-slate-50/90 dark:bg-slate-900/80 hover:bg-slate-100 dark:hover:bg-slate-800/80 text-xs text-slate-600 dark:text-slate-300 font-medium transition-all shadow-2xs hover:border-[#107e65]/40 cursor-pointer"
            title="Open Ask Tavryn Command Bar (⌘K)"
            aria-label="Open command bar"
          >
            <Search className="h-3.5 w-3.5 text-[#107e65] shrink-0" />
            <span className="text-slate-500 dark:text-slate-400">
              Ask Tavryn...
            </span>
            <kbd className="font-mono text-[10px] px-1.5 py-0.5 rounded-md bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 font-bold border border-slate-200 dark:border-slate-700 shadow-2xs">
              ⌘K
            </kbd>
          </button>

          {/* Mobile Ask Tavryn Trigger */}
          <button
            id="mobile-ask-tavryn-btn"
            type="button"
            onClick={() => setCommandBarOpen(true)}
            className="md:hidden h-8 w-8 flex items-center justify-center rounded-lg border border-slate-200/80 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/60 text-[#107e65] dark:text-[#34d399] hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
            title="Ask Tavryn"
            aria-label="Ask Tavryn"
          >
            <Sparkles className="h-4 w-4" />
          </button>

          {/* Run Agent Now Button */}
          <button
            id="header-run-agent-btn"
            type="button"
            onClick={async () => {
              try {
                const targetUrl = activeBusinessId
                  ? `/api/agent/run?businessId=${encodeURIComponent(activeBusinessId)}`
                  : "/api/demo/reset-and-run";
                await fetch(targetUrl, { method: "POST" });
                window.location.reload();
              } catch {
                // ignore
              }
            }}
            className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 h-8 rounded-lg bg-gradient-to-r from-[#107e65] to-[#0d6b55] hover:from-[#0d6b55] hover:to-[#0a5644] text-white text-xs font-bold shadow-xs hover:shadow-sm transition-all cursor-pointer whitespace-nowrap shrink-0"
            title="Execute autonomous procurement run immediately"
            aria-label="Run agent now"
          >
            <AgentIcon className="h-3.5 w-3.5 shrink-0" />
            <span className="hidden sm:inline">Run agent now</span>
            <span className="inline sm:hidden font-semibold text-[11px]">
              Run
            </span>
          </button>

          {/* Theme Toggle */}
          <ThemeToggle />

          {/* Notification Bell */}
          <button
            type="button"
            onClick={() => setNotificationOpen(true)}
            className="relative h-8 w-8 flex items-center justify-center rounded-xl text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100/70 dark:hover:bg-slate-800/50 transition-colors cursor-pointer shrink-0"
            title="Notifications"
            aria-label="Notifications"
          >
            <Bell className="h-4 w-4" />
            {unreadCount > 0 ? (
              <span className="absolute -top-0.5 -right-0.5 min-w-4 h-4 px-1 rounded-full bg-[#107e65] text-white text-[10px] font-bold flex items-center justify-center ring-2 ring-white dark:ring-[#0e1411]">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            ) : (
              <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-slate-300 dark:bg-slate-600 ring-2 ring-white dark:ring-[#0e1411]" />
            )}
          </button>

          {/* User Dropdown with integrated organization switcher */}
          <UserDropdown
            businessName={businessName}
            isReal={isReal}
            businesses={businesses}
            activeBusinessId={activeBusinessId}
          />
        </div>
      </header>

      {/* Ask Tavryn Command Bar Dialog */}
      <CommandBar
        isOpen={commandBarOpen}
        onClose={() => setCommandBarOpen(false)}
        businessId={activeBusinessId}
        businessName={businessName}
      />

      {/* 20px Distanced Floating Offcanvas Notification Panel */}
      <NotificationPanel
        isOpen={notificationOpen}
        onClose={() => setNotificationOpen(false)}
        businessId={activeBusinessId}
        onUnreadChange={setUnreadCount}
      />
    </>
  );
}
