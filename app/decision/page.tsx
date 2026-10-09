import { redirect } from "next/navigation";

import { getActiveBusiness } from "@/lib/active-business";
import { getServiceSupabase } from "@/lib/supabase";

export const revalidate = 0;

interface DecisionIndexPageProps {
  searchParams: Promise<{ businessId?: string }>;
}

export default async function DecisionIndexPage({
  searchParams,
}: DecisionIndexPageProps) {
  const supabase = getServiceSupabase();
  const { businessId } = await searchParams;

  // 1. Resolve active business
  const business = await getActiveBusiness(businessId);

  if (business) {
    // 2. Fetch the latest contract to inspect its decision
    const { data: contracts } = await supabase
      .from("contracts")
      .select("id")
      .eq("business_id", business.id)
      .order("renewal_date", { ascending: true })
      .limit(1);

    if (contracts && contracts.length > 0) {
      redirect(`/decision/${contracts[0].id}`);
    }
  }

  // Fallback to contracts ledger if no contract is available
  redirect("/contracts");
}
