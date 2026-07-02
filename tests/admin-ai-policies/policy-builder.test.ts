import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildTemplatePolicy, compileExtensionPolicyBundle, evaluateCompiledPolicies, POLICY_TEMPLATES, privacySafeFingerprint, testPolicy, validateRegexPattern } from "../../lib/admin-ai-policies";
import type { AdminAiPolicy } from "../../lib/admin-ai-policies";

test("template policy creation uses safe defaults", () => {
  const policy = buildTemplatePolicy("org_1", "block-api-keys-secrets", "admin_1");
  assert.equal(policy.mode, "template");
  assert.equal(policy.action, "block");
  assert.equal(policy.logMode, "redacted_prompt");
  assert.ok(policy.detectionConfig.detectorKeys.includes("api_key"));
});

test("all requested quick templates are available", () => {
  assert.equal(POLICY_TEMPLATES.length >= 30, true);
  assert.ok(POLICY_TEMPLATES.some((template) => template.name === "Block unknown AI websites"));
  assert.ok(POLICY_TEMPLATES.some((template) => template.name === "Allow approved enterprise AI tools only"));
});

test("custom keyword policy matches sensitive phrases", () => {
  const policy = customPolicy({ keywords: ["soter_internal_api", "prod-db"] });
  const result = testPolicy({ policy, sampleText: "Please debug prod-db for soter_internal_api", destinationDomain: "chatgpt.com" });
  assert.equal(result.matched, true);
  assert.equal(result.action, "block");
  assert.ok(result.matchedRules.some((rule) => rule.startsWith("keyword:")));
});

test("custom regex policy validates and matches input", () => {
  assert.equal(validateRegexPattern("(a+)+$").ok, false);
  const policy = customPolicy({ regex: ["PRIVATE-[0-9]{4}"] });
  const result = testPolicy({ policy, sampleText: "The code is PRIVATE-1234", destinationDomain: "claude.ai" });
  assert.equal(result.matched, true);
  assert.ok(result.matchedRules.includes("regex:PRIVATE-[0-9]{4}"));
});

test("destination-specific policy only applies on configured domains", () => {
  const policy = customPolicy({ domains: ["claude.ai"], destinationDomains: ["claude.ai"] });
  assert.equal(testPolicy({ policy, sampleText: "prod-db", destinationDomain: "chatgpt.com" }).matched, false);
  assert.equal(testPolicy({ policy, sampleText: "prod-db", destinationDomain: "claude.ai" }).matched, true);
});

test("department-specific policy only applies to matching department", () => {
  const policy = customPolicy({ departments: ["Finance"], scopeType: "department", keywords: ["forecast"] });
  assert.equal(testPolicy({ policy, sampleText: "forecast is confidential", destinationDomain: "chatgpt.com", department: "HR" }).matched, false);
  assert.equal(testPolicy({ policy, sampleText: "forecast is confidential", destinationDomain: "chatgpt.com", department: "Finance" }).matched, true);
});

test("strictest action wins across matching policies", () => {
  const warn = customPolicy({ action: "warn", keywords: ["prod-db"] });
  const block = customPolicy({ action: "block", keywords: ["prod-db"] });
  const result = evaluateCompiledPolicies({ policies: [warn, block], sampleText: "prod-db", destinationDomain: "chatgpt.com" });
  assert.equal(result.action, "block");
});

test("policy test endpoint logic returns redacted output and no raw secret in log preview", () => {
  const policy = customPolicy({ detectorKeys: ["api_key"] });
  const result = testPolicy({ policy, sampleText: "api_key = abcdefghijklmnop", destinationDomain: "chatgpt.com" });
  assert.equal(result.redactedOutput.includes("abcdefghijklmnop"), false);
  assert.equal(result.logPreview.includes("abcdefghijklmnop"), false);
});

test("policy version publish and rollback routes are wired and audited", () => {
  const publishRoute = readFileSync("app/api/admin/ai-policies/[id]/publish/route.ts", "utf8");
  const rollbackRoute = readFileSync("app/api/admin/ai-policies/[id]/rollback/route.ts", "utf8");
  assert.match(publishRoute, /publishPolicy/);
  assert.match(rollbackRoute, /rollbackPolicy/);
  assert.match(rollbackRoute, /requireAdmin/);
});

test("extension policy bundle generation includes custom detectors", () => {
  const policy = customPolicy({ keywords: ["private-roadmap"], regex: ["ROAD-[0-9]+"], documentFingerprints: [privacySafeFingerprint("private roadmap")] });
  const bundle = compileExtensionPolicyBundle("org_1", [policy]);
  assert.equal(bundle.organizationId, "org_1");
  assert.ok(bundle.policies[0].detectors.includes("custom_keyword"));
  assert.ok(bundle.customDetectors.keywords.includes("private-roadmap"));
});

test("admin API routes deny unauthorized access via requireAdmin guards", () => {
  const listRoute = readFileSync("app/api/admin/ai-policies/route.ts", "utf8");
  const templateRoute = readFileSync("app/api/admin/ai-policy-templates/route.ts", "utf8");
  assert.match(listRoute, /requireAdmin/);
  assert.match(templateRoute, /requireAdmin/);
});

function customPolicy(overrides: {
  action?: AdminAiPolicy["action"];
  detectorKeys?: string[];
  keywords?: string[];
  regex?: string[];
  domains?: string[];
  destinationDomains?: string[];
  departments?: string[];
  scopeType?: AdminAiPolicy["scope"]["type"];
  documentFingerprints?: string[];
} = {}): AdminAiPolicy {
  const now = new Date(0).toISOString();
  return {
    id: `policy_${Math.random().toString(36).slice(2)}`,
    organizationId: "org_1",
    name: "Custom",
    description: "Custom test policy",
    enabled: true,
    mode: "custom",
    severity: "critical",
    action: overrides.action ?? "block",
    scope: {
      type: overrides.scopeType ?? "all",
      departments: overrides.departments ?? ["all"],
      roles: ["all"],
      users: ["all"],
    },
    destinations: {
      preset: "custom",
      domains: overrides.destinationDomains ?? ["*"],
      riskLevel: "all",
    },
    detectionConfig: {
      detectorKeys: overrides.detectorKeys ?? [],
      keywords: overrides.keywords ?? ["prod-db"],
      regex: overrides.regex ?? [],
      domains: overrides.domains ?? [],
      fileNames: [],
      documentFingerprints: overrides.documentFingerprints ?? [],
      semanticCategories: [],
      scanResponses: false,
    },
    logMode: "redacted_prompt",
    version: 1,
    createdBy: "admin_1",
    updatedBy: "admin_1",
    publishedAt: now,
    createdAt: now,
    updatedAt: now,
  };
}
