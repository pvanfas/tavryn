import { z } from "zod";

import { runDailyProcurementCron } from "@/lib/agent/cron";
import { apiError, apiSuccess, handleApiError } from "@/lib/api-response";
import { logger } from "@/lib/logger";
import { checkRateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

const runNowSchema = z.object({
  businessId: z.string().uuid().optional(),
  force: z.boolean().optional(),
});

export async function POST(req: Request) {
  // Rate limiting: 10 requests per minute max on run-now
  const rate = checkRateLimit("agent_run_now", 10, 60_000);
  if (!rate.success) {
    return apiError(
      "Agent run rate limit exceeded. Please wait before triggering another scan.",
      429,
      {
        resetMs: rate.resetMs,
      },
    );
  }

  try {
    let rawBody = {};
    const text = await req.text();
    if (text && text.trim() !== "") {
      try {
        rawBody = JSON.parse(text);
      } catch {
        return apiError("Malformed JSON body in request", 400);
      }
    }

    const parsed = runNowSchema.safeParse(rawBody);
    if (!parsed.success) {
      return apiError("Invalid request body", 400, parsed.error.issues);
    }

    const { businessId, force } = parsed.data;

    const result = await runDailyProcurementCron({
      businessId,
      force: force ?? false,
    });

    return apiSuccess({
      message: `Agent executed: ${result.totalNegotiationsStarted} negotiations initiated, ${result.totalNotificationsCreated} notifications created.`,
      result,
    });
  } catch (err) {
    logger.error("Run-now agent execution error", err);
    return handleApiError(err, "Agent execution failed");
  }
}
