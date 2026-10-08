import { NextRequest } from "next/server";

import { logger } from "@/lib/logger";
import { getServiceSupabase } from "@/lib/supabase";

export interface AuthUser {
  userId: string;
  email?: string;
  isDemo?: boolean;
}

export type AuthCheckResult =
  | { authorized: true; user: AuthUser; role?: string }
  | { authorized: false; status: number; error: string };

/**
 * Extracts and verifies the authenticated user from the incoming HTTP request.
 * Checks Bearer Authorization header, standard Supabase auth cookies, and demo cookies.
 */
export async function getAuthUser(req: Request | NextRequest): Promise<AuthUser | null> {
  const supabase = getServiceSupabase();

  // 1. Check Bearer Authorization header
  const authHeader = req.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.substring(7).trim();
    if (token) {
      try {
        const { data, error } = await supabase.auth.getUser(token);
        if (!error && data?.user?.id) {
          return {
            userId: data.user.id,
            email: data.user.email,
          };
        }
      } catch (err) {
        logger.warn("Token validation exception", err);
      }
    }
  }

  // 2. Parse cookie header for session tokens
  const cookieHeader = req.headers.get("cookie") || "";
  if (cookieHeader) {
    const cookies = Object.fromEntries(
      cookieHeader.split(";").map((c) => {
        const [k, ...v] = c.trim().split("=");
        return [k, decodeURIComponent(v.join("="))];
      }),
    );

    // Check standard Supabase access token cookies
    const accessToken = cookies["sb-access-token"];
    if (accessToken) {
      try {
        const { data, error } = await supabase.auth.getUser(accessToken);
        if (!error && data?.user?.id) {
          return {
            userId: data.user.id,
            email: data.user.email,
          };
        }
      } catch {}
    }

    // Check supabase chunked or project auth cookies (sb-*-auth-token)
    for (const [key, val] of Object.entries(cookies)) {
      if (key.startsWith("sb-") && key.endsWith("-auth-token")) {
        try {
          // If stored as JSON string [access_token, refresh_token]
          const parsed = JSON.parse(val);
          const rawToken = Array.isArray(parsed) ? parsed[0] : parsed?.access_token;
          if (rawToken && typeof rawToken === "string") {
            const { data, error } = await supabase.auth.getUser(rawToken);
            if (!error && data?.user?.id) {
              return {
                userId: data.user.id,
                email: data.user.email,
              };
            }
          }
        } catch {}

        // Check if demo cookie
        if (val === "demo-tavryn-session-token") {
          return {
            userId: "00000000-0000-0000-0000-000000000001",
            email: "demo@tavryn.network",
            isDemo: true,
          };
        }
      }
    }
  }

  return null;
}

/**
 * Server-side guard: Validates that the requesting client is authenticated
 * AND belongs to the specified business_id in `business_members`.
 */
export async function requireBusinessAccess(
  req: Request | NextRequest,
  businessId: string,
): Promise<AuthCheckResult> {
  if (!businessId) {
    return { authorized: false, status: 400, error: "Missing business ID" };
  }

  const supabase = getServiceSupabase();
  const { data: businessRecord } = await supabase
    .from("businesses")
    .select("id, is_real")
    .eq("id", businessId)
    .maybeSingle();

  if (!businessRecord) {
    return {
      authorized: false,
      status: 404,
      error: "Organization not found",
    };
  }

  // Simulated organizations (is_real = false) allow demo session / simulated testing access
  if (!businessRecord.is_real) {
    const user = await getAuthUser(req);
    return {
      authorized: true,
      user: user || {
        userId: "00000000-0000-0000-0000-000000000001",
        email: "demo@tavryn.network",
        isDemo: true,
      },
      role: "owner",
    };
  }

  const user = await getAuthUser(req);
  if (!user) {
    return {
      authorized: false,
      status: 401,
      error: "Unauthorized: Authentication required to access organization data.",
    };
  }

  // Demo user token cannot access real businesses
  if (user.isDemo) {
    return {
      authorized: false,
      status: 403,
      error: "Forbidden: Demo session is strictly restricted to Demo Co.",
    };
  }

  const { data: member, error } = await supabase
    .from("business_members")
    .select("role")
    .eq("business_id", businessId)
    .eq("user_id", user.userId)
    .maybeSingle();

  if (error || !member) {
    return {
      authorized: false,
      status: 403,
      error: "Forbidden: You do not have permission to access this organization.",
    };
  }

  return {
    authorized: true,
    user,
    role: member.role,
  };
}

/**
 * Server-side guard: Validates that the requesting client has access
 * to the business that owns the given contractId.
 * Returns 404 if the contract doesn't exist or caller does not belong to its business.
 */
export async function requireContractAccess(
  req: Request | NextRequest,
  contractId: string,
): Promise<
  | { authorized: true; user: AuthUser; businessId: string; contract: any }
  | { authorized: false; status: number; error: string }
> {
  if (!contractId) {
    return { authorized: false, status: 400, error: "Missing contract ID" };
  }

  const supabase = getServiceSupabase();
  const { data: contract, error } = await supabase
    .from("contracts")
    .select("*, vendors(*), businesses(*)")
    .eq("id", contractId)
    .maybeSingle();

  if (error || !contract) {
    return { authorized: false, status: 404, error: "Contract not found" };
  }

  const auth = await requireBusinessAccess(req, contract.business_id);
  if (!auth.authorized) {
    // Return 404 to prevent resource ID discovery/enumeration across tenants
    return {
      authorized: false,
      status: auth.status === 401 ? 401 : 404,
      error: auth.status === 401 ? auth.error : "Contract not found",
    };
  }

  return {
    authorized: true,
    user: auth.user,
    businessId: contract.business_id,
    contract,
  };
}
