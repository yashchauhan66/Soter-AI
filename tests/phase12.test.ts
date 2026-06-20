// Phase 12: Market-gap module tests
// Covers: Shadow AI Scanner, MCP Credential Vault, AI Cost Firewall,
//         AI Red Team Lab, AI Incident Forensics
//
// These tests validate pure logic functions only, matching the project's
// existing test patterns (see phase11.test.ts). Database-dependent
// operations are tested via integration tests.

import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import test from "node:test";
import { KNOWN_AI_PROVIDERS, SDK_TOOL_PATTERNS, assessProviderRisk } from "../lib/shadow-ai";
import { validateServerUrl } from "../lib/credentials/vault";
import { detectUsageSpike, estimateCost, KNOWN_MODEL_RATES, CRITICAL_SPIKE_MULTIPLIER, WARNING_SPIKE_MULTIPLIER } from "../lib/cost-firewall";
import { safeRedTeamScenarios } from "../lib/redteam/scenarios";

// ═══════════════════════════════════════════════════════════════════════════════
// Shadow AI Scanner — Pure Logic Tests
// ═══════════════════════════════════════════════════════════════════════════════

test("Shadow AI: known provider signatures exist and are valid", () => {
  assert.ok(KNOWN_AI_PROVIDERS.length >= 10, "Should have at least 10 known providers");
  for (const provider of KNOWN_AI_PROVIDERS) {
    assert.ok(provider.name, "Provider must have a name");
    assert.ok(provider.providerType, "Provider must have a type");
    assert.ok(provider.domain, "Provider must have a domain");
    assert.ok(provider.sdkPatterns.length > 0, "Provider must have SDK patterns");
  }

  // Verify major providers are present
  const names = KNOWN_AI_PROVIDERS.map((p) => p.name);
  assert.ok(names.includes("OpenAI"), "OpenAI must be a known provider");
  assert.ok(names.includes("Anthropic"), "Anthropic must be a known provider");
  assert.ok(names.includes("Google AI"), "Google AI must be a known provider");
  assert.ok(names.includes("LangChain"), "LangChain must be a known provider");
  assert.ok(names.includes("Vercel AI SDK"), "Vercel AI SDK must be a known provider");
});

test("Shadow AI: SDK tool patterns cover major categories", () => {
  assert.ok(SDK_TOOL_PATTERNS.length >= 25, "Should have at least 25 SDK tool patterns");
  const categories = new Set(SDK_TOOL_PATTERNS.map((t) => t.category));
  assert.ok(categories.has("LLM"), "Should have LLM category");
  assert.ok(categories.has("MCP"), "Should have MCP category");
  assert.ok(categories.has("EMBEDDING"), "Should have EMBEDDING category");
  assert.ok(categories.has("VECTOR_STORE"), "Should have VECTOR_STORE category");
  assert.ok(categories.has("WEB_SEARCH"), "Should have WEB_SEARCH category");
  assert.ok(categories.has("EMAIL"), "Should have EMAIL category");
  assert.ok(categories.has("DATABASE"), "Should have DATABASE category");
});

test("Shadow AI: provider risk assessment works", () => {
  assert.equal(assessProviderRisk("CLOUD", "US"), "MEDIUM");
  assert.equal(assessProviderRisk("CLOUD", "EU"), "MEDIUM");
  assert.equal(assessProviderRisk("OPEN_SOURCE", "US"), "MEDIUM");
  assert.equal(assessProviderRisk("CLOUD", "CN"), "HIGH");
  assert.equal(assessProviderRisk("CLOUD", "RU"), "HIGH");
  assert.equal(assessProviderRisk("SDK", "US"), "LOW");
  assert.equal(assessProviderRisk("FRAMEWORK", "US"), "LOW");
});

