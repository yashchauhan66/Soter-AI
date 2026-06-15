import assert from "node:assert/strict";
import test from "node:test";
import { retentionCutoff, retentionDays, expectedDeletionConfirmation, RETENTION_WINDOWS } from "../lib/retention/policy";

const FIXED_NOW = new Date("2026-06-15T00:00:00.000Z");

test("retentionDays returns canonical day counts for each window", () => {
  assert.equal(retentionDays("DAYS_7"), 7);
  assert.equal(retentionDays("DAYS_30"), 30);
  assert.equal(retentionDays("DAYS_90"), 90);
  assert.equal(retentionDays("DAYS_180"), 180);
  assert.equal(retentionDays("DAYS_365"), 365);
  assert.equal(retentionDays("CUSTOM", 45), 45);
});

test("custom window requires a positive customDays value", () => {
  assert.throws(() => retentionDays("CUSTOM"), /customDays is required/);
  assert.throws(() => retentionDays("CUSTOM", 0), /customDays is required/);
  assert.throws(() => retentionDays("CUSTOM", -10), /customDays is required/);
});

test("retentionCutoff produces a cutoff strictly before now and respects custom days", () => {
  const cutoff = retentionCutoff(FIXED_NOW, "DAYS_30");
  assert.equal(cutoff.toISOString(), "2026-05-16T00:00:00.000Z");
  const customCutoff = retentionCutoff(FIXED_NOW, "CUSTOM", 14);
  assert.equal(customCutoff.toISOString(), "2026-06-01T00:00:00.000Z");
  assert.ok(cutoff.getTime() < FIXED_NOW.getTime());
});

test("expected deletion confirmation strings require typing the full scope", () => {
  assert.equal(expectedDeletionConfirmation("ORGANIZATION", "Acme"), "DELETE ORGANIZATION Acme");
  assert.equal(expectedDeletionConfirmation("PROJECT", "Alpha"), "DELETE PROJECT Alpha");
  assert.equal(expectedDeletionConfirmation("GUARD_LOGS", "Alpha"), "DELETE GUARD_LOGS Alpha");
});

test("retention window catalogue is bounded and includes CUSTOM", () => {
  assert.ok(RETENTION_WINDOWS.length <= 6);
  assert.ok(RETENTION_WINDOWS.includes("CUSTOM"));
  assert.ok(RETENTION_WINDOWS.includes("DAYS_7"));
});

test("retention runbook documentation lists destructive prerequisites", async () => {
  const fs = await import("node:fs");
  if (!fs.existsSync("docs/retention-runbook.md")) {
    assert.ok(false, "docs/retention-runbook.md must exist with destructive prerequisites");
  }
  const runbook = fs.readFileSync("docs/retention-runbook.md", "utf8");
  assert.match(runbook, /Backup/i);
  assert.match(runbook, /confirmation/i);
  assert.match(runbook, /retentionCutoff/);
});
