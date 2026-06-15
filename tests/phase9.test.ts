import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { test } from "node:test";

const requiredFiles = [
  "docs/go-to-market/icp.md",
  "docs/sales/crm-template.csv",
  "docs/sales/beta-customer-list.csv",
  "docs/sales/beta-onboarding-playbook.md",
  "docs/sales/free-audit-template.md",
  "docs/sales/security-report-sample.md",
  "docs/sales/outreach-templates.md",
  "docs/sales/agency-partner-program.md",
  "docs/sales/enterprise-pilot-package.md",
  "docs/sales/pricing-validation.md",
  "docs/sales/case-study-template.md",
  "docs/launch/public-launch-plan.md",
  "docs/investor/one-pager.md",
  "docs/investor/pitch-deck-outline.md",
  "docs/investor/problem-market-solution.md",
  "app/admin/growth/metrics/page.tsx",
];

test("Phase 9 required sales, launch, investor, and metrics assets exist", () => {
  for (const file of requiredFiles) assert.equal(existsSync(file), true, `${file} is missing`);
});

test("founder-led CRM template contains the required fields and statuses", () => {
  const crm = readFileSync("docs/sales/crm-template.csv", "utf8");
  for (const field of ["company", "contact_name", "segment", "source", "status", "last_contacted", "next_follow_up", "notes", "demo_scheduled_at", "pilot_status", "plan_interest", "expected_value_inr"]) {
    assert.match(crm, new RegExp(field));
  }
  const playbook = readFileSync("docs/sales/beta-onboarding-playbook.md", "utf8");
  for (const status of ["PAID", "ACTIVE_BETA", "FOLLOW_UP_LATER", "LOST"]) assert.match(playbook, new RegExp(status));
});

test("growth metrics page remains behind the authenticated admin layout", () => {
  const layout = readFileSync("app/admin/layout.tsx", "utf8");
  const page = readFileSync("app/admin/growth/metrics/page.tsx", "utf8");
  assert.match(layout, /await auth\(\)/);
  assert.match(layout, /isAdmin/);
  assert.match(page, /Business KPI dashboard/);
});

test("Phase 9 materials use honest defensive positioning", () => {
  const combined = requiredFiles.filter((file) => file.endsWith(".md") || file.endsWith(".tsx")).map((file) => readFileSync(file, "utf8")).join("\n");
  assert.doesNotMatch(
    combined,
    /\b(?:provides|offers|delivers)\s+(?:complete|perfect|100%)\s+(?:security|protection)\b/i,
  );
  assert.doesNotMatch(
    combined,
    /\bguaranteed\s+(?:complete|perfect|100%)\s+(?:security|protection)\b/i,
  );
  assert.doesNotMatch(combined, /trusted by \d+\+? (?:customers|companies)/i);
  assert.match(
    combined,
    /does not guarantee complete protection|not complete protection|not a guarantee/i,
  );
  assert.match(combined, /OWASP LLM Top 10 aligned/);
  assert.match(combined, /risk reduction|risk-reduction/);
});

test("Phase 7 production-readiness assets remain present", () => {
  assert.equal(existsSync("docs/phase7-performance-audit.md"), true);
  assert.equal(existsSync("app/admin/system-health/page.tsx"), true);
  assert.equal(existsSync("docs/self-hosted-deployment.md"), true);
});
