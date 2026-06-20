import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function read(rel: string) {
  return readFileSync(rel, "utf8");
}

test("Feature7 canary: API routes require canary auth guards", () => {
  const tokens = read("app/api/canary/tokens/route.ts");
  assert.match(tokens, /authenticateAgentFirewall\(/);

  const leaks = read("app/api/canary/leaks/route.ts");
  assert.match(leaks, /authenticateAgentFirewall\(/);

  const disable = read("app/api/canary/[id]/disable/route.ts");
  assert.match(disable, /authenticateAgentFirewall\(/);
  assert.match(disable, /readAgentJson\(/);
});

test("Feature7 canary: canary check persists redacted leak events (no raw token/hash stored in CanaryLeakEvent)", () => {
  const check = read("app/api/canary/check/route.ts");

  // Must insert dedicated leak events
  assert.match(check, /INSERT INTO\s+"CanaryLeakEvent"/);

  // Must sanitize content before persistence
  assert.match(check, /contentRedacted[\s\S]*sanitizeLogText\(body\.content\)/);

  // Must not store tokenHash or a raw canary token into the dedicated leak event.
  const leakInsert = check.match(/INSERT INTO\s+"CanaryLeakEvent"[\s\S]+?`;/)?.[0] ?? "";
  assert.match(leakInsert, /contentRedacted/);
  assert.doesNotMatch(leakInsert, /tokenHash/i);
  assert.doesNotMatch(leakInsert, /canaryToken\b/i);
});

test("Feature7 canary: list tokens route does not expose tokenHash", () => {
  const tokens = read("app/api/canary/tokens/route.ts");
  assert.match(tokens, /SELECT\s+"id",\s*"tokenLabel",\s*"scope",\s*"active"/);
  assert.doesNotMatch(tokens, /tokenHash/i);
});

test("Feature7 canary: list leaks route returns redacted content only", () => {
  const leaks = read("app/api/canary/leaks/route.ts");
  assert.match(leaks, /contentRedacted/);
  assert.doesNotMatch(leaks, /tokenHash/i);
});

test("Feature7 canary: disable route is tenant/project scoped fail-closed", () => {
  const disable = read("app/api/canary/[id]/disable/route.ts");
  assert.match(disable, /WHERE\s+"projectId"\s*=\s*\$\{authenticated\.auth\.project\.id\}\s*AND\s+"id"\s*=\s*\$\{canaryId\}/);
});
