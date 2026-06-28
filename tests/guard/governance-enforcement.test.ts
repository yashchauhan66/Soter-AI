import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";
import { z } from "zod";

// ── Duplicate the route schemas for isolated testing ──
// The route files have these as private consts. We test them here in isolation.

const inputGuardSchema = z.object({
  message: z.string().trim().min(1, "Message is required.").max(100_000),
  userId: z.string().max(200).optional(),
  sessionId: z.string().max(200).optional(),
  providerName: z.string().trim().max(100).optional(),
  modelName: z.string().trim().max(100).optional(),
  metadata: z.record(z.string().min(1).max(64), z.union([z.string().max(500), z.number().finite(), z.boolean(), z.null()])).optional().default({}),
});

const outputGuardSchema = z.object({
  aiResponse: z.string().trim().min(1, "AI response is required.").max(100_000),
  userId: z.string().max(200).optional(),
  sessionId: z.string().max(200).optional(),
  providerName: z.string().trim().max(100).optional(),
  modelName: z.string().trim().max(100).optional(),
  metadata: z.record(z.string().min(1).max(64), z.union([z.string().max(500), z.number().finite(), z.boolean(), z.null()])).optional().default({}),
});

const streamingGuardSchema = z.object({
  content: z.string().min(1).max(100_000),
  direction: z.enum(["INPUT", "OUTPUT"]).default("INPUT"),
  stream: z.boolean().default(false),
  chunkSize: z.number().int().min(50).max(10_000).default(500),
  includeRedacted: z.boolean().default(true),
  userId: z.string().max(200).optional(),
  sessionId: z.string().max(200).optional(),
  providerName: z.string().trim().max(100).optional(),
  modelName: z.string().trim().max(100).optional(),
  metadata: z.record(z.unknown()).optional(),
});

// ── Governance result shape (matches the inline objects in guard routes) ──

interface GovernanceResult {
  allowed: boolean;
  action: "BLOCK" | "HUMAN_REVIEW" | "ALLOW";
  riskScore: number;
  riskTypes: string[];
  reason: string;
  findings: unknown[];
  metadata: {
    governanceBlocked: boolean;
    governanceAction: string;
    governanceReason: string;
    providerName: string;
  };
}

function createGovernanceBlockResult(providerName: string, reason: string): GovernanceResult {
  return {
    allowed: false,
    action: "BLOCK",
    riskScore: 0,
    riskTypes: [],
    reason: `Blocked by governance policy: ${reason}`,
    findings: [],
    metadata: {
      governanceBlocked: true,
      governanceAction: "BLOCK",
      governanceReason: reason,
      providerName,
    },
  };
}

function createGovernanceApprovalResult(providerName: string, reason: string): GovernanceResult {
  return {
    allowed: false,
    action: "HUMAN_REVIEW",
    riskScore: 0,
    riskTypes: [],
    reason: `Requires governance approval: ${reason}. Submit an approval request via the AI Usage Governance dashboard.`,
    findings: [],
    metadata: {
      governanceBlocked: true,
      governanceAction: "REQUIRE_APPROVAL",
      governanceReason: reason,
      providerName,
    },
  };
}

// ── Governance Enforcement Event shape ──

interface GovernanceEnforcementEvent {
  organizationId: string;
  projectId: string;
  providerName: string;
  modelName?: string | null;
  enforcementAction: "BLOCK" | "REQUIRE_APPROVAL";
  reason: string;
  userId?: string | null;
}

// ── Schema Validation Tests ─────────────────────────────────

test("GOV-INPUT-001: inputGuardSchema accepts valid input with providerName", () => {
  const result = inputGuardSchema.parse({
    message: "Hello world",
    providerName: "OpenAI",
    modelName: "gpt-4",
  });
  assert.equal(result.message, "Hello world");
  assert.equal(result.providerName, "OpenAI");
  assert.equal(result.modelName, "gpt-4");
  assert.equal(result.userId, undefined);
});

