import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { getServiceSupabase } from "@/lib/supabase";
import { check_policy, create_escrow } from "@/lib/tools";

describe("Contract Category Trust & Anti-Spoofing Tests", () => {
  const supabase = getServiceSupabase();

  it("1. A contract with no category causes create_escrow to fail cleanly rather than silently trusting caller input", async () => {
    const { data: business } = await supabase
      .from("businesses")
      .select("id")
      .limit(1)
      .single();
    assert.ok(business, "Business must exist");

    // Insert contract with empty category
    const { data: contract, error: cErr } = await supabase
      .from("contracts")
      .insert({
        business_id: business.id,
        service: `Missing Category Test ${Date.now()}`,
        category: "", // <--- Empty/missing category in trusted database record
        current_price: 2000,
        renewal_date: new Date(Date.now() + 30 * 86400 * 1000).toISOString(),
        status: "active",
      })
      .select()
      .single();
    assert.ok(contract && !cErr, "Contract created");

    try {
      // Caller attempts to supply category: "software" to bypass category budget/policy evaluation
      await assert.rejects(async () => {
        await (create_escrow as any).execute(
          {
            contractId: contract.id,
            amount: 1000,
            vendorWallet: "0x1234567890123456789012345678901234567890",
            category: "software", // <--- Caller attempts to supply category
            businessId: business.id,
          },
          { messages: [], toolCallId: "t-cat-trust-exploit" },
        );
      }, /Policy refusal: Contract has no category set, cannot evaluate policy/i);
    } finally {
      await supabase.from("contracts").delete().eq("id", contract.id);
    }
  });

  it("2. create_escrow rejects when caller supplies a category that conflicts with the authoritative contract category", async () => {
    const { data: business } = await supabase
      .from("businesses")
      .select("id")
      .limit(1)
      .single();
    assert.ok(business, "Business must exist");

    const { data: contract, error: cErr } = await supabase
      .from("contracts")
      .insert({
        business_id: business.id,
        service: `Category Mismatch Test ${Date.now()}`,
        category: "software",
        current_price: 2000,
        renewal_date: new Date(Date.now() + 30 * 86400 * 1000).toISOString(),
        status: "active",
      })
      .select()
      .single();
    assert.ok(contract && !cErr, "Contract created");

    try {
      // Caller supplies category: "cloud" while contract is in "software"
      await assert.rejects(async () => {
        await (create_escrow as any).execute(
          {
            contractId: contract.id,
            amount: 1000,
            vendorWallet: "0x1234567890123456789012345678901234567890",
            category: "cloud", // <--- Conflicting category
            businessId: business.id,
          },
          { messages: [], toolCallId: "t-cat-mismatch" },
        );
      }, /Policy refusal: Caller category 'cloud' does not match authoritative contract category 'software'/i);
    } finally {
      await supabase.from("contracts").delete().eq("id", contract.id);
    }
  });

  it("3. check_policy rejects when contract has no category set rather than trusting caller input", async () => {
    const { data: business } = await supabase
      .from("businesses")
      .select("id")
      .limit(1)
      .single();
    assert.ok(business, "Business must exist");

    const { data: contract, error: cErr } = await supabase
      .from("contracts")
      .insert({
        business_id: business.id,
        service: `Check Policy Missing Category ${Date.now()}`,
        category: "",
        current_price: 2000,
        renewal_date: new Date(Date.now() + 30 * 86400 * 1000).toISOString(),
        status: "active",
      })
      .select()
      .single();
    assert.ok(contract && !cErr, "Contract created");

    try {
      await assert.rejects(async () => {
        await (check_policy as any).execute(
          {
            action: "create_escrow",
            amount: 1000,
            category: "software", // <--- Caller supplies category
            contractId: contract.id,
            businessId: business.id,
          },
          { messages: [], toolCallId: "t-check-policy-cat" },
        );
      }, /Policy refusal: Contract has no category set, cannot evaluate policy/i);
    } finally {
      await supabase.from("contracts").delete().eq("id", contract.id);
    }
  });
});
