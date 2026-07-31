/**
 * SS-2 adversarial tests for the enrollment trust boundary.
 *
 * `enrollWithCode` used to store `data.apiBaseUrl` — the origin returned by whatever
 * server answered the enrollment POST:
 *
 *     apiBaseUrl: typeof data.apiBaseUrl === "string" ? data.apiBaseUrl : apiBaseUrl,
 *
 * That single line let the first responder permanently rebind every later policy fetch,
 * audit event, scan event and heartbeat — and with them the `x-soter-extension-token`
 * device token. EN-3xx tests are the attacks; the last group proves normal enrollment,
 * managed enrollment and unenrollment still behave.
 */
import test from "node:test";
import assert from "node:assert/strict";
import {
  enrollFromManagedConfig,
  enrollWithCode,
  parseManagedTrustedKeys,
  unenroll,
} from "../../apps/extension/src/lib/enrollment";
import { getState, setState } from "../../apps/extension/src/lib/storage";

const storage = new Map<string, unknown>();
let managedConfig: Record<string, unknown> | null = null;

// Assigned before any test body runs. `storage.ts` and `enrollment.ts` only touch
// `chrome` from inside functions, so a module-scope stub is enough.
(globalThis as unknown as { chrome: unknown }).chrome = {
  storage: {
    local: {
      async get(keys: string[]) {
        return Object.fromEntries(keys.map((key) => [key, storage.get(key)]));
      },
      async set(items: Record<string, unknown>) {
        for (const [key, value] of Object.entries(items)) storage.set(key, value);
      },
      remove(keys: string[]) {
        for (const key of keys) storage.delete(key);
      },
    },
    managed: {
      get(_keys: unknown, callback: (result: Record<string, unknown>) => void) {
        callback(managedConfig ?? {});
      },
    },
  },
  runtime: { sendMessage() {} },
};

const OPERATOR_ORIGIN = "https://guard.acme-corp.example";
const ATTACKER_ORIGIN = "https://evil.example";

interface Attempt { url: string; init: RequestInit }

/**
 * Stubs the enrollment endpoint. `serverApiBaseUrl` is what a hostile or misconfigured
 * server tries to talk the extension into adopting as its permanent control plane.
 */
function stubEnrollServer(attempts: Attempt[], body: Record<string, unknown> = {}) {
  const original = globalThis.fetch;
  globalThis.fetch = (async (input: unknown, init: RequestInit = {}) => {
    attempts.push({ url: String(input), init });
    return {
      ok: true,
      status: 200,
      json: async () => ({
        organizationId: "org-alpha",
        organizationName: "Acme Corp",
        employeeId: "employee-1",
        employeeEmail: "employee@acme-corp.example",
        deviceToken: "soter_device_TOP_SECRET",
        ...body,
      }),
    } as unknown as Response;
  }) as typeof globalThis.fetch;
  return () => { globalThis.fetch = original; };
}

async function reset() {
  storage.clear();
  managedConfig = null;
}

/* ── The rebinding attack ────────────────────────────────────────────────── */

test("EN-301: a server-supplied apiBaseUrl cannot rebind the control plane", async () => {
  await reset();
  const attempts: Attempt[] = [];
  const restore = stubEnrollServer(attempts, { apiBaseUrl: ATTACKER_ORIGIN });
  try {
    const result = await enrollWithCode(OPERATOR_ORIGIN, "CODE-123");
    assert.equal(result.ok, true);
    const state = await getState();
    assert.equal(state.config.apiBaseUrl, OPERATOR_ORIGIN, "the operator origin is the only authority");
    assert.equal(state.config.pinnedApiOrigin, OPERATOR_ORIGIN, "first enrollment must pin");
    assert.equal(JSON.stringify(state.config).includes("evil.example"), false);
  } finally {
    restore();
  }
});

