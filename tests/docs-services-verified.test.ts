import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import { SERVICES } from "../lib/docs/services";
import { SERVICE_EXPERIENCE } from "../lib/docs/serviceExperience";

const root = process.cwd();
const source = (path: string) => readFileSync(resolve(root, path), "utf8");

// Deliberately explicit: finding a route file does not establish its auth contract.
const EXPECTED_AUTH = {
  "guard-logs": "session",
  reports: "session",
  "detection-feedback": "session",
  "customer-success": "dashboard-session",
  "agent-firewall": "session",
  "policy-engine": "session",
  "rag-security": "session",
  webhooks: "session",
  "shadow-ai": "session",
  "red-team-lab": "session",
  forensics: "session",
  "canary-network": "api-key",
  "semantic-egress": "api-key",
  "agent-passports": "api-key",
  "transaction-escrow": "api-key",
  "intent-guard": "api-key",
  "tool-chain": "api-key",
  "dry-run-sandbox": "api-key",
  "memory-firewall": "api-key",
  "mcp-drift": "api-key",
  "legal-boundary": "api-key",
  "evidence-vault": "api-key",
  "context-lineage": "api-key",
  "blast-radius": "api-key",
  "credential-vault": "session",
  projects: "session",
  "api-keys": "session",
  "cost-firewall": "session",
  "security-badges": "public",
  billing: "admin-session",
  settings: "dashboard-session",
  "audit-exports": "session",
  onboarding: "api-key",
} as const;

test("all 33 service entries declare the auth boundary enforced by their route, not by its existence", () => {
  assert.equal(SERVICES.length, 33);
  assert.deepEqual(SERVICES.map((entry) => entry.id).sort(), Object.keys(EXPECTED_AUTH).sort());
  assert.deepEqual(Object.keys(SERVICE_EXPERIENCE).sort(), Object.keys(EXPECTED_AUTH).sort());
  const mismatches: string[] = [];
  for (const [id, expected] of Object.entries(EXPECTED_AUTH)) {
    const service = SERVICES.find((entry) => entry.id === id)!;
    const experience = SERVICE_EXPERIENCE[id];
    if (experience.authentication?.kind !== expected) {
      mismatches.push(`${id}: expected ${expected}, got ${experience.authentication?.kind ?? "undeclared"}`);
    }
    if (!service.apiEndpoint) continue;
    const [method, path] = service.apiEndpoint.split(" ");
    const route = source(`app${path}/route.ts`);
    assert.match(route, new RegExp(`export\\s+async\\s+function\\s+${method}\\s*\\(`), id);
    if (expected === "session") assert.match(route, /requireProjectPermission|requirePermission|getActiveOrganization/, id);
    if (expected === "admin-session") assert.match(route, /await requireAdmin\(\)/, id);
    if (expected === "api-key") assert.match(route, /authenticate(?:ApiKeyRequest|AgentFirewall|AdvancedSecurity|AgentPassport)\(request\)/, id);
    if (expected === "public") assert.doesNotMatch(route, /requireUser|requirePermission|authenticateApiKeyRequest/, id);
  }
  assert.deepEqual(mismatches, [], "every service needs an explicit, source-checked authentication boundary");
});

