import test from "node:test";
import assert from "node:assert/strict";
import {
  canonicalizeDecisionPayload,
  computeEscrowDecisionHash,
  type EscrowDecisionInput,
} from "../lib/policy/decision-hash";

test("Canonical Decision Hash Suite", async (t) => {
  await t.test(
    "1. Canonical JSON produces identical serialization regardless of input key order",
    () => {
      const inputA: EscrowDecisionInput = {
        businessId: "biz-12345",
        contractId: "contract-abc",
        negotiationId: "neg-999",
        vendorWallet: "0x3600000000000000000000000000000000000000",
        amount: 2500,
        baselinePrice: 3500,
        category: "software",
        policyDecision: "approved",
        reviewerVerdict: "AGREE",
      };

      // Create object with reversed key order
      const inputB: EscrowDecisionInput = {
        reviewerVerdict: "AGREE",
        policyDecision: "approved",
        category: "software",
        baselinePrice: 3500,
        amount: 2500,
        vendorWallet: "0x3600000000000000000000000000000000000000",
        negotiationId: "neg-999",
        contractId: "contract-abc",
        businessId: "biz-12345",
      };

      const jsonA = canonicalizeDecisionPayload(inputA);
      const jsonB = canonicalizeDecisionPayload(inputB);
      assert.equal(jsonA, jsonB);

      const hashA = computeEscrowDecisionHash(inputA);
      const hashB = computeEscrowDecisionHash(inputB);
      assert.equal(hashA, hashB);
      assert.match(hashA, /^0x[0-9a-f]{64}$/);
    },
  );

  await t.test(
    "2. Address casing is normalized to prevent checksum collision divergence",
    () => {
      const inputLower: EscrowDecisionInput = {
        businessId: "biz-1",
        vendorWallet: "0x78e61ae7e8eef34add911fa3e41f3408a819c047",
        amount: 1000,
        category: "cloud",
      };

      const inputChecksum: EscrowDecisionInput = {
        businessId: "biz-1",
        vendorWallet: "0x78e61ae7e8EeF34Add911FA3e41F3408a819c047",
        amount: 1000,
        category: "cloud",
      };

      assert.equal(
        computeEscrowDecisionHash(inputLower),
        computeEscrowDecisionHash(inputChecksum),
      );
    },
  );

  await t.test(
    "3. Tamper detection: $0.01 price divergence produces completely distinct hash",
    () => {
      const baseInput: EscrowDecisionInput = {
        businessId: "biz-1",
        contractId: "c-1",
        vendorWallet: "0x3600000000000000000000000000000000000000",
        amount: 1000.0,
        baselinePrice: 1500.0,
        category: "software",
      };

      const tamperedInput: EscrowDecisionInput = {
        ...baseInput,
        amount: 1000.01,
      };

      const hash1 = computeEscrowDecisionHash(baseInput);
      const hash2 = computeEscrowDecisionHash(tamperedInput);

      assert.notEqual(hash1, hash2);
    },
  );

  await t.test(
    "4. Numeric formatting pins exactly 6 decimal places (USDC precision)",
    () => {
      const inputFloat: EscrowDecisionInput = {
        businessId: "biz-1",
        vendorWallet: "0x3600000000000000000000000000000000000000",
        amount: 500,
        baselinePrice: 500,
        category: "cloud",
      };

      const canonicalJson = canonicalizeDecisionPayload(inputFloat);
      assert.ok(canonicalJson.includes('"amount":"500.000000"'));
      assert.ok(canonicalJson.includes('"baselinePrice":"500.000000"'));
    },
  );
});
