"use client";

import React, { useState } from "react";
import { AppSidebar } from "./AppSidebar";
import { AppHeader } from "./AppHeader";
import { BusinessItem } from "./BusinessSwitcher";

interface AppShellProps {
  businessName?: string;
  isReal?: boolean;
  breadcrumbs?: Array<{ label: string; href?: string }>;
  businesses?: BusinessItem[];
  activeBusinessId?: string;
  treasuryBalance?: number;
  currency?: string;
  children: React.ReactNode;
}

export function AppShell({
  businessName = "Demo Co",
  isReal = false,
  breadcrumbs = [{ label: "Dashboard", href: "/" }, { label: "Contracts Ledger" }],
  businesses = [],
  activeBusinessId,
  treasuryBalance,
  currency = "USDC",
  children,
}: AppShellProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen flex bg-[#f7f9f8] dark:bg-[#0b100e] font-sans text-slate-800 dark:text-slate-100 antialiased selection:bg-[#107e65]/15 selection:text-[#107e65] relative">
      {/* Calm ambient background lighting */}
      <div 
        aria-hidden="true"
        className="fixed inset-0 pointer-events-none bg-[radial-gradient(ellipse_70%_50%_at_50%_-10%,rgba(16,126,101,0.06),transparent_70%)] dark:bg-[radial-gradient(ellipse_70%_50%_at_50%_-10%,rgba(16,126,101,0.12),transparent_70%)]" 
      />

      {/* Desktop & Mobile Responsive Sidebar */}
      <AppSidebar
        businessName={businessName}
        isReal={isReal}
        collapsed={collapsed}
        onToggleCollapse={() => setCollapsed(!collapsed)}
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
      />

      {/* Main Content Viewport with dynamic margin-left matching sidebar width */}
      <div
        className={`flex-1 flex flex-col min-h-screen min-w-0 relative z-10 transition-all duration-300 ${
          collapsed ? "lg:ml-20" : "lg:ml-64"
        }`}
      >
        <AppHeader
          breadcrumbs={breadcrumbs}
          businesses={businesses}
          activeBusinessId={activeBusinessId}
          treasuryBalance={treasuryBalance}
          currency={currency}
          isReal={isReal}
          businessName={businessName}
          onOpenMobileMenu={() => setMobileOpen(true)}
        />

        <main className="flex-1 p-5 sm:p-7 md:p-8 max-w-7xl w-full mx-auto space-y-7">
          {children}
        </main>
      </div>
    </div>
  );
}
