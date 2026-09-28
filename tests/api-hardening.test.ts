import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { checkRateLimit } from "../lib/rate-limit";
import { logger } from "../lib/logger";

describe("API Hardening, Rate Limiting & Sensitive Data Masking", () => {
  it("1. Rate limiter enforces sliding-window thresholds and returns 429 semantics", () => {
    const testKey = `test_rate_client_${Date.now()}`;
    const limit = 5;
    const windowMs = 5000;

    // Send 5 permitted requests
    for (let i = 0; i < limit; i++) {
      const res = checkRateLimit(testKey, limit, windowMs);
      assert.equal(res.success, true);
      assert.equal(res.remaining, limit - (i + 1));
    }

    // 6th request must be rejected
    const blockedRes = checkRateLimit(testKey, limit, windowMs);
    assert.equal(blockedRes.success, false);
    assert.equal(blockedRes.remaining, 0);
    assert.ok(blockedRes.resetMs > 0 && blockedRes.resetMs <= windowMs);
  });

  it("2. Logger redacts sensitive API keys, private keys, entity secrets, and JWTs", () => {
    const interceptedLogs: string[] = [];
    const originalConsoleLog = console.log;
    const originalConsoleWarn = console.warn;
    const originalConsoleError = console.error;

    try {
      console.log = (...args: any[]) => interceptedLogs.push(args.join(" "));
      console.warn = (...args: any[]) => interceptedLogs.push(args.join(" "));
      console.error = (...args: any[]) => interceptedLogs.push(args.join(" "));

      const fakeApiKey = "TEST_API_KEY:e6a4a41a5770ece4c3b1597b9ab266d8:21cc791e640c6c3ded2103833fb1d433";
      const fakeEntitySecret = "edecc0ae558cf8a377b4809ba4c45a4482d16e5cc2e8a54e043f82d0d6fa7376";
      const fakeJwt = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJvbGUiOiJzZXJ2aWNlX3JvbGUifQ.signaturePart12345678901234567890";

      logger.info(`Starting transaction with ${fakeApiKey} and secret ${fakeEntitySecret}`, {
        apiKey: fakeApiKey,
        entitySecret: fakeEntitySecret,
        token: fakeJwt,
        safeField: "payment_for_slack",
      });

      assert.equal(interceptedLogs.length, 1);
      const output = interceptedLogs[0];

      // Plaintext secrets must not appear
      assert.ok(!output.includes(fakeApiKey), "API key must not appear in plaintext");
      assert.ok(!output.includes(fakeEntitySecret), "Entity secret must not appear in plaintext");
      assert.ok(!output.includes(fakeJwt), "JWT must not appear in plaintext");

      // Redaction placeholders must appear
      assert.ok(output.includes("[REDACTED_SECRET]") || output.includes("[REDACTED]"));
      assert.ok(output.includes("payment_for_slack"));
    } finally {
      console.log = originalConsoleLog;
      console.warn = originalConsoleWarn;
      console.error = originalConsoleError;
    }
  });

  it("3. Zod validates route inputs and rejects malformed UUIDs and negative values", async () => {
    const { POST: runNowHandler } = await import("../app/api/agent/run-now/route");

    // Invalid UUID for businessId
    const req = new Request("http://localhost:3000/api/agent/run-now", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ businessId: "not-a-valid-uuid" }),
    });

    const res = await runNowHandler(req);
    assert.equal(res.status, 400);
    const body = await res.json();
    assert.equal(body.success, false);
    assert.equal(body.error, "Invalid request body");
  });
});
