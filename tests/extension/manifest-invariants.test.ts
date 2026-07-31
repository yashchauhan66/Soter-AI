/**
 * SS-5 / SS-10 invariant tests for the shipped manifests and the managed-policy schema.
 *
 * These are the two controls that cannot be proven by exercising code, because they are
 * declarations the *browser* enforces:
 *
 *  - SS-5: the hardened `extension_pages` CSP. MV3's implicit default already forbids remote
 *    script and `eval`, but an implicit default is not an enforced control — a later manifest
 *    edit relaxes it silently. `scripts/validate-store-manifest.mjs` fails the build if the
 *    policy is missing or weakened; these tests fail the *test suite* for the same reasons,
 *    so a regression is caught without waiting for a packaged build.
 *  - SS-10: Chrome/Edge managed storage only surfaces properties that appear in
 *    `managed-schema.json`. Every field the code reads out of managed config must therefore be
 *    declared, or the enterprise control channel silently does nothing. `hardEnforcement` and
 *    `offlineFailClosed` were both read and both undeclared at HEAD 30e89459.
 *
 * Also frozen here: the absence of `externally_connectable` and `web_accessible_resources`.
 * The runtime message guard's threat model depends on web pages not being able to reach
 * `chrome.runtime.sendMessage` at all, which is true only while those keys stay absent.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

const MANIFESTS = [
  ["store", "apps/extension/manifest.json"],
  ["dev", "apps/extension/manifest.dev.json"],
] as const;

const SCHEMA_PATH = "apps/extension/managed-schema.json";
const ENROLLMENT_SOURCE = "apps/extension/src/lib/enrollment.ts";

interface Manifest {
  manifest_version?: number;
  permissions?: string[];
  optional_permissions?: string[];
  host_permissions?: string[];
  content_scripts?: Array<{ matches?: string[]; js?: string[]; all_frames?: boolean }>;
  content_security_policy?: { extension_pages?: string; sandbox?: string };
  externally_connectable?: unknown;
  web_accessible_resources?: unknown;
  sandbox?: unknown;
  storage?: { managed_schema?: string };
}

function manifest(path: string): Manifest {
  return JSON.parse(readFileSync(path, "utf8"));
}

function directives(csp: string) {
  return new Map(
    csp.split(";").map((part) => part.trim()).filter(Boolean).map((part) => {
      const [name, ...values] = part.split(/\s+/);
      return [name.toLowerCase(), values.join(" ")] as const;
    }),
  );
}

/* ── SS-5: the CSP is declared, hardened, and identical in both builds ────── */

test("MF-501: both manifests declare the hardened extension_pages CSP", () => {
  const REQUIRED = [
    ["script-src", ["'self'"]],
    ["object-src", ["'self'", "'none'"]],
    ["base-uri", ["'none'", "'self'"]],
    ["form-action", ["'none'", "'self'"]],
  ] as const;
  for (const [label, path] of MANIFESTS) {
    const csp = manifest(path).content_security_policy?.extension_pages;
    assert.equal(typeof csp, "string", `${label}: extension_pages CSP must be declared explicitly`);
    const parsed = directives(csp!);
    for (const [directive, accepted] of REQUIRED) {
      const value = parsed.get(directive);
      assert.ok(value !== undefined, `${label}: CSP is missing ${directive}`);
      assert.ok(accepted.includes(value!.trim() as never), `${label}: ${directive} ${value} is not one of ${accepted.join(", ")}`);
    }
  }
});

test("MF-502: no manifest CSP token may weaken the MV3 default", () => {
  for (const [label, path] of MANIFESTS) {
    const csp = JSON.stringify(manifest(path).content_security_policy ?? {});
    for (const token of ["unsafe-eval", "'unsafe-inline'", "wasm-unsafe-eval", "http:", "data:", "https://"]) {
      assert.equal(csp.includes(token), false, `${label}: CSP must not contain ${token} (found in ${csp})`);
    }
  }
});

