import { z } from "zod";
import { runDailyProcurementCron } from "@/lib/agent/cron";
import { checkRateLimit } from "@/lib/rate-limit";
import { apiError, apiSuccess, handleApiError } from "@/lib/api-response";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

const cronQuerySchema = z.object({
  renewalDays: z.coerce.number().int().min(1).max(365).optional(),
  idempotencyDays: z.coerce.number().int().min(1).max(90).optional(),
  businessId: z.string().uuid().optional(),
  force: z.enum(["true", "false"]).transform((v) => v === "true").optional(),
});

function isAuthorizedCronRequest(req: Request): boolean {
  const expectedSecret = process.env.CRON_SECRET;

  if (!expectedSecret) {
    logger.error("CRON_SECRET environment variable is not set — all cron requests will be rejected");
    return false;
  }

  const authHeader = req.headers.get("authorization");
  const xCronSecret = req.headers.get("x-cron-secret");

  if (authHeader && authHeader.trim() === `Bearer ${expectedSecret}`) {
    return true;
  }

  if (xCronSecret && xCronSecret.trim() === expectedSecret) {
    return true;
  }

  return false;
}

export async function GET(req: Request) {
  // Rate limiting: 10 requests per minute max on cron endpoint
  const rate = checkRateLimit("cron_daily", 10, 60_000);
  if (!rate.success) {
    return apiError("Too many cron requests; rate limit exceeded", 429, {
      resetMs: rate.resetMs,
    });
  }

  if (!isAuthorizedCronRequest(req)) {
    logger.warn("Unauthorized cron attempt rejected");
    return apiError("Unauthorized: Invalid or missing CRON_SECRET header", 401);
  }

  try {
    const { searchParams } = new URL(req.url);
    const parsedQuery = cronQuerySchema.safeParse({
      renewalDays: searchParams.get("renewalDays") || undefined,
      idempotencyDays: searchParams.get("idempotencyDays") || undefined,
      businessId: searchParams.get("businessId") || undefined,
      force: searchParams.get("force") || undefined,
    });

    if (!parsedQuery.success) {
      return apiError("Invalid query parameters", 400, parsedQuery.error.issues);
    }

    const { renewalDays, idempotencyDays, businessId, force } = parsedQuery.data;

    const result = await runDailyProcurementCron({
      renewalWindowDays: renewalDays,
      idempotencyWindowDays: idempotencyDays,
      businessId,
      force,
    });

    return apiSuccess({
      message: `Proactive procurement scan completed: ${result.totalNegotiationsStarted} negotiations initiated, ${result.totalNotificationsCreated} notifications created.`,
      result,
    });
  } catch (err) {
    logger.error("Cron /api/cron/daily execution error", err);
    return handleApiError(err, "Proactive daily cron execution failed");
  }
}

export async function POST(req: Request) {
  return GET(req);
}
