import { NextRequest, NextResponse } from "next/server";

import { DEFAULT_SITE_URL } from "@/lib/constants";
import { getServiceSupabase } from "@/lib/supabase";

export async function POST(req: NextRequest) {
  const supabase = getServiceSupabase();

  // 1. Invalidate session token server-side in Supabase Auth
  const authHeader = req.headers.get("authorization");
  let jwtToken = authHeader?.startsWith("Bearer ")
    ? authHeader.substring(7).trim()
    : null;

  if (!jwtToken) {
    const cookie = req.cookies.get("sb-access-token")?.value;
    if (cookie) jwtToken = cookie;
  }

  if (jwtToken) {
    try {
      await supabase.auth.admin.signOut(jwtToken);
    } catch {}
  }

  const response = NextResponse.redirect(
    new URL(
      "/auth/login",
      process.env.NEXT_PUBLIC_SITE_URL || DEFAULT_SITE_URL,
    ),
  );

  // 2. Clear all authentication cookies
  const allCookies = req.cookies.getAll();
  for (const c of allCookies) {
    if (
      c.name.startsWith("sb-") ||
      c.name.includes("auth-token") ||
      c.name.includes("session")
    ) {
      response.cookies.set(c.name, "", { maxAge: 0, path: "/" });
    }
  }

  response.cookies.set("sb-access-token", "", { maxAge: 0, path: "/" });
  response.cookies.set("sb-refresh-token", "", { maxAge: 0, path: "/" });
  response.cookies.set("sb-tavryn-auth-token", "", { maxAge: 0, path: "/" });

  return response;
}
