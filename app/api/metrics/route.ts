import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { apiError, apiSuccess, handleApiError } from "@/lib/api-response";
import { generateMetricsCsv, getTractionMetrics } from "@/lib/metrics";

export const dynamic = "force-dynamic";

const QuerySchema = z.object({
  realOnly: z
    .enum(["true", "false", "1", "0"])
    .optional()
    .transform((val) => val === "true" || val === "1"),
  format: z.enum(["json", "csv"]).optional().default("json"),
});

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const parseResult = QuerySchema.safeParse({
      realOnly: url.searchParams.get("realOnly") ?? undefined,
      format: url.searchParams.get("format") ?? undefined,
    });

    if (!parseResult.success) {
      return apiError(
        "Invalid query parameters",
        400,
        parseResult.error.issues,
      );
    }

    const { realOnly, format } = parseResult.data;
    const metrics = await getTractionMetrics({ realOnly });

    if (format === "csv") {
      const csv = generateMetricsCsv(metrics);
      const filename = `tavryn-traction-metrics-${realOnly ? "real" : "all"}-${new Date().toISOString().slice(0, 10)}.csv`;
      return new NextResponse(csv, {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="${filename}"`,
          "Cache-Control": "no-store, max-age=0",
        },
      });
    }

    return apiSuccess({
      metrics,
    });
  } catch (error) {
    return handleApiError(error, "Failed to compute traction metrics");
  }
}
