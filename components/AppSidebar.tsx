"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { formatBusinessName } from "./UserDropdown";
import { SIDEBAR_NAV_GROUPS, isRouteActive } from "@/lib/nav";
import {
  LayoutDashboard,
  ShieldCheck,
  PlusCircle,
  ChevronLeft,
  ChevronRight,
  History,
  X,
  Settings as SettingsIcon,
  BarChart3,
  Building2,
  type LucideIcon,
} from "lucide-react";

interface AppSidebarProps {
  businessName?: string;
  isReal?: boolean;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  mobileOpen?: boolean;
  onCloseMobile?: () => void;
}

export function AppSidebar({
  businessName = "Demo Co",
  isReal = false,
  collapsed: controlledCollapsed,
  onToggleCollapse,
  mobileOpen = false,
  onCloseMobile,
}: AppSidebarProps) {
  const pathname = usePathname();
  const [internalCollapsed, setInternalCollapsed] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [userInitials, setUserInitials] = useState("??");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [fullName, setFullName] = useState<string | null>(null);

  useEffect(() => {
    getCurrentUser().then((user) => {
      if (user) {
        if (user.email) {
          setUserEmail(user.email);
          const parts = user.email.split("@")[0].split(/[._-]/);
          const initials = parts
            .slice(0, 2)
            .map((p: string) => p[0]?.toUpperCase() || "")
            .join("");
          setUserInitials(initials || user.email[0].toUpperCase());
        }
        const meta = user.user_metadata;
        if (meta?.avatar_url || meta?.picture) {
          setAvatarUrl(meta.avatar_url || meta.picture);
        }
        if (meta?.full_name || meta?.name) {
          setFullName(meta.full_name || meta.name);
        }
      }
    });
  }, []);

  const collapsed =
    controlledCollapsed !== undefined ? controlledCollapsed : internalCollapsed;
  const toggleCollapse =
    onToggleCollapse || (() => setInternalCollapsed(!internalCollapsed));

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

  const displayName = fullName || userEmail?.split("@")[0] || "Operator";

  const ICON_MAP: Record<string, LucideIcon> = {
    LayoutDashboard,
    ShieldCheck,
    History,
    BarChart3,
    PlusCircle,
    SettingsIcon,
  };

  const navGroups = SIDEBAR_NAV_GROUPS.map((group) => ({
    label: group.label,
    items: group.items.map((item) => ({
      label: item.label,
      href: item.href,
      icon: ICON_MAP[item.iconName] || LayoutDashboard,
      active: isRouteActive(pathname, item.href, item.matchNested),
      badge: item.badge,
      pulseBadge: item.pulseBadge,
    })),
  }));

  const renderNavLinks = (isMobile = false) => (
    <nav
      className={`flex-1 px-3 py-4 ${collapsed && !isMobile ? "overflow-visible" : "overflow-y-auto"} space-y-5`}
    >
      {navGroups.map((group) => (
        <div key={group.label}>
          {/* Group Label — visible when expanded or mobile */}
          {(!collapsed || isMobile) && (
            <p className="px-3 mb-2 text-[0.625rem] font-extrabold uppercase tracking-widest text-slate-400 dark:text-slate-500 select-none">
              {group.label}
            </p>
          )}

          <ul className="space-y-1">
            {group.items.map((item) => {
              const Icon = item.icon;

              if (collapsed && !isMobile) {
                // Collapsed desktop item: centered icon with animated flyout tooltip
                return (
                  <li
                    key={item.label}
                    className="relative group flex justify-center"
                  >
                    <Link
                      href={item.href}
                      className={`h-11 w-11 rounded-xl flex items-center justify-center transition-all duration-150 relative cursor-pointer ${
                        item.active
                          ? "bg-[#107e65] text-white shadow-[0_2px_12px_rgba(16,126,101,0.35)]"
                          : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800/60"
                      }`}
                      aria-label={item.label}
                    >
                      <Icon className="h-5 w-5 shrink-0" />
                      {item.pulseBadge && (
                        <span className="absolute top-2 right-2 h-2 w-2 rounded-full bg-emerald-400 ring-2 ring-white dark:ring-[#0e1411] animate-pulse" />
                      )}
                    </Link>

                    {/* Flyout Tooltip to the right */}
                    <div className="absolute left-full ml-3 top-1/2 -translate-y-1/2 px-3 py-1.5 rounded-xl bg-slate-900 text-white dark:bg-white dark:text-slate-900 text-xs font-bold shadow-xl border border-slate-800 dark:border-slate-200 whitespace-nowrap z-[200] pointer-events-none opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-150 flex items-center gap-2">
                      <span>{item.label}</span>
                      {item.badge && (
                        <span className="px-1.5 py-0.5 rounded text-[0.625rem] font-extrabold uppercase bg-emerald-500/20 text-emerald-300 dark:text-[#107e65]">
                          {item.badge}
                        </span>
                      )}
                    </div>
                  </li>
                );
              }

              // Expanded item (desktop or mobile drawer)
              return (
                <li key={item.label}>
                  <Link
                    href={item.href}
                    onClick={() => {
                      if (isMobile && onCloseMobile) onCloseMobile();
                    }}
                    className={`relative flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition-all duration-150 group cursor-pointer ${
                      item.active
                        ? "bg-[#107e65]/10 dark:bg-[#107e65]/[0.14] text-[#0d6b55] dark:text-[#34d399] font-bold shadow-2xs"
                        : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100/80 dark:hover:bg-slate-800/50"
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {item.active && (
                        <span
                          aria-hidden="true"
                          className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-[3.5px] rounded-r-full bg-[#107e65] dark:bg-[#34d399] shadow-[0_0_8px_rgba(16,126,101,0.5)]"
                        />
                      )}
                      <Icon
                        className={`h-4 w-4 shrink-0 transition-colors ${
                          item.active
                            ? "text-[#107e65] dark:text-[#34d399]"
                            : "text-slate-400 dark:text-slate-500 group-hover:text-slate-600 dark:group-hover:text-slate-300"
                        }`}
                      />
                      <span className="truncate">{item.label}</span>
                    </div>

                    {item.badge && (
                      <span
                        className={`text-[0.625rem] font-extrabold px-1.5 py-0.5 rounded-md uppercase tracking-wider shrink-0 ${
                          item.active
                            ? "bg-[#107e65]/15 text-[#107e65] dark:text-[#34d399]"
                            : "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 group-hover:text-slate-700 dark:group-hover:text-slate-200"
                        }`}
                      >
                        {item.pulseBadge && (
                          <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500 mr-1 animate-pulse" />
                        )}
                        {item.badge}
                      </span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );

  const renderUserProfile = (isMobile = false) => {
    if (collapsed && !isMobile) {
      // Collapsed profile: centered avatar with rich hover flyout
      return (
        <div className="p-3 border-t border-slate-200/60 dark:border-slate-800/60 flex justify-center relative group">
          <div className="relative">
            <div className="h-10 w-10 rounded-full bg-[#142620] text-emerald-300 font-bold text-xs flex items-center justify-center border border-emerald-900/40 ring-2 ring-[#107e65]/25 shadow-2xs select-none overflow-hidden cursor-pointer">
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt={displayName}
                  className="h-full w-full object-cover"
                />
              ) : (
                userInitials
              )}
            </div>
            <span
              className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-[#0e1411]"
              title="Online • Arc Testnet"
            />
          </div>

          {/* Hover flyout card */}
          <div className="absolute left-full ml-3 bottom-2 p-3.5 rounded-2xl bg-white dark:bg-[#111714] border border-slate-200/80 dark:border-slate-800/80 shadow-2xl z-[200] pointer-events-none opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-150 w-56">
            <div className="flex items-center gap-2.5 mb-2.5">
              <div className="h-8 w-8 rounded-full bg-[#142620] text-emerald-300 font-bold text-xs flex items-center justify-center shrink-0 border border-emerald-900/40 select-none overflow-hidden">
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt={displayName}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  userInitials
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                  {displayName}
                </p>
                {userEmail && (
                  <p className="text-[10px] text-slate-400 dark:text-slate-500 truncate">
                    {userEmail}
                  </p>
                )}
              </div>
            </div>
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800/60 flex items-center justify-between text-[11px] text-slate-600 dark:text-slate-300">
              <span className="truncate">
                {formatBusinessName(businessName)}
              </span>
              <span className="text-[10px] font-bold text-[#107e65] dark:text-[#34d399] uppercase">
                {isReal ? "Real" : "Demo"}
              </span>
            </div>
          </div>
        </div>
      );
    }

    // Expanded profile card
    return (
      <div className="p-3 border-t border-slate-200/60 dark:border-slate-800/60 bg-slate-50/50 dark:bg-[#0b100e]/50">
        <div className="p-2.5 rounded-xl bg-white/90 dark:bg-[#131b17]/90 border border-slate-200/70 dark:border-slate-800/70 shadow-2xs flex items-center gap-3">
          <div className="relative shrink-0">
            <div className="h-9 w-9 rounded-full bg-[#142620] text-emerald-300 font-bold text-xs flex items-center justify-center border border-emerald-900/40 ring-2 ring-[#107e65]/20 shadow-2xs select-none overflow-hidden">
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt={displayName}
                  className="h-full w-full object-cover"
                />
              ) : (
                userInitials
              )}
            </div>
            <span
              className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-[#131b17]"
              title="Online"
            />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-1">
              <p
                className="text-xs font-bold text-slate-900 dark:text-white truncate"
                title={userEmail || displayName}
              >
                {displayName}
              </p>
              <span className="px-1.5 py-0.5 rounded text-[0.625rem] font-extrabold uppercase tracking-wide bg-emerald-500/10 text-[#107e65] dark:text-emerald-400 border border-emerald-500/20 shrink-0">
                Admin
              </span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate flex items-center gap-1 mt-0.5 font-medium">
              <Building2 className="h-3 w-3 inline text-slate-400 shrink-0" />
              <span className="truncate">
                {formatBusinessName(businessName)}
              </span>
              {isReal ? (
                <span className="text-[#107e65] font-semibold shrink-0">
                  &bull; Real
                </span>
              ) : (
                <span className="text-amber-600 dark:text-amber-400 font-medium shrink-0">
                  &bull; Demo
                </span>
              )}
            </p>
          </div>
        </div>
      </div>
    );
  };

  return (
    <>
      {/* Desktop Persistent Sidebar */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-40 bg-white/95 dark:bg-[#0e1411]/95 border-r border-slate-200/60 dark:border-slate-800/60 hidden lg:flex flex-col transition-all duration-300 ${
          collapsed
            ? "w-20 overflow-visible"
            : "w-64 overflow-hidden backdrop-blur-md"
        }`}
      >
        {/* Brand Header */}
        {collapsed ? (
          <div className="h-16 flex items-center justify-center border-b border-slate-200/60 dark:border-slate-800/60 relative">
            <Link
              href="/dashboard"
              className="h-10 w-10 rounded-xl bg-white border border-slate-200 dark:border-slate-700 flex items-center justify-center shadow-xs overflow-hidden p-1.5 hover:border-[#107e65]/50 transition-all cursor-pointer"
              title="Tavryn Home"
            >
              <Image
                src="/logo.png"
                alt="Tavryn Logo"
                width={28}
                height={28}
                className="object-contain"
                priority
              />
            </Link>

            {/* Edge expand pill */}
            <button
              id="sidebar-expand-button"
              type="button"
              onClick={toggleCollapse}
              className="absolute -right-3 top-1/2 -translate-y-1/2 h-6 w-6 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-md flex items-center justify-center text-slate-500 hover:text-[#107e65] dark:hover:text-[#34d399] transition-all cursor-pointer z-50 hover:scale-110"
              title="Expand sidebar (⌘B)"
              aria-label="Expand sidebar"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : (
          <div className="h-16 px-4 flex items-center justify-between border-b border-slate-200/60 dark:border-slate-800/60">
            <Link
              href="/dashboard"
              className="flex items-center gap-3 overflow-hidden group cursor-pointer"
            >
              <div className="h-9 w-9 rounded-xl bg-white border border-slate-200 dark:border-slate-700 flex items-center justify-center shrink-0 shadow-xs overflow-hidden p-1 group-hover:border-[#107e65]/40 transition-colors">
                <Image
                  src="/logo.png"
                  alt="Tavryn Logo"
                  width={32}
                  height={32}
                  className="object-contain"
                  priority
                />
              </div>
              <div className="leading-tight">
                <div className="flex items-center gap-1.5">
                  <span className="font-extrabold text-base text-slate-900 dark:text-white tracking-tight">
                    Tavryn
                  </span>
                  <span className="text-[0.625rem] font-bold px-1.5 py-0.5 rounded-md bg-emerald-500/10 text-[#107e65] dark:text-[#34d399] border border-emerald-500/20">
                    Arc
                  </span>
                </div>
                <span className="block text-[0.6875rem] font-medium text-slate-400 dark:text-slate-500 mt-0.5">
                  Autonomous Treasury
                </span>
              </div>
            </Link>

            <button
              id="sidebar-collapse-button"
              type="button"
              onClick={toggleCollapse}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800/70 dark:hover:text-slate-200 transition-colors cursor-pointer"
              title="Collapse sidebar (⌘B)"
              aria-label="Collapse sidebar"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Navigation List */}
        {renderNavLinks(false)}

        {/* Bottom User Card */}
        {renderUserProfile(false)}
      </aside>

      {/* Mobile Drawer Backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-slate-950/50 backdrop-blur-xs z-50 lg:hidden transition-opacity"
          onClick={onCloseMobile}
          aria-hidden="true"
        />
      )}

      {/* Mobile Slide-over Drawer */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 w-72 bg-white/95 dark:bg-[#0e1411]/95 backdrop-blur-md border-r border-slate-200/60 dark:border-slate-800/60 flex flex-col lg:hidden transition-transform duration-300 ease-in-out shadow-2xl ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="h-16 px-4 flex items-center justify-between border-b border-slate-200/60 dark:border-slate-800/60">
          <Link
            href="/dashboard"
            onClick={onCloseMobile}
            className="flex items-center gap-3"
          >
            <div className="h-9 w-9 rounded-xl bg-white border border-slate-200 dark:border-slate-700 flex items-center justify-center shrink-0 shadow-xs overflow-hidden p-1">
              <Image
                src="/logo.png"
                alt="Tavryn Logo"
                width={32}
                height={32}
                className="object-contain"
                priority
              />
            </div>
            <div className="leading-tight">
              <div className="flex items-center gap-1.5">
                <span className="font-extrabold text-base text-slate-900 dark:text-white tracking-tight">
                  Tavryn
                </span>
                <span className="text-[0.625rem] font-bold px-1.5 py-0.5 rounded-md bg-emerald-500/10 text-[#107e65] dark:text-[#34d399] border border-emerald-500/20">
                  Arc
                </span>
              </div>
              <span className="block text-[0.6875rem] font-medium text-slate-400 dark:text-slate-500 mt-0.5">
                Autonomous Treasury
              </span>
            </div>
          </Link>

          <button
            type="button"
            onClick={onCloseMobile}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100/80 dark:hover:bg-slate-800/60 transition-colors cursor-pointer"
            title="Close menu"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {renderNavLinks(true)}
        {renderUserProfile(true)}
      </aside>
    </>
  );
}
