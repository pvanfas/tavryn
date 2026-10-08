import React from "react";

import { AppShell } from "@/components/AppShell";
import { getTractionMetrics } from "@/lib/metrics";
import { getServiceSupabase } from "@/lib/supabase";

import { TractionMetricsClient } from "./TractionMetricsClient";

export const revalidate = 0; // Fresh metrics on every load

interface MetricsPageProps {
  searchParams: Promise<{ businessId?: string }>;
}

export default async function MetricsPage({ searchParams }: MetricsPageProps) {
  const supabase = getServiceSupabase();
  const { businessId } = await searchParams;

  // 1. Fetch businesses for AppShell header and user context
  const { data: bList } = await supabase
    .from("businesses")
    .select(
      "id, name, is_real, treasury_balance, default_currency, wallet_address",
    )
    .not("name", "ilike", "[Deleted%")
    .order("created_at", { ascending: false });

  const businesses = bList || [];
  let business = businesses.find((b) => b.id === businessId) || null;
  if (!business && businesses.length > 0) {
    business = businesses.find((b) => b.name === "Demo Co") || businesses[0];
  }

  // 2. Fetch metrics specific to the logged organisation ONLY
  const activeBusinessId = business?.id;
  const [metricsAll, metricsReal] = await Promise.all([
    getTractionMetrics({ businessId: activeBusinessId, realOnly: false }),
    getTractionMetrics({ businessId: activeBusinessId, realOnly: true }),
  ]);

  return (
    <AppShell
      businessName={business?.name || "Demo Co"}
      isReal={Boolean(business?.is_real)}
      breadcrumbs={[
        { label: "Dashboard", href: "/dashboard" },
        { label: "Organization Metrics" },
      ]}
      businesses={businesses}
      activeBusinessId={business?.id}
      treasuryBalance={Number(business?.treasury_balance ?? 0)}
      currency={business?.default_currency || "USDC"}
    >
      <TractionMetricsClient
        business={business}
        initialMetricsAll={metricsAll}
        initialMetricsReal={metricsReal}
      />
    </AppShell>
  );
}