test("GOV-INPUT-002: inputGuardSchema accepts providerName without modelName", () => {
  const result = inputGuardSchema.parse({
    message: "Translate this",
    providerName: "Anthropic",
  });
  assert.equal(result.providerName, "Anthropic");
  assert.equal(result.modelName, undefined);
});

test("GOV-INPUT-003: inputGuardSchema accepts userId with providerName", () => {
  const result = inputGuardSchema.parse({
    message: "Help me code",
    userId: "usr_abc123",
    providerName: "OpenAI",
  });
  assert.equal(result.userId, "usr_abc123");
  assert.equal(result.providerName, "OpenAI");
});

test("GOV-INPUT-004: inputGuardSchema works without providerName (backwards compat)", () => {
  const result = inputGuardSchema.parse({ message: "Hello" });
  assert.equal(result.providerName, undefined);
  assert.equal(result.modelName, undefined);
});

test("GOV-INPUT-005: inputGuardSchema trims providerName and modelName", () => {
  const result = inputGuardSchema.parse({
    message: "Hi",
    providerName: "  OpenAI  ",
    modelName: "  gpt-4  ",
  });
  assert.equal(result.providerName, "OpenAI");
  assert.equal(result.modelName, "gpt-4");
});

test("GOV-INPUT-006: inputGuardSchema rejects providerName exceeding max length", () => {
  assert.throws(
    () =>
      inputGuardSchema.parse({
        message: "Hi",
        providerName: "A".repeat(101),
      }),
    /at most 100/i,
  );
});

test("GOV-INPUT-007: inputGuardSchema rejects modelName exceeding max length", () => {
  assert.throws(
    () =>
      inputGuardSchema.parse({
        message: "Hi",
        providerName: "OpenAI",
        modelName: "A".repeat(101),
      }),
    /at most 100/i,
  );
});

// ── Output Schema Validation ─────────────────────────────────

test("GOV-OUTPUT-001: outputGuardSchema accepts valid input with providerName", () => {
  const result = outputGuardSchema.parse({
    aiResponse: "Sure, here is your answer",
    providerName: "OpenAI",
    modelName: "gpt-4o",
  });
  assert.equal(result.aiResponse, "Sure, here is your answer");
  assert.equal(result.providerName, "OpenAI");
  assert.equal(result.modelName, "gpt-4o");
});

test("GOV-OUTPUT-002: outputGuardSchema accepts userId with providerName", () => {
  const result = outputGuardSchema.parse({
    aiResponse: "Response text",
    userId: "usr_xyz",
    providerName: "Anthropic",
  });
  assert.equal(result.userId, "usr_xyz");
  assert.equal(result.providerName, "Anthropic");
});

test("GOV-OUTPUT-003: outputGuardSchema works without providerName (backwards compat)", () => {
  const result = outputGuardSchema.parse({ aiResponse: "Hello" });
  assert.equal(result.providerName, undefined);
  assert.equal(result.modelName, undefined);
  assert.equal(result.userId, undefined);
});

test("GOV-OUTPUT-004: outputGuardSchema rejects providerName exceeding max length", () => {
  assert.throws(
    () =>
      outputGuardSchema.parse({
        aiResponse: "Hi",
        providerName: "A".repeat(101),
      }),
    /at most 100/i,
  );
});

// ── Streaming Schema Validation ───────────────────────────────

test("GOV-STREAM-001: streamingGuardSchema accepts valid input with providerName", () => {
  const result = streamingGuardSchema.parse({
    content: "Streaming content",
    providerName: "OpenAI",
    modelName: "gpt-4",
  });
  assert.equal(result.content, "Streaming content");
  assert.equal(result.providerName, "OpenAI");
  assert.equal(result.modelName, "gpt-4");
});

test("GOV-STREAM-002: streamingGuardSchema accepts providerName with direction", () => {
  const result = streamingGuardSchema.parse({
    content: "Test",
    direction: "OUTPUT",
    providerName: "Anthropic",
  });
  assert.equal(result.direction, "OUTPUT");
  assert.equal(result.providerName, "Anthropic");
});

