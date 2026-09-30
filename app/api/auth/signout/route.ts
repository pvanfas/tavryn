import { NextResponse } from "next/server";

import { DEFAULT_SITE_URL } from "@/lib/constants";

export async function POST() {
  const response = NextResponse.redirect(
    new URL(
      "/auth/login",
      process.env.NEXT_PUBLIC_SITE_URL || DEFAULT_SITE_URL,
    ),
  );
  // Clear all Supabase auth cookies
  const cookieNames = ["sb-access-token", "sb-refresh-token"];
  for (const name of cookieNames) {
    response.cookies.set(name, "", { maxAge: 0, path: "/" });
  }
  return response;
}
