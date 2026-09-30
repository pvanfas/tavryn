import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";

import { createClient } from "@supabase/supabase-js";

import { getServiceSupabase } from "../lib/supabase";

describe("Self-Service Multi-Tenant Onboarding & RLS Data Isolation", () => {
  const admin = getServiceSupabase();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  let userAId: string;
  let userBId: string;
  let clientA: any;
  let clientB: any;

  let businessAId: string;
  let businessBId: string;
  let contractAId: string;
  let contractBId: string;
  let eventAId: string;
  let eventBId: string;

  const emailA = `founder_a_${Date.now()}@alpha-corp.io`;
  const emailB = `founder_b_${Date.now()}@beta-labs.io`;
  const password = "SecurePassword123!@#";

  before(async () => {
    // 1. Create two independent Auth Users via Supabase Admin
    const { data: uA, error: errA } = await admin.auth.admin.createUser({
      email: emailA,
      password,
      email_confirm: true,
    });
    assert.ok(uA.user && !errA, `Failed to create User A: ${errA?.message}`);
    userAId = uA.user.id;

    const { data: uB, error: errB } = await admin.auth.admin.createUser({
      email: emailB,
      password,
      email_confirm: true,
    });
    assert.ok(uB.user && !errB, `Failed to create User B: ${errB?.message}`);
    userBId = uB.user.id;

    // 2. Onboard Business Alpha for User A
    const { data: bA, error: bAErr } = await admin
      .from("businesses")
      .insert({
        name: `Alpha Corp (${Date.now()})`,
        is_real: true,
        treasury_balance: 65000,
        default_currency: "USDC",
        wallet_address: "0x1111111111111111111111111111111111111111",
        webhook_url: "https://discord.com/api/webhooks/alpha-test",
      })
      .select("id")
      .single();
    assert.ok(
      bA && !bAErr,
      `Failed to insert Business Alpha: ${bAErr?.message}`,
    );
    businessAId = bA.id;

    // Map User A as Owner of Alpha
    await admin.from("business_members").insert({
      business_id: businessAId,
      user_id: userAId,
      role: "owner",
    });

    // Create Contract & Policy for Alpha
    const { data: cA } = await admin
      .from("contracts")
      .insert({
        business_id: businessAId,
        service: "Alpha Slack Enterprise",
        current_price: 12000,
        category: "software",
        renewal_date: "2026-11-01",
        status: "active",
      })
      .select("id")
      .single();
    contractAId = cA!.id;

    await admin.from("policies").insert({
      business_id: businessAId,
      max_auto_transaction: 3500,
      min_savings: 350,
      human_approval_required_above: 3500,
      allowed_categories: ["software", "cloud"],
    });

    const { data: evA } = await admin
      .from("onboarding_events")
      .insert({
        business_id: businessAId,
        user_id: userAId,
        event_type: "business_onboarded",
        step: "completed",
        metadata: { company: "Alpha Corp", total_spend: 12000 },
      })
      .select("id")
      .single();
    eventAId = evA!.id;

    // 3. Onboard Business Beta for User B
    const { data: bB, error: bBErr } = await admin
      .from("businesses")
      .insert({
        name: `Beta Labs (${Date.now()})`,
        is_real: true,
        treasury_balance: 95000,
        default_currency: "USDC",
        wallet_address: "0x2222222222222222222222222222222222222222",
        webhook_url: "https://hooks.slack.com/services/beta-test",
      })
      .select("id")
      .single();
    assert.ok(
      bB && !bBErr,
      `Failed to insert Business Beta: ${bBErr?.message}`,
    );
    businessBId = bB.id;

    // Map User B as Owner of Beta
    await admin.from("business_members").insert({
      business_id: businessBId,
      user_id: userBId,
      role: "owner",
    });

    // Create Contract & Policy for Beta
    const { data: cB } = await admin
      .from("contracts")
      .insert({
        business_id: businessBId,
        service: "Beta Datadog Pro Infrastructure",
        current_price: 24000,
        category: "cloud",
        renewal_date: "2026-12-15",
        status: "active",
      })
      .select("id")
      .single();
    contractBId = cB!.id;

    await admin.from("policies").insert({
      business_id: businessBId,
      max_auto_transaction: 8000,
      min_savings: 800,
      human_approval_required_above: 8000,
      allowed_categories: ["cloud", "infrastructure"],
    });

    const { data: evB } = await admin
      .from("onboarding_events")
      .insert({
        business_id: businessBId,
        user_id: userBId,
        event_type: "business_onboarded",
        step: "completed",
        metadata: { company: "Beta Labs", total_spend: 24000 },
      })
      .select("id")
      .single();
    eventBId = evB!.id;

    // 4. Authenticate clientA (as User A) and clientB (as User B) via Supabase Auth
    clientA = createClient(url, anonKey, { auth: { persistSession: false } });
    const { error: logAErr } = await clientA.auth.signInWithPassword({
      email: emailA,
      password,
    });
    assert.ok(!logAErr, `User A sign in failed: ${logAErr?.message}`);

    clientB = createClient(url, anonKey, { auth: { persistSession: false } });
    const { error: logBErr } = await clientB.auth.signInWithPassword({
      email: emailB,
      password,
    });
    assert.ok(!logBErr, `User B sign in failed: ${logBErr?.message}`);
  });

  after(async () => {
    // Cleanup test data
    if (contractAId)
      await admin.from("contracts").delete().eq("id", contractAId);
    if (contractBId)
      await admin.from("contracts").delete().eq("id", contractBId);
    if (eventAId)
      await admin.from("onboarding_events").delete().eq("id", eventAId);
    if (eventBId)
      await admin.from("onboarding_events").delete().eq("id", eventBId);
    if (businessAId)
      await admin.from("businesses").delete().eq("id", businessAId);
    if (businessBId)
      await admin.from("businesses").delete().eq("id", businessBId);
    if (userAId) await admin.auth.admin.deleteUser(userAId);
    if (userBId) await admin.auth.admin.deleteUser(userBId);
  });

  it("1. User A can read Business Alpha's contracts, but CANNOT read Business Beta's contracts", async () => {
    // User A reads their own contract
    const { data: aOwnContracts, error: errOwn } = await clientA
      .from("contracts")
      .select("id, service, business_id")
      .eq("id", contractAId);

    assert.ok(!errOwn);
    assert.equal(aOwnContracts?.length, 1);
    assert.equal(aOwnContracts[0].service, "Alpha Slack Enterprise");

    // User A attempts to read Business B's contract
    const { data: aOtherContracts, error: errOther } = await clientA
      .from("contracts")
      .select("id, service, business_id")
      .eq("id", contractBId);

    assert.ok(!errOther);
    assert.equal(
      aOtherContracts?.length,
      0,
      "User A must receive empty set for User B's contract",
    );
  });

  it("2. User B can read Business Beta's contracts, but CANNOT read Business Alpha's contracts", async () => {
    // User B reads their own contract
    const { data: bOwnContracts, error: errOwn } = await clientB
      .from("contracts")
      .select("id, service, business_id")
      .eq("id", contractBId);

    assert.ok(!errOwn);
    assert.equal(bOwnContracts?.length, 1);
    assert.equal(bOwnContracts[0].service, "Beta Datadog Pro Infrastructure");

    // User B attempts to read Business A's contract
    const { data: bOtherContracts, error: errOther } = await clientB
      .from("contracts")
      .select("id, service, business_id")
      .eq("id", contractAId);

    assert.ok(!errOther);
    assert.equal(
      bOtherContracts?.length,
      0,
      "User B must receive empty set for User A's contract",
    );
  });

  it("3. User A CANNOT read Business Beta profile or settings", async () => {
    const { data, error } = await clientA
      .from("businesses")
      .select("id, name, wallet_address, webhook_url")
      .eq("id", businessBId);

    assert.ok(!error);
    assert.equal(
      data?.length,
      0,
      "User A must not be able to read Business B's profile",
    );
  });

  it("4. User B CANNOT read Business Alpha profile or settings", async () => {
    const { data, error } = await clientB
      .from("businesses")
      .select("id, name, wallet_address, webhook_url")
      .eq("id", businessAId);

    assert.ok(!error);
    assert.equal(
      data?.length,
      0,
      "User B must not be able to read Business A's profile",
    );
  });

  it("5. User A CANNOT read or update Business Beta's policy", async () => {
    // Read attempt
    const { data: pData } = await clientA
      .from("policies")
      .select("*")
      .eq("business_id", businessBId);

    assert.equal(pData?.length, 0, "User A must not read Business B's policy");

    // Update attempt
    await clientA
      .from("policies")
      .update({ max_auto_transaction: 999999 })
      .eq("business_id", businessBId);

    // Verify Business B's policy in database was untouched
    const { data: checkB } = await admin
      .from("policies")
      .select("max_auto_transaction")
      .eq("business_id", businessBId)
      .single();

    assert.equal(
      checkB?.max_auto_transaction,
      8000,
      "Business B policy must remain 8000 and unchanged by User A",
    );
  });

  it("6. Onboarding events table isolates events by business and records audit history", async () => {
    // User A reads onboarding events: should only see Alpha Corp event
    const { data: eventsA, error: errEvA } = await clientA
      .from("onboarding_events")
      .select("id, business_id, event_type, metadata");

    assert.ok(!errEvA);
    assert.equal(eventsA?.length, 1);
    assert.equal(eventsA[0].business_id, businessAId);
    assert.equal(eventsA[0].metadata?.company, "Alpha Corp");

    // User B reads onboarding events: should only see Beta Labs event
    const { data: eventsB, error: errEvB } = await clientB
      .from("onboarding_events")
      .select("id, business_id, event_type, metadata");

    assert.ok(!errEvB);
    assert.equal(eventsB?.length, 1);
    assert.equal(eventsB[0].business_id, businessBId);
    assert.equal(eventsB[0].metadata?.company, "Beta Labs");

    // Admin endpoint verifies both events were tracked
    const { data: allEvents } = await admin
      .from("onboarding_events")
      .select("id, business_id")
      .in("business_id", [businessAId, businessBId]);

    assert.equal(
      allEvents?.length,
      2,
      "Admin should see both businesses tracked in onboarding_events",
    );
  });
});
