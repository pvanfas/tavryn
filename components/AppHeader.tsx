"use client";

import { Bell, Menu } from "lucide-react";
import Link from "next/link";
import React, { useEffect, useState } from "react";

import { AgentIcon } from "@/components/AgentIcon";

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
  const [unreadCount, setUnreadCount] = useState<number>(0);

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

  return (
    <>
      <header className="h-16 px-4 sm:px-6 bg-white/80 dark:bg-[#0e1411]/80 backdrop-blur-md border-b border-slate-200/60 dark:border-slate-800/60 flex items-center justify-between sticky top-0 z-30 transition-colors">
        {/* Mobile Menu Button + Breadcrumbs */}
        <div className="flex items-center gap-2 min-w-0">
          {onOpenMobileMenu && (
            <button
              type="button"
              onClick={onOpenMobileMenu}
              className="lg:hidden p-2 -ml-1 rounded-xl text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100/80 dark:hover:bg-slate-800/60 transition-colors cursor-pointer"
              title="Open navigation menu"
              aria-label="Open navigation menu"
            >
              <Menu className="h-5 w-5" />
            </button>
          )}

          <nav
            aria-label="Breadcrumb"
            className="flex items-center gap-2 text-xs font-medium text-slate-500 dark:text-slate-400 truncate"
          >
            {breadcrumbs.map((crumb, idx) => {
              const isLast = idx === breadcrumbs.length - 1;
              return (
                <React.Fragment key={crumb.label}>
                  {idx > 0 && (
                    <span className="text-slate-300 dark:text-slate-700 font-normal">
                      /
                    </span>
                  )}
                  {crumb.href && !isLast ? (
                    <Link
                      href={crumb.href}
                      className="text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition-colors font-medium"
                    >
                      {crumb.label}
                    </Link>
                  ) : (
                    <span className="font-bold text-slate-900 dark:text-slate-100 text-xs">
                      {crumb.label}
                    </span>
                  )}
                </React.Fragment>
              );
            })}
          </nav>
        </div>

        {/* Right Actions: Run Agent Now, Dark Mode, Bell, User Dropdown */}
        <div className="flex items-center gap-2 sm:gap-3">
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
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-[#107e65] to-[#0d6b55] hover:from-[#0d6b55] hover:to-[#0a5644] text-white text-xs font-bold shadow-xs hover:shadow-sm transition-all cursor-pointer"
            title="Execute autonomous procurement run immediately"
          >
            <AgentIcon className="h-3.5 w-3.5 shrink-0" />
            <span>Run agent now</span>
          </button>

          {/* Theme Toggle */}
          <ThemeToggle />

          {/* Notification Bell */}
          <button
            type="button"
            onClick={() => setNotificationOpen(true)}
            className="relative p-2 rounded-xl text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100/70 dark:hover:bg-slate-800/50 transition-colors cursor-pointer"
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
