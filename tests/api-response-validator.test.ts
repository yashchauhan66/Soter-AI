import assert from "node:assert/strict";
import test from "node:test";
import { ZodError } from "zod";
import { validateBodyStrings } from "../lib/validateBodyStrings";

// ── validateBodyStrings ──────────────────────────────────────────

test("VBS-001: allows strings within the default limit", () => {
  validateBodyStrings({ name: "Alice", message: "Hello, world!" });
});

test("VBS-002: blocks a string exceeding the default 10_000 limit", () => {
  const long = "x".repeat(10_001);
  assert.throws(
    () => validateBodyStrings({ content: long }),
    (error: unknown) =>
      error instanceof ZodError &&
      error.issues[0]!.path[0] === "content" &&
      error.issues[0]!.code === "too_big",
  );
});

test("VBS-003: allows strings exactly at the limit", () => {
  const exactly = "x".repeat(10_000);
  validateBodyStrings({ content: exactly });
});

test("VBS-004: blocks strings exceeding a custom limit", () => {
  assert.throws(
    () => validateBodyStrings({ name: "x".repeat(201) }, 200),
    (error: unknown) =>
      error instanceof ZodError &&
      error.issues[0]!.code === "too_big" &&
      (error.issues[0]! as { maximum: number }).maximum === 200,
  );
});

test("VBS-005: validates nested objects recursively", () => {
  const long = "x".repeat(10_001);
  assert.throws(
    () => validateBodyStrings({ outer: { inner: { field: long } } }),
    (error: unknown) =>
      error instanceof ZodError &&
      error.issues[0]!.path[0] === "outer" &&
      error.issues[0]!.path[1] === "inner" &&
      error.issues[0]!.path[2] === "field",
  );
});

test("VBS-006: validates arrays recursively", () => {
  const long = "x".repeat(10_001);
  assert.throws(
    () => validateBodyStrings({ items: ["short", long, "also short"] }),
    (error: unknown) =>
      error instanceof ZodError &&
      error.issues[0]!.path[0] === "items" &&
      error.issues[0]!.path[1] === "1",
  );
});

test("VBS-007: allows numbers, booleans, and null without throwing", () => {
  validateBodyStrings({
    count: 42,
    active: true,
    data: null,
    tags: [1, 2, 3],
    nested: { x: 1.5, y: false, z: null },
  });
});

test("VBS-008: allows a top-level string within the limit", () => {
  validateBodyStrings("Hello, world!", 100);
});

test("VBS-009: blocks a top-level string exceeding the limit", () => {
  assert.throws(
    () => validateBodyStrings("x".repeat(101), 100),
    (error: unknown) =>
      error instanceof ZodError &&
      error.issues[0]!.code === "too_big",
  );
});

test("VBS-010: allows null, undefined, numbers, booleans as top-level values", () => {
  validateBodyStrings(null);
  validateBodyStrings(42);
  validateBodyStrings(true);
});

test("VBS-011: validates deeply nested arrays of objects", () => {
  const long = "x".repeat(10_001);
  assert.throws(
    () => validateBodyStrings([
      { items: [{ content: long }] },
    ]),
    (error: unknown) =>
      error instanceof ZodError &&
      error.issues[0]!.path[0] === "0" &&
      error.issues[0]!.path[1] === "items" &&
      error.issues[0]!.path[2] === "0" &&
      error.issues[0]!.path[3] === "content",
  );
});

test("VBS-012: reports the correct path for a deeply nested violation", () => {
  const long = "x".repeat(20_000);
  try {
    validateBodyStrings({ level1: { level2: { value: long } } }, 5_000);
    assert.fail("Expected ZodError");
  } catch (error: unknown) {
    assert.ok(error instanceof ZodError);
    const issue = error.issues[0]!;
    assert.deepEqual(issue.path, ["level1", "level2", "value"]);
    assert.equal((issue as { maximum: number }).maximum, 5_000);
  }
});
