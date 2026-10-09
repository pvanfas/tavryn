import { cookies } from "next/headers";

import { getServiceSupabase } from "@/lib/supabase";

export interface ActiveBusiness {
  id: string;
  name: string;
  is_real: boolean | null;
  treasury_balance: number | null;
  default_currency: string | null;
  wallet_address: string | null;
  webhook_url: string | null;
  industry?: string | null;
}

/**
 * Server-side helper to resolve the single active business for the logged-in user.
 * Each authenticated user has exactly one business organization.
 * Demo sessions resolve strictly to "Demo Co".
 * If an optional explicit businessId is passed (e.g. from an older link), it is verified,
 * but users never need ?businessId= in URLs anymore.
 */
export async function getActiveBusiness(
  preferredId?: string | null,
): Promise<ActiveBusiness | null> {
  const supabase = getServiceSupabase();

  // 1. Fetch all non-deleted businesses
  const { data: bList } = await supabase
    .from("businesses")
    .select(
      "id, name, is_real, treasury_balance, default_currency, wallet_address, webhook_url",
    )
    .not("name", "ilike", "[Deleted%")
    .order("created_at", { ascending: true });

  const businesses = (bList as ActiveBusiness[]) || [];
  if (businesses.length === 0) return null;

  // 2. Inspect active authentication session from cookies
  const cookieStore = await cookies();
  const demoCookie = cookieStore.get("sb-tavryn-auth-token")?.value;

  if (demoCookie === "demo-tavryn-session-token") {
    // Demo session is active: strictly resolve to Demo Co
    return (
      businesses.find((b) => b.name === "Demo Co") ||
      businesses.find((b) => !b.is_real) ||
      businesses[0]
    );
  }

  // 3. Check for authenticated Supabase user session
  let token = cookieStore.get("sb-access-token")?.value;
  if (!token) {
    for (const c of cookieStore.getAll()) {
      if (c.name.startsWith("sb-") && c.name.endsWith("-auth-token")) {
        try {
          const parsed = JSON.parse(c.value);
          token = Array.isArray(parsed) ? parsed[0] : parsed?.access_token;
          if (token) break;
        } catch {}
      }
    }
  }

  if (token && token !== "active" && token !== "demo-tavryn-session-token") {
    try {
      const { data: userData } = await supabase.auth.getUser(token);
      if (userData?.user?.id) {
        // Look up user's membership in business_members
        const { data: member } = await supabase
          .from("business_members")
          .select("business_id")
          .eq("user_id", userData.user.id)
          .maybeSingle();

        if (member?.business_id) {
          const matched = businesses.find((b) => b.id === member.business_id);
          if (matched) return matched;
        }
      }
    } catch {}
  }

  // 4. If an explicit businessId was passed and matches an accessible business
  if (preferredId) {
    const matched = businesses.find((b) => b.id === preferredId);
    if (matched) return matched;
  }

  // 5. Fallback: Demo Co, or first available business
  return (
    businesses.find((b) => b.name === "Demo Co") ||
    businesses.find((b) => !b.is_real) ||
    businesses[0]
  );
}

/**
 * Returns all accessible businesses for the current context.
 * In single-business model, returns [activeBusiness].
 */
export async function getAccessibleBusinesses(): Promise<ActiveBusiness[]> {
  const active = await getActiveBusiness();
  return active ? [active] : [];
}
