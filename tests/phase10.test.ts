import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { test } from "node:test";

const requiredFiles = [
  "docs/growth/lead-list-template.csv",
  "docs/growth/priority-targets.csv",
  "docs/growth/outreach-draft-queue.csv",
  "docs/growth/outreach-campaign-phase10.md",
  "docs/growth/free-security-audit-workflow.md",
  "docs/growth/demo-script.md",
  "docs/growth/beta-onboarding-execution.md",
  "docs/growth/pricing-validation-results.md",
  "docs/growth/pricing-validation-interviews.csv",
  "docs/growth/objection-handling.md",
  "docs/growth/first-case-study-template.md",
  "docs/growth/public-launch-checklist.md",
  "docs/growth/business-kpi-tracking.md",
  "docs/growth/phase10-weekly-plan.md",
  "docs/phase11-recommendation.md",
  "app/admin/growth/metrics/page.tsx",
];

function dataRows(path: string) {
  return readFileSync(path, "utf8").trim().split(/\r?\n/).length - 1;
}

test("Phase 10 required growth execution assets exist", () => {
  for (const file of requiredFiles) assert.equal(existsSync(file), true, `${file} is missing`);
});

test("Phase 10 lead system contains 100 accounts and the required fields", () => {
  const path = "docs/growth/lead-list-template.csv";
  const leadList = readFileSync(path, "utf8");
  assert.equal(dataRows(path), 100);
  for (const field of ["companyName", "website", "contactName", "role", "email", "LinkedIn", "segment", "source", "chatbotType", "likelyPain", "offer", "outreachStatus", "lastContacted", "nextFollowUp", "notes", "demoStatus", "betaStatus", "paidStatus"]) {
    assert.match(leadList.split(/\r?\n/, 1)[0], new RegExp(field));
  }
  for (const segment of ["AI_CHATBOT_AGENCY", "RAG_CHATBOT_BUILDER", "SMALL_SAAS_FOUNDER", "WORDPRESS_WOOCOMMERCE_PROSPECT", "ENTERPRISE_SECURITY_TEAM"]) {
    assert.match(leadList, new RegExp(segment));
  }
});

test("Phase 10 prepares 50 unsent messages and identifies demo and beta priorities", () => {
  const draftsPath = "docs/growth/outreach-draft-queue.csv";
  const drafts = readFileSync(draftsPath, "utf8");
  const priorities = readFileSync("docs/growth/priority-targets.csv", "utf8");
  assert.equal(dataRows(draftsPath), 50);
  assert.equal((drafts.match(/DRAFT_NOT_SENT/g) ?? []).length, 50);
  assert.equal((priorities.match(/,BETA_AND_DEMO,/g) ?? []).length, 5);
  assert.equal((priorities.match(/,(?:BETA_AND_DEMO|DEMO),/g) ?? []).length, 15);
});

test("Phase 10 audit, demo, and case-study workflows require authorization and evidence", () => {
  const combined = [
    "docs/growth/free-security-audit-workflow.md",
    "docs/growth/demo-script.md",
    "docs/growth/first-case-study-template.md",
  ].map((file) => readFileSync(file, "utf8")).join("\n");
  assert.match(combined, /written permission|written customer approval|owned or explicitly authorized/i);
  assert.match(combined, /synthetic data|synthetic prompt|synthetic tests/i);
  assert.doesNotMatch(
    combined,
    /\b(?:provides|offers|delivers)\s+(?:100%|complete|perfect)\s+(?:security|protection)\b/i,
  );
  assert.doesNotMatch(
    combined,
    /\bguaranteed\s+(?:100%|complete|perfect)\s+(?:security|protection)\b/i,
  );
  assert.match(combined, /does not guarantee complete protection|does not prove complete security/i);
});

test("Phase 10 KPI dashboard includes outreach, activity, and conversion indicators", () => {
  const page = readFileSync("app/admin/growth/metrics/page.tsx", "utf8");
  for (const value of ["outreach.sent", "outreach.replied", "Reply rate", "Active projects (14d)", "Lead-to-paid indicator"]) {
    assert.match(page, new RegExp(value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
});

test("Phase 10 materials do not invent traction or absolute protection", () => {
  const combined = requiredFiles
    .filter((file) => file.endsWith(".md") || file.endsWith(".tsx"))
    .map((file) => readFileSync(file, "utf8"))
    .join("\n");
  assert.doesNotMatch(combined, /trusted by \d+\+? (?:customers|companies)/i);
  assert.doesNotMatch(combined, /(?:we have|already have) \d+ (?:paid customers|agency partners|beta users)/i);
  assert.match(combined, /does not guarantee complete protection|not a security guarantee|No AI security tool can guarantee complete protection/i);
});
