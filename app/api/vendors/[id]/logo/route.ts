import { NextRequest, NextResponse } from "next/server";

import { getServiceSupabase } from "@/lib/supabase";

const MAX_LOGO_BYTES = 3 * 1024 * 1024; // 3MB limit
const ALLOWED_MIME_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
  "image/svg+xml",
  "image/gif",
]);

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(req: NextRequest, { params }: RouteContext) {
  try {
    const { id: vendorId } = await params;
    if (!vendorId) {
      return NextResponse.json(
        { error: "Vendor ID is required" },
        { status: 400 },
      );
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    if (!ALLOWED_MIME_TYPES.has(file.type)) {
      return NextResponse.json(
        { error: "Invalid file type. Allowed: PNG, JPEG, SVG, WebP, GIF." },
        { status: 400 },
      );
    }

    if (file.size > MAX_LOGO_BYTES) {
      return NextResponse.json(
        { error: "File size exceeds 3MB limit." },
        { status: 400 },
      );
    }

    // Convert to base64 Data URI for robust in-database persistence
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const dataUri = `data:${file.type};base64,${buffer.toString("base64")}`;

    const supabase = getServiceSupabase();
    const { data: updatedVendor, error } = await supabase
      .from("vendors")
      .update({ logo_url: dataUri })
      .eq("id", vendorId)
      .select("id, name, logo_url")
      .single();

    if (error || !updatedVendor) {
      return NextResponse.json(
        {
          error: `Database update failed: ${error?.message || "Vendor not found"}`,
        },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      logo_url: updatedVendor.logo_url,
      vendor: updatedVendor,
    });
  } catch (err) {
    console.error("Vendor logo upload error:", err);
    return NextResponse.json(
      {
        error:
          "Internal server error during logo upload: " + (err as Error).message,
      },
      { status: 500 },
    );
  }
}