test("MF-503: the dev build does not relax anything the store build hardens", () => {
  // A dev-only CSP relaxation is how a hardened store manifest ends up untested.
  const store = manifest("apps/extension/manifest.json");
  const dev = manifest("apps/extension/manifest.dev.json");
  assert.equal(
    dev.content_security_policy?.extension_pages,
    store.content_security_policy?.extension_pages,
    "the dev manifest must be tested against the same CSP that ships",
  );
  assert.deepEqual(dev.permissions, store.permissions, "dev must not grant extra API permissions");
});

test("MF-504: the extension pages load only local module scripts (the CSP would break otherwise)", () => {
  for (const page of ["apps/extension/src/popup/index.html", "apps/extension/src/sidepanel/index.html"]) {
    const html = readFileSync(page, "utf8");
    const scripts = html.match(/<script\b[^>]*>/gi) ?? [];
    assert.ok(scripts.length > 0, `${page}: expected at least one script tag`);
    for (const tag of scripts) {
      assert.match(tag, /src="\.\/[\w./-]+\.js"/, `${page}: inline script is refused by script-src 'self': ${tag}`);
      assert.equal(/src="(https?:)?\/\//.test(tag), false, `${page}: remote script ${tag}`);
    }
    // An inline handler would also be refused by script-src 'self'.
    assert.equal(/\son[a-z]+\s*=/.test(html), false, `${page}: inline event handler attribute found`);
  }
});

/* ── The message boundary depends on these keys staying absent ────────────── */

test("MF-505: no manifest exposes the extension to web pages or other extensions", () => {
  for (const [label, path] of MANIFESTS) {
    const parsed = manifest(path);
    assert.equal("externally_connectable" in parsed, false,
      `${label}: externally_connectable makes chrome.runtime reachable from web pages; the message-guard threat model assumes it is absent`);
    assert.equal("web_accessible_resources" in parsed, false,
      `${label}: a web-accessible resource is a page-reachable surface and makes the extension id probeable`);
    assert.equal("sandbox" in parsed, false, `${label}: unused sandbox section must not be declared`);
    assert.equal(parsed.optional_permissions?.length ?? 0, 0, `${label}: optional_permissions must stay empty until something gates on them`);
  }
});

test("MF-506: permissions stay least-privilege and every host is https", () => {
  // Adding a permission here must be a deliberate act that also updates
  // docs/SOTERAI-BROWSER-GUARD-SUPREMACY-REPORT.md and the store justification doc.
  const ALLOWED = ["contextMenus", "sidePanel", "storage", "alarms"];
  const FORBIDDEN = ["tabs", "webRequest", "webRequestBlocking", "debugger", "management", "cookies", "history", "downloads", "scripting", "declarativeNetRequest", "proxy", "nativeMessaging", "<all_urls>"];
  for (const [label, path] of MANIFESTS) {
    const parsed = manifest(path);
    assert.deepEqual([...(parsed.permissions ?? [])].sort(), [...ALLOWED].sort(), `${label}: permission set changed`);
    for (const forbidden of FORBIDDEN) {
      assert.equal((parsed.permissions ?? []).includes(forbidden), false, `${label}: ${forbidden} must not be requested`);
    }
    for (const host of parsed.host_permissions ?? []) {
      assert.equal(host === "<all_urls>" || host === "*://*/*", false, `${label}: broad host ${host}`);
      assert.equal(host.startsWith("*://"), false, `${label}: wildcard scheme ${host} allows http`);
    }
    // Content scripts may never run somewhere the manifest has not declared a host for.
    const hosts = new Set(parsed.host_permissions ?? []);
    for (const script of parsed.content_scripts ?? []) {
      for (const match of script.matches ?? []) {
        assert.ok(hosts.has(match), `${label}: content script matches ${match} with no matching host_permission`);
      }
    }
  }
  // Only the store build must be https-only; the dev manifest intentionally adds localhost
  // for the bounded local test server and is excluded from the store package.
  for (const host of manifest("apps/extension/manifest.json").host_permissions ?? []) {
    assert.ok(host.startsWith("https://"), `store build: non-https host ${host}`);
    assert.equal(/localhost|127\.0\.0\.1|0\.0\.0\.0/.test(host), false, `store build: dev host ${host}`);
  }
});

/* ── SS-10: every managed field the code reads must be declarable ─────────── */

test("MF-510: managed_schema is declared and present", () => {
  for (const [label, path] of MANIFESTS) {
    assert.equal(manifest(path).storage?.managed_schema, "managed-schema.json", `${label}: managed_schema not declared`);
  }
  assert.ok(existsSync(SCHEMA_PATH), `${SCHEMA_PATH} must exist or managed policy silently does nothing`);
});

test("MF-511: every managed field the code reads is declared in managed-schema.json", () => {
  const schema = JSON.parse(readFileSync(SCHEMA_PATH, "utf8")) as { type?: string; properties?: Record<string, unknown> };
  assert.equal(schema.type, "object");
  const declared = new Set(Object.keys(schema.properties ?? {}));

  // Derived from the source rather than hard-coded, so a newly read field that nobody
  // declared fails this test instead of failing silently in the field.
  const source = readFileSync(ENROLLMENT_SOURCE, "utf8");
  const read = new Set(Array.from(source.matchAll(/\bmanaged\.([A-Za-z_][A-Za-z0-9_]*)/g), (match) => match[1]));
  assert.ok(read.size >= 10, `expected to find managed field reads in ${ENROLLMENT_SOURCE}, found ${read.size}`);
  for (const field of read) {
    assert.ok(declared.has(field), `managed config reads "${field}" but managed-schema.json does not declare it (an admin cannot set it)`);
  }

  // The four enforcement fields are the SS-10 regression: they were read and undeclared.
  for (const field of ["hardEnforcement", "offlineFailClosed", "requirePolicySignature", "policyTrustedKeys"]) {
    assert.ok(declared.has(field), `${field} must be settable by an enterprise administrator`);
    assert.ok(read.has(field), `${field} is declared but no longer read — remove it or wire it back`);
  }
});

test("MF-512: the schema's signing algorithms are exactly the ones the parser accepts", () => {
  const schema = JSON.parse(readFileSync(SCHEMA_PATH, "utf8")) as {
    properties?: { policyTrustedKeys?: { type?: string; items?: { properties?: { algorithm?: { enum?: string[] }; publicKey?: unknown; keyId?: unknown } } } };
  };
  const keys = schema.properties?.policyTrustedKeys;
  assert.equal(keys?.type, "array");
  const item = keys?.items?.properties;
  for (const field of ["keyId", "algorithm", "publicKey"] as const) {
    assert.ok(item?.[field], `policyTrustedKeys items must declare ${field}`);
  }
  // An algorithm an admin can push but `parseManagedTrustedKeys` silently drops is a
  // configuration trap; one the parser accepts but the schema omits is undeliverable.
  const accepted = Array.from(
    readFileSync(ENROLLMENT_SOURCE, "utf8").matchAll(/algorithm !== "([a-z0-9-]+)"/g),
    (match) => match[1],
  ).sort();
  assert.deepEqual([...(item?.algorithm?.enum ?? [])].sort(), accepted, "schema enum and parser allowlist disagree");
  assert.ok(accepted.includes("ecdsa-p256-sha256"), "the asymmetric algorithm must remain accepted");
});

test("MF-513: booleans default to the safe (off) value so an unset policy cannot imply enforcement", () => {
  const schema = JSON.parse(readFileSync(SCHEMA_PATH, "utf8")) as {
    properties?: Record<string, { type?: string; default?: unknown }>;
  };
  for (const field of ["hardEnforcement", "offlineFailClosed", "requirePolicySignature"]) {
    const property = schema.properties?.[field];
    assert.equal(property?.type, "boolean", `${field} must be a boolean`);
    assert.equal(property?.default, false, `${field} must default to false — enforcement is opt-in and explicit`);
  }
});
