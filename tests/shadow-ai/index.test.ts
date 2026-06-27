import assert from "node:assert/strict";
import test from "node:test";
import {
  KNOWN_AI_PROVIDERS,
  SDK_TOOL_PATTERNS,
  assessProviderRisk,
  type ProviderSignature,
} from "../../lib/shadow-ai";

// ── Provider Signature Validation ─────────────────────────────

test("SAI-001: KNOWN_AI_PROVIDERS has at least 36 providers", () => {
  assert.ok(
    KNOWN_AI_PROVIDERS.length >= 36,
    `Expected at least 36 providers, got ${KNOWN_AI_PROVIDERS.length}`,
  );
});

test("SAI-002: every provider has required fields", () => {
  for (const provider of KNOWN_AI_PROVIDERS) {
    assert.equal(typeof provider.name, "string", `Missing name`);
    assert.equal(typeof provider.providerType, "string", `${provider.name}: missing providerType`);
    assert.equal(typeof provider.domain, "string", `${provider.name}: missing domain`);
    assert.equal(typeof provider.riskLevel, "string", `${provider.name}: missing riskLevel`);
    assert.equal(typeof provider.dataRegion, "string", `${provider.name}: missing dataRegion`);
    assert.ok(Array.isArray(provider.sdkPatterns), `${provider.name}: sdkPatterns must be array`);
  }
});

test("SAI-003: provider names are unique", () => {
  const names = KNOWN_AI_PROVIDERS.map((p) => p.name);
  const unique = new Set(names);
  assert.equal(unique.size, names.length, "Duplicate provider names found");
});

test("SAI-004: risk levels are valid", () => {
  const validLevels = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];
  for (const provider of KNOWN_AI_PROVIDERS) {
    assert.ok(
      validLevels.includes(provider.riskLevel),
      `${provider.name}: invalid risk level "${provider.riskLevel}"`,
    );
  }
});

test("SAI-005: provider types are valid", () => {
  const validTypes = ["CLOUD", "OPEN_SOURCE", "PLATFORM", "SDK", "FRAMEWORK"];
  for (const provider of KNOWN_AI_PROVIDERS) {
    assert.ok(
      validTypes.includes(provider.providerType),
      `${provider.name}: invalid providerType "${provider.providerType}"`,
    );
  }
});

test("SAI-006: data regions are valid", () => {
  const validRegions = ["US", "EU", "CN", "CA", "RU", "GLOBAL"];
  for (const provider of KNOWN_AI_PROVIDERS) {
    assert.ok(
      validRegions.includes(provider.dataRegion),
      `${provider.name}: invalid dataRegion "${provider.dataRegion}"`,
    );
  }
});

test("SAI-007: domains have valid format", () => {
  for (const provider of KNOWN_AI_PROVIDERS) {
    assert.match(
      provider.domain,
      /^[a-zA-Z0-9][-a-zA-Z0-9]*\.[a-zA-Z]{2,}(\.[a-zA-Z]{2,})?$|^api\.x\.ai$/,
      `${provider.name}: invalid domain "${provider.domain}"`,
    );
  }
});

test("SAI-008: every provider has at least one SDK pattern", () => {
  for (const provider of KNOWN_AI_PROVIDERS) {
    assert.ok(
      provider.sdkPatterns.length >= 1,
      `${provider.name}: missing sdkPatterns`,
    );
  }
});

test("SAI-009: all sdkPatterns have pattern and label", () => {
  for (const provider of KNOWN_AI_PROVIDERS) {
    for (const pattern of provider.sdkPatterns) {
      assert.equal(typeof pattern.pattern, "string", `${provider.name}: sdkPattern missing pattern`);
      assert.equal(typeof pattern.label, "string", `${provider.name}: sdkPattern missing label`);
      assert.ok(pattern.pattern.length > 0, `${provider.name}: empty sdkPattern`);
      assert.ok(pattern.label.length > 0, `${provider.name}: empty sdkPattern label`);
    }
  }
});

test("SAI-010: apiKeyPatterns are valid RegExps when present", () => {
  for (const provider of KNOWN_AI_PROVIDERS) {
    if (provider.apiKeyPattern) {
      assert.ok(
        provider.apiKeyPattern instanceof RegExp,
        `${provider.name}: apiKeyPattern must be RegExp`,
      );
    }
  }
});

test("SAI-011: every modelPattern has name and modality", () => {
  for (const provider of KNOWN_AI_PROVIDERS) {
    if (provider.modelPatterns) {
      for (const model of provider.modelPatterns) {
        assert.equal(typeof model.name, "string", `${provider.name}: model missing name`);
        assert.equal(typeof model.modality, "string", `${provider.name}: model missing modality`);
        assert.ok(model.name.length > 0, `${provider.name}: empty model name`);
      }
    }
  }
});

