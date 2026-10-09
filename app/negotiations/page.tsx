import React from "react";

import { AppShell } from "@/components/AppShell";
import {
  NegotiationRow,
  NegotiationsDataTable,
} from "@/components/negotiations/NegotiationsDataTable";
import { PageHeader } from "@/components/PageHeader";
import { getActiveBusiness } from "@/lib/active-business";
import { getOnChainUSDCBalance } from "@/lib/circle";
import { getServiceSupabase } from "@/lib/supabase";

export const revalidate = 0;

interface NegotiationsPageProps {
  searchParams: Promise<{ businessId?: string; filter?: string }>;
}

export default async function NegotiationsPage({
  searchParams,
}: NegotiationsPageProps) {
  const supabase = getServiceSupabase();
  const { businessId } = await searchParams;

  // 1. Resolve Active Business (Session-aware single organization resolution)
  const business = await getActiveBusiness(businessId);
  const businesses = business ? [business] : [];

  // Real-time on-chain balance & negotiations in parallel
  let liveTreasuryBalance = business?.treasury_balance
    ? Number(business.treasury_balance)
    : 0;
  let negotiations: NegotiationRow[] = [];

  if (business) {
    const negotiationsQuery = supabase
      .from("negotiations")
      .select(
        "id, contract_id, original_price, target_price, current_offer, final_price, savings, rounds, status, created_at, contracts!inner(id, service, category, vendors(name, is_simulated))",
      )
      .eq("contracts.business_id", business.id)
      .order("created_at", { ascending: false });

    const balancePromise = business.wallet_address
      ? getOnChainUSDCBalance(business.wallet_address).catch(() => liveTreasuryBalance)
      : Promise.resolve(liveTreasuryBalance);

    const [nRes, balRes] = await Promise.all([
      negotiationsQuery,
      balancePromise,
    ]);

    if (nRes.data) {
      negotiations = nRes.data as unknown as NegotiationRow[];
    }
    liveTreasuryBalance = balRes;
  }

  return (
    <AppShell
      businessName={business?.name || "Demo Co"}
      isReal={business?.is_real ?? false}
      businesses={businesses}
      activeBusinessId={business?.id}
      treasuryBalance={liveTreasuryBalance}
      currency={business?.default_currency || "USDC"}
      breadcrumbs={[
        { label: "Overview", href: "/" },
        { label: "Negotiations" },
      ]}
    >
      <div className="space-y-6">
        {/* Minimal Reusable Page Header */}
        <PageHeader
          badge="Workspace"
          caption="Autonomous Procurement"
          title="Vendor Negotiations"
          description="Multi-round agent concession dialogues, pricing concessions, and decision checklists."
        />

        {/* Shared Negotiations DataTable */}
        <NegotiationsDataTable negotiations={negotiations} />
      </div>
    </AppShell>
  );
}
