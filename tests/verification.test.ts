import { test } from "node:test";
import assert from "node:assert/strict";
import {
  extractFromDocumentRegex,
  verifyConfirmationTerms,
  ExpectedTerms,
} from "../lib/agent/verification";
import { getServiceSupabase } from "../lib/supabase";
import { dispute_escrow, create_escrow } from "../lib/tools";

test("extractFromDocumentRegex extracts exact numeric and date fields from order document", () => {
  const sampleDoc = `
============================================================
ORDER CONFIRMATION & RENEWAL SCHEDULE
Confirmation Reference: CONF-98A72B-2026
Vendor: Datadog Inc
Date Issued: 2026-09-27
============================================================

AGREEMENT SPECIFICATIONS:
• Annual Commitment Price: $9,600.00 USDC
• Authorized User Seats: 18 licensed accounts
• Contract Duration: 12 Months
• Effective Renewal Date: 2026-10-15
• Settlement Escrow Asset: USDC (Arc Testnet)
============================================================
  `;

  const extracted = extractFromDocumentRegex(sampleDoc);

  assert.equal(extracted.price, 9600);
  assert.equal(extracted.seats, 18);
  assert.equal(extracted.term_months, 12);
  assert.equal(extracted.renewal_date, "2026-10-15");
});

test("verifyConfirmationTerms happy path: all 4 fields match expected terms", () => {
  const extracted = {
    price: 9600,
    seats: 18,
    term_months: 12,
    renewal_date: "2026-10-15",
  };

  const expected: ExpectedTerms = {
    finalPrice: 9600,
    seats: 18,
    termMonths: 12,
    renewalDate: "2026-10-15",
  };

  const result = verifyConfirmationTerms(extracted, expected);

  assert.equal(result.allPassed, true);
  assert.equal(result.discrepancies.length, 0);
  assert.equal(result.checks.length, 4);
  assert.ok(result.checks.every((c) => c.passed));
});

test("verifyConfirmationTerms detects price tampering (?tamper=price)", () => {
  // Tampered confirmation: price inflated by $1,800
  const tamperedExtracted = {
    price: 11400,
    seats: 18,
    term_months: 12,
    renewal_date: "2026-10-15",
  };

  const expected: ExpectedTerms = {
    finalPrice: 9600,
    seats: 18,
    termMonths: 12,
    renewalDate: "2026-10-15",
  };

  const result = verifyConfirmationTerms(tamperedExtracted, expected);

  assert.equal(result.allPassed, false);
  assert.equal(result.discrepancies.length, 1);
  assert.match(result.discrepancies[0], /Price mismatch: confirmation states \$11,400/);

  const priceCheck = result.checks.find((c) => c.field === "price");
  assert.ok(priceCheck);
  assert.equal(priceCheck.passed, false);
  assert.equal(priceCheck.expected, 9600);
  assert.equal(priceCheck.actual, 11400);

  // Other checks must still pass
  const seatsCheck = result.checks.find((c) => c.field === "seats");
  assert.ok(seatsCheck?.passed);
});

test("verifyConfirmationTerms detects seat count tampering (?tamper=seats)", () => {
  // Tampered confirmation: reverts to unoptimized 23 seats instead of 18
  const tamperedExtracted = {
    price: 9600,
    seats: 23,
    term_months: 12,
    renewal_date: "2026-10-15",
  };

  const expected: ExpectedTerms = {
    finalPrice: 9600,
    seats: 18,
    termMonths: 12,
    renewalDate: "2026-10-15",
  };

  const result = verifyConfirmationTerms(tamperedExtracted, expected);

  assert.equal(result.allPassed, false);
  assert.equal(result.discrepancies.length, 1);
  assert.match(result.discrepancies[0], /Seat allocation mismatch: confirmation states 23 seats/);

  const seatsCheck = result.checks.find((c) => c.field === "seats");
  assert.ok(seatsCheck);
  assert.equal(seatsCheck.passed, false);
  assert.equal(seatsCheck.expected, 18);
  assert.equal(seatsCheck.actual, 23);
});

test("release_escrow and dispute_escrow interact correctly with Supabase transactions and approvals", async () => {
  const supabase = getServiceSupabase();

  // Find an existing contract
  const { data: contract } = await supabase
    .from("contracts")
    .select("id, business_id, service")
    .limit(1)
    .single();

  assert.ok(contract, "Must have at least one contract seeded");

  // Test 1: Dispute creates human approval
  const disputeRes = await (dispute_escrow.execute as any)(
    {
      contractId: contract.id,
      reason: "Automated test verification mismatch",
      discrepancies: ["Price mismatch: expected $9,600, got $11,400"],
    },
    { toolCallId: "test-dispute", messages: [] }
  );

  assert.equal(disputeRes.success, true);
  assert.equal(disputeRes.status, "disputed");

  // Verify transaction status updated to disputed
  const { data: disputedTx } = await supabase
    .from("transactions")
    .select("status")
    .eq("contract_id", contract.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  assert.equal(disputedTx?.status, "disputed");

  // Test 2: Idempotency of create_escrow
  const idempotencyKey = `test-escrow-${contract.id}-${Date.now()}`;
  const escrowRes1 = await (create_escrow.execute as any)(
    {
      amount: 1500,
      savings: 2000,
      contractId: contract.id,
      idempotencyKey,
    },
    { toolCallId: "test-escrow-1", messages: [] }
  );

  assert.equal(escrowRes1.success, true);

  // Calling with exact same idempotency key returns existing transaction
  const escrowRes2 = await (create_escrow.execute as any)(
    {
      amount: 1500,
      savings: 2000,
      contractId: contract.id,
      idempotencyKey,
    },
    { toolCallId: "test-escrow-2", messages: [] }
  );

  assert.equal(escrowRes2.success, true);
  assert.equal(escrowRes2.transactionId, escrowRes1.transactionId);
  assert.match(escrowRes2.message, /Idempotent hit/);
});