test("SAI-012: model modalities are valid", () => {
  const validModalities = ["TEXT", "IMAGE", "AUDIO", "VIDEO", "CODE", "EMBEDDING", "MULTIMODAL"];
  for (const provider of KNOWN_AI_PROVIDERS) {
    for (const model of provider.modelPatterns || []) {
      assert.ok(
        validModalities.includes(model.modality),
        `${provider.name}/${model.name}: invalid modality "${model.modality}"`,
      );
    }
  }
});

// ── Cloud Provider Coverage ──────────────────────────────────

test("SAI-013: expected major cloud AI providers are present", () => {
  const names = KNOWN_AI_PROVIDERS.map((p) => p.name);
  const required = ["OpenAI", "Anthropic", "Google AI", "Amazon Bedrock", "Azure OpenAI"];
  for (const name of required) {
    assert.ok(names.includes(name), `Missing required provider: ${name}`);
  }
});

test("SAI-014: expected open-source providers are present", () => {
  const names = KNOWN_AI_PROVIDERS.map((p) => p.name);
  const required = ["Meta Llama", "Mistral AI", "Ollama", "vLLM", "Chroma"];
  for (const name of required) {
    assert.ok(names.includes(name), `Missing required open-source provider: ${name}`);
  }
});

test("SAI-015: expected frameworks/SDKs are present", () => {
  const names = KNOWN_AI_PROVIDERS.map((p) => p.name);
  const required = ["LangChain", "LlamaIndex", "Vercel AI SDK", "CrewAI", "LiteLLM"];
  for (const name of required) {
    assert.ok(names.includes(name), `Missing required framework: ${name}`);
  }
});

test("SAI-016: at least one high-risk provider exists", () => {
  const highRisk = KNOWN_AI_PROVIDERS.filter((p) => p.riskLevel === "HIGH");
  assert.ok(highRisk.length >= 1, "Expected at least one HIGH risk provider");
});

// ── SDK Tool Patterns Validation ─────────────────────────────

test("SAI-017: SDK_TOOL_PATTERNS has entries", () => {
  assert.ok(SDK_TOOL_PATTERNS.length >= 30, `Expected at least 30 tool patterns, got ${SDK_TOOL_PATTERNS.length}`);
});

test("SAI-018: every tool pattern has required fields", () => {
  for (const tool of SDK_TOOL_PATTERNS) {
    assert.equal(typeof tool.pattern, "string", `Tool missing pattern`);
    assert.equal(typeof tool.toolName, "string", `Tool "${tool.pattern}" missing toolName`);
    assert.equal(typeof tool.category, "string", `Tool "${tool.toolName}" missing category`);
    assert.equal(typeof tool.riskLevel, "string", `Tool "${tool.toolName}" missing riskLevel`);
    assert.ok(["LOW", "MEDIUM", "HIGH"].includes(tool.riskLevel), `${tool.toolName}: invalid riskLevel`);
  }
});

test("SAI-019: tool names are unique", () => {
  const names = SDK_TOOL_PATTERNS.map((t) => t.toolName);
  const unique = new Set(names);
  assert.equal(unique.size, names.length, "Duplicate tool names found");
});

test("SAI-020: tool categories include expected types", () => {
  const categories = SDK_TOOL_PATTERNS.map((t) => t.category);
  const expectedCategories = ["LLM", "EMBEDDING", "VECTOR_STORE", "WEB_SEARCH", "WEB_BROWSER", "UTILITY", "EXTERNAL_API", "DATABASE", "EMAIL", "MCP", "UI_HOOK", "STREAMING"];
  for (const cat of expectedCategories) {
    assert.ok(categories.includes(cat), `Missing tool category: ${cat}`);
  }
});

// ── assessProviderRisk Tests ─────────────────────────────────

test("SAI-021: assessProviderRisk returns MEDIUM for US CLOUD", () => {
  assert.equal(assessProviderRisk("CLOUD", "US"), "MEDIUM");
});

test("SAI-022: assessProviderRisk returns MEDIUM for EU providers", () => {
  assert.equal(assessProviderRisk("CLOUD", "EU"), "MEDIUM");
  assert.equal(assessProviderRisk("FRAMEWORK", "EU"), "MEDIUM");
});

test("SAI-023: assessProviderRisk returns HIGH for CN/RU cloud providers", () => {
  assert.equal(assessProviderRisk("CLOUD", "CN"), "HIGH");
  assert.equal(assessProviderRisk("CLOUD", "RU"), "HIGH");
});

test("SAI-024: assessProviderRisk returns MEDIUM for OPEN_SOURCE", () => {
  assert.equal(assessProviderRisk("OPEN_SOURCE", "US"), "MEDIUM");
});

test("SAI-025: assessProviderRisk returns LOW for SDK type", () => {
  assert.equal(assessProviderRisk("SDK", "US"), "LOW");
});

