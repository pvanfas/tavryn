import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";

import { createClient } from "@supabase/supabase-js";

import { getServiceSupabase } from "../lib/supabase";

describe("Supabase Multi-Tenant Row-Level Security (RLS)", () => {
  const admin = getServiceSupabase();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  let businessAId: string;
  let businessBId: string;
  let userAId: string;
  let userBId: string;
  let clientA: any;
  let clientB: any;
  let contractAId: string;
  let contractBId: string;

  before(async () => {
    // 1. Create two isolated businesses
    const { data: bA, error: errBA } = await admin
      .from("businesses")
      .insert({ name: `Tenant A (${Date.now()})` })
      .select("id")
      .single();
    assert.ok(bA && !errBA, `Failed to create Business A: ${errBA?.message}`);
    businessAId = bA.id;

    const { data: bB, error: errBB } = await admin
      .from("businesses")
      .insert({ name: `Tenant B (${Date.now()})` })
      .select("id")
      .single();
    assert.ok(bB && !errBB, `Failed to create Business B: ${errBB?.message}`);
    businessBId = bB.id;

    // 2. Create Auth Users for each tenant
    const emailA = `tenant_a_${Date.now()}@tavryn.internal`;
    const emailB = `tenant_b_${Date.now()}@tavryn.internal`;
    const password = "Password123!Secure";

    const { data: uA, error: errUA } = await admin.auth.admin.createUser({
      email: emailA,
      password,
      email_confirm: true,
    });
    assert.ok(uA.user && !errUA, `Failed to create user A: ${errUA?.message}`);
    userAId = uA.user.id;

    const { data: uB, error: errUB } = await admin.auth.admin.createUser({
      email: emailB,
      password,
      email_confirm: true,
    });
    assert.ok(uB.user && !errUB, `Failed to create user B: ${errUB?.message}`);
    userBId = uB.user.id;

    // 3. Map Users to Businesses in business_members table
    const { error: memErrA } = await admin.from("business_members").insert({
      business_id: businessAId,
      user_id: userAId,
      role: "owner",
    });
    assert.ok(!memErrA, `Failed to insert member A: ${memErrA?.message}`);

    const { error: memErrB } = await admin.from("business_members").insert({
      business_id: businessBId,
      user_id: userBId,
      role: "owner",
    });
    assert.ok(!memErrB, `Failed to insert member B: ${memErrB?.message}`);

    // 4. Create Contracts for Business A and Business B
    const { data: cA, error: cErrA } = await admin
      .from("contracts")
      .insert({
        business_id: businessAId,
        service: "Tenant A Cloud Service",
        current_price: 5000,
        renewal_date: "2026-10-31",
        category: "infrastructure",
      })
      .select("id")
      .single();
    assert.ok(cA && !cErrA, `Failed to create contract A: ${cErrA?.message}`);
    contractAId = cA.id;

    const { data: cB, error: cErrB } = await admin
      .from("contracts")
      .insert({
        business_id: businessBId,
        service: "Tenant B Secret DB Service",
        current_price: 9000,
        renewal_date: "2026-11-15",
        category: "database",
      })
      .select("id")
      .single();
    assert.ok(cB && !cErrB, `Failed to create contract B: ${cErrB?.message}`);
    contractBId = cB.id;

    // 5. Sign in Client A and Client B using Supabase anon key
    clientA = createClient(url, anonKey, { auth: { persistSession: false } });
    const { error: loginErrA } = await clientA.auth.signInWithPassword({
      email: emailA,
      password,
    });
    assert.ok(!loginErrA, `Failed to login Client A: ${loginErrA?.message}`);

    clientB = createClient(url, anonKey, { auth: { persistSession: false } });
    const { error: loginErrB } = await clientB.auth.signInWithPassword({
      email: emailB,
      password,
    });
    assert.ok(!loginErrB, `Failed to login Client B: ${loginErrB?.message}`);
  });

  after(async () => {
    // Clean up test data
    if (contractAId)
      await admin.from("contracts").delete().eq("id", contractAId);
    if (contractBId)
      await admin.from("contracts").delete().eq("id", contractBId);
    if (businessAId)
      await admin.from("businesses").delete().eq("id", businessAId);
    if (businessBId)
      await admin.from("businesses").delete().eq("id", businessBId);
    if (userAId) await admin.auth.admin.deleteUser(userAId);
    if (userBId) await admin.auth.admin.deleteUser(userBId);
  });

  it("1. User of Business A can read Business A's contracts", async () => {
    const { data, error } = await clientA
      .from("contracts")
      .select("id, service, business_id")
      .eq("id", contractAId);

    assert.ok(!error, `Unexpected error: ${error?.message}`);
    assert.equal(data?.length, 1);
    assert.equal(data[0].id, contractAId);
    assert.equal(data[0].business_id, businessAId);
  });

  it("2. User of Business A CANNOT read Business B's contracts", async () => {
    const { data, error } = await clientA
      .from("contracts")
      .select("id, service, business_id")
      .eq("id", contractBId);

    // RLS filters out rows of other businesses, returning an empty set
    assert.ok(
      !error,
      `Query should succeed but return empty set: ${error?.message}`,
    );
    assert.equal(
      data?.length,
      0,
      "User A must not be able to read User B's contract",
    );
  });

  it("3. User of Business A CANNOT read Business B's business profile", async () => {
    const { data, error } = await clientA
      .from("businesses")
      .select("id, name")
      .eq("id", businessBId);

    assert.ok(!error);
    assert.equal(
      data?.length,
      0,
      "User A must not be able to see Business B record",
    );
  });

  it("4. User of Business A CANNOT insert a contract into Business B", async () => {
    const { error } = await clientA.from("contracts").insert({
      business_id: businessBId, // Cross-tenant forgery attempt
      service: "Malicious Contract Injected By A",
      current_price: 1,
      category: "software",
    });

    assert.ok(
      error,
      "Insert into foreign business must be rejected by RLS WITH CHECK policy",
    );
  });

  it("5. User of Business A CANNOT update Business B's contracts", async () => {
    const { data, error } = await clientA
      .from("contracts")
      .update({ current_price: 999999 })
      .eq("id", contractBId)
      .select();

    // RLS blocks update: 0 rows modified
    assert.ok(!error);
    assert.equal(
      data?.length,
      0,
      "User A cannot modify rows belonging to Business B",
    );

    // Verify Business B's contract current_price was NOT mutated
    const { data: verifiedB } = await admin
      .from("contracts")
      .select("current_price")
      .eq("id", contractBId)
      .single();
    assert.equal(Number(verifiedB?.current_price), 9000);
  });

  it("6. User of Business A CANNOT read Business B's agent actions", async () => {
    // Admin logs an action for Business B
    await admin.from("agent_actions").insert({
      business_id: businessBId,
      action: "analyze_contract",
      reason: "Confidential analysis for Tenant B",
      confidence: 0.95,
      input: { contractId: contractBId },
      result: { confidential: true },
    });

    const { data, error } = await clientA
      .from("agent_actions")
      .select("*")
      .eq("business_id", businessBId);

    assert.ok(!error);
    assert.equal(
      data?.length,
      0,
      "User A must not be able to read agent_actions for Business B",
    );
  });
});
