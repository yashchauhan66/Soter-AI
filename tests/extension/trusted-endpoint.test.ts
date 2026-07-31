/**
 * SS-2 adversarial tests for control-plane endpoint trust.
 *
 * The vulnerability these tests lock closed: the extension used to `fetch` any string as
 * its API base URL and then persist the origin the *server* returned in its enrollment
 * response —
 *
 *     apiBaseUrl: typeof data.apiBaseUrl === "string" ? data.apiBaseUrl : apiBaseUrl,
 *
 * so whichever host answered the first enrollment permanently rebound every later policy
 * fetch, audit event, scan event and heartbeat, including the `x-soter-extension-token`
 * device token. EP-2xx tests are written from the attacker's side; the "legitimate
 * traffic" tests exist so the guard cannot be made to pass by refusing everything.
 */
import test from "node:test";
import assert from "node:assert/strict";
import {
  assertTrustedEndpoint,
  buildTrustedUrl,
  normalizeEndpoint,
  normalizePinnedOrigin,
} from "../../apps/extension/src/lib/trusted-endpoint";
import { SoterExtensionApiClient } from "../../apps/extension/src/lib/api-client";
import type { ExtensionConfig } from "../../apps/extension/src/lib/types";

const TRUSTED = "https://guard.acme-corp.example";

function config(overrides: Partial<ExtensionConfig> = {}): ExtensionConfig {
  return {
    apiBaseUrl: TRUSTED,
    organizationId: "org-alpha",
    employeeId: "employee-1",
    deviceToken: "soter_device_TOP_SECRET",
    ...overrides,
  };
}

interface Attempt { url: string; init: RequestInit }

/** Installs a fetch spy that records every attempt and returns an empty JSON 200. */
function spyFetch(attempts: Attempt[]) {
  const original = globalThis.fetch;
  globalThis.fetch = (async (input: unknown, init: RequestInit = {}) => {
    attempts.push({ url: String(input), init });
    return {
      ok: true,
      status: 200,
      json: async () => ({ destinations: [], sourceApps: [], fingerprintBundle: [] }),
    } as unknown as Response;
  }) as typeof globalThis.fetch;
  return () => { globalThis.fetch = original; };
}

/* ── Scheme, host and credential rules ───────────────────────────────────── */

test("EP-201: plaintext http is refused for a remote host", () => {
  const result = normalizeEndpoint("http://guard.acme-corp.example");
  assert.equal(result.allowed, false);
  assert.equal(result.code, "insecure_scheme");
});

test("EP-202: non-http schemes cannot become a control plane", () => {
  for (const candidate of [
    "javascript:fetch('https://evil.example')",
    "data:text/html,<script>1</script>",
    "file:///C:/Windows/System32",
    "ftp://guard.acme-corp.example",
    "chrome-extension://abcdefghijklmnopabcdefghijklmnop",
    "ws://guard.acme-corp.example",
  ]) {
    const result = normalizeEndpoint(candidate);
    assert.equal(result.allowed, false, candidate);
    assert.equal(result.code, "insecure_scheme", candidate);
  }
});

test("EP-203: garbage, empty and non-string endpoints are refused, never thrown on", () => {
  for (const candidate of [null, undefined, 42, {}, [], "", "   ", "guard.acme-corp.example", "//evil.example", "https://"]) {
    const result = normalizeEndpoint(candidate);
    assert.equal(result.allowed, false, JSON.stringify(candidate));
    assert.equal(result.code, "malformed", JSON.stringify(candidate));
  }
});

test("EP-204: credentials embedded in the URL are refused", () => {
  // `https://guard.acme-corp.example@evil.example/` reads as the trusted host to a human
  // but its real origin is evil.example.
  const result = normalizeEndpoint("https://guard.acme-corp.example@evil.example/");
  assert.equal(result.allowed, false);
  assert.equal(result.code, "credentials_in_url");
});

test("EP-205: remote IP literals are refused (v4 and v6)", () => {
  for (const candidate of ["https://203.0.113.10", "https://[2001:db8::1]", "https://198.51.100.7:8443"]) {
    const result = normalizeEndpoint(candidate);
    assert.equal(result.allowed, false, candidate);
    assert.equal(result.code, "ip_literal", candidate);
  }
});

test("EP-206: punycode/IDN control-plane hosts are refused (homograph confusion)", () => {
  // xn--80ak6aa92e.example renders as apple.example in some fonts.
  const result = normalizeEndpoint("https://xn--80ak6aa92e.example");
  assert.equal(result.allowed, false);
  assert.equal(result.code, "punycode_host");
});

test("EP-207: loopback is allowed over http, for a local broker only", () => {
  for (const candidate of ["http://localhost:8787", "http://127.0.0.1:8787", "http://soter.localhost:9000"]) {
    const result = normalizeEndpoint(candidate);
    assert.equal(result.allowed, true, candidate);
    assert.equal(result.loopback, true, candidate);
  }
  // A remote host must not be able to masquerade as loopback by suffix.
  assert.equal(normalizeEndpoint("https://localhost.evil.example").allowed, true);
  assert.equal(normalizeEndpoint("https://localhost.evil.example").origin, "https://localhost.evil.example");
});

/* ── Canonicalisation, so a pin cannot be slipped past ───────────────────── */

test("EP-208: host case and a trailing dot canonicalise to the same origin", () => {
  const canonical = "https://guard.acme-corp.example";
  for (const candidate of [
    "https://GUARD.Acme-Corp.Example",
    "https://guard.acme-corp.example.",
    "https://guard.acme-corp.example/api/extension/policy?organizationId=x",
    "  https://guard.acme-corp.example/  ",
  ]) {
    assert.equal(normalizeEndpoint(candidate).origin, canonical, candidate);
  }
  assert.equal(normalizePinnedOrigin("https://GUARD.acme-corp.example./"), canonical);
});