test("Shadow AI: provider API key patterns are defined", () => {
  const openai = KNOWN_AI_PROVIDERS.find((p) => p.name === "OpenAI");
  assert.ok(openai?.apiKeyPattern, "OpenAI should have API key pattern");
  assert.ok(/sk-[A-Za-z0-9]{32,}/.test("sk-test1234567890123456789012345678"), "Should match OpenAI key pattern");

  const anthropic = KNOWN_AI_PROVIDERS.find((p) => p.name === "Anthropic");
  assert.ok(anthropic?.apiKeyPattern, "Anthropic should have API key pattern");
});

test("Shadow AI: provider model patterns are defined", () => {
  const openai = KNOWN_AI_PROVIDERS.find((p) => p.name === "OpenAI");
  assert.ok(openai?.modelPatterns, "OpenAI should have model patterns");
  assert.ok(openai!.modelPatterns!.length >= 5, "OpenAI should have at least 5 known models");
  const modelNames = openai!.modelPatterns!.map((m) => m.name);
  assert.ok(modelNames.includes("gpt-4o"), "Should include GPT-4o");
  assert.ok(modelNames.includes("gpt-3.5-turbo"), "Should include GPT-3.5-turbo");
});

// ═══════════════════════════════════════════════════════════════════════════════
// MCP Credential Vault — Pure Logic Tests
// ═══════════════════════════════════════════════════════════════════════════════

test("Credential vault: valid server URLs pass validation", () => {
  assert.equal(validateServerUrl("https://mcp.example.com").valid, true);
  assert.equal(validateServerUrl("http://localhost:8080").valid, true);
  assert.equal(validateServerUrl("ws://mcp-server:9090").valid, true);
  assert.equal(validateServerUrl("wss://secure-mcp.example.com").valid, true);
});

test("Credential vault: invalid server URLs fail validation", () => {
  assert.equal(validateServerUrl("ftp://bad.com").valid, false);
  assert.equal(validateServerUrl("not-a-url").valid, false);
  assert.equal(validateServerUrl("").valid, false);
  assert.equal(validateServerUrl("javascript:alert(1)").valid, false);
  assert.equal(validateServerUrl("file:///etc/passwd").valid, false);
});

// ═══════════════════════════════════════════════════════════════════════════════
// AI Cost Firewall — Pure Logic Tests
// ═══════════════════════════════════════════════════════════════════════════════

test("Cost firewall: detects critical usage spikes", () => {
  const result = detectUsageSpike([
    { timestamp: new Date(Date.now() - 86400_000 * 6), count: 100 },
    { timestamp: new Date(Date.now() - 86400_000 * 5), count: 110 },
    { timestamp: new Date(Date.now() - 86400_000 * 4), count: 95 },
    { timestamp: new Date(Date.now() - 86400_000 * 3), count: 105 },
    { timestamp: new Date(Date.now() - 86400_000 * 2), count: 98 },
    { timestamp: new Date(Date.now() - 86400_000 * 1), count: 500 },
  ]);
  assert.equal(result.spike, true, "Should detect spike");
  assert.equal(result.severity, "CRITICAL", "Should be CRITICAL severity");
  assert.ok(result.observed > result.baseline, "Observed should exceed baseline");
});

test("Cost firewall: detects warning usage spikes", () => {
  const result = detectUsageSpike([
    { timestamp: new Date(Date.now() - 86400_000 * 4), count: 100 },
    { timestamp: new Date(Date.now() - 86400_000 * 3), count: 110 },
    { timestamp: new Date(Date.now() - 86400_000 * 2), count: 105 },
    { timestamp: new Date(Date.now() - 86400_000 * 1), count: 180 },
  ]);
  assert.equal(result.spike, true, "Should detect spike");
  assert.equal(result.severity, "WARNING", "Should be WARNING severity");
});

test("Cost firewall: no spike for normal traffic", () => {
  const result = detectUsageSpike([
    { timestamp: new Date(Date.now() - 86400_000 * 2), count: 100 },
    { timestamp: new Date(Date.now() - 86400_000 * 1), count: 110 },
    { timestamp: new Date(), count: 105 },
  ]);
  assert.equal(result.spike, false, "Should not detect spike");
  assert.equal(result.severity, "NONE", "Should be NONE severity");
});

