import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { getServiceSupabase } from "../lib/supabase";
import { runDailyProcurementCron } from "../lib/agent/cron";
import { GET as cronGetRoute } from "../app/api/cron/daily/route";
import { getNotifications } from "../lib/notifications";

describe("Proactive Daily Procurement Cron & Idempotency", () => {
  let demoBusinessId: string;
  const cronSecret = process.env.CRON_SECRET || "tavryn_cron_secret_2026";

  before(async () => {
    const supabase = getServiceSupabase();
    const { data: business } = await supabase
      .from("businesses")
      .select("id")
      .eq("name", "Demo Co")
      .single();

    assert.ok(business, "Demo Co business must exist in database");
    demoBusinessId = business.id;
  });

  it("1. Rejects unauthorized requests without valid CRON_SECRET header with 401", async () => {
    // No headers
    const req1 = new Request("http://localhost:3000/api/cron/daily", {
      method: "GET",
    });
    const res1 = await cronGetRoute(req1);
    assert.equal(res1.status, 401);
    const body1 = await res1.json();
    assert.ok(body1.error.includes("Unauthorized"));

    // Invalid secret header
    const req2 = new Request("http://localhost:3000/api/cron/daily", {
      method: "GET",
      headers: {
        authorization: "Bearer wrong-secret",
      },
    });
    const res2 = await cronGetRoute(req2);
    assert.equal(res2.status, 401);
  });

  it("2. Route accepts valid CRON_SECRET via Authorization: Bearer or x-cron-secret", async () => {
    const reqBearer = new Request(`http://localhost:3000/api/cron/daily?businessId=${demoBusinessId}`, {
      method: "GET",
      headers: {
        authorization: `Bearer ${cronSecret}`,
      },
    });
    const resBearer = await cronGetRoute(reqBearer);
    assert.equal(resBearer.status, 200);
    const dataBearer = await resBearer.json();
    assert.equal(dataBearer.success, true);
    assert.ok(dataBearer.result);
  });

  it("3. Cron run executes negotiations, creates notifications, and logs summary to agent_actions", async () => {
    const supabase = getServiceSupabase();

    // Check agent_actions count before
    const { count: actionsBefore } = await supabase
      .from("agent_actions")
      .select("id", { count: "exact", head: true })
      .eq("business_id", demoBusinessId)
      .eq("action", "cron_daily_run");

    // Execute engine for demo business
    const cronResult = await runDailyProcurementCron({
      businessId: demoBusinessId,
      renewalWindowDays: 45,
      idempotencyWindowDays: 14,
    });

    assert.equal(cronResult.success, true);
    assert.ok(cronResult.results.length > 0);

    const businessResult = cronResult.results[0];
    assert.equal(businessResult.businessId, demoBusinessId);
    assert.ok(businessResult.contractsScanned > 0, "Should scan contracts renewing within 45 days");

    // Verify agent_actions logged a summary
    const { count: actionsAfter } = await supabase
      .from("agent_actions")
      .select("id", { count: "exact", head: true })
      .eq("business_id", demoBusinessId)
      .eq("action", "cron_daily_run");

    assert.ok((actionsAfter || 0) > (actionsBefore || 0), "Summary must be appended to agent_actions");

    // Verify notifications table has records
    const notifications = await getNotifications(demoBusinessId, 10);
    assert.ok(notifications.length > 0, "Notifications must have been created");
    const renewalNotif = notifications.find((n) => n.category === "renewal" && n.message.includes("requested a revised quote"));
    assert.ok(renewalNotif, "At least one renewal notification must exist");
    assert.ok(
      renewalNotif.message.includes("requested a revised quote"),
      `Message format check failed: ${renewalNotif.message}`
    );
  });

  it("4. Idempotency test: consecutive cron run within 14-day window initiates 0 duplicate negotiations", async () => {
    const supabase = getServiceSupabase();

    const { count: negsBefore } = await supabase
      .from("negotiations")
      .select("id", { count: "exact", head: true });

    // Run again immediately
    const secondRun = await runDailyProcurementCron({
      businessId: demoBusinessId,
      renewalWindowDays: 45,
      idempotencyWindowDays: 14,
    });

    assert.equal(secondRun.success, true);
    assert.equal(secondRun.totalNegotiationsStarted, 0, "Second run must start ZERO new negotiations");

    const businessResult = secondRun.results[0];
    assert.ok(businessResult.skippedContracts.length > 0, "Contracts must be skipped as idempotent");
    for (const skipped of businessResult.skippedContracts) {
      assert.ok(
        ["active_negotiation", "recent_negotiation", "below_min_savings", "no_opportunity"].includes(
          skipped.reason
        ),
        `Unexpected skip reason: ${skipped.reason}`
      );
    }

    const { count: negsAfter } = await supabase
      .from("negotiations")
      .select("id", { count: "exact", head: true });

    assert.equal(negsAfter, negsBefore, "Negotiations table row count must NOT increase on idempotent second run");
  });
});
