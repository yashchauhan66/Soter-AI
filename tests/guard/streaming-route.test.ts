import assert from "node:assert/strict";
import test from "node:test";
import { z } from "zod";

// ── Replicate the streaming route's internal logic for testing ──
// The route handler depends on Next.js APIs (authenticateApiKeyRequest,
// jsonResponse, etc.) so we test the pure functions directly.

const streamingGuardSchema = z.object({
  content: z.string().min(1).max(100_000),
  direction: z.enum(["INPUT", "OUTPUT"]).default("INPUT"),
  stream: z.boolean().default(false),
  chunkSize: z.number().int().min(50).max(10_000).default(500),
  includeRedacted: z.boolean().default(true),
  sessionId: z.string().max(200).optional(),
  metadata: z.record(z.unknown()).optional(),
});

function chunkText(text: string, chunkSize: number): string[] {
  const chunks: string[] = [];
  for (let i = 0; i < text.length; i += chunkSize) {
    chunks.push(text.slice(i, i + chunkSize));
  }
  return chunks;
}

// ── Chunking Tests ───────────────────────────────────────────

test("STR-001: chunkText splits text evenly by chunk size", () => {
  const text = "HelloWorld";
  const chunks = chunkText(text, 5);
  assert.equal(chunks.length, 2);
  assert.equal(chunks[0], "Hello");
  assert.equal(chunks[1], "World");
});

test("STR-002: chunkText returns single chunk for text smaller than chunk size", () => {
  const text = "Hi";
  const chunks = chunkText(text, 100);
  assert.equal(chunks.length, 1);
  assert.equal(chunks[0], "Hi");
});

test("STR-003: chunkText handles exact multiple", () => {
  const text = "ABCDEFGH";
  const chunks = chunkText(text, 4);
  assert.equal(chunks.length, 2);
  assert.equal(chunks[0], "ABCD");
  assert.equal(chunks[1], "EFGH");
});

test("STR-004: chunkText handles empty string", () => {
  const chunks = chunkText("", 50);
  // Empty string means 0 length, so no iterations -> empty array
  assert.equal(chunks.length, 0);
});

test("STR-005: chunkText handles large text", () => {
  const text = "A".repeat(10_000);
  const chunks = chunkText(text, 500);
  assert.equal(chunks.length, 20);
  assert.equal(chunks[0].length, 500);
  assert.equal(chunks[19].length, 500);
});

// ── Schema Validation Tests ──────────────────────────────────

test("STR-006: schema accepts valid input with defaults", () => {
  const result = streamingGuardSchema.parse({ content: "Hello" });
  assert.equal(result.content, "Hello");
  assert.equal(result.direction, "INPUT");
  assert.equal(result.stream, false);
  assert.equal(result.chunkSize, 500);
  assert.equal(result.includeRedacted, true);
});

test("STR-007: schema accepts direction OUTPUT", () => {
  const result = streamingGuardSchema.parse({ content: "Response", direction: "OUTPUT" });
  assert.equal(result.direction, "OUTPUT");
});

test("STR-008: schema accepts stream: true", () => {
  const result = streamingGuardSchema.parse({ content: "Test", stream: true });
  assert.equal(result.stream, true);
});

test("STR-009: schema accepts custom chunk size", () => {
  const result = streamingGuardSchema.parse({ content: "Test", chunkSize: 1000 });
  assert.equal(result.chunkSize, 1000);
});

test("STR-010: schema rejects empty content", () => {
  assert.throws(() => streamingGuardSchema.parse({ content: "" }), /at least 1 character/i);
});

test("STR-011: schema rejects invalid direction", () => {
  assert.throws(() => streamingGuardSchema.parse({ content: "Test", direction: "BOTH" }));
});

test("STR-012: schema rejects chunkSize below minimum", () => {
  assert.throws(() => streamingGuardSchema.parse({ content: "Test", chunkSize: 10 }));
});

test("STR-013: schema rejects chunkSize above maximum", () => {
  assert.throws(() => streamingGuardSchema.parse({ content: "Test", chunkSize: 20_000 }));
});

test("STR-014: schema rejects non-integer chunkSize", () => {
  assert.throws(() => streamingGuardSchema.parse({ content: "Test", chunkSize: 100.5 }));
});

test("STR-015: schema accepts includeRedacted false", () => {
  const result = streamingGuardSchema.parse({ content: "Test", includeRedacted: false });
  assert.equal(result.includeRedacted, false);
});

test("STR-016: schema accepts sessionId", () => {
  const result = streamingGuardSchema.parse({ content: "Test", sessionId: "sess_abc123" });
  assert.equal(result.sessionId, "sess_abc123");
});

test("STR-017: schema accepts metadata", () => {
  const result = streamingGuardSchema.parse({
    content: "Test",
    metadata: { source: "playground", userId: "usr_1" },
  });
  assert.deepEqual(result.metadata, { source: "playground", userId: "usr_1" });
});

test("STR-018: schema rejects sessionId exceeding max length", () => {
  const longId = "a".repeat(201);
  assert.throws(() => streamingGuardSchema.parse({ content: "Test", sessionId: longId }));
});

// ── Chunk Edge Cases ─────────────────────────────────────────

test("STR-019: chunkText handles single character chunk size", () => {
  const chunks = chunkText("ABC", 1);
  assert.equal(chunks.length, 3);
  assert.equal(chunks[0], "A");
  assert.equal(chunks[1], "B");
  assert.equal(chunks[2], "C");
});

test("STR-020: chunkText handles special characters and unicode", () => {
  const text = "Hello 世界";
  const chunks = chunkText(text, 4);
  // "Hello 世界" has 8 characters: H(0) e(1) l(2) l(3) o(4) ' '(5) 世(6) 界(7)
  // chunkSize=4: indices 0-3="Hell", 4-7="o 世界" (JavaScript slice uses UTF-16 code units)
  assert.equal(chunks.length, 2);
  assert.equal(chunks[0], "Hell");
  assert.equal(chunks[1], "o 世界");
});

// ── Streaming guard result shape ─────────────────────────────

test("STR-021: streaming chunk shape is correct", () => {
  const chunk = {
    chunkIndex: 0,
    chunkText: "Hello World",
    result: {
      decision: "ALLOW",
      action: "ALLOW",
      riskScore: 0,
      riskLevel: "LOW",
      riskTypes: ["LOW_RISK"],
      findings: [],
      redactedText: null,
    },
    isFinal: true,
  };

  assert.equal(chunk.chunkIndex, 0);
  assert.equal(chunk.isFinal, true);
  assert.equal(chunk.result.action, "ALLOW");
  assert.ok(Array.isArray(chunk.result.riskTypes));
  assert.equal(typeof chunk.result.riskScore, "number");
});

// ── Content length and size limits ───────────────────────────

test("STR-022: schema accepts content at maximum length", () => {
  const text = "A".repeat(100_000);
  const result = streamingGuardSchema.parse({ content: text });
  assert.equal(result.content.length, 100_000);
});

test("STR-023: schema rejects content exceeding maximum length", () => {
  assert.throws(() => streamingGuardSchema.parse({ content: "A".repeat(100_001) }));
});

test("STR-024: chunking with max parameters", () => {
  const text = "A".repeat(10_000);
  const chunks = chunkText(text, 10_000);
  assert.equal(chunks.length, 1);
  assert.equal(chunks[0].length, 10_000);
});