test("Cost firewall: insufficient data does not trigger spike", () => {
  const result = detectUsageSpike([
    { timestamp: new Date(), count: 100 },
    { timestamp: new Date(Date.now() - 86400_000), count: 90 },
  ]);
  assert.equal(result.spike, false, "Need at least 3 data points");
});

test("Cost firewall: estimates model costs correctly", () => {
  const gpt4Cost = estimateCost("OpenAI", "gpt-4o", 1000, 500);
  assert.ok(gpt4Cost > 0, "Should estimate GPT-4o cost");

  const claudeCost = estimateCost("Anthropic", "claude-3.5-sonnet", 1000, 500);
  assert.ok(claudeCost > 0, "Should estimate Claude cost");

  const unknownCost = estimateCost("Unknown", "unknown-model", 1000, 500);
  assert.equal(unknownCost, 0, "Unknown models should return 0");
});

test("Cost firewall: known model rates cover major models", () => {
  const models = KNOWN_MODEL_RATES.map((r) => r.model);
  assert.ok(models.some((m) => m.includes("gpt-4o")), "Should include GPT-4o");
  assert.ok(models.some((m) => m.includes("claude")), "Should include Claude models");
  assert.ok(models.some((m) => m.includes("gemini")), "Should include Gemini models");
  assert.ok(models.some((m) => m.includes("mistral")), "Should include Mistral models");
  assert.ok(KNOWN_MODEL_RATES.every((r) => r.inputPer1K > 0), "All models should have input rates");
  assert.ok(KNOWN_MODEL_RATES.every((r) => r.outputPer1K > 0), "All models should have output rates");
});

test("Cost firewall: spike detection constants are reasonable", () => {
  assert.equal(CRITICAL_SPIKE_MULTIPLIER, 3.0, "Critical spike should be 3x");
  assert.equal(WARNING_SPIKE_MULTIPLIER, 1.5, "Warning spike should be 1.5x");
});

// ═══════════════════════════════════════════════════════════════════════════════
// AI Red Team Lab — Pure Logic Tests
// ═══════════════════════════════════════════════════════════════════════════════

test("Red team lab: all 11 scenarios exist with valid structure", () => {
  assert.equal(safeRedTeamScenarios.length, 11, "Should have exactly 11 scenarios");
  const keys = safeRedTeamScenarios.map((s) => s.key);
  assert.ok(keys.includes("direct-ignore"), "Should include direct-ignore");
  assert.ok(keys.includes("system-prompt-leak"), "Should include system-prompt-leak");
  assert.ok(keys.includes("jailbreak-mode"), "Should include jailbreak-mode");
  assert.ok(keys.includes("pii-exfil"), "Should include pii-exfil");
  assert.ok(keys.includes("tool-misuse"), "Should include tool-misuse");
  assert.ok(keys.includes("cost-abuse"), "Should include cost-abuse");
});

test("Red team lab: all scenarios have valid severity", () => {
  const validSeverities = ["MEDIUM", "HIGH", "CRITICAL"];
  for (const scenario of safeRedTeamScenarios) {
    assert.ok(validSeverities.includes(scenario.severity), `${scenario.key} has invalid severity: ${scenario.severity}`);
  }
});

test("Red team lab: all scenarios have OWASP mappings", () => {
  for (const scenario of safeRedTeamScenarios) {
    assert.ok(scenario.owaspMapping.length >= 1, `${scenario.key} should have at least 1 OWASP mapping`);
    for (const mapping of scenario.owaspMapping) {
      assert.ok(mapping.startsWith("LLM"), `OWASP mapping should start with LLM: ${mapping}`);
    }
  }
});

