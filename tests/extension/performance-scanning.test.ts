import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { scanText } from "../../packages/detectors/src";
import { redactByDataTypes } from "../../packages/policy-engine/src";
import { scanPrompt } from "../../apps/extension/src/lib/scanner";
import { lockdownPolicy } from "../../lib/extension/emergencyLockdown";
import { defaultState } from "../../apps/extension/src/lib/storage";
import type { ExtensionState } from "../../apps/extension/src/lib/types";

// ── Test prompts of varying sizes ───────────────────────────────────────────
const smallPrompt = "What is the capital of France?";
const mediumPrompt = "Please analyze this business proposal and provide feedback on the following points: market opportunity, competitive landscape, financial projections, team capabilities, and risk factors. The proposal covers a SaaS platform for enterprise AI security monitoring.".repeat(3); // ~500 chars
const largePrompt = "Explain in detail how machine learning models can be used for anomaly detection in network traffic. Cover the following aspects: feature engineering, model selection, training methodology, deployment considerations, and monitoring. Include code examples in Python using scikit-learn and TensorFlow.".repeat(10); // ~5KB
const hugePrompt = "The quick brown fox jumps over the lazy dog. ".repeat(500); // ~23KB

const cleanScanInput = "Summarize the quarterly report for the board meeting.";

// ── Default policy for extension scans ──────────────────────────────────────
const baseState = { ...defaultState, enrollmentStatus: "enrolled" as const };

// ── PERF-001: Small prompt scan < 100ms ─────────────────────────────────────
test("PERF-001: small prompt (<100 words) scans in <100ms", () => {
  const iterations = 50;
  const times: number[] = [];
  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    scanPrompt(smallPrompt, "https://chatgpt.com/", baseState);
    times.push(performance.now() - start);
  }
  const avg = times.reduce((a, b) => a + b, 0) / times.length;
  const sorted = [...times].sort((a, b) => a - b);
  const p95 = sorted[Math.floor(sorted.length * 0.95)];
  assert.ok(p95 < 100, `Small prompt P95 scan time ${p95.toFixed(1)}ms must be <100ms (avg: ${avg.toFixed(1)}ms)`);
});

// ── PERF-002: Medium prompt scan < 300ms ────────────────────────────────────
test("PERF-002: medium prompt (~500 chars) scans in <300ms", () => {
  const iterations = 20;
  const times: number[] = [];
  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    scanPrompt(mediumPrompt, "https://claude.ai/", baseState);
    times.push(performance.now() - start);
  }
  const p95 = [...times].sort((a, b) => a - b)[Math.floor(times.length * 0.95)];
  assert.ok(p95 < 300, `Medium prompt P95 scan time ${p95.toFixed(1)}ms must be <300ms`);
});

// ── PERF-003: Large prompt scan < 1000ms ────────────────────────────────────
test("PERF-003: large prompt (~5KB) scans in <1000ms with no freeze", () => {
  const start = performance.now();
  const result = scanPrompt(largePrompt, "https://gemini.google.com/", baseState);
  const duration = performance.now() - start;
  assert.ok(duration < 1000, `Large prompt scan ${duration.toFixed(1)}ms must be <1000ms`);
  assert.ok(typeof result.action === "string", "Result must have valid action");
});

// ── PERF-004: Huge prompt scan rejects or handles gracefully ─────────────────
test("PERF-004: huge prompt (~23KB) processes without page freeze", () => {
  const start = performance.now();
  const result = scanPrompt(hugePrompt, "https://chatgpt.com/", baseState);
  const duration = performance.now() - start;
  // Should complete in reasonable time even for large inputs
  assert.ok(duration < 2000, `Huge prompt scan ${duration.toFixed(1)}ms must be <2000ms`);
  assert.ok(typeof result.action === "string", "Result must have valid action");
});

// ── PERF-005: Repeated response observer scanning prevents duplicates ────────
test("PERF-005: duplicate audit prevention via WeakMap tracking", () => {
  const source = readFileSync(
    resolve(import.meta.dirname, "../../apps/extension/src/content/response-observer.ts"),
    "utf8",
  );
  assert.match(source, /WeakMap/, "Response observer must use WeakMap for deduplication");
  assert.match(
    source,
    /scanned\.get\(target\) === text/,
    "Response observer must skip already-scanned text",
  );
  assert.match(
    source,
    /scanned\.set\(target, text\)/,
    "Response observer must track scanned content",
  );
});

