import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { NextRequest } from "next/server";

import { POST as resetAndRunHandler } from "../app/api/demo/reset-and-run/route";
import { getServiceSupabase } from "../lib/supabase";

describe("Real One-Click Demo Pipeline", () => {
  it("executes full real pipeline twice and produces different negotiation numbers with reviewer verdicts", async () => {
    const supabase = getServiceSupabase();

    // 1. Resolve Demo Co business
    const { data: demoCo } = await supabase
      .from("businesses")
      .select("id, name")
      .eq("name", "Demo Co")
      .single();

    assert.ok(demoCo, "Demo Co business must exist in database");

    // ----------------------------------------------------
    // RUN 1: First full demo execution
    // ----------------------------------------------------
    const req1 = new NextRequest(
      "http://localhost:3000/api/demo/reset-and-run",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessId: demoCo.id }),
      },
    );

    const res1 = await resetAndRunHandler(req1);
    assert.equal(res1.status, 200, "Run 1 must return HTTP 200");

    const json1 = await res1.json();
    assert.ok(json1.success, "Run 1 must succeed");
    const data1 = json1.data;

    assert.ok(data1.finalPrice, "Run 1 must return finalPrice");
    assert.ok(data1.savingsRealized, "Run 1 must return savingsRealized");
    assert.ok(data1.reviewer, "Run 1 must return reviewer verdict");
    assert.ok(
      ["agree", "challenge", "reject"].includes(data1.reviewer.verdict),
      `Run 1 reviewer verdict must be valid: got ${data1.reviewer.verdict}`,
    );

    // Verify all 8 steps in pipeline
    assert.equal(data1.steps.length, 8, "Must produce all 8 pipeline steps");
    const stepNames1 = data1.steps.map((s: any) => s.name);
    assert.deepEqual(stepNames1, [
      "detect",
      "negotiate",
      "reviewer",
      "policy",
      "escrow",
      "verify",
      "release",
      "memory",
    ]);

    // Verify step 2 negotiation is dynamic
    const negotiateStep1 = data1.steps.find((s: any) => s.name === "negotiate");
    assert.ok(negotiateStep1.details.rounds >= 1, "Rounds must be >= 1");
    assert.ok(negotiateStep1.details.finalPrice > 0, "Final price > 0");

    // Verify step 3 reviewer step
    const reviewerStep1 = data1.steps.find((s: any) => s.name === "reviewer");
    assert.ok(reviewerStep1.details.verdict, "Reviewer step must have verdict");

    // Verify step 6 verification checks passed
    const verifyStep1 = data1.steps.find((s: any) => s.name === "verify");
    assert.equal(
      verifyStep1.details.allPassed,
      true,
      "Verification checks must pass",
    );

    // ----------------------------------------------------
    // RUN 2: Second full demo execution
    // ----------------------------------------------------
    const req2 = new NextRequest(
      "http://localhost:3000/api/demo/reset-and-run",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessId: demoCo.id }),
      },
    );

    const res2 = await resetAndRunHandler(req2);
    assert.equal(res2.status, 200, "Run 2 must return HTTP 200");

    const json2 = await res2.json();
    assert.ok(json2.success, "Run 2 must succeed");
    const data2 = json2.data;

    assert.ok(data2.finalPrice, "Run 2 must return finalPrice");
    assert.ok(data2.savingsRealized, "Run 2 must return savingsRealized");
    assert.ok(data2.reviewer, "Run 2 must return reviewer verdict");
    assert.ok(
      ["agree", "challenge", "reject"].includes(data2.reviewer.verdict),
      `Run 2 reviewer verdict must be valid: got ${data2.reviewer.verdict}`,
    );

    // ----------------------------------------------------
    // VERIFICATION: Run 1 vs Run 2 Dynamic Comparison
    // ----------------------------------------------------
    console.log("\n=======================================================");
    console.log("DEMO PIPELINE VERIFICATION RESULTS:");
    console.log(
      `Run 1 Agreed Price: $${data1.finalPrice.toLocaleString()} (Savings: $${data1.savingsRealized.toLocaleString()}, Rounds: ${data1.rounds})`,
    );
    console.log(
      `Run 1 Reviewer Verdict: ${data1.reviewer.verdict.toUpperCase()} — "${data1.reviewer.reasoning}"`,
    );
    console.log(
      `Run 2 Agreed Price: $${data2.finalPrice.toLocaleString()} (Savings: $${data2.savingsRealized.toLocaleString()}, Rounds: ${data2.rounds})`,
    );
    console.log(
      `Run 2 Reviewer Verdict: ${data2.reviewer.verdict.toUpperCase()} — "${data2.reviewer.reasoning}"`,
    );
    console.log("=======================================================\n");

    assert.notEqual(
      data1.finalPrice,
      data2.finalPrice,
      `Run 1 price ($${data1.finalPrice}) and Run 2 price ($${data2.finalPrice}) must be different due to real dynamic concession logic`,
    );

    assert.ok(
      data1.negotiationId !== data2.negotiationId,
      "Run 1 and Run 2 must have distinct negotiation records",
    );
  });
});
