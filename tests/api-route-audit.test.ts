import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { PUBLIC_API_PREFIXES } from "../auth.config";

const API_ROOT = path.join("app", "api");

function routeFiles(dir = API_ROOT): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) return routeFiles(fullPath);
    return entry.name === "route.ts" ? [fullPath.replaceAll(path.sep, "/")] : [];
  });
}

function routeId(file: string) {
  return file.replace(/^app\/api/, "/api").replace(/\/route\.ts$/, "");
}

function hasAny(source: string, patterns: RegExp[]) {
  return patterns.some((pattern) => pattern.test(source));
}

const publicRoutes = new Map<string, RegExp[]>([
  ["/api/health", [/jsonResponse/]],
  ["/api/openapi", [/jsonResponse/]],
  ["/api/ready", [/SELECT 1/]],
  ["/api/badge", [/force-static/]],
  ["/api/badge/[slug]", [/loadBadgeStatus/]],
  ["/api/auth/signup", [/enforcePublicRateLimit/, /schema\.parse/]],
  ["/api/auth/request-password-reset", [/enforcePublicRateLimit|checkRedisRateLimit/, /z\.object[\s\S]*\.parse/]],
  ["/api/auth/reset-password", [/enforcePublicRateLimit|checkRedisRateLimit/, /z\.object[\s\S]*\.parse/]],
  ["/api/auth/verify-email", [/enforcePublicRateLimit|checkRedisRateLimit/, /z\.object[\s\S]*\.parse/]],
  ["/api/auth/send-otp", [/enforcePublicRateLimit/, /z\.object[\s\S]*\.parse/]],
  ["/api/auth/verify-otp", [/enforcePublicRateLimit/, /z\.object[\s\S]*\.parse/]],
  ["/api/auth/[...nextauth]", [/handlers/, /GET/, /POST/]],
  ["/api/billing/webhook", [/verifyRazorpayWebhook/, /request\.text\(\)/]],
  ["/api/guard/analyze", [/checkRedisRateLimit/, /analyzeSchema\.parse/]],
  ["/api/sso/saml/login", [/safeCallbackUrl/, /buildAuthnRequest/]],
  ["/api/sso/saml/metadata", [/buildSpMetadata/, /application\/xml/]],
  ["/api/sso/saml/acs", [/validateSamlResponse|parseSamlResponse|signIn/]],
  ["/api/sso/saml/test", [/requireOrganizationAccess|requirePermission/]],
  ["/api/scim/v2/ServiceProviderConfig", [/schemas|ServiceProviderConfig/]],
  ["/api/scim/v2/Schemas", [/schemas|ResourceType/]],
  ["/api/scim/v2/ResourceTypes", [/schemas|ResourceType/]],
  ["/api/ops/contact", [/enforcePublicRateLimit|recordProductEvent|contact/i, /schema\.parse|z\.object/]],
  ["/api/ops/pilot", [/enforcePublicRateLimit/, /schema\.parse/]],
  ["/api/docs/track", [/request\.json\(\)/, /recordProductEvent/]],
  ["/api/ai-assistant", [/enforcePublicRateLimit/]],
  ["/api/scanner", [/enforcePublicRateLimit/, /request\.json\(/]],
  ["/api/scanner/lead", [/enforcePublicRateLimit/, /request\.json\(/]],
  ["/api/mcp/risk/scan", [/enforcePublicRateLimit/, /schema\.parse|readJson\(/]],
  ["/api/mcp/risk/badge", [/image\/svg\+xml/, /mcpRiskBadgeSvg/]],
  ["/api/extension/enroll", [/redeemEnrollmentToken/, /readJson/]],
  ["/api/extension/approval-claim", [/evaluateApprovalClaim/, /readJson/, /authenticateExtensionRequest\(/, /checkRateLimit\(/]],
  ["/api/extension/approval-status/[requestId]", [/agentApproval/, /findUnique/]],
]);

const authPatterns = [
  /requireUser\(/,
  /getActiveOrganization\(/,
  /requireOrganizationAccess\(/,
  /requirePermission\(/,
  /requireProjectAccess\(/,
  /requireProjectPermission\(/,
  /requireAdmin\(/,
  /getCurrentUser\(/,
  /authenticateApiKeyRequest\(/,
  /authenticateAgentFirewall\(/,
  /authenticateAdvancedSecurity\(/,
  /authenticateAgentPassport\(/,
  /authenticateAgentJson\(/,
  /authenticateExtensionRequest\(/,
  /authorizeScimRequest\(/,
  /WEBHOOK_WORKER_TOKEN|REPORT_WORKER_TOKEN/,
];

const validationPatterns = [/z\.object/, /schema\.parse/, /readJson\(/, /readAgentJson\(/, /readAdvancedJson\(/, /readPassportJson\(/, /request\.json\(/, /request\.text\(\)/, /request\.formData\(\)/, /request\.body/];
const rateLimitPatterns = [/checkRedisRateLimit/, /enforcePublicRateLimit/, /rateLimit/i];

test("API route audit inventory classifies every route", () => {
  const files = routeFiles();
  assert.ok(files.length > 40, "route inventory unexpectedly small");

  for (const file of files) {
    const id = routeId(file);
    const source = readFileSync(file, "utf8");
    const publicRequirements = publicRoutes.get(id);

    if (publicRequirements) {
      for (const requirement of publicRequirements) assert.match(source, requirement, id);
      continue;
    }

    if (id.startsWith("/api/admin/")) {
      assert.match(source, /requireAdmin\(|WEBHOOK_WORKER_TOKEN|REPORT_WORKER_TOKEN/, id);
    } else if (id.startsWith("/api/scim/")) {
      assert.match(source, /authorizeScimRequest\(/, id);
    } else {
      assert.ok(hasAny(source, authPatterns), id + " has no recognized auth guard");
    }

    if (
      /export async function (POST|PATCH|PUT|DELETE)\(request: Request/.test(source) &&
      !/WEBHOOK_WORKER_TOKEN|REPORT_WORKER_TOKEN/.test(source)
    ) {
      assert.ok(hasAny(source, validationPatterns), id + " mutation has no recognized validation/body parser");
    }
  }
});

// ── Middleware reachability ──────────────────────────────────────────────────
//
// The NextAuth middleware in auth.config.ts runs before any route handler. A
// route that authenticates with x-api-key has no session cookie to present, so
// if its prefix is missing from PUBLIC_API_PREFIXES the middleware answers
// 401 {"message":"Authentication required."} and the handler is never reached.
// That is not a theoretical gap: /api/semantic-egress was missing, which broke
// the n8n node's universalGuard action for every valid API key while its other
// layers worked. The two tests below pin both directions of the invariant.

const machineAuthPatterns = [
  /authenticateApiKeyRequest\(/,
  /authenticateAgentFirewall\(/,
  /authenticateAdvancedSecurity\(/,
  /authenticateAgentPassport\(/,
  /authenticateAgentJson\(/,
  /authenticateExtensionRequest\(/,
  /authorizeScimRequest\(/,
  /WEBHOOK_WORKER_TOKEN|REPORT_WORKER_TOKEN/,
];

const sessionAuthPatterns = [
  /requireUser\(/,
  /getActiveOrganization\(/,
  /requireOrganizationAccess\(/,
  /requirePermission\(/,
  /requireProjectAccess\(/,
  /requireProjectPermission\(/,
  /requireAdmin\(/,
  /getCurrentUser\(/,
];

// Transcribed from authConfig.callbacks.authorized. If the middleware's matching
// rule changes, change it here too — that divergence is the bug this catches.
function middlewareAllows(pathname: string) {
  const isPublicApi = PUBLIC_API_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
  const isGuardApi = pathname === "/api/guard/input" || pathname === "/api/guard/output" || pathname === "/api/guard/streaming";
  return isPublicApi || isGuardApi;
}

test("every machine-authenticated route is reachable through the middleware", () => {
  const unreachable: string[] = [];
  for (const file of routeFiles()) {
    const id = routeId(file);
    const source = readFileSync(file, "utf8");
    // Only routes with no session path at all: those literally cannot satisfy
    // the middleware, so gating them is an outage rather than a policy.
    if (!hasAny(source, machineAuthPatterns)) continue;
    if (hasAny(source, sessionAuthPatterns)) continue;
    if (!middlewareAllows(id)) unreachable.push(id);
  }
  assert.deepEqual(
    unreachable,
    [],
    `these routes authenticate by API key only but are session-gated by the middleware, so callers get 401 "Authentication required." before the handler runs — add their prefix to PUBLIC_API_PREFIXES`,
  );
});

test("no allowlisted prefix un-gates a session-authenticated route", () => {
  // The other direction: widening a prefix (e.g. "/api/guard" instead of
  // "/api/guard/universal") would drop the session requirement from dashboard
  // routes that rely on the middleware as their outer gate.
  //
  // These prefixes were already broad before this invariant existed, and every
  // route below still enforces its own session guard at the handler (the audit
  // above proves it), so they lose the middleware as defence-in-depth rather
  // than losing authentication. They are enumerated instead of tolerated by
  // pattern so that a *new* one fails this test.
  const knownBroadPrefixExceptions = new Set([
    "/api/agent/behavior",
    "/api/agent-firewall/inspect",
    "/api/cost-firewall/budget",
    "/api/rag/chunks/acl",
    "/api/rag/collections",
    "/api/rag/documents",
    "/api/rag/documents/[id]/rescan",
    "/api/rag/documents/review",
    "/api/rag/query",
    "/api/shadow/scan",
    "/api/sso/saml/test",
  ]);
  const unGated: string[] = [];
  for (const file of routeFiles()) {
    const id = routeId(file);
    const source = readFileSync(file, "utf8");
    if (!hasAny(source, sessionAuthPatterns)) continue;
    if (hasAny(source, machineAuthPatterns)) continue;
    if (middlewareAllows(id) && !knownBroadPrefixExceptions.has(id)) unGated.push(id);
  }
  assert.deepEqual(unGated, [], "these session-authenticated routes are covered by a PUBLIC_API_PREFIXES entry that is too broad");
});

// The two invariants above only inspect routes that already authenticate
// somehow: one checks machine-auth routes are reachable, the other that
// session-auth routes stay gated. A route with *neither* passes both, which is
// how /api/extension/approval-status/[requestId] reached this point taking a
// caller-supplied id into findUnique with no auth, no rate limit and no
// ownership check. It was invisible because the middleware 401'd the whole
// prefix, so the route was broken rather than exposed -- and allowlisting the
// prefix is exactly what converts the one into the other.
//
// Scoped to /api/extension rather than to every public prefix: 25 routes across
// the API are deliberately unauthenticated (health, signup, badges,
// signature-verified webhooks), so enumerating all of them would be noise
// nobody maintains. The extension control plane is a closed set that speaks only
// device tokens and API keys, so "all of them authenticate" is a real rule there.
test("every /api/extension route authenticates, since the prefix is public", () => {
  // Enrollment is the bootstrap: the extension has no token yet, and the
  // enrollmentCode it presents IS the credential (redeemEnrollmentToken answers
  // 401 when it does not verify). It is IP-rate-limited. Anything else added
  // here needs the same kind of justification, in writing.
  const intentionallyUnauthenticated = new Set(["/api/extension/enroll"]);

  const missing: string[] = [];
  for (const file of routeFiles()) {
    const id = routeId(file);
    if (!id.startsWith("/api/extension")) continue;
    if (intentionallyUnauthenticated.has(id)) continue;
    const source = readFileSync(file, "utf8");
    if (!hasAny(source, machineAuthPatterns)) missing.push(id);
  }
  assert.deepEqual(
    missing,
    [],
    "these routes sit under the public /api/extension prefix without authenticating, so anyone on the internet can call them",
  );
});

test("guard API routes combine API-key auth, validation, and rate limiting", () => {
  for (const route of ["/api/guard/input", "/api/guard/output"]) {
    const file = "app" + route + "/route.ts";
    assert.equal(existsSync(file), true, file);
    const source = readFileSync(file, "utf8");
    assert.match(source, /authenticateApiKeyRequest\(/, route);
    assert.ok(hasAny(source, validationPatterns), route + " missing validation");
    assert.ok(hasAny(source, rateLimitPatterns), route + " missing rate limiting");
  }

  const groundingSource = readFileSync("app/api/guard/grounding/route.ts", "utf8");
  assert.match(groundingSource, /requireProjectPermission\(body\.projectId, "rag:read"\)/);
  assert.ok(hasAny(groundingSource, validationPatterns), "/api/guard/grounding missing validation");
});

test("public badge routes expose only public documentation/script data", () => {
  const badgeSource = readFileSync("lib/badge.ts", "utf8");
  assert.match(badgeSource, /PUBLIC_BADGE_STATUS_FIELDS/);
  for (const field of ["slug", "brandColor", "status", "monitoringActive", "monthRequestsScanned", "monthRisksBlocked", "lastActivity", "message", "alignment"]) {
    assert.match(badgeSource, new RegExp('"' + field + '"'));
  }
  const registrySource = readFileSync("app/api/badge/route.ts", "utf8");
  assert.match(registrySource, /name: "SoterAI Badge"/);
  assert.match(registrySource, /statuses:/);
  assert.doesNotMatch(registrySource, /organizationId|userId|apiKey|secret|originalText|redactedText|safeText/i);

  const scriptSource = readFileSync("app/badge.js/route.ts", "utf8");
  assert.match(scriptSource, /credentials: 'omit'/);
  assert.match(scriptSource, /X-Content-Type-Options/);
  assert.doesNotMatch(scriptSource, /innerHTML|organizationId|userId|apiKey|secret|originalText|redactedText|safeText/i);
});

test("cost-bearing routes apply tenant-aware rate limiting", () => {
  const costBearingRoutes = [
    "app/api/guard/input/route.ts",
    "app/api/guard/output/route.ts",
    "app/api/guard/analyze/route.ts",
    "app/api/guard/grounding/route.ts",
    "app/api/exports/route.ts",
    "app/api/reports/pdf/route.ts",
  ];
  for (const file of costBearingRoutes) {
    const source = readFileSync(file, "utf8");
    assert.ok(hasAny(source, rateLimitPatterns), file + " missing rate limiting on cost-bearing path");
  }
});

test("public write routes apply public rate limiting", () => {
  const publicWriteRoutes = [
    "app/api/auth/signup/route.ts",
    "app/api/auth/request-password-reset/route.ts",
    "app/api/auth/reset-password/route.ts",
    "app/api/auth/verify-email/route.ts",
    "app/api/ops/contact/route.ts",
    "app/api/ops/pilot/route.ts",
  ];
  for (const file of publicWriteRoutes) {
    const source = readFileSync(file, "utf8");
    assert.ok(
      /enforcePublicRateLimit|checkRedisRateLimit/.test(source),
      file + " missing public/global rate limiting",
    );
  }
});

test("API key rotation route revokes the old key atomically and only shows raw key once", () => {
  const file = "app/api/api-keys/rotate/route.ts";
  assert.equal(existsSync(file), true);
  const source = readFileSync(file, "utf8");
  assert.match(source, /requireUser\(\)/);
  assert.match(source, /db\.apiKey\.findFirst\(\{[\s\S]*members:\s*\{\s*some:\s*\{\s*userId:\s*user\.id/);
  assert.doesNotMatch(source, /const target = await db\.apiKey\.findUnique/);
  assert.match(source, /requireProjectPermission\(target\.projectId, "api_key:create"\)/);
  assert.match(source, /requireProjectPermission\(target\.projectId, "api_key:revoke"\)/);
  assert.match(source, /db\.\$transaction\(/);
  assert.match(source, /isActive:\s*false/);
  assert.match(source, /apiKey: generated\.rawKey/);
  assert.doesNotMatch(source, /keyHash:\s*target\.keyHash/);
});