test("Red team lab: scenarios cover all required categories", () => {
  const categories = new Set(safeRedTeamScenarios.map((s) => s.category));
  assert.ok(categories.has("DIRECT_PROMPT_INJECTION"), "Should have direct prompt injection");
  assert.ok(categories.has("JAILBREAK"), "Should have jailbreak");
  assert.ok(categories.has("SYSTEM_PROMPT_LEAK"), "Should have system prompt leak");
  assert.ok(categories.has("PII_EXFILTRATION"), "Should have PII exfiltration");
  assert.ok(categories.has("TOOL_CALL_MISUSE"), "Should have tool call misuse");
  assert.ok(categories.has("COST_ABUSE"), "Should have cost abuse");
  assert.ok(categories.has("UNSAFE_OUTPUT"), "Should have unsafe output");
});

test("Red team lab: all scenarios have expected actions", () => {
  for (const scenario of safeRedTeamScenarios) {
    assert.ok(scenario.expectedActions.length >= 1, `${scenario.key} should have at least 1 expected action`);
    for (const action of scenario.expectedActions) {
      assert.ok(["ALLOW", "BLOCK", "REWRITE", "HUMAN_REVIEW", "ALLOW_WITH_REDACTION"].includes(action),
        `${scenario.key} has invalid expected action: ${action}`);
    }
  }
});

test("Red team lab: all scenarios have prompts", () => {
  for (const scenario of safeRedTeamScenarios) {
    assert.ok(scenario.prompt.length > 10, `${scenario.key} prompt should be meaningful`);
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// AI Incident Forensics — Pure Logic Tests
// ═══════════════════════════════════════════════════════════════════════════════

test("Implementation docs exist", () => {
  for (const file of [
    "docs/final-audit/market-gap-modules-implementation-report.md",
    "lib/shadow-ai/index.ts",
    "lib/credentials/vault.ts",
    "lib/cost-firewall/index.ts",
    "lib/forensics/index.ts",
    "lib/redteam/lab.ts",
    "app/dashboard/shadow-ai/page.tsx",
    "app/dashboard/cost-firewall/page.tsx",
    "app/dashboard/forensics/page.tsx",
    "app/dashboard/credentials/page.tsx",
    "app/dashboard/redteam/lab/page.tsx",
    "app/api/shadow/scan/route.ts",
    "app/api/credentials/route.ts",
    "app/api/cost-firewall/budget/route.ts",
    "app/api/forensics/route.ts",
  ]) {
    assert.equal(existsSync(file), true, `${file} missing`);
  }
});

test("Dashboard sidebar has new navigation links", () => {
  const sidebar = require("fs").readFileSync("components/dashboard/DashboardSidebar.tsx", "utf8");
  assert.ok(sidebar.includes("Shadow AI"), "Sidebar should have Shadow AI link");
  assert.ok(sidebar.includes("Red team lab"), "Sidebar should have Red team lab link");
  assert.ok(sidebar.includes("Cost firewall"), "Sidebar should have Cost firewall link");
  assert.ok(sidebar.includes("Credential vault"), "Sidebar should have Credential vault link");
  assert.ok(sidebar.includes("Forensics"), "Sidebar should have Forensics link");
});

test("Permissions include new module permissions", () => {
  const permissions = require("fs").readFileSync("lib/auth/permissions.ts", "utf8");
  assert.ok(permissions.includes("shadow_ai:read"), "Should include shadow_ai:read");
  assert.ok(permissions.includes("credentials:read"), "Should include credentials:read");
  assert.ok(permissions.includes("cost:read"), "Should include cost:read");
  assert.ok(permissions.includes("forensics:read"), "Should include forensics:read");
  assert.ok(permissions.includes("redteam:read"), "Should include redteam:read");
});

test("Prisma schema includes new models", () => {
  const schema = require("fs").readFileSync("prisma/schema.prisma", "utf8");
  assert.ok(schema.includes("model ShadowAiScan"), "Schema should have ShadowAiScan");
  assert.ok(schema.includes("model McpCredentialVault"), "Schema should have McpCredentialVault");
  assert.ok(schema.includes("model CostTransaction"), "Schema should have CostTransaction");
  assert.ok(schema.includes("model ForensicReport"), "Schema should have ForensicReport");
  assert.ok(schema.includes("model ForensicEvidence"), "Schema should have ForensicEvidence");
});