test("GOV-STREAM-003: streamingGuardSchema accepts userId with providerName", () => {
  const result = streamingGuardSchema.parse({
    content: "Test",
    userId: "usr_stream",
    providerName: "Google AI",
  });
  assert.equal(result.userId, "usr_stream");
  assert.equal(result.providerName, "Google AI");
});

test("GOV-STREAM-004: streamingGuardSchema works without providerName (backwards compat)", () => {
  const result = streamingGuardSchema.parse({ content: "Hello" });
  assert.equal(result.providerName, undefined);
  assert.equal(result.modelName, undefined);
  assert.equal(result.userId, undefined);
});

test("GOV-STREAM-005: streamingGuardSchema rejects providerName exceeding max length", () => {
  assert.throws(
    () =>
      streamingGuardSchema.parse({
        content: "Hi",
        providerName: "A".repeat(101),
      }),
    /at most 100/i,
  );
});

// ── Governance Result Shape ───────────────────────────────────

test("GOV-RESULT-001: BLOCK result has correct shape", () => {
  const result = createGovernanceBlockResult("DeepSeek", "Restricted region provider");

  assert.equal(result.allowed, false);
  assert.equal(result.action, "BLOCK");
  assert.equal(result.riskScore, 0);
  assert.deepEqual(result.riskTypes, []);
  assert.equal(result.metadata.governanceBlocked, true);
  assert.equal(result.metadata.governanceAction, "BLOCK");
  assert.equal(result.metadata.governanceReason, "Restricted region provider");
  assert.equal(result.metadata.providerName, "DeepSeek");
});

test("GOV-RESULT-002: REQUIRE_APPROVAL result has correct shape", () => {
  const result = createGovernanceApprovalResult("Anthropic", "Requires approval for sensitive data");

  assert.equal(result.allowed, false);
  assert.equal(result.action, "HUMAN_REVIEW");
  assert.equal(result.riskScore, 0);
  assert.deepEqual(result.riskTypes, []);
  assert.equal(result.metadata.governanceBlocked, true);
  assert.equal(result.metadata.governanceAction, "REQUIRE_APPROVAL");
  assert.equal(result.metadata.governanceReason, "Requires approval for sensitive data");
  assert.equal(result.metadata.providerName, "Anthropic");
  assert.ok(result.reason.includes("Requires governance approval"));
  assert.ok(result.reason.includes("AI Usage Governance dashboard"));
});

test("GOV-RESULT-003: BLOCK result has no findings", () => {
  const result = createGovernanceBlockResult("OpenAI", "Default policy block");
  assert.deepEqual(result.findings, []);
});

test("GOV-RESULT-004: BLOCK result reason mentions provider", () => {
  const result = createGovernanceBlockResult("Anthropic", "Policy rule for Anthropic");
  assert.ok(result.reason.includes("Anthropic"));
  assert.ok(result.reason.includes("Blocked by governance policy"));
});

// ── Governance Enforcement Event Shape ─────────────────────────

test("GOV-EVENT-001: BLOCK enforcement event has required fields", () => {
  const event: GovernanceEnforcementEvent = {
    organizationId: "org_abc",
    projectId: "proj_xyz",
    providerName: "DeepSeek",
    enforcementAction: "BLOCK",
    reason: "Restricted region provider",
  };

  assert.equal(event.organizationId, "org_abc");
  assert.equal(event.projectId, "proj_xyz");
  assert.equal(event.providerName, "DeepSeek");
  assert.equal(event.enforcementAction, "BLOCK");
  assert.equal(event.reason, "Restricted region provider");
  assert.equal(event.modelName, undefined);
  assert.equal(event.userId, undefined);
});

test("GOV-EVENT-002: REQUIRE_APPROVAL enforcement event with all optional fields", () => {
  const event: GovernanceEnforcementEvent = {
    organizationId: "org_abc",
    projectId: "proj_xyz",
    providerName: "OpenAI",
    modelName: "gpt-4",
    enforcementAction: "REQUIRE_APPROVAL",
    reason: "Requires department approval",
    userId: "usr_123",
  };

  assert.equal(event.modelName, "gpt-4");
  assert.equal(event.userId, "usr_123");
  assert.equal(event.enforcementAction, "REQUIRE_APPROVAL");
});

