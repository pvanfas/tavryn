import React from "react";

import { ActivityTimeline } from "@/components/ActivityTimeline";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { getOnChainUSDCBalance } from "@/lib/circle";
import { getServiceSupabase } from "@/lib/supabase";

export const revalidate = 0;

interface ActivityPageProps {
  searchParams: Promise<{ businessId?: string }>;
}

export default async function ActivityPage({
  searchParams,
}: ActivityPageProps) {
  const supabase = getServiceSupabase();
  const { businessId } = await searchParams;

  // 1. Fetch businesses
  const { data: bData } = await supabase
    .from("businesses")
    .select(
      "id, name, is_real, treasury_balance, default_currency, wallet_address",
    )
    .order("created_at", { ascending: true });

  const businesses = bData || [];
  const business =
    businesses.find((b) => b.id === businessId) || businesses[0] || null;

  // Real-time on-chain balance
  let liveTreasuryBalance = business?.treasury_balance
    ? Number(business.treasury_balance)
    : 0;
  if (business?.wallet_address) {
    try {
      liveTreasuryBalance = await getOnChainUSDCBalance(
        business.wallet_address,
      );
    } catch {
      // fallback
    }
  }

  return (
    <AppShell
      businessName={business?.name || "Demo Co"}
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
            businessName={business?.name || "Demo Co"}
          />
        </section>
      </div>
    </AppShell>
  );
}
