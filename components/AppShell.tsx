"use client";

import React, { useState } from "react";

import { AppHeader } from "./AppHeader";
import { AppSidebar } from "./AppSidebar";
import { BusinessItem } from "./BusinessSwitcher";
import { FirstTimeOnboardingModal } from "./FirstTimeOnboardingModal";
import { MobileTabBar } from "./MobileTabBar";

interface AppShellProps {
  businessName?: string;
  isReal?: boolean;
  breadcrumbs?: Array<{ label: string; href?: string }>;
  businesses?: BusinessItem[];
  activeBusinessId?: string;
  treasuryBalance?: number;
  currency?: string;
  walletAddress?: string | null;
  children: React.ReactNode;
}

export function AppShell({
  businessName = "Demo Co",
  isReal = false,
  breadcrumbs = [
    { label: "Overview", href: "/" },
    { label: "Contracts Ledger" },
  ],
  businesses = [],
  activeBusinessId,
  treasuryBalance,
  currency = "USDC",
  walletAddress,
  children,
}: AppShellProps) {
  const [collapsed, setCollapsed] = useState(false);

  const activeBusiness =
    businesses.find((b) => b.id === activeBusinessId) || businesses[0];
  const effectiveWallet = walletAddress || activeBusiness?.wallet_address;

  return (
    <div className="min-h-screen flex bg-[#f7f9f8] dark:bg-[#0b100e] font-sans text-slate-800 dark:text-slate-100 antialiased selection:bg-[#107e65]/15 selection:text-[#107e65] relative">
      {/* Ambient background lighting */}
      <div
        aria-hidden="true"
        className="fixed inset-0 pointer-events-none bg-[radial-gradient(ellipse_70%_50%_at_50%_-10%,rgba(16,126,101,0.06),transparent_70%)] dark:bg-[radial-gradient(ellipse_70%_50%_at_50%_-10%,rgba(16,126,101,0.12),transparent_70%)]"
      />

      {/* Desktop Fixed Sidebar (hidden below md) */}
      <AppSidebar
        businessName={businessName}
        isReal={isReal}
        businesses={businesses}
        activeBusinessId={activeBusinessId}
        treasuryBalance={treasuryBalance}
        currency={currency}
        walletAddress={effectiveWallet}
        collapsed={collapsed}
        onToggleCollapse={() => setCollapsed(!collapsed)}
      />

      {/* Main Content Viewport with dynamic margin-left matching desktop sidebar width */}
      <div
        className={`flex-1 flex flex-col min-h-screen min-w-0 transition-all duration-300 ${
          collapsed ? "md:ml-20" : "md:ml-64"
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
        />

        <main className="flex-1 p-4 sm:p-6 md:p-8 max-w-7xl w-full mx-auto space-y-7 pb-24 md:pb-8">
          {children}
        </main>
      </div>

      {/* Mobile Bottom Tab Bar & More Sheet (visible below md) */}
      <MobileTabBar
        businesses={businesses}
        activeBusinessId={activeBusinessId}
        treasuryBalance={treasuryBalance}
        currency={currency}
        walletAddress={effectiveWallet}
      />

      {/* First-Time Onboarding Modal */}
      <FirstTimeOnboardingModal currentBusinessIsReal={isReal} />
    </div>
  );
}
