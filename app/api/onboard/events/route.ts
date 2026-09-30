import { apiSuccess, handleApiError } from "@/lib/api-response";
import { logger } from "@/lib/logger";
import { getServiceSupabase } from "@/lib/supabase";

export async function GET() {
  try {
    const supabase = getServiceSupabase();

    // Query all onboarding events ordered by creation timestamp
    const { data: events, error } = await supabase
      .from("onboarding_events")
      .select(
        "id, business_id, user_id, event_type, step, metadata, created_at",
      )
      .order("created_at", { ascending: false });

    if (error) {
      logger.error("Failed to query onboarding events", error);
      throw error;
    }

    const totalBusinessesOnboarded = events ? events.length : 0;

    // Aggregate by date (YYYY-MM-DD)
    const timelineMap: Record<string, number> = {};
    for (const ev of events || []) {
      const dateKey = ev.created_at
        ? new Date(ev.created_at).toISOString().slice(0, 10)
        : "unknown";
      timelineMap[dateKey] = (timelineMap[dateKey] || 0) + 1;
    }

    const timeline = Object.entries(timelineMap).map(([date, count]) => ({
      date,
      count,
    }));

    return apiSuccess({
      totalBusinessesOnboarded,
      timeline,
      events: (events || []).slice(0, 25),
    });
  } catch (err) {
    return handleApiError(err, "Failed to retrieve onboarding events");
  }
}
