import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";

import {
  createReceipt,
  generateReceiptToken,
  getPublicReceipt,
  updateReceipt,
} from "../lib/receipt";
import { getServiceSupabase } from "../lib/supabase";

describe("Public Savings Receipts & Allow-List Isolation", () => {
  const admin = getServiceSupabase();

  let businessId: string;
  let vendorId: string;
  let contractId: string;
  let negotiationId: string;
  let transactionId: string;
  let testToken: string;

  before(async () => {
    // 1. Setup isolated mock business, vendor, contract, negotiation, and completed transaction
    const { data: b } = await admin
      .from("businesses")
      .insert({
        name: `Receipt Test Co (${Date.now()})`,
        is_real: false,
        treasury_balance: 50000,
        wallet_address: "0x1111111111111111111111111111111111111111", // sensitive!
      })
      .select("id")
      .single();
    assert.ok(b, "Failed to create business");
    businessId = b.id;

    const { data: v } = await admin
      .from("vendors")
      .insert({
        name: "Test Slack Inc",
        category: "software",
        is_simulated: true,
      })
      .select("id")
      .single();
    assert.ok(v, "Failed to create vendor");
    vendorId = v.id;

    const { data: c, error: cErr } = await admin
      .from("contracts")
      .insert({
        business_id: businessId,
        vendor_id: vendorId,
        service: "Slack Enterprise",
        category: "software",
        current_price: 12000,
        renewal_date: new Date(Date.now() + 30 * 86400 * 1000).toISOString(),
        status: "active",
      })
      .select("id")
      .single();
    assert.ok(c && !cErr, `Failed to create contract: ${cErr?.message}`);
    contractId = c.id;

    const { data: n, error: nErr } = await admin
      .from("negotiations")
      .insert({
        contract_id: contractId,
        original_price: 12000,
        status: "accepted",
        final_price: 9600,
        rounds: 2,
      })
      .select("id")
      .single();
    assert.ok(n && !nErr, `Failed to create negotiation: ${nErr?.message}`);
    negotiationId = n.id;

    const { data: t } = await admin
      .from("transactions")
      .insert({
        business_id: businessId,
        vendor_id: vendorId,
        contract_id: contractId,
        negotiation_id: negotiationId,
        amount: 9600,
        status: "completed",
        tx_hash:
          "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
        idempotency_key: `receipt_test_tx_${Date.now()}`,
      })
      .select("id")
      .single();
    assert.ok(t, "Failed to create transaction");
    transactionId = t.id;
  });

  after(async () => {
    // Cleanup
    if (businessId) {
      await admin.from("businesses").delete().eq("id", businessId);
    }
  });

  it("generates a high-entropy, unguessable token >= 128 bits", () => {
    const token = generateReceiptToken();
    assert.ok(token, "Token must not be empty");
    assert.strictEqual(typeof token, "string");
    // 16 bytes hex = 32 characters = 128 bits of entropy
    assert.ok(
      token.length >= 32,
      "Token must be at least 32 hex chars (128 bits)",
    );

    const token2 = generateReceiptToken();
    assert.notStrictEqual(
      token,
      token2,
      "Successive tokens must be unique and unguessable",
    );
  });

  it("creates a receipt record strictly for completed transactions", async () => {
    const res = await createReceipt({
      transactionId,
      businessId,
      createdBy: "test_suite",
    });

    assert.ok(res.token, "Receipt must return a token");
    assert.ok(
      res.receiptUrl.startsWith("/r/"),
      "Receipt URL must start with /r/",
    );
    testToken = res.token;

    // Verify row in database
    const { data: dbRow } = await admin
      .from("receipts")
      .select("*")
      .eq("token", testToken)
      .single();

    assert.ok(dbRow, "Receipt must exist in database");
    assert.strictEqual(dbRow.transaction_id, transactionId);
    assert.strictEqual(dbRow.business_id, businessId);
    assert.strictEqual(dbRow.revoked_at, null);
  });

  it("refuses to create a receipt for non-completed transactions", async () => {
    const { data: pendingTx } = await admin
      .from("transactions")
      .insert({
        business_id: businessId,
        amount: 5000,
        status: "pending",
        idempotency_key: `pending_tx_${Date.now()}`,
      })
      .select("id")
      .single();

    assert.ok(pendingTx);

    await assert.rejects(async () => {
      await createReceipt({
        transactionId: pendingTx.id,
        businessId,
      });
    }, /Cannot create receipt for transaction with status 'pending'/);
  });

  it("strictly enforces allow-listed view model with zero sensitive data leak", async () => {
    const model = await getPublicReceipt(testToken);
    assert.ok(model, "Public receipt should be retrieved");

    // Allowed schema keys
    const allowedKeys = new Set([
      "token",
      "service",
      "category",
      "businessName",
      "vendorName",
      "oldPrice",
      "newPrice",
      "annualSavings",
      "savingsPct",
      "roundsCount",
      "agentExplanation",
      "policyChecklist",
      "verificationResult",
      "arcExplorerUrls",
      "createdAt",
    ]);

    const actualKeys = Object.keys(model);
    for (const key of actualKeys) {
      assert.ok(
        allowedKeys.has(key),
        `Unexpected key found in PublicReceiptViewModel: ${key}`,
      );
    }

    // Explicitly verify sensitive database fields are completely absent
    const forbiddenFields = [
      "id",
      "business_id",
      "businessId",
      "vendor_id",
      "vendorId",
      "contract_id",
      "contractId",
      "negotiation_id",
      "negotiationId",
      "wallet_address",
      "walletAddress",
      "raw_text",
      "approver",
      "created_by",
      "api_key",
    ];

    for (const forbidden of forbiddenFields) {
      assert.strictEqual(
        (model as any)[forbidden],
        undefined,
        `Forbidden sensitive field '${forbidden}' was exposed in public receipt!`,
      );
    }

    // Verify computed financial numbers
    assert.strictEqual(model.oldPrice, 12000);
    assert.strictEqual(model.newPrice, 9600);
    assert.strictEqual(model.annualSavings, 2400);
    assert.strictEqual(model.savingsPct, 20);
    assert.strictEqual(model.roundsCount, 2);
    assert.strictEqual(model.service, "Slack Enterprise");
  });

  it("respects privacy visibility toggles for business and vendor names", async () => {
    // Hide business name
    await updateReceipt({
      token: testToken,
      businessId,
      showBusinessName: false,
    });

    let model = await getPublicReceipt(testToken);
    assert.ok(model);
    assert.strictEqual(
      model.businessName,
      null,
      "Business name should be hidden",
    );
    assert.strictEqual(
      model.vendorName,
      "Test Slack Inc",
      "Vendor name should remain visible",
    );

    // Hide vendor name
    await updateReceipt({
      token: testToken,
      businessId,
      showVendorName: false,
    });

    model = await getPublicReceipt(testToken);
    assert.ok(model);
    assert.strictEqual(
      model.businessName,
      null,
      "Business name should be hidden",
    );
    assert.strictEqual(model.vendorName, null, "Vendor name should be hidden");

    // Restore visibility
    await updateReceipt({
      token: testToken,
      businessId,
      showBusinessName: true,
      showVendorName: true,
    });

    model = await getPublicReceipt(testToken);
    assert.ok(model);
    assert.ok(model.businessName?.includes("Receipt Test Co"));
    assert.strictEqual(model.vendorName, "Test Slack Inc");
  });

  it("revoking a receipt immediately produces null / 404", async () => {
    // Revoke
    await updateReceipt({
      token: testToken,
      businessId,
      revoke: true,
    });

    const revokedModel = await getPublicReceipt(testToken);
    assert.strictEqual(
      revokedModel,
      null,
      "Revoked receipt must immediately return null to trigger generic 404",
    );

    // Non-existent token also produces null
    const ghostModel = await getPublicReceipt(
      "0123456789abcdef0123456789abcdef",
    );
    assert.strictEqual(ghostModel, null, "Unknown token must return null");
  });
});