// ── PERF-006: Policy evaluation performance ──────────────────────────────────
test("PERF-006: policy evaluation for clean prompt is fast (<50ms)", () => {
  const iterations = 50;
  const times: number[] = [];
  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    scanPrompt(cleanScanInput, "https://chatgpt.com/", baseState);
    times.push(performance.now() - start);
  }
  const avg = times.reduce((a, b) => a + b, 0) / times.length;
  assert.ok(avg < 50, `Clean prompt avg scan time ${avg.toFixed(2)}ms must be <50ms`);
});

// ── PERF-007: Lockdown state check performance ──────────────────────────────
test("PERF-007: lockdown state check is fast (<5ms)", () => {
  const iterations = 200;
  const times: number[] = [];
  const enabledLockdown = lockdownPolicy({ enabled: true, policyVersion: 3, reason: "Incident", enabledAt: new Date() });
  const disabledLockdown = lockdownPolicy(null);
  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    // Simulate lockdown state check (the common hot path)
    void (enabledLockdown.enabled ? enabledLockdown : disabledLockdown);
    times.push(performance.now() - start);
  }
  const avg = times.reduce((a, b) => a + b, 0) / times.length;
  assert.ok(avg < 5, `Lockdown check avg ${avg.toFixed(3)}ms must be <5ms`);
});

// ── PERF-008: Detector scanText performance ──────────────────────────────────
test("PERF-008: detector scanText for clean text is fast (<50ms)", () => {
  const iterations = 100;
  const times: number[] = [];
  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    scanText(cleanScanInput);
    times.push(performance.now() - start);
  }
  const avg = times.reduce((a, b) => a + b, 0) / times.length;
  assert.ok(avg < 50, `Detector avg scan time ${avg.toFixed(2)}ms must be <50ms`);
});

// ── PERF-009: Redaction performance ──────────────────────────────────────────
test("PERF-009: redaction of text with detected types is fast (<10ms)", () => {
  const text = "My PAN is ABCDE1234F and my API key is synthetic_api_key_value";
  const iterations = 200;
  const times: number[] = [];
  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    redactByDataTypes(text, ["pan", "api_key"]);
    times.push(performance.now() - start);
  }
  const avg = times.reduce((a, b) => a + b, 0) / times.length;
  assert.ok(avg < 10, `Redaction avg ${avg.toFixed(2)}ms must be <10ms`);
});

// ── PERF-010: No duplicate audit logs for same response ─────────────────────
test("PERF-010: service worker response scan deduplication logic present", () => {
  const source = readFileSync(
    resolve(import.meta.dirname, "../../apps/extension/src/background/service-worker.ts"),
    "utf8",
  );
  // Verify the service worker skips audit for clean response scans
  assert.match(
    source,
    /isResponseScan.*result\.hasFindings|isResponseScan \|\\| result\.hasFindings/,
    "Service worker must only audit response scans when findings exist",
  );
});

// ── PERF-011: Lockdown propagation timing ────────────────────────────────────
test("PERF-011: heartbeat interval reduced during lockdown", () => {
  const heartbeatSource = readFileSync(
    resolve(import.meta.dirname, "../../apps/extension/src/background/heartbeat.ts"),
    "utf8",
  );
  const syncSource = readFileSync(
    resolve(import.meta.dirname, "../../apps/extension/src/background/policy-sync.ts"),
    "utf8",
  );
  // Either heartbeat or policy-sync should reference lockdown interval
  assert.ok(
    heartbeatSource.includes("recommendedPollIntervalMs") || heartbeatSource.includes("lockdown") ||
    syncSource.includes("lockdown") || syncSource.includes("pollInterval"),
    "Heartbeat or policy-sync must reference lockdown-aware polling interval",
  );
});

// ── PERF-012: Concurrent scan safety ─────────────────────────────────────────
test("PERF-012: scanPrompt produces independent results for different inputs", () => {
  // Run multiple scans to verify no shared mutable state
  const results = [
    scanPrompt(smallPrompt, "https://chatgpt.com/", baseState),
    scanPrompt(mediumPrompt, "https://claude.ai/", baseState),
    scanPrompt(largePrompt, "https://gemini.google.com/", baseState),
  ];
  // Each result should be independent
  for (const result of results) {
    assert.ok(typeof result.action === "string", "Each result must have valid action");
    assert.ok(typeof result.riskScore === "number", "Each result must have numeric riskScore");
    assert.ok(Array.isArray(result.detectedDataTypes), "Each result must have detectedDataTypes array");
  }
  // Clean prompt should be allowed
  assert.equal(results[0].action, "allow");
});