test("EN-302: once pinned, enrolling against a different origin is refused before any request", async () => {
  await reset();
  await setState({ config: { pinnedApiOrigin: OPERATOR_ORIGIN } as never });
  const attempts: Attempt[] = [];
  const restore = stubEnrollServer(attempts);
  try {
    const result = await enrollWithCode(ATTACKER_ORIGIN, "CODE-123");
    assert.equal(result.ok, false);
    assert.match((result as { error: string }).error, /pinned origin/);
    assert.equal(attempts.length, 0, "the enrollment code must not be sent to an unpinned host");
    const state = await getState();
    assert.equal(state.config.pinnedApiOrigin, OPERATOR_ORIGIN);
  } finally {
    restore();
  }
});

test("EN-303: an untrusted endpoint is refused before the enrollment code leaves the device", async () => {
  await reset();
  const attempts: Attempt[] = [];
  const restore = stubEnrollServer(attempts);
  try {
    for (const endpoint of [
      "http://guard.acme-corp.example",
      "https://203.0.113.10",
      "https://guard.acme-corp.example@evil.example",
      "https://xn--80ak6aa92e.example",
      "javascript:alert(1)",
      "",
    ]) {
      const result = await enrollWithCode(endpoint, "CODE-123");
      assert.equal(result.ok, false, endpoint);
    }
    assert.equal(attempts.length, 0);
    assert.equal((await getState()).enrollmentStatus, "unenrolled");
  } finally {
    restore();
  }
});

test("EN-304: enrollment posts to the canonical origin with no cookies and no redirects", async () => {
  await reset();
  const attempts: Attempt[] = [];
  const restore = stubEnrollServer(attempts);
  try {
    // Mixed case, trailing dot and a trailing slash all canonicalise to one origin.
    const result = await enrollWithCode("https://GUARD.Acme-Corp.Example./", "CODE-123");
    assert.equal(result.ok, true);
    assert.equal(attempts.length, 1);
    assert.equal(attempts[0].url, `${OPERATOR_ORIGIN}/api/extension/enroll`);
    assert.equal(attempts[0].init.credentials, "omit");
    assert.equal(attempts[0].init.redirect, "error");
    assert.equal((await getState()).config.pinnedApiOrigin, OPERATOR_ORIGIN);
  } finally {
    restore();
  }
});

test("EN-305: a self-service re-enrollment cannot downgrade enterprise enforcement", async () => {
  await reset();
  await setState({
    config: {
      hardEnforcement: true,
      offlineFailClosed: true,
      requirePolicySignature: true,
      policyTrustedKeys: [{ keyId: "k1", algorithm: "ecdsa-p256-sha256", publicKey: "AAAA" }],
    } as never,
  });
  const attempts: Attempt[] = [];
  const restore = stubEnrollServer(attempts, {
    // A hostile control plane trying to talk the client out of its own enforcement.
    hardEnforcement: false,
    offlineFailClosed: false,
    requirePolicySignature: false,
    policyTrustedKeys: [],
  });
  try {
    assert.equal((await enrollWithCode(OPERATOR_ORIGIN, "CODE-123")).ok, true);
    const config = (await getState()).config;
    assert.equal(config.hardEnforcement, true);
    assert.equal(config.offlineFailClosed, true);
    assert.equal(config.requirePolicySignature, true);
    assert.equal(config.policyTrustedKeys?.[0].keyId, "k1");
  } finally {
    restore();
  }
});

test("EN-306: unenroll clears the device token and the pin but keeps the trust ratchet", async () => {
  await reset();
  const restore = stubEnrollServer([]);
  try {
    await enrollWithCode(OPERATOR_ORIGIN, "CODE-123");
  } finally {
    restore();
  }
  await setState({ policyTrust: { signedBundleSeen: true, lastAcceptedIssuedAt: "2026-07-31T00:00:00.000Z" } });
  await unenroll();
  const state = await getState();
  assert.equal(state.config.deviceToken, undefined, "a stale device token must not survive unenrollment");
  assert.equal(state.config.pinnedApiOrigin, undefined, "unenroll is the only way to release the pin");
  assert.equal(state.config.organizationName, undefined);
  assert.equal(state.enrollmentStatus, "unenrolled");
  assert.equal(state.policyTrust?.signedBundleSeen, true,
    "an unenroll/re-enroll cycle must not become a way back to accepting unsigned policy");
  assert.equal(state.policyIntegrity, undefined);
});

