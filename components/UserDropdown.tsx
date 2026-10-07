"use client";

import {
  Building2,
  ChevronDown,
  FileSpreadsheet,
  Loader2,
  Lock,
  LogOut,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import React, { useEffect, useRef, useState } from "react";

import {
  clearAuthCookie,
  getBrowserSupabase,
  getCurrentUser,
} from "@/lib/auth";

import type { BusinessItem } from "./BusinessSwitcher";

export function formatBusinessName(name?: string | null): string {
  if (!name) return "Demo Co";
  // Strip trailing numeric timestamps, IDs, or numbers (e.g. "Test Real Business 1790488549038" -> "Test Real Business")
  const cleaned = name
    .replace(/\s+\d+$/g, "")
    .replace(/\s*\(\d+\)/g, "")
    .trim();
  return cleaned || name;
}

interface UserDropdownProps {
  businessName?: string;
  isReal?: boolean;
  businesses?: BusinessItem[];
  activeBusinessId?: string;
}

export function UserDropdown({
  businessName = "Demo Co",
  isReal = false,
  businesses = [],
  activeBusinessId,
}: UserDropdownProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [userInitials, setUserInitials] = useState("??");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [fullName, setFullName] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    getCurrentUser().then((user: any) => {
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

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    if (open) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      clearAuthCookie();
      const supabase = getBrowserSupabase();
      await supabase.auth.signOut();
      router.push("/auth/login");
      router.refresh();
    } catch {
      clearAuthCookie();
      setSigningOut(false);
    }
  };

  const displayName = fullName || userEmail?.split("@")[0] || "User";

  return (
    <div ref={dropdownRef} className="relative flex items-center">
      {/* SSR Accessible Organization Information */}
      <div className="sr-only" aria-hidden="true">
        <span>{businessName}</span>
        {isReal && <span>Verified Real Business</span>}
      </div>

      {/* Trigger */}
      <button
        id="user-dropdown-trigger"
        type="button"
        onClick={() => setOpen(!open)}
        aria-haspopup="true"
        aria-expanded={open}
        className="flex items-center gap-2 pl-2 border-l border-slate-200/70 dark:border-slate-800/70 group cursor-pointer shrink-0"
      >
        {/* Avatar */}
        <div className="h-8 w-8 rounded-full bg-[#142620] text-emerald-300 font-bold text-xs flex items-center justify-center ring-2 ring-[#107e65]/25 border border-emerald-900/40 shadow-2xs select-none overflow-hidden">
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
        <div className="hidden md:flex items-center gap-1">
          <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
            {displayName}
          </span>
          <ChevronDown
            className={`h-3.5 w-3.5 text-slate-400 transition-transform duration-150 ${open ? "rotate-180" : ""}`}
          />
        </div>
      </button>

      {/* Dropdown panel */}
      {open && (
        <div
          role="menu"
          aria-label="User menu"
          className="absolute right-0 top-full mt-2.5 w-72 rounded-xl bg-white/98 dark:bg-[#111714]/98 border border-slate-200/80 dark:border-slate-800/70 shadow-[0_12px_40px_rgba(0,0,0,0.12)] dark:shadow-[0_12px_40px_rgba(0,0,0,0.5)] backdrop-blur-md z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150"
        >
          {/* User info header */}
          <div className="px-4 py-3.5 border-b border-slate-100 dark:border-slate-800/70">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-full bg-[#142620] text-emerald-300 font-bold text-xs flex items-center justify-center ring-2 ring-[#107e65]/20 border border-emerald-900/40 shrink-0 select-none overflow-hidden">
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
                <p className="text-sm font-bold text-slate-900 dark:text-white truncate">
                  {displayName}
                </p>
                {userEmail && (
                  <p className="text-xs font-medium text-slate-400 dark:text-slate-500 truncate mt-0.5">
                    {userEmail}
                  </p>
                )}
              </div>
            </div>

            {/* Org badge - Clean name only with no numbers */}
            <div
              className="mt-3 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60"
              title={businessName}
              data-business-name={businessName}
            >
              <Building2 className="h-3.5 w-3.5 text-slate-400 shrink-0" />
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-200 truncate">
                {formatBusinessName(businessName)}
              </span>
              {isReal ? (
                <span
                  title="Verified Real Business"
                  className="ml-auto text-[0.65rem] font-bold px-1.5 py-0.5 rounded-md bg-emerald-500/10 text-[#107e65] dark:text-emerald-400 border border-emerald-500/15 shrink-0"
                >
                  Real
                </span>
              ) : (
                <span
                  title="Demo / Simulated"
                  className="ml-auto text-[0.65rem] font-bold px-1.5 py-0.5 rounded-md bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/15 shrink-0"
                >
                  Demo
                </span>
              )}
            </div>
          </div>

          {/* Menu items */}
          <div className="p-1.5 space-y-0.5">
            <Link
              href="/import-bills"
              role="menuitem"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100/80 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-white transition-colors group"
            >
              <FileSpreadsheet className="h-4 w-4 text-[#107e65] dark:text-[#34d399] group-hover:scale-105 transition-transform" />
              <span>Import Bills</span>
            </Link>

            <Link
              href="/auth/change-password"
              role="menuitem"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100/80 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-white transition-colors group"
            >
              <Lock className="h-4 w-4 text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-300 transition-colors" />
              Change Password
            </Link>
          </div>

          {/* Sign out */}
          <div className="p-1.5 border-t border-slate-100 dark:border-slate-800/60">
            <button
              id="sign-out-button"
              type="button"
              role="menuitem"
              onClick={handleSignOut}
              disabled={signingOut}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {signingOut ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <LogOut className="h-4 w-4" />
              )}
              {signingOut ? "Signing out…" : "Sign out"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
