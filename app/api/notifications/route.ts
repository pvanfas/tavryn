import { z } from "zod";

import { apiError, apiSuccess, handleApiError } from "@/lib/api-response";
import { logger } from "@/lib/logger";
import {
  getNotifications,
  markAllNotificationsAsRead,
  markNotificationAsRead,
} from "@/lib/notifications";

export const dynamic = "force-dynamic";

const getNotificationsSchema = z.object({
  businessId: z.string().uuid({ message: "Invalid business UUID parameter" }),
  limit: z.coerce.number().int().min(1).max(100).default(40),
});

const postNotificationSchema = z.union([
  z.object({
    all: z.literal(true),
    businessId: z.string().uuid(),
  }),
  z.object({
    id: z.string().uuid(),
  }),
]);

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const parsed = getNotificationsSchema.safeParse({
      businessId: searchParams.get("businessId") || undefined,
      limit: searchParams.get("limit") || undefined,
    });

    if (!parsed.success) {
      return apiError("Invalid query parameters", 400, parsed.error.issues);
    }

    const { businessId, limit } = parsed.data;
    const notifications = await getNotifications(businessId, limit);
    const unreadCount = notifications.filter((n) => !n.read).length;

    return apiSuccess({
      notifications,
      unreadCount,
    });
  } catch (err) {
    logger.error("GET notifications error", err);
    return handleApiError(err, "Failed to fetch notifications");
  }
}

export async function POST(req: Request) {
  try {
    let rawBody = {};
    try {
      rawBody = await req.json();
    } catch {
      return apiError("Malformed JSON body in request", 400);
    }

    const parsed = postNotificationSchema.safeParse(rawBody);
    if (!parsed.success) {
      return apiError(
        "Invalid request body. Must provide either notification 'id' (UUID) or 'all: true' with 'businessId' (UUID)",
        400,
        parsed.error.issues,
      );
    }

    if ("all" in parsed.data && parsed.data.all) {
      await markAllNotificationsAsRead(parsed.data.businessId);
      return apiSuccess({ allRead: true });
    }

    if ("id" in parsed.data) {
      await markNotificationAsRead(parsed.data.id);
      return apiSuccess({ id: parsed.data.id, read: true });
    }

    return apiError("Invalid notification operation", 400);
  } catch (err) {
    logger.error("POST notifications read error", err);
    return handleApiError(err, "Failed to update notification");
  }
}
