"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";

import {
  clearAuthCookie,
  getBrowserSupabase,
  setAuthCookie,
} from "@/lib/auth";

/**
 * Global authentication sync and hash listener.
 * Automatically catches Supabase auth hash fragments (e.g. #access_token=... from
 * signup confirmation or magic links) across all routes, forwards to /auth/callback,
 * and maintains continuous synchronization between Supabase client session state
 * and Next.js middleware cookies (sb-tavryn-auth-token).
 */
export function AuthHashListener() {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (typeof window === "undefined") return;

    // 1. Detect Supabase hash fragment tokens on any page
    const hash = window.location.hash;
    if (hash) {
      const hashStr = hash.startsWith("#") ? hash.slice(1) : hash;
      const params = new URLSearchParams(hashStr);

      const hasAccessToken = params.has("access_token");
      const hasError = params.has("error") || params.has("error_description");
      const isAuthType =
        params.has("type") &&
        ["signup", "recovery", "magiclink", "invite", "email_change"].includes(
          params.get("type") || "",
        );

      if (hasAccessToken || hasError || isAuthType) {
        // Eagerly sync cookie if access token is directly readable
        const token = params.get("access_token");
        if (token) {
          setAuthCookie(token);
        }

        // If not already on /auth/callback, redirect to /auth/callback with the hash
        if (pathname !== "/auth/callback") {
          const search = window.location.search || "";
          router.replace(`/auth/callback${search}${hash}`);
        }
      }
    }

    // 2. Synchronize Supabase auth state changes with middleware cookies
    try {
      const supabase = getBrowserSupabase();
      const {
        data: { subscription },
      } = supabase.auth.onAuthStateChange((event, session) => {
        if (session?.access_token) {
          setAuthCookie(session.access_token);
        } else if (event === "SIGNED_OUT") {
          clearAuthCookie();
        }
      });

      return () => {
        subscription.unsubscribe();
      };
    } catch {
      // In case Supabase client is uninitialized during static pre-rendering
    }
  }, [pathname, router]);

  return null;
}
