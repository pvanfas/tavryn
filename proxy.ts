import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

const PUBLIC_PATHS = [
  "/auth/login",
  "/auth/register",
  "/auth/forgot-password",
  "/auth/reset-password",
  "/auth/callback",
];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public landing page, public receipts, verification page, auth pages, and all API routes
  const isPublic =
    pathname === "/" ||
    pathname.startsWith("/r/") ||
    pathname.startsWith("/verify-labeling") ||
    PUBLIC_PATHS.some((p) => pathname.startsWith(p)) ||
    pathname.startsWith("/api/") ||
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/favicon") ||
    pathname.startsWith("/logo") ||
    pathname.startsWith("/icon");

  if (isPublic) {
    return NextResponse.next();
  }

  // Check for Supabase auth cookie (any sb-*-auth-token cookie)
  const cookies = request.cookies.getAll();
  const hasAuthCookie = cookies.some(
    (c) => c.name.startsWith("sb-") && c.name.endsWith("-auth-token"),
  );

  if (!hasAuthCookie) {
    const loginUrl = new URL("/auth/login", request.url);
    // Preserve the original destination for post-login redirect
    if (pathname !== "/") {
      loginUrl.searchParams.set("next", pathname);
    }
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except static assets.
     * Auth check runs on all app routes.
     */
    "/((?!_next/static|_next/image|favicon\\.ico|logo\\.png|icon\\.png|sample-subscriptions\\.csv).*)",
  ],
};
