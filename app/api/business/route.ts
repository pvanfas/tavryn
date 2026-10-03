import { NextResponse } from "next/server";

import { getServiceSupabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    const supabase = getServiceSupabase();
    const { data: businesses, error } = await supabase
      .from("businesses")
      .select("id, name, is_real, treasury_balance, default_currency, wallet_address")
      .not("name", "ilike", "[Deleted%")
      .order("created_at", { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ businesses: businesses || [] });
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message || "Failed to fetch businesses" },
      { status: 500 },
    );
  }
}