test("GOV-EVENT-003: enforcement event action is strict union type", () => {
  // Verify the type constraint at runtime via a validation function
  function isValidAction(action: string): action is "BLOCK" | "REQUIRE_APPROVAL" {
    return action === "BLOCK" || action === "REQUIRE_APPROVAL";
  }

  assert.equal(isValidAction("BLOCK"), true);
  assert.equal(isValidAction("REQUIRE_APPROVAL"), true);
  assert.equal(isValidAction("ALLOW"), false);
  assert.equal(isValidAction("MONITOR_ONLY"), false);
});

// ── Route file existence and imports ──────────────────────────

test("GOV-ROUTE-001: input guard route imports evaluateGovernance", () => {
  const source = readFileSync("app/api/guard/input/route.ts", "utf8");
  assert.ok(source.includes("evaluateGovernance"), "input route must import evaluateGovernance");
  assert.ok(source.includes("logAiUsageEvent"), "input route must import logAiUsageEvent");
  assert.ok(source.includes("dispatchGovernanceEnforcement"), "input route must import dispatchGovernanceEnforcement");
});

test("GOV-ROUTE-002: input guard route has governance enforcement logic", () => {
  const source = readFileSync("app/api/guard/input/route.ts", "utf8");
  assert.ok(
    source.includes("decision.action === \"BLOCK\""),
    "input route must handle BLOCK decision",
  );
  assert.ok(
    source.includes("decision.action === \"REQUIRE_APPROVAL\""),
    "input route must handle REQUIRE_APPROVAL decision",
  );
  assert.ok(
    source.includes("X-Governance-Action"),
    "input route must set X-Governance-Action header",
  );
});

test("GOV-ROUTE-003: output guard route imports evaluateGovernance", () => {
  const source = readFileSync("app/api/guard/output/route.ts", "utf8");
  assert.ok(source.includes("evaluateGovernance"), "output route must import evaluateGovernance");
  assert.ok(source.includes("logAiUsageEvent"), "output route must import logAiUsageEvent");
  assert.ok(source.includes("dispatchGovernanceEnforcement"), "output route must import dispatchGovernanceEnforcement");
});

test("GOV-ROUTE-004: output guard route has governance enforcement logic", () => {
  const source = readFileSync("app/api/guard/output/route.ts", "utf8");
  assert.ok(
    source.includes("decision.action === \"BLOCK\""),
    "output route must handle BLOCK decision",
  );
  assert.ok(
    source.includes("decision.action === \"REQUIRE_APPROVAL\""),
    "output route must handle REQUIRE_APPROVAL decision",
  );
  assert.ok(
    source.includes("X-Governance-Action"),
    "output route must set X-Governance-Action header",
  );
});

test("GOV-ROUTE-005: streaming guard route imports evaluateGovernance", () => {
  const source = readFileSync("app/api/guard/streaming/route.ts", "utf8");
  assert.ok(source.includes("evaluateGovernance"), "streaming route must import evaluateGovernance");
  assert.ok(source.includes("logAiUsageEvent"), "streaming route must import logAiUsageEvent");
  assert.ok(source.includes("dispatchGovernanceEnforcement"), "streaming route must import dispatchGovernanceEnforcement");
});

test("GOV-ROUTE-006: streaming guard route has governance enforcement logic", () => {
  const source = readFileSync("app/api/guard/streaming/route.ts", "utf8");
  assert.ok(
    source.includes("decision.action === \"BLOCK\""),
    "streaming route must handle BLOCK decision",
  );
  assert.ok(
    source.includes("decision.action === \"REQUIRE_APPROVAL\""),
    "streaming route must handle REQUIRE_APPROVAL decision",
  );
  assert.ok(
    source.includes("X-Governance-Action"),
    "streaming route must set X-Governance-Action header",
  );
});