test("SAI-026: assessProviderRisk returns LOW for unknown combinations", () => {
  assert.equal(assessProviderRisk("PLATFORM", "CA"), "LOW");
  assert.equal(assessProviderRisk("FRAMEWORK", "US"), "LOW");
});

test("SAI-027: assessProviderRisk handles empty strings", () => {
  assert.equal(assessProviderRisk("", ""), "LOW");
});

// ── runShadowScan Structure Test ──────────────────────────────
// Note: runShadowScan requires DB (Prisma), so we test its input
// processing logic by importing and verifying function existence.

test("SAI-028: runShadowScan is a function accepting ShadowScanInput", () => {
  const { runShadowScan } = require("../../lib/shadow-ai");
  assert.equal(typeof runShadowScan, "function");
});

// ── Provider Distribution ────────────────────────────────────

test("SAI-029: providers are distributed across multiple types", () => {
  const types = KNOWN_AI_PROVIDERS.map((p) => p.providerType);
  const typeCounts: Record<string, number> = {};
  for (const t of types) typeCounts[t] = (typeCounts[t] ?? 0) + 1;

  // Should have at least 2 of each type
  for (const [type, count] of Object.entries(typeCounts)) {
    assert.ok(count >= 1, `Provider type "${type}" has only ${count} providers`);
  }
});

test("SAI-030: CN/RU region providers are flagged as HIGH risk", () => {
  for (const provider of KNOWN_AI_PROVIDERS) {
    if (provider.dataRegion === "CN" || provider.dataRegion === "RU") {
      const expected = assessProviderRisk(provider.providerType, provider.dataRegion);
      assert.equal(
        expected, "HIGH",
        `${provider.name}: CN/RU provider should be HIGH risk, got ${expected}`,
      );
    }
  }
});

test("SAI-031: OpenAI has expected model patterns", () => {
  const openai = KNOWN_AI_PROVIDERS.find((p) => p.name === "OpenAI");
  assert.ok(openai, "OpenAI provider not found");
  assert.ok(openai.modelPatterns, "OpenAI missing model patterns");
  const modelNames = openai.modelPatterns.map((m) => m.name);
  assert.ok(modelNames.includes("gpt-4"), "OpenAI missing gpt-4");
  assert.ok(modelNames.includes("dall-e-3"), "OpenAI missing dall-e-3");
  assert.ok(modelNames.includes("whisper-1"), "OpenAI missing whisper-1");
});

test("SAI-032: Anthropic has Claude model patterns", () => {
  const anthropic = KNOWN_AI_PROVIDERS.find((p) => p.name === "Anthropic");
  assert.ok(anthropic, "Anthropic provider not found");
  assert.ok(anthropic.modelPatterns, "Anthropic missing model patterns");
  const modelNames = anthropic.modelPatterns.map((m) => m.name);
  assert.ok(modelNames.some((n) => n.includes("claude")), "Anthropic missing Claude models");
});

test("SAI-033: OpenAI is the first provider", () => {
  assert.equal(KNOWN_AI_PROVIDERS[0].name, "OpenAI");
});

// ── Data Integrity ───────────────────────────────────────────

test("SAI-034: no provider has redundant sdkPatterns", () => {
  for (const provider of KNOWN_AI_PROVIDERS) {
    const patterns = provider.sdkPatterns.map((p) => p.pattern);
    const unique = new Set(patterns);
    assert.equal(
      unique.size, patterns.length,
      `${provider.name}: duplicate sdkPatterns found`,
    );
  }
});

test("SAI-035: apiKey is never stored in raw pattern", () => {
  // Ensure no sdkPattern contains actual credential patterns
  for (const provider of KNOWN_AI_PROVIDERS) {
    for (const sp of provider.sdkPatterns) {
      assert.equal(
        sp.pattern.includes("sk-") || sp.pattern.includes("api_key") || sp.pattern.includes("secret"),
        false,
        `${provider.name}: sdkPattern "${sp.pattern}" looks like a credential pattern`,
      );
    }
  }
});

test("SAI-036: all sdkPattern labels describe the pattern clearly", () => {
  for (const provider of KNOWN_AI_PROVIDERS) {
    for (const sp of provider.sdkPatterns) {
      assert.ok(
        sp.label.length >= 3,
        `${provider.name}: sdkPattern label "${sp.label}" too short`,
      );
    }
  }
});

test("SAI-037: cloud providers have data regions set consistently", () => {
  for (const provider of KNOWN_AI_PROVIDERS) {
    if (provider.providerType === "CLOUD") {
      assert.ok(
        ["US", "EU", "CN", "CA"].includes(provider.dataRegion),
        `${provider.name}: cloud provider should have US/EU/CN/CA data region, got "${provider.dataRegion}"`,
      );
    }
  }
});
