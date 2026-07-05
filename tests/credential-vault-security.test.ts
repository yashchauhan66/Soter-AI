import assert from "node:assert/strict";
import test from "node:test";

import { resolveCredentialVaultKeyMaterial } from "../lib/credentials/vault";

const API_KEY_PEPPER = "api-key-pepper-that-is-longer-than-thirty-two-characters";
const NEXTAUTH_SECRET = "nextauth-secret-that-is-longer-than-thirty-two-characters";
const AUTH_SECRET = "auth-secret-that-is-longer-than-thirty-two-characters";

test("P0-01: credential vault fails closed when encryption key material is missing", () => {
  assert.throws(
    () => resolveCredentialVaultKeyMaterial({}),
    /credential vault encryption key material/i,
  );
});

test("P0-01: credential vault rejects short and placeholder key material", () => {
  assert.throws(
    () => resolveCredentialVaultKeyMaterial({ API_KEY_PEPPER: "too-short" }),
    /at least 32 characters/i,
  );
  assert.throws(
    () => resolveCredentialVaultKeyMaterial({ API_KEY_PEPPER: "replace-with-a-long-random-secret" }),
    /placeholder/i,
  );
});

test("P0-01: credential vault preserves legacy key-source precedence", () => {
  assert.equal(
    resolveCredentialVaultKeyMaterial({ API_KEY_PEPPER, NEXTAUTH_SECRET, AUTH_SECRET }),
    API_KEY_PEPPER,
  );
  assert.equal(
    resolveCredentialVaultKeyMaterial({ NEXTAUTH_SECRET, AUTH_SECRET }),
    NEXTAUTH_SECRET,
  );
  assert.equal(resolveCredentialVaultKeyMaterial({ AUTH_SECRET }), AUTH_SECRET);
});

test("P0-01: credential vault does not silently skip an invalid higher-priority key", () => {
  assert.throws(
    () => resolveCredentialVaultKeyMaterial({ API_KEY_PEPPER: "short", NEXTAUTH_SECRET }),
    /API_KEY_PEPPER.*at least 32 characters/i,
  );
});