test("EP-209: a different port is a different origin", () => {
  assert.equal(normalizeEndpoint("https://guard.acme-corp.example:8443").origin, "https://guard.acme-corp.example:8443");
  const pinned = normalizeEndpoint("https://guard.acme-corp.example:8443", { pinnedOrigin: TRUSTED });
  assert.equal(pinned.allowed, false);
  assert.equal(pinned.code, "pin_mismatch");
});

/* ── The pin ─────────────────────────────────────────────────────────────── */

test("EP-210: once pinned, no other origin is accepted — including lookalikes", () => {
  for (const candidate of [
    "https://evil.example",
    "https://guard.acme-corp.example.evil.example",
    "https://guard-acme-corp.example",
    "https://guard.acme-corp.example@evil.example",
    "https://sub.guard.acme-corp.example",
  ]) {
    const result = normalizeEndpoint(candidate, { pinnedOrigin: TRUSTED });
    assert.equal(result.allowed, false, candidate);
  }
  assert.equal(normalizeEndpoint(TRUSTED, { pinnedOrigin: TRUSTED }).allowed, true);
});

test("EP-211: a path can never escape the trusted origin", () => {
  assert.equal(
    buildTrustedUrl(TRUSTED, "/api/extension/policy?organizationId=org-alpha").toString(),
    "https://guard.acme-corp.example/api/extension/policy?organizationId=org-alpha",
  );
  for (const path of ["https://evil.example/api/x", "//evil.example/api/x", "\\\\evil.example/api/x"]) {
    assert.throws(() => buildTrustedUrl(TRUSTED, path), /different origin|refused/, path);
  }
  // Traversal resolves inside the origin rather than off it.
  assert.equal(buildTrustedUrl(TRUSTED, "/api/../../etc/passwd").origin, TRUSTED);
});

test("EP-212: assertTrustedEndpoint throws rather than returning an untrusted origin", () => {
  assert.equal(assertTrustedEndpoint(TRUSTED), TRUSTED);
  assert.throws(() => assertTrustedEndpoint("http://evil.example"), /refused/);
  assert.throws(() => assertTrustedEndpoint("https://evil.example", TRUSTED), /pinned origin/);
});

/* ── The enforcement point: the API client ───────────────────────────────── */

test("EP-220: a poisoned apiBaseUrl cannot send the device token to another origin", async () => {
  const attempts: Attempt[] = [];
  const restore = spyFetch(attempts);
  try {
    // Storage has been poisoned after enrollment, but the pin still says otherwise.
    const client = new SoterExtensionApiClient(config({
      apiBaseUrl: "https://evil.example",
      pinnedApiOrigin: TRUSTED,
    }));
    await assert.rejects(() => client.fetchPolicy(), /pinned origin/);
    await assert.rejects(() => client.heartbeat({ organizationId: "org-alpha", employeeId: "e1" } as never), /pinned origin/);
    await assert.rejects(() => client.audit({ organizationId: "org-alpha", eventType: "scan" } as never), /pinned origin/);
    assert.equal(attempts.length, 0, "no request may leave the extension at all");
  } finally {
    restore();
  }
});

test("EP-221: every request is re-anchored onto the trusted origin and carries no cookies", async () => {
  const attempts: Attempt[] = [];
  const restore = spyFetch(attempts);
  try {
    const client = new SoterExtensionApiClient(config({ pinnedApiOrigin: TRUSTED }));
    await client.fetchPolicy();
    await client.fetchDestinations();
    await client.fetchSourceApps();
    await client.scan({ url: "https://chatgpt.com/c/abc", result: {
      hasFindings: false, riskScore: 0, detectedDataTypes: [], findings: [],
      action: "allow", policy: { action: "allow", matchedRules: [], riskScore: 0 },
      redactedText: "", rewrittenSafeText: "", scannedAt: new Date(0).toISOString(),
    } as never });
    assert.equal(attempts.length, 4);
    for (const attempt of attempts) {
      assert.ok(attempt.url.startsWith(`${TRUSTED}/api/extension/`), attempt.url);
      assert.equal(attempt.init.credentials, "omit");
      assert.equal(attempt.init.redirect, "error", "a redirect must not be able to move the token");
      const headers = attempt.init.headers as Record<string, string>;
      assert.equal(headers["x-soter-extension-token"], "soter_device_TOP_SECRET");
    }
  } finally {
    restore();
  }
});

test("EP-222: an unpinned profile still refuses http, IP-literal and credential endpoints", async () => {
  const attempts: Attempt[] = [];
  const restore = spyFetch(attempts);
  try {
    for (const apiBaseUrl of ["http://evil.example", "https://203.0.113.10", "https://guard.acme-corp.example@evil.example"]) {
      const client = new SoterExtensionApiClient(config({ apiBaseUrl }));
      await assert.rejects(() => client.fetchPolicy(), /refused|Invalid/, apiBaseUrl);
    }
    assert.equal(attempts.length, 0);
  } finally {
    restore();
  }
});

test("EP-223: the query string the client builds survives re-anchoring", async () => {
  const attempts: Attempt[] = [];
  const restore = spyFetch(attempts);
  try {
    await new SoterExtensionApiClient(config({ pinnedApiOrigin: TRUSTED })).fetchFingerprintBundle();
    assert.equal(
      attempts[0].url,
      `${TRUSTED}/api/extension/fingerprint-bundle?organizationId=org-alpha`,
    );
  } finally {
    restore();
  }
});
