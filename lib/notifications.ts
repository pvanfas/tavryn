import {
  DEFAULT_NOTIFICATION_LIMIT,
  WEBHOOK_TIMEOUT_MS,
} from "@/lib/constants";
import { getServiceSupabase } from "@/lib/supabase";

export type NotificationCategory =
  "renewal" | "negotiation" | "policy" | "treasury" | "audit";

export interface CreateNotificationInput {
  businessId: string;
  contractId?: string | null;
  negotiationId?: string | null;
  category: NotificationCategory;
  title: string;
  message: string;
  link?: string | null;
  linkLabel?: string | null;
}

export interface NotificationRecord {
  id: string;
  business_id: string;
  contract_id: string | null;
  negotiation_id: string | null;
  category: NotificationCategory;
  title: string;
  message: string;
  read: boolean;
  link: string | null;
  link_label: string | null;
  created_at: string;
}

/**
 * Dispatch notification text to Discord, Slack, or generic webhook if configured.
 * Safely handles errors and timeouts so external webhook issues never impact the core loop.
 */
export async function sendWebhookNotification(
  title: string,
  message: string,
  link?: string | null,
  customWebhookUrl?: string | null,
): Promise<{ sent: boolean; reason?: string }> {
  const webhookUrl =
    customWebhookUrl ||
    process.env.DISCORD_WEBHOOK_URL ||
    process.env.SLACK_WEBHOOK_URL ||
    process.env.NOTIFICATION_WEBHOOK_URL;

  if (!webhookUrl) {
    return { sent: false, reason: "No webhook URL configured" };
  }

  try {
    const isDiscord = webhookUrl.includes("discord.com");
    const isSlack = webhookUrl.includes("slack.com");

    const fullMessage = link ? `${message}\nView: ${link}` : message;

    let payload: Record<string, unknown>;
    if (isDiscord) {
      payload = { content: `**${title}**\n${fullMessage}` };
    } else if (isSlack) {
      payload = { text: `*${title}*\n${fullMessage}` };
    } else {
      payload = {
        title,
        message: fullMessage,
        content: `**${title}**\n${fullMessage}`,
        text: `*${title}*\n${fullMessage}`,
      };
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), WEBHOOK_TIMEOUT_MS);

    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    }).finally(() => clearTimeout(timeout));

    if (!res.ok) {
      console.warn(
        `[Webhook] Remote returned status ${res.status}: ${res.statusText}`,
      );
      return { sent: false, reason: `Status ${res.status}` };
    }

    return { sent: true };
  } catch (err) {
    console.warn(
      "[Webhook] Failed to dispatch webhook notification:",
      (err as Error).message,
    );
    return { sent: false, reason: (err as Error).message };
  }
}

/**
 * Persist notification to database and trigger webhook if configured.
 */
export async function createNotification(
  input: CreateNotificationInput,
): Promise<NotificationRecord> {
  const supabase = getServiceSupabase();

  const insertPayload = {
    business_id: input.businessId,
    contract_id: input.contractId || null,
    negotiation_id: input.negotiationId || null,
    category: input.category,
    title: input.title,
    message: input.message,
    read: false,
    link: input.link || null,
    link_label: input.linkLabel || null,
  };

  const { data, error } = await supabase
    .from("notifications")
    .insert(insertPayload)
    .select("*")
    .single();

  if (error || !data) {
    console.error("Failed to insert notification into database:", error);
    throw new Error(
      `Failed to create notification: ${error?.message || "Unknown error"}`,
    );
  }

  // Trigger webhook asynchronously without blocking return
  (async () => {
    try {
      let customUrl: string | null = null;
      if (input.businessId) {
        const { data: b } = await supabase
          .from("businesses")
          .select("webhook_url")
          .eq("id", input.businessId)
          .maybeSingle();
        customUrl = b?.webhook_url || null;
      }
      await sendWebhookNotification(
        input.title,
        input.message,
        input.link,
        customUrl,
      );
    } catch (err) {
      console.warn("Async webhook dispatch error:", err);
    }
  })();

  return data as NotificationRecord;
}

/**
 * Fetch notifications for a business, sorted newest first.
 */
export async function getNotifications(
  businessId: string,
  limit = DEFAULT_NOTIFICATION_LIMIT,
): Promise<NotificationRecord[]> {
  const supabase = getServiceSupabase();

  const { data, error } = await supabase
    .from("notifications")
    .select("*")
    .eq("business_id", businessId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("Failed to query notifications:", error);
    return [];
  }

  return (data || []) as NotificationRecord[];
}

/**
 * Mark a single notification as read.
 */
export async function markNotificationAsRead(id: string): Promise<boolean> {
  const supabase = getServiceSupabase();

  const { error } = await supabase
    .from("notifications")
    .update({ read: true })
    .eq("id", id);

  return !error;
}

/**
 * Mark all unread notifications for a business as read.
 */
export async function markAllNotificationsAsRead(
  businessId: string,
): Promise<boolean> {
  const supabase = getServiceSupabase();

  const { error } = await supabase
    .from("notifications")
    .update({ read: true })
    .eq("business_id", businessId)
    .eq("read", false);

  return !error;
}