const CONTENT_REQUIREMENTS: Record<string, RegExp> = {
  "guard-logs": /cursor/i,
  reports: /202[\s\S]*worker/i,
  "detection-feedback": /review[\s\S]*(?:not|does not)[\s\S]*train/i,
  "customer-success": /heuristic/i,
  "agent-firewall": /inspect[\s\S]*(?:does not|not)[\s\S]*(?:persist|log)/i,
  "policy-engine": /riskThresholds[\s\S]*0.{1,5}100/i,
  "rag-security": /simulation/i,
  webhooks: /raw[\s\S]*payload/i,
  "shadow-ai": /submitted[\s\S]*(?:code|dependencies)/i,
  "red-team-lab": /202[\s\S]*worker/i,
  forensics: /tenant[\s\S]*(?:review|validation)/i,
  "canary-network": /exact[\s\S]*token/i,
  "semantic-egress": /heuristic/i,
  "agent-passports": /hash[\s\S]*token|token[\s\S]*hash/i,
  "transaction-escrow": /reviewed action/i,
  "intent-guard": /intentRecordId/,
  "tool-chain": /session\/start/,
  "dry-run-sandbox": /SAFE_TO_EXECUTE/,
  "memory-firewall": /check[\s\S]*does not[\s\S]*(?:persist|store)/i,
  "mcp-drift": /(?:caller|you)[\s\S]*snapshots/i,
  "legal-boundary": /TAKEOVER_REQUIRED/,
  "evidence-vault": /on-demand/i,
  "context-lineage": /sourceIds/,
  "blast-radius": /declared/i,
  "credential-vault": /manual[\s\S]*rotation/i,
  projects: /one new project[\s\S]*month/i,
  "api-keys": /ck_test_/,
  "cost-firewall": /monthlyLimitPaise/,
  "security-badges": /metadata[\s\S]*JSON|JSON[\s\S]*metadata/i,
  billing: /platform.admin/i,
  settings: /read.only/i,
  "audit-exports": /JSONL/,
  onboarding: /(?:manual|self.reported)[\s\S]*SDK|SDK[\s\S]*(?:manual|self.reported)/i,
};

test("every service has specific setup, validation, limitations and implementation references", () => {
  const missing: string[] = [];
  assert.deepEqual(Object.keys(CONTENT_REQUIREMENTS).sort(), SERVICES.map((entry) => entry.id).sort());
  for (const service of SERVICES) {
    const experience = SERVICE_EXPERIENCE[service.id];
    for (const field of ["setup", "validation", "limitations", "integrationNotes", "sourceFiles"] as const) {
      if (!Array.isArray(experience[field]) || experience[field].length < 2) missing.push(`${service.id}: missing ${field}`);
    }
  }
  assert.deepEqual(missing, [], "the full catalog needs task-specific operational guidance, not the shared safe/risky/logging checklist");
  for (const service of SERVICES) {
    const experience = SERVICE_EXPERIENCE[service.id];
    const prose = JSON.stringify({ ...service, ...experience });
    assert.match(prose, CONTENT_REQUIREMENTS[service.id], `${service.id} loses its material implementation boundary`);
    assert.ok(experience.sourceFiles.includes(`app${experience.dashboardHref}/page.tsx`), `${service.id} dashboard was not reviewed`);
    if (service.apiEndpoint) assert.ok(experience.sourceFiles.includes(`app${service.apiEndpoint.split(" ")[1]}/route.ts`), `${service.id} route source is missing`);
    for (const file of experience.sourceFiles) assert.ok(source(file).length > 0, `${service.id}: missing evidence source ${file}`);
    for (const step of [...experience.setup, ...experience.validation]) {
      assert.ok(step.heading.trim().length > 0 && step.body.trim().length > 40, `${service.id}: incomplete operational step`);
    }
  }
  assert.equal(new Set(SERVICES.map((entry) => JSON.stringify(SERVICE_EXPERIENCE[entry.id].validation))).size, SERVICES.length, "validation cannot be the same generic checklist for every service");
});

test("cost budget documentation distinguishes creating a budget from recording a transaction", () => {
  const route = source("app/api/cost-firewall/budget/route.ts");
  assert.match(route, /async function POST[\s\S]*budgetSchema\.parse[\s\S]*setBudget\(/);
  assert.match(route, /async function PUT[\s\S]*transactionSchema\.parse[\s\S]*recordCostTransaction\(/);
  assert.equal(SERVICES.find((entry) => entry.id === "cost-firewall")?.apiEndpoint, "POST /api/cost-firewall/budget");
});

test("catalog prose no longer promises unsupported security mechanisms or leaked legacy SDK examples", () => {
  const prose = SERVICES.map((entry) => JSON.stringify(entry)).join("\n");
  assert.doesNotMatch(prose, /hardware-backed key management|Ed25519 signatures|tamper-proof|guaranteed delivery|ML-powered identification|fine-tune detection models|permanent log entry|Sub-100ms/);
  assert.doesNotMatch(prose, /api\.soterai\.in\/v1\/|proces\.\.\.EY|SoterClient|toolChainAnalysis/);
});
