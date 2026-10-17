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
  logo_url?: string | null;
  address?: string | null;
  country?: string | null;
}

/**
 * Robust extractor for Supabase auth tokens across direct tokens,
 * chunked cookies (sb-*-auth-token.0, .1), and base64-encoded SSR session strings.
 */
export function extractAuthTokenFromCookies(
  cookiesList: Array<{ name: string; value: string }>,
): string | null {
  // 1. Direct sb-access-token cookie
  const direct = cookiesList.find((c) => c.name === "sb-access-token")?.value;
  if (direct && direct !== "demo-tavryn-session-token" && direct !== "active") {
    return direct;
  }

  // 2. Next.js synchronized auth cookie
  const tavrynCookie = cookiesList.find(
    (c) => c.name === "sb-tavryn-auth-token",
  )?.value;
  if (
    tavrynCookie &&
    tavrynCookie !== "demo-tavryn-session-token" &&
    tavrynCookie !== "active"
  ) {
    if (tavrynCookie.startsWith("ey")) {
      return tavrynCookie;
    }
    try {
      const parsed = JSON.parse(decodeURIComponent(tavrynCookie));
      const extracted = Array.isArray(parsed) ? parsed[0] : parsed?.access_token;
      if (
        extracted &&
        typeof extracted === "string" &&
        extracted.startsWith("ey")
      ) {
        return extracted;
      }
    } catch {}
    return tavrynCookie;
  }

  // 3. Supabase SSR auth cookies (chunked: .0, .1, or single)
  const authChunks = cookiesList
    .filter((c) => c.name.startsWith("sb-") && c.name.includes("-auth-token"))
    .sort((a, b) => {
      const aParts = a.name.split(".");
      const bParts = b.name.split(".");
      const aIdx =
        aParts.length > 1 ? parseInt(aParts[aParts.length - 1], 10) || 0 : 0;
      const bIdx =
        bParts.length > 1 ? parseInt(bParts[bParts.length - 1], 10) || 0 : 0;
      return aIdx - bIdx;
    });

  if (authChunks.length > 0) {
    let raw = authChunks.map((c) => c.value).join("");
    if (raw.startsWith("base64-")) {
      try {
        raw = Buffer.from(raw.slice(7), "base64").toString("utf-8");
      } catch {}
    }
    try {
      const parsed = JSON.parse(raw);
      const extracted =
        Array.isArray(parsed) ? parsed[0] : parsed?.access_token;
      if (extracted && typeof extracted === "string") {
        return extracted;
      }
    } catch {}
    if (raw.startsWith("ey")) {
      return raw;
    }
  }

  return null;
}

/**
 * Server-side helper to resolve the single active business for the logged-in user.
 * Each authenticated user has exactly one business organization.
 * Demo sessions resolve strictly to "Demo Co".
 * If an authenticated user has no business, returns null (triggering onboarding).
 */
export async function getActiveBusiness(
  preferredId?: string | null,
): Promise<ActiveBusiness | null> {
  const supabase = getServiceSupabase();

  // 1. Fetch all non-deleted businesses with extended organization metadata
  const { data: bList } = await supabase
    .from("businesses")
    .select(
      "id, name, is_real, treasury_balance, default_currency, wallet_address, webhook_url, industry, logo_url, address, country",
    )
    .not("name", "ilike", "[Deleted%")
    .order("created_at", { ascending: true });

  const businesses = (bList as ActiveBusiness[]) || [];
  if (businesses.length === 0) return null;

  // 2. Check for authenticated Supabase user session FIRST
  const cookieStore = await cookies();
  const allCookies = cookieStore.getAll();
  const token = extractAuthTokenFromCookies(allCookies);

  if (token && token !== "active" && token !== "demo-tavryn-session-token") {
    try {
      const { data: userData } = await supabase.auth.getUser(token);
      if (userData?.user?.id) {
        // Look up user's membership in business_members (ordered by most recent first)
        const { data: memberRows } = await supabase
          .from("business_members")
          .select("business_id, created_at")
          .eq("user_id", userData.user.id)
          .order("created_at", { ascending: false });

        if (memberRows && memberRows.length > 0) {
          // If preferredId was passed and is one of user's memberships, prioritize it
          const preferredMember = preferredId
            ? memberRows.find((m) => m.business_id === preferredId)
            : null;

          const targetId = preferredMember
            ? preferredMember.business_id
            : memberRows[0].business_id;

          const matched = businesses.find((b) => b.id === targetId);
          if (matched && matched.name !== "Demo Co") return matched;
          if (matched) return matched;

          // If the primary match wasn't found (e.g. deleted), check other memberships
          for (const m of memberRows) {
            const candidate = businesses.find((b) => b.id === m.business_id);
            if (candidate && candidate.name !== "Demo Co") return candidate;
            if (candidate) return candidate;
          }
        }

        // New signup user has an authenticated account but no organization yet — strictly return null (redirect to onboard)
        return null;
      }
    } catch {}

    // A real token was present — never fall back to Demo Co
    return null;
  }

  // 3. Inspect demo session cookie (only if user signed out and logged in as demo)
  const demoCookie = allCookies.find(
    (c) => c.name === "sb-tavryn-auth-token",
  )?.value;
  if (demoCookie === "demo-tavryn-session-token") {
    // Explicit demo session is active: strictly resolve to Demo Co
    return (
      businesses.find((b) => b.name === "Demo Co") ||
      businesses.find((b) => !b.is_real) ||
      businesses[0]
    );
  }

  // 4. If an explicit businessId was passed and matches an accessible demo business
  if (preferredId) {
    const matched = businesses.find((b) => b.id === preferredId);
    if (matched && matched.name === "Demo Co") return matched;
  }

  // 5. Unauthenticated non-demo requests strictly return null so caller redirects appropriately
  return null;
}

/**
 * Returns all accessible businesses for the current context.
 * In single-business model, returns [activeBusiness].
 */
export async function getAccessibleBusinesses(): Promise<ActiveBusiness[]> {
  const active = await getActiveBusiness();
  return active ? [active] : [];
}
