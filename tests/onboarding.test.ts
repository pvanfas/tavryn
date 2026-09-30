import assert from "node:assert/strict";
import { test } from "node:test";

import { parseAndValidateSubscriptionsCSV } from "../lib/csv";
import { SubscriptionRowSchema } from "../lib/schemas";

test("SubscriptionRowSchema accepts valid software subscription", () => {
  const valid = {
    vendor: "GitHub",
    service: "Enterprise Cloud",
    category: "software",
    annual_price: 14400,
    renewal_date: "2026-10-25",
    seats: 60,
    active_seats: 42,
  };
  const parsed = SubscriptionRowSchema.parse(valid);
  assert.equal(parsed.vendor, "GitHub");
  assert.equal(parsed.annual_price, 14400);
});

test("SubscriptionRowSchema rejects active_seats greater than seats", () => {
  const invalid = {
    vendor: "Slack",
    service: "Business Pro",
    category: "software",
    annual_price: 5000,
    renewal_date: "2026-11-01",
    seats: 20,
    active_seats: 25, // invalid!
  };
  const result = SubscriptionRowSchema.safeParse(invalid);
  assert.equal(result.success, false);
  if (!result.success) {
    assert.match(result.error.issues[0].message, /cannot exceed/);
  }
});

test("SubscriptionRowSchema rejects invalid date and negative price", () => {
  const invalid = {
    vendor: "AWS",
    service: "Cloud",
    category: "cloud",
    annual_price: -500,
    renewal_date: "not-a-date",
  };
  const result = SubscriptionRowSchema.safeParse(invalid);
  assert.equal(result.success, false);
  if (!result.success) {
    const messages = result.error.issues.map((i) => i.message);
    assert.ok(messages.some((m) => m.includes("greater than $0")));
    assert.ok(messages.some((m) => m.includes("Invalid renewal date")));
  }
});

test("parseAndValidateSubscriptionsCSV correctly segregates valid and invalid rows", () => {
  const csv = `vendor,service,category,annual_price,renewal_date,seats,active_seats,usage_decline_pct
GitHub,Enterprise,software,12000,2026-12-01,50,30,
Datadog,APM,cloud,24000,2026-11-15,,,25
BadRow,Faulty,software,-100,invalid-date,10,15,
AWS,Compute,cloud,36000,2026-10-10,,,15`;

  const parsed = parseAndValidateSubscriptionsCSV(csv);
  assert.equal(parsed.validCount, 3);
  assert.equal(parsed.invalidCount, 1);
  assert.equal(parsed.rows.length, 4);

  const errorRow = parsed.rows.find((r) => !r.isValid);
  assert.ok(errorRow);
  assert.ok(
    errorRow.errors.annual_price ||
      errorRow.errors.active_seats ||
      errorRow.errors.renewal_date,
  );
});
