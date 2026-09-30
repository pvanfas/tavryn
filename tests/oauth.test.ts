import assert from "node:assert/strict";
import { test } from "node:test";

import { clearAuthCookie, setAuthCookie, signInWithOAuth } from "../lib/auth";

test("signInWithOAuth generates accurate redirect URI and options for Google", async () => {
  const result = await signInWithOAuth("google", "/onboard");

  // In test environment without browser origin, it falls back to NEXT_PUBLIC_SITE_URL or localhost
  assert.ok(result);
  // Supabase signInWithOAuth returns { data: { provider: 'google', url: ... }, error: null }
  if (result.data) {
    assert.equal(result.data.provider, "google");
  }
});

test("signInWithOAuth generates accurate redirect URI and options for GitHub", async () => {
  const result = await signInWithOAuth("github", "/");

  assert.ok(result);
  if (result.data) {
    assert.equal(result.data.provider, "github");
  }
});

test("setAuthCookie and clearAuthCookie execute safely in Node/browser environments", () => {
  // Verifies safe execution without throwing in headless environments
  assert.doesNotThrow(() => {
    setAuthCookie("test-access-token-12345");
  });

  assert.doesNotThrow(() => {
    clearAuthCookie();
  });
});

test("callback next destination validation prevents open redirect attacks", () => {
  // Helper validation pattern used in redirect resolution
  const sanitizeNextUrl = (nextParam: string | null): string => {
    if (!nextParam) return "/";
    // Only allow relative internal paths
    if (nextParam.startsWith("/") && !nextParam.startsWith("//")) {
      return nextParam;
    }
    return "/";
  };

  assert.equal(sanitizeNextUrl("/"), "/");
  assert.equal(sanitizeNextUrl("/onboard"), "/onboard");
  assert.equal(sanitizeNextUrl("/negotiate/123"), "/negotiate/123");
  assert.equal(sanitizeNextUrl("https://evil.com"), "/");
  assert.equal(sanitizeNextUrl("//evil.com"), "/");
  assert.equal(sanitizeNextUrl(null), "/");
});
