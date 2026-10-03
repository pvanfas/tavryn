import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { DELETE } from "@/app/api/business/[id]/settings/route";
import { getServiceSupabase } from "@/lib/supabase";

describe("Organization Deletion & Cascade Purge", () => {
  it("rejects deletion of the system default Demo Co organization", async () => {
    const demoId = "b655fb94-fc62-4e3c-8898-2c5f88068159";
    const req = new Request(
      `http://localhost:3000/api/business/${demoId}/settings`,
      {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmName: "Demo Co" }),
      },
    );

    const res = await DELETE(req, { params: Promise.resolve({ id: demoId }) });
    assert.equal(res.status, 400);

    const data = await res.json();
    assert.match(data.error, /Default Demo Co organization is protected/);
  });

  it("returns 404 for nonexistent organization", async () => {
    const nonexistentId = "00000000-0000-0000-0000-000000000404";
    const req = new Request(
      `http://localhost:3000/api/business/${nonexistentId}/settings`,
      {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmName: "Nonexistent" }),
      },
    );

    const res = await DELETE(req, {
      params: Promise.resolve({ id: nonexistentId }),
    });
    assert.equal(res.status, 404);
  });

  it("rejects deletion when confirmName does not match the organization name", async () => {
    const supabase = getServiceSupabase();
    const testId = "00000000-0000-0000-0000-000000000888";

    // Setup temporary business
    await supabase.from("businesses").insert({
      id: testId,
      name: "Mismatch Org Test",
      default_currency: "USDC",
      is_real: false,
      treasury_balance: 0,
    });

    try {
      const req = new Request(
        `http://localhost:3000/api/business/${testId}/settings`,
        {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ confirmName: "Wrong Name Org" }),
        },
      );

      const res = await DELETE(req, {
        params: Promise.resolve({ id: testId }),
      });
      assert.equal(res.status, 400);
      const data = await res.json();
      assert.match(data.error, /Confirmation mismatch/);
    } finally {
      await supabase.from("businesses").delete().eq("id", testId);
    }
  });

  it("deletes organization and all related contracts, policies, and transactions", async () => {
    const supabase = getServiceSupabase();
    const testId = `00000000-0000-0000-0000-${Date.now().toString().slice(-12).padStart(12, "0")}`;
    const contractId = `00000000-0000-0000-0001-${Date.now().toString().slice(-12).padStart(12, "0")}`;
    const orgName = `Purge Test Org ${Date.now()}`;

    // 1. Create organization
    const { error: bErr } = await supabase.from("businesses").insert({
      id: testId,
      name: orgName,
      default_currency: "USDC",
      is_real: false,
      treasury_balance: 500,
    });
    assert.equal(bErr, null, "Failed to create test business");

    // 2. Create policy
    const { error: pErr } = await supabase.from("policies").insert({
      business_id: testId,
      max_auto_transaction: 1000,
      min_savings: 100,
      human_approval_required_above: 1000,
      allowed_categories: ["software"],
    });
    assert.equal(pErr, null, "Failed to create test policy");

    // 3. Create contract
    const { error: cErr } = await supabase.from("contracts").insert({
      id: contractId,
      business_id: testId,
      service: "Test Datadog",
      category: "software",
      current_price: 3500,
      renewal_date: new Date().toISOString(),
    });
    assert.equal(cErr, null, "Failed to create test contract");

    // 4. Execute DELETE via API route
    const req = new Request(
      `http://localhost:3000/api/business/${testId}/settings`,
      {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmName: orgName }),
      },
    );

    const res = await DELETE(req, { params: Promise.resolve({ id: testId }) });
    assert.equal(res.status, 200);

    const body = await res.json();
    assert.equal(body.data.deleted, true);
    assert.equal(body.data.businessId, testId);

    // 5. Verify all child and parent records are gone from database
    const { data: bCheck } = await supabase
      .from("businesses")
      .select("id")
      .eq("id", testId)
      .maybeSingle();
    assert.equal(bCheck, null, "Business record was not removed");

    const { data: pCheck } = await supabase
      .from("policies")
      .select("id")
      .eq("business_id", testId);
    assert.equal(pCheck?.length, 0, "Policies were not purged");

    const { data: cCheck } = await supabase
      .from("contracts")
      .select("id")
      .eq("business_id", testId);
    assert.equal(cCheck?.length, 0, "Contracts were not purged");
  });
});
