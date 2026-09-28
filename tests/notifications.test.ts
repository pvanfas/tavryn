import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { getServiceSupabase } from "../lib/supabase";
import {
  createNotification,
  getNotifications,
  markNotificationAsRead,
  sendWebhookNotification,
} from "../lib/notifications";

describe("Notifications Service & Webhook Integration", () => {
  let testBusinessId: string;
  let testNotificationId: string;

  before(async () => {
    const supabase = getServiceSupabase();
    const { data: business } = await supabase
      .from("businesses")
      .select("id")
      .limit(1)
      .single();

    assert.ok(business, "Business must exist for testing");
    testBusinessId = business.id;
  });

  after(async () => {
    if (testNotificationId) {
      const supabase = getServiceSupabase();
      await supabase.from("notifications").delete().eq("id", testNotificationId);
    }
  });

  it("sendWebhookNotification handles unconfigured webhooks gracefully without throwing", async () => {
    const res = await sendWebhookNotification("Test Title", "Test Message");
    assert.equal(res.sent, false);
    assert.equal(res.reason, "No webhook URL configured");
  });

  it("createNotification persists row to database and retrieves it via getNotifications", async () => {
    const notification = await createNotification({
      businessId: testBusinessId,
      category: "renewal",
      title: "Slack renewal detected",
      message: "18 of 25 seats active. I have contacted the vendor and requested a revised quote. Status: negotiation in progress.",
      link: "/negotiate/test-contract",
      linkLabel: "View Negotiation",
    });

    assert.ok(notification.id);
    testNotificationId = notification.id;
    assert.equal(notification.business_id, testBusinessId);
    assert.equal(notification.category, "renewal");
    assert.equal(notification.read, false);
    assert.ok(notification.message.includes("18 of 25 seats active"));

    const list = await getNotifications(testBusinessId, 10);
    const found = list.find((n) => n.id === notification.id);
    assert.ok(found, "Newly created notification must be returned in getNotifications");
  });

  it("markNotificationAsRead updates read status to true in database", async () => {
    assert.ok(testNotificationId);
    const updated = await markNotificationAsRead(testNotificationId);
    assert.equal(updated, true);

    const list = await getNotifications(testBusinessId, 10);
    const found = list.find((n) => n.id === testNotificationId);
    assert.ok(found);
    assert.equal(found.read, true);
  });
});
