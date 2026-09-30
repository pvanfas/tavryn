import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const url = new URL("/dashboard", request.url);
  const response = NextResponse.redirect(url);
  response.cookies.set("sb-tavryn-auth-token", "demo-tavryn-session-token", {
    path: "/",
    maxAge: 604800, // 7 days
    sameSite: "lax",
    httpOnly: false, // accessible to client auth helper
  });
  return response;
}

export async function POST() {
  const response = NextResponse.json({
    success: true,
    redirect: "/dashboard",
  });
  response.cookies.set("sb-tavryn-auth-token", "demo-tavryn-session-token", {
    path: "/",
    maxAge: 604800,
    sameSite: "lax",
    httpOnly: false,
  });
  return response;
}
