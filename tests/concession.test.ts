import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  getVendorSimulatorConfig,
  NegotiateRequest,
  simulateVendorNegotiation,
  VendorSimulatorConfig,
} from "../lib/vendor-simulator";

describe("Vendor Simulator Concession & Secrecy Unit Tests", () => {
  it("strictly preserves reservation floor secrecy (never leaked in response)", () => {
    const config: VendorSimulatorConfig = {
      vendorId: "v-secret-test",
      vendorName: "Support Platform A",
      category: "software",
      style: "stubborn",
      floorPercentage: 0.88,
      concessionRate: 0.18,
    };

    const req: NegotiateRequest = {
      contract_id: "c-test-1",
      offer: 7000,
      round: 1,
      original_price: 10000,
      previous_counter: 10000,
    };

    const res = simulateVendorNegotiation(req, config);

    // Assert that the response object contains only public fields
    assert.deepEqual(
      Object.keys(res).sort(),
      ["accepted", "counter_offer", "message"].sort(),
    );

    // Explicitly confirm floor, reservation, or private variables are undefined
    assert.equal((res as unknown as Record<string, unknown>).floor, undefined);
    assert.equal(
      (res as unknown as Record<string, unknown>).reservation_price,
      undefined,
    );
    assert.equal(
      (res as unknown as Record<string, unknown>).hiddenFloor,
      undefined,
    );
    assert.equal(
      (res as unknown as Record<string, unknown>).floorPercentage,
      undefined,
    );
    assert.equal(
      (res as unknown as Record<string, unknown>).concessionRate,
      undefined,
    );

    // Confirm message text does not mention words like 'floor' or 'reservation price'
    assert.equal(res.message.toLowerCase().includes("floor"), false);
    assert.equal(res.message.toLowerCase().includes("reservation"), false);
  });

  it("accepts immediately when offer is at or above current counter", () => {
    const config: VendorSimulatorConfig = {
      vendorId: "v-accept-test",
      vendorName: "Support Platform B",
      category: "software",
      style: "moderate",
      floorPercentage: 0.78,
      concessionRate: 0.35,
    };

    const req: NegotiateRequest = {
      contract_id: "c-test-2",
      offer: 9200,
      round: 2,
      original_price: 10000,
      previous_counter: 9000, // offer 9200 >= counter 9000
    };

    const res = simulateVendorNegotiation(req, config);
    assert.equal(res.accepted, true);
    assert.equal(res.counter_offer, 9200);
    assert.ok(res.message.toLowerCase().includes("accept"));
  });

  it("demonstrates distinct concession rates across stubborn, moderate, and flexible styles", () => {
    const originalPrice = 10000;
    const initialOffer = 6000;

    const stubbornConfig: VendorSimulatorConfig = {
      vendorId: "v-stubborn",
      vendorName: "Support Platform A",
      category: "software",
      style: "stubborn",
      floorPercentage: 0.88,
      concessionRate: 0.18,
    };

    const moderateConfig: VendorSimulatorConfig = {
      vendorId: "v-moderate",
      vendorName: "Support Platform B",
      category: "software",
      style: "moderate",
      floorPercentage: 0.78,
      concessionRate: 0.35,
    };

    const flexibleConfig: VendorSimulatorConfig = {
      vendorId: "v-flexible",
      vendorName: "Support Platform C",
      category: "software",
      style: "flexible",
      floorPercentage: 0.68,
      concessionRate: 0.55,
    };

    // Round 1
    const resStubborn1 = simulateVendorNegotiation(
      {
        contract_id: "test-diff-1",
        offer: initialOffer,
        round: 1,
        original_price: originalPrice,
        previous_counter: originalPrice,
      },
      stubbornConfig,
    );

    const resModerate1 = simulateVendorNegotiation(
      {
        contract_id: "test-diff-1",
        offer: initialOffer,
        round: 1,
        original_price: originalPrice,
        previous_counter: originalPrice,
      },
      moderateConfig,
    );

    const resFlexible1 = simulateVendorNegotiation(
      {
        contract_id: "test-diff-1",
        offer: initialOffer,
        round: 1,
        original_price: originalPrice,
        previous_counter: originalPrice,
      },
      flexibleConfig,
    );

    // Concession amounts: stubborn concedes least, flexible concedes most
    const concessionStubborn = originalPrice - resStubborn1.counter_offer;
    const concessionModerate = originalPrice - resModerate1.counter_offer;
    const concessionFlexible = originalPrice - resFlexible1.counter_offer;

    assert.ok(
      concessionStubborn < concessionModerate,
      `Expected stubborn concession (${concessionStubborn}) < moderate concession (${concessionModerate})`,
    );
    assert.ok(
      concessionModerate < concessionFlexible,
      `Expected moderate concession (${concessionModerate}) < flexible concession (${concessionFlexible})`,
    );

    // Counters must be monotonically ordered: stubborn > moderate > flexible
    assert.ok(resStubborn1.counter_offer > resModerate1.counter_offer);
    assert.ok(resModerate1.counter_offer > resFlexible1.counter_offer);
  });

  it("seeded PRNG produces identical reproducible results for demos", () => {
    const config = getVendorSimulatorConfig(
      "vendor-repeat",
      "Support Platform B",
      "software",
    );
    const req: NegotiateRequest = {
      contract_id: "contract-repeatable",
      offer: 7500,
      round: 1,
      original_price: 10000,
      previous_counter: 10000,
    };

    const res1 = simulateVendorNegotiation(req, config);
    const res2 = simulateVendorNegotiation(req, config);

    assert.equal(res1.counter_offer, res2.counter_offer);
    assert.equal(res1.accepted, res2.accepted);
    assert.equal(res1.message, res2.message);
  });

  it("counter-offers never drop below the vendor's hidden floor", () => {
    const originalPrice = 10000;
    const stubbornFloor = Math.round(originalPrice * 0.88); // 8800

    const stubbornConfig: VendorSimulatorConfig = {
      vendorId: "v-stubborn-floor",
      vendorName: "Support Platform A",
      category: "software",
      style: "stubborn",
      floorPercentage: 0.88,
      concessionRate: 0.18,
    };

    let counter = originalPrice;
    for (let round = 1; round <= 5; round++) {
      const res = simulateVendorNegotiation(
        {
          contract_id: "test-floor-bound",
          offer: 5000, // Very low aggressive offer
          round,
          original_price: originalPrice,
          previous_counter: counter,
        },
        stubbornConfig,
      );

      assert.ok(
        res.counter_offer >= stubbornFloor,
        `Round ${round}: counter ${res.counter_offer} went below hidden floor ${stubbornFloor}`,
      );
      counter = res.counter_offer;
    }
  });
});
