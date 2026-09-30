import { NextResponse } from "next/server";

import { getServiceSupabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const businessId = url.searchParams.get("businessId");
    const supabase = getServiceSupabase();

    let query = supabase
      .from("approvals")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending");

    if (businessId) {
      query = query.eq("business_id", businessId);
    }

    const { count, error } = await query;
    if (error) {
      return NextResponse.json({ count: 0 }, { status: 200 });
    }

    return NextResponse.json({ count: count || 0 });
  } catch {
    return NextResponse.json({ count: 0 }, { status: 200 });
  }
}
