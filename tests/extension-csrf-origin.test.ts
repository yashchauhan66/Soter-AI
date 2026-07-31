/**
 * CSRF origin-guard tests for lib/csrf.ts, with a regression test for the
 * Microsoft Edge Add-ons certification failure ("Invalid origin." on extension API).
 *
 * The browser extension calls POST /api/extension/* with an Origin header like
 * "chrome-extension://<id>" (or moz-extension:// / safari-web-extension://).
 * Those routes authenticate via the x-soter-extension-token / x-api-key header,
 * NOT a session cookie, so they are exempt from CSRF origin validation.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { enforceCsrfOrigin } from "../lib/csrf";

const CANONICAL = "https://app.soterai.in";

function post(url: string, headers: Record<string, string> = {}): Request {
  return new Request(url, { method: "POST", headers });
}

test("csrf: allows safe methods regardless of origin", () => {
  process.env.NEXTAUTH_URL = CANONICAL;
  const req = new Request(`${CANONICAL}/api/extension/policy`, { method: "GET" });
  assert.equal(enforceCsrfOrigin(req), null);
});

test("csrf: rejects a cross-origin POST on a session-cookie route (not exempt)", async () => {
  process.env.NEXTAUTH_URL = CANONICAL;
  const req = post(`${CANONICAL}/api/account/settings`, { origin: "https://evil.example" });
  const res = enforceCsrfOrigin(req);
  assert.ok(res, "should block cross-origin mutation");
  assert.equal(res.status, 403);
  assert.match(await res.text(), /Invalid origin/i);
});

test("csrf: allows a same-origin POST on a session-cookie route", () => {
  process.env.NEXTAUTH_URL = CANONICAL;
  const req = post(`${CANONICAL}/api/account/settings`, { origin: CANONICAL });
  assert.equal(enforceCsrfOrigin(req), null);
});

test("regression: extension enroll is allowed from a chrome-extension origin", () => {
  process.env.NEXTAUTH_URL = CANONICAL;
  const req = post(`${CANONICAL}/api/extension/enroll`, { origin: "chrome-extension://abcdefgh" });
  assert.equal(enforceCsrfOrigin(req), null);
});

test("regression: all extension mutation routes are exempt from origin check", () => {
  process.env.NEXTAUTH_URL = CANONICAL;
  for (const path of [
    "/api/extension/heartbeat",
    "/api/extension/scan",
    "/api/extension/fingerprint-match",
    "/api/extension/audit-log",
    "/api/extension/lineage-event",
    "/api/extension/approval-request",
    "/api/extension/file-scan-event",
    "/api/extension/enroll",
  ]) {
    const req = post(`${CANONICAL}${path}`, { origin: "chrome-extension://someid" });
    assert.equal(enforceCsrfOrigin(req), null, `${path} should be CSRF-exempt`);
  }
});

test("regression: moz-extension and safari-web-extension origins are also exempt", () => {
  process.env.NEXTAUTH_URL = CANONICAL;
  assert.equal(enforceCsrfOrigin(post(`${CANONICAL}/api/extension/heartbeat`, { origin: "moz-extension://xyz" })), null);
  assert.equal(enforceCsrfOrigin(post(`${CANONICAL}/api/extension/heartbeat`, { origin: "safari-web-extension://xyz" })), null);
});
