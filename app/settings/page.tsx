import { Metadata } from "next";
import { cookies } from "next/headers";

import { getActiveBusiness } from "@/lib/active-business";
import { getServiceSupabase } from "@/lib/supabase";

import { SettingsClient } from "./SettingsClient";

export const metadata: Metadata = {
  title: "Settings | Tavryn",
  description:
    "Deterministic spending policies, Arc treasury wallets, and notification alerts",
};

export const revalidate = 0;

interface SettingsPageProps {
  searchParams: Promise<{ businessId?: string }>;
}

export default async function SettingsPage({
  searchParams,
}: SettingsPageProps) {
  const supabase = getServiceSupabase();
  const { businessId } = await searchParams;

  // 1 & 2. Resolve Active Business (Session-aware single organization resolution)
  const business = await getActiveBusiness(businessId);
  const businesses = business ? [business] : [];

  // 3. Fetch Deterministic Policy for the active business
  let policy = {
    max_auto_transaction: 2000,
    min_savings: 200,
    human_approval_required_above: 2000,
    allowed_categories: ["software", "cloud", "contractors"],
    category_budgets: { software: 25000, cloud: 50000, contractors: 25000 },
  };

  if (business?.id) {
    const { data: pData } = await supabase
      .from("policies")
      .select(
        "max_auto_transaction, min_savings, human_approval_required_above, allowed_categories, category_budgets",
      )
      .eq("business_id", business.id)
      .maybeSingle();

    if (pData) {
      policy = {
        max_auto_transaction: pData.max_auto_transaction ?? 2000,
        min_savings: pData.min_savings ?? 200,
        human_approval_required_above:
          pData.human_approval_required_above ?? 2000,
        allowed_categories: pData.allowed_categories || [
          "software",
          "cloud",
          "contractors",
        ],
        category_budgets: pData.category_budgets || {
          software: 25000,
          cloud: 50000,
          contractors: 25000,
        },
      };
    }
  }

  return (
    <SettingsClient
      initialBusiness={
        business
          ? {
              id: business.id,
              name: business.name,
              wallet_address: business.wallet_address || null,
              default_currency: business.default_currency || "USDC",
              is_real: Boolean(business.is_real),
              treasury_balance: Number(business.treasury_balance || 0),
              webhook_url: business.webhook_url || null,
            }
          : null
      }
      initialPolicy={policy}
      businesses={businesses}
      activeBusinessId={business?.id || businessId}
    />
  );
}
