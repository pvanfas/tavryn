import assert from "node:assert/strict";
import { before, describe, it } from "node:test";

import { getServiceSupabase } from "../lib/supabase";
import { create_escrow } from "../lib/tools";

describe("Wrong-Vendor & Wallet Mutation Defenses", () => {
  let slackContractId: string;
  let slackVendorId: string;
  let alternativeVendorId: string;

  before(async () => {
    const supabase = getServiceSupabase();

    // 1. Get Slack contract and vendor
    const { data: contract } = await supabase
      .from("contracts")
      .select("id, vendor_id, vendors ( id, name, wallet_address )")
      .eq("service", "Slack")
      .limit(1)
      .single();

    assert.ok(
      contract && contract.vendor_id,
      "Slack contract and vendor must exist",
    );
    slackContractId = contract.id;
    slackVendorId = contract.vendor_id;

    // 2. Get Datadog or another vendor to act as the wrong vendor
    const { data: otherVendor } = await supabase
      .from("vendors")
      .select("id, name")
      .not("id", "eq", slackVendorId)
      .limit(1)
      .single();

    assert.ok(otherVendor, "Alternative vendor must exist");
    alternativeVendorId = otherVendor.id;
  });

  it("1. Mismatch between contract vendor and transaction vendor blocks execution immediately", async () => {
    await assert.rejects(
      async () => {
        await (create_escrow as any).execute({
          amount: 1000,
          contractId: slackContractId,
          vendor: alternativeVendorId, // Conflict: Slack contract vs different vendor ID
        });
      },
      (err: Error) => {
        assert.ok(
          err.message.includes("Wrong-vendor violation") ||
            err.message.includes("Mismatch between contract vendor"),
          `Expected wrong-vendor mismatch error, got: ${err.message}`,
        );
        return true;
      },
    );
  });

  it("2. Mutated vendor recipient wallet address blocks execution and escalates to human approval", async () => {
    const supabase = getServiceSupabase();

    const approvalsBefore =
      (
        await supabase
          .from("approvals")
          .select("id", { count: "exact", head: true })
          .eq("status", "pending")
      ).count || 0;

    const fakeMutatedWallet = "0x8888888888888888888888888888888888888888";

    await assert.rejects(
      async () => {
        await (create_escrow as any).execute({
          amount: 1000,
          savings: 600,
          contractId: slackContractId,
          vendorWallet: fakeMutatedWallet, // Mutated address compared to registered 0x4444...
        });
      },
      (err: Error) => {
        assert.ok(
          err.message.includes("Vendor wallet address changed") ||
            err.message.includes("human supervisor approval required"),
          `Expected wallet mutation escalation error, got: ${err.message}`,
        );
        return true;
      },
    );

    // Verify an approval record was inserted into approvals table
    const approvalsAfter =
      (
        await supabase
          .from("approvals")
          .select("id", { count: "exact", head: true })
          .eq("status", "pending")
      ).count || 0;

    assert.ok(
      approvalsAfter > approvalsBefore,
      "A pending human approval row must be generated upon wallet change",
    );
  });
});
