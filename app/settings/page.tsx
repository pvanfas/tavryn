import { Metadata } from "next";

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

  // 1. Fetch businesses (filtering out soft-deleted orgs)
  const { data: bList } = await supabase
    .from("businesses")
    .select(
      "id, name, is_real, treasury_balance, default_currency, wallet_address, webhook_url",
    )
    .not("name", "ilike", "[Deleted%")
    .order("created_at", { ascending: false });

  const businesses = bList || [];

  // 2. Resolve Active Business:
  // - If businessId is provided in URL, prioritize finding that business
  // - Otherwise, default to any real business if one exists, then Demo Co, then first available
  let business = businesses.find((b) => b.id === businessId) || null;
  if (!business && businesses.length > 0) {
    business =
      businesses.find((b) => b.is_real) ||
      businesses.find((b) => b.name === "Demo Co") ||
      businesses[0];
  }

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
              wallet_address: business.wallet_address,
              default_currency: business.default_currency || "USDC",
              is_real: Boolean(business.is_real),
              treasury_balance: Number(business.treasury_balance || 0),
              webhook_url: business.webhook_url,
            }
          : null
      }
      initialPolicy={policy}
      businesses={businesses}
      activeBusinessId={business?.id || businessId}
    />
  );
}
