import assert from "node:assert/strict";
import { test } from "node:test";

import {
  generateApprovalToken,
  verifyApprovalToken,
} from "../lib/approval-tokens";
import {
  getOverrideGuidancePrompt,
  OVERRIDE_REASON_CODES,
  recordOverrideMemory,
} from "../lib/override-memory";

test("One-Tap HMAC: generateApprovalToken produces tamper-evident signed token", async () => {
  const result = await generateApprovalToken({
    businessId: "11111111-1111-1111-1111-111111111111",
    contractId: "22222222-2222-2222-2222-222222222222",
    action: "approve",
    expiresInHours: 24,
  });

  assert.ok(typeof result.token === "string");
  const parts = result.token.split(".");
  assert.equal(parts.length, 2);
  assert.ok(parts[0].length >= 32); // 20 byte hex nonce
  assert.ok(parts[1].length === 64); // sha256 hex signature
  assert.ok(result.url.includes("/approve/"));
});

test("One-Tap HMAC: verifyApprovalToken rejects malformed or altered tokens", async () => {
  const malformed = await verifyApprovalToken("invalid-token-without-dot");
  assert.equal(malformed.valid, false);
  assert.match(malformed.error || "", /Malformed approval token format/i);

  const fakeValidFormat = await verifyApprovalToken(
    "0123456789abcdef0123456789abcdef01234567.0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
  );
  assert.equal(fakeValidFormat.valid, false);
  assert.match(
    fakeValidFormat.error || "",
    /Invalid or unrecognized approval token/i,
  );
});

test("Override Memory: supports structured supervisor reason codes", () => {
  assert.ok(OVERRIDE_REASON_CODES.includes("need_longer_commitment"));
  assert.ok(OVERRIDE_REASON_CODES.includes("vendor_unreliable"));
  assert.ok(OVERRIDE_REASON_CODES.includes("wrong_seat_count"));
  assert.ok(OVERRIDE_REASON_CODES.includes("rate_too_high"));
});

test("Override Memory: recordOverrideMemory logs feedback and getOverrideGuidancePrompt formats guidance", async () => {
  const testBusinessId = "11111111-1111-1111-1111-111111111111";

  // Record an override
  const recordResult = await recordOverrideMemory({
    businessId: testBusinessId,
    category: "software",
    reasonCode: "need_longer_commitment",
    notes: "Do not accept 1-year terms without at least 25% discount.",
  });
  assert.ok(recordResult.success);

  // Retrieve prompt guidance
  const guidance = await getOverrideGuidancePrompt(
    testBusinessId,
    null,
    "software",
  );
  assert.ok(typeof guidance === "string");
  if (guidance.length > 0) {
    assert.match(guidance, /PAST HUMAN SUPERVISOR FEEDBACK/i);
    assert.match(guidance, /NEED_LONGER_COMMITMENT/i);
  }
});
