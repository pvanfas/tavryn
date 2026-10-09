import React from "react";

import { AppShell } from "@/components/AppShell";
import { getActiveBusiness } from "@/lib/active-business";
import { getTractionMetrics } from "@/lib/metrics";
import { getServiceSupabase } from "@/lib/supabase";

import { TractionMetricsClient } from "./TractionMetricsClient";

export const revalidate = 0; // Fresh metrics on every load

interface MetricsPageProps {
  searchParams: Promise<{ businessId?: string }>;
}

export default async function MetricsPage({ searchParams }: MetricsPageProps) {
  const { businessId } = await searchParams;

  // 1. Resolve Active Business (Session-aware single organization resolution)
  const business = await getActiveBusiness(businessId);
  const businesses = business ? [business] : [];

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
