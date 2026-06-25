import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

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
  ["/api/ready", [/SELECT 1/]],
  ["/api/badge", [/force-static/]],
  ["/api/badge/[slug]", [/loadBadgeStatus/]],
  ["/api/auth/signup", [/enforcePublicRateLimit/, /schema\.parse/]],
  ["/api/auth/request-password-reset", [/enforcePublicRateLimit|checkRedisRateLimit/, /z\.object[\s\S]*\.parse/]],
  ["/api/auth/reset-password", [/enforcePublicRateLimit|checkRedisRateLimit/, /z\.object[\s\S]*\.parse/]],
  ["/api/auth/verify-email", [/enforcePublicRateLimit|checkRedisRateLimit/, /z\.object[\s\S]*\.parse/]],
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
  /authorizeScimRequest\(/,
  /WEBHOOK_WORKER_TOKEN|REPORT_WORKER_TOKEN/,
];

const validationPatterns = [/z\.object/, /schema\.parse/, /readJson\(/, /readAgentJson\(/, /readAdvancedJson\(/, /readPassportJson\(/, /request\.json\(/, /request\.text\(\)/, /request\.formData\(\)/];
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
  assert.match(source, /requireProjectPermission\(target\.projectId, "api_key:create"\)/);
  assert.match(source, /requireProjectPermission\(target\.projectId, "api_key:revoke"\)/);
  assert.match(source, /db\.\$transaction\(/);
  assert.match(source, /isActive:\s*false/);
  assert.match(source, /apiKey: generated\.rawKey/);
  assert.doesNotMatch(source, /keyHash:\s*target\.keyHash/);
});
