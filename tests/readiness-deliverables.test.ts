import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const requiredDocs = [
  "docs/quickstart-first-5-minutes.md", "docs/user-onboarding-checklist.md",
  "docs/feature-status-matrix.md", "docs/razorpay-test-mode-checklist.md",
  "docs/billing-test-report.md", "docs/enterprise-runtime-test-report.md",
  "docs/security/access-control-model.md", "docs/security/shared-responsibility-model.md",
  "docs/security/data-retention-policy.md", "docs/integrations/live-integration-test-report.md",
  "docs/final-no-gap-retest-report.md",
];

const n8nExamples = [
  "examples/n8n/manual-analyze-if.json", "examples/n8n/webhook-input-respond.json",
  "examples/n8n/output-guard-save.json", "examples/n8n/invalid-credentials.json",
  "examples/n8n/large-payload-rate-limit.json",
];

test("Phase 6-18 required documentation exists and is substantive", () => {
  for (const path of requiredDocs) {
    assert.equal(existsSync(path), true, `${path} is missing`);
    assert.ok(readFileSync(path, "utf8").length > 300, `${path} is unexpectedly short`);
  }
});

test("n8n readiness examples are valid, inactive importable workflows", () => {
  for (const path of n8nExamples) {
    const workflow = JSON.parse(readFileSync(path, "utf8")) as { name?: string; nodes?: unknown[]; connections?: object; active?: boolean };
    assert.ok(workflow.name?.startsWith("SoterAI"), `${path} has no SoterAI name`);
    assert.ok((workflow.nodes?.length ?? 0) >= 2, `${path} has too few nodes`);
    assert.equal(typeof workflow.connections, "object", `${path} lacks connections`);
    assert.equal(workflow.active, false, `${path} must be inactive on import`);
  }
});

test("external runtime reports do not falsely claim pending evidence passed", () => {
  for (const path of ["docs/billing-test-report.md", "docs/enterprise-runtime-test-report.md", "docs/integrations/live-integration-test-report.md", "docs/vscode-extension-real-runtime-test-report.md", "docs/browser-extension-real-runtime-test-report.md"]) {
    assert.match(readFileSync(path, "utf8"), /EVIDENCE REQUIRED/i, path);
  }
});