/* ── Managed (enterprise policy) enrollment ──────────────────────────────── */

test("EN-307: a managed endpoint that fails validation refuses enrollment, never falls back", async () => {
  await reset();
  const attempts: Attempt[] = [];
  const restore = stubEnrollServer(attempts);
  try {
    for (const apiBaseUrl of ["http://guard.acme-corp.example", "https://203.0.113.10", "not-a-url"]) {
      managedConfig = { organizationId: "org-alpha", apiBaseUrl };
      const info = await enrollFromManagedConfig();
      assert.equal(info.status, "unenrolled", apiBaseUrl);
      assert.equal(info.managedValid, false, apiBaseUrl);
      assert.ok(info.endpointError, apiBaseUrl);
      // Silently using the public cloud endpoint would send a regulated org's telemetry
      // to the wrong control plane.
      assert.equal((await getState()).config.apiBaseUrl.includes("203.0.113.10"), false);
      assert.equal((await getState()).enrollmentStatus, "unenrolled", apiBaseUrl);
    }
  } finally {
    restore();
  }
});

test("EN-308: managed enrollment pins its endpoint and applies enterprise enforcement", async () => {
  await reset();
  managedConfig = {
    organizationId: "org-alpha",
    apiBaseUrl: `${OPERATOR_ORIGIN}/`,
    email: "employee@acme-corp.example",
    hardEnforcement: true,
    offlineFailClosed: true,
    requirePolicySignature: true,
    policyTrustedKeys: [
      { keyId: "k1", algorithm: "ecdsa-p256-sha256", publicKey: "AAAA" },
      { keyId: "no-algorithm", publicKey: "BBBB" },
      { keyId: "bad-algorithm", algorithm: "md5", publicKey: "CCCC" },
      { algorithm: "ecdsa-p256-sha256", publicKey: "DDDD" },
      "not-an-object",
    ],
  };
  const info = await enrollFromManagedConfig();
  assert.equal(info.status, "enrolled");
  const config = (await getState()).config;
  assert.equal(config.apiBaseUrl, OPERATOR_ORIGIN);
  assert.equal(config.pinnedApiOrigin, OPERATOR_ORIGIN);
  assert.equal(config.hardEnforcement, true);
  assert.equal(config.offlineFailClosed, true);
  assert.equal(config.requirePolicySignature, true);
  assert.deepEqual(config.policyTrustedKeys, [{ keyId: "k1", algorithm: "ecdsa-p256-sha256", publicKey: "AAAA" }]);
});

test("EN-309: a trusted key is never accepted without an explicit known algorithm", () => {
  assert.equal(parseManagedTrustedKeys(undefined), undefined);
  assert.equal(parseManagedTrustedKeys("keys"), undefined);
  assert.equal(parseManagedTrustedKeys([{ keyId: "k", publicKey: "p" }]), undefined);
  assert.equal(parseManagedTrustedKeys([{ keyId: "k", algorithm: "none", publicKey: "p" }]), undefined);
  assert.equal(parseManagedTrustedKeys([{ keyId: "  ", algorithm: "ecdsa-p256-sha256", publicKey: "p" }]), undefined);
  assert.deepEqual(
    parseManagedTrustedKeys([{ keyId: " k ", algorithm: "hmac-sha256", publicKey: " p " }]),
    [{ keyId: "k", algorithm: "hmac-sha256", publicKey: "p" }],
  );
});

test("EN-310: managed config without an endpoint uses the built-in default and pins it", async () => {
  await reset();
  managedConfig = { organizationId: "org-alpha", email: "employee@acme-corp.example" };
  const info = await enrollFromManagedConfig();
  assert.equal(info.status, "enrolled");
  const config = (await getState()).config;
  assert.ok(config.pinnedApiOrigin?.startsWith("https://"));
  assert.equal(config.pinnedApiOrigin, config.apiBaseUrl);
  assert.equal(config.hardEnforcement, false);
  assert.equal(config.requirePolicySignature, false);
});

