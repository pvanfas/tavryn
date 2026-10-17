import { redirect } from "next/navigation";
import React from "react";

import { ActivityTimeline } from "@/components/ActivityTimeline";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { getActiveBusiness } from "@/lib/active-business";
import { getOnChainUSDCBalance } from "@/lib/circle";

export const revalidate = 0;

interface ActivityPageProps {
  searchParams: Promise<{ businessId?: string }>;
}

export default async function ActivityPage({
  searchParams,
}: ActivityPageProps) {
  const { businessId } = await searchParams;

  // 1. Resolve Active Business (Session-aware single organization resolution)
  const business = await getActiveBusiness(businessId);
  if (!business) {
    redirect("/onboard");
  }
  const businesses = [business];

  // Real-time on-chain balance
  let liveTreasuryBalance = business?.treasury_balance
    ? Number(business.treasury_balance)
    : 0;
  if (business?.wallet_address) {
    try {
      const chainBal = await getOnChainUSDCBalance(
        business.wallet_address,
      );
      if (chainBal > 0) {
        liveTreasuryBalance = chainBal;
      }
    } catch {
      // fallback
    }
  }

  return (
    <AppShell
      businessName={business?.name || (business?.is_real ? "Organization" : "Demo Co")}
      isReal={business?.is_real ?? false}
      businesses={businesses}
      activeBusinessId={business?.id}
      treasuryBalance={liveTreasuryBalance}
      currency={business?.default_currency || "USDC"}
      breadcrumbs={[{ label: "Overview", href: "/" }, { label: "Activity" }]}
    >
      <div className="space-y-6">
        <PageHeader
          badge="Workspace"
          caption="Live Agent Stream"
          title="Autonomous Agent Activity"
          description="Real-time feed of autonomous waste detection, vendor negotiations, deterministic policy checks, and on-chain Arc escrow locks."
        />

        <section aria-label="Autonomous Agent Execution Timeline">
          <ActivityTimeline
            businessId={business?.id}
            businessName={business?.name || (business?.is_real ? "Organization" : "Demo Co")}
            isReal={Boolean(business?.is_real)}
          />
        </section>
      </div>
    </AppShell>
  );
}
