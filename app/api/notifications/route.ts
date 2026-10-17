import { z } from "zod";

import { apiError, apiSuccess, handleApiError } from "@/lib/api-response";
import { requireBusinessAccess } from "@/lib/auth-guard";
import { logger } from "@/lib/logger";
import {
  getNotifications,
  markAllNotificationsAsRead,
  markNotificationAsRead,
} from "@/lib/notifications";
import { getServiceSupabase } from "@/lib/supabase";

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

    // Verify the caller is authenticated and belongs to this business
    const auth = await requireBusinessAccess(req, businessId);
    if (!auth.authorized) {
      return apiError(auth.error, auth.status);
    }

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
      // Verify caller belongs to the business before marking all read
      const auth = await requireBusinessAccess(req, parsed.data.businessId);
      if (!auth.authorized) {
        return apiError(auth.error, auth.status);
      }
      await markAllNotificationsAsRead(parsed.data.businessId);
      return apiSuccess({ allRead: true });
    }

    if ("id" in parsed.data) {
      const supabase = getServiceSupabase();

      // Look up the notification to find its business_id, then verify access
      const { data: notif, error: lookupErr } = await supabase
        .from("notifications")
        .select("id, business_id")
        .eq("id", parsed.data.id)
        .maybeSingle();

      if (lookupErr || !notif) {
        return apiError("Notification not found", 404);
      }

      const auth = await requireBusinessAccess(req, notif.business_id);
      if (!auth.authorized) {
        // Return 404 to avoid leaking that the notification exists
        return apiError("Notification not found", 404);
      }

      await markNotificationAsRead(parsed.data.id);
      return apiSuccess({ id: parsed.data.id, read: true });
    }

    return apiError("Invalid notification operation", 400);
  } catch (err) {
    logger.error("POST notifications read error", err);
    return handleApiError(err, "Failed to update notification");
  }
}