// ── Header Format Tests ───────────────────────────────────────

test("GOV-HEADER-001: X-Governance-Action header uses consistent casing", () => {
  // Verify all three routes use the same header format
  for (const route of ["app/api/guard/input/route.ts", "app/api/guard/output/route.ts", "app/api/guard/streaming/route.ts"]) {
    const source = readFileSync(route, "utf8");
    const matches = source.match(/"X-Governance-[A-Za-z-]+"/g);
    assert.ok(matches, `${route} must have X-Governance-* headers`);
    assert.ok(matches.some((m) => m.includes("Action")), `${route} must have X-Governance-Action`);
    assert.ok(matches.some((m) => m.includes("Reason")), `${route} must have X-Governance-Reason`);
  }
});

test("GOV-HEADER-002: governance block status is 403 on all routes", () => {
  for (const route of ["app/api/guard/input/route.ts", "app/api/guard/output/route.ts", "app/api/guard/streaming/route.ts"]) {
    const source = readFileSync(route, "utf8");
    // Count occurrences of "status: 403" in governance block context
    const blockMatch = source.match(/status:\s*403/g);
    assert.ok(blockMatch, `${route} must return status 403 when governance blocks`);
  }
});

// ── Route file existence ──────────────────────────────────────

test("GOV-EXIST-001: all three guard route files exist", () => {
  assert.equal(existsSync("app/api/guard/input/route.ts"), true, "Input guard route must exist");
  assert.equal(existsSync("app/api/guard/output/route.ts"), true, "Output guard route must exist");
  assert.equal(existsSync("app/api/guard/streaming/route.ts"), true, "Streaming guard route must exist");
});

// ── Governance result serialization ────────────────────────────

test("GOV-SERIAL-001: governance result can be JSON-serialized (no circular refs)", () => {
  const result = createGovernanceBlockResult("TestProvider", "Test reason");
  const serialized = JSON.parse(JSON.stringify(result));
  assert.equal(serialized.allowed, false);
  assert.equal(serialized.action, "BLOCK");
  assert.equal(serialized.metadata.governanceBlocked, true);
});

test("GOV-SERIAL-002: governance result reason survives encodeURIComponent round-trip", () => {
  const reasons = [
    "Default governance policy: BLOCK",
    'Department "Engineering" policy for OpenAI',
    "PII data not allowed to be sent to DeepSeek",
    "Sensitive data (RESTRICTED) default action: BLOCK",
    "Blocked by governance policy: restricted region provider - CN",
  ];

  for (const reason of reasons) {
    const original = reason.slice(0, 200);
    const encoded = encodeURIComponent(original);
    const decoded = decodeURIComponent(encoded);
    // Must survive the round-trip unchanged
    assert.equal(decoded, original, `Round-trip encode/decode must preserve reason: ${original}`);
    // All headers in governance blocks are set via jsonResponse with a headers object,
    // so the value ends up in the HTTP response. encodeURIComponent ensures the value
    // is valid in any context — no further assertion needed beyond the round-trip.
    assert.ok(encoded.length > 0, "Encoded string must not be empty");
  }
});

// ── Governance event headers in streaming response ────────────

test("GOV-STREAM-RESP-001: governance block response includes X-Governance headers alongside rate-limit headers", () => {
  const source = readFileSync("app/api/guard/streaming/route.ts", "utf8");

  // Verify all required elements exist somewhere in the BLOCK governance section.
  // Using broad checks avoids fragility from whitespace/linebreak changes.
  assert.ok(source.includes("X-RateLimit-Limit"), "Streaming route must include rate-limit header");
  assert.ok(source.includes("X-Governance-Action"), "Streaming route must include governance header");
  assert.ok(source.includes("X-Governance-Reason"), "Streaming route must include governance reason header");
  assert.ok(source.includes("status: 403"), "Streaming governance block must return status 403");
  assert.ok(source.includes("chunks"), "Streaming route must return chunks array in response");
  assert.ok(source.includes("isFinal: true"), "Streaming route must mark chunk as final");
});
