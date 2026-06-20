import assert from "node:assert/strict";
import test from "node:test";
import { existsSync, readFileSync } from "node:fs";
import {
  buildComplianceEvidenceItem,
  exportComplianceEvidenceReport,
  generateComplianceEvidenceReport,
  sanitizeEvidenceJson,
} from "../lib/evidence-vault";

const SECRET = "sk-proj-abcdefghijklmnopqrstuvwxyz123456";

test("Evidence Vault 1: collect policy evidence", () => {
  const item = buildComplianceEvidenceItem({
    evidenceType: "POLICY",
    title: "Policy enabled",
    summary: "Prompt injection and secret blocking controls are enabled.",
    controlName: "Policy enforcement",
    status: "PASS",
    evidence: { blockPromptInjection: true, blockSecrets: true },
  });
  assert.equal(item.evidenceType, "POLICY");
  assert.equal(item.status, "PASS");
  assert.match(item.contentHash, /^[a-f0-9]{64}$/);
});

test("Evidence Vault 2: collect guard decision evidence", () => {
  const item = buildComplianceEvidenceItem({
    evidenceType: "GUARD_DECISION",
    title: "Guard blocked attack",
    summary: "Input guard blocked prompt injection.",
    controlName: "Prompt and output guard",
    status: "PASS",
    riskLevel: "HIGH",
    evidence: { decision: "BLOCK", riskTypes: ["PROMPT_INJECTION"] },
  });
  assert.equal(item.evidenceType, "GUARD_DECISION");
  assert.equal(item.riskLevel, "HIGH");
});

test("Evidence Vault 3: collect redaction evidence without raw secret", () => {
  const item = buildComplianceEvidenceItem({
    evidenceType: "REDACTION",
    title: "Secret redacted",
    summary: `A secret ${SECRET} was redacted before persistence.`,
    controlName: "Sensitive data redaction",
    status: "PASS",
    evidence: { apiKey: SECRET, redactedText: `OPENAI_API_KEY=${SECRET}` },
  });
  const serialized = JSON.stringify(item);
  assert.equal(serialized.includes(SECRET), false);
  assert.equal((item.evidenceJson.apiKey as string), "[REDACTED_KEY]");
});

test("Evidence Vault 4: collect approval evidence", () => {
  const item = buildComplianceEvidenceItem({
    evidenceType: "APPROVAL",
    title: "Escrow approval recorded",
    summary: "High-risk email send was approved through escrow.",
    controlName: "Human-in-the-loop approval",
    status: "ACTIVE",
    evidence: { status: "APPROVED", actorType: "USER" },
  });
  assert.equal(item.evidenceType, "APPROVAL");
  assert.equal(item.controlName, "Human-in-the-loop approval");
});

test("Evidence Vault 5: collect incident evidence", () => {
  const item = buildComplianceEvidenceItem({
    evidenceType: "INCIDENT",
    title: "Canary leak incident",
    summary: "A protected canary was detected in final output.",
    controlName: "Incident response",
    status: "WARNING",
    riskLevel: "CRITICAL",
    evidence: { incidentType: "CANARY_LEAK", status: "OPEN" },
  });
  assert.equal(item.status, "WARNING");
  assert.equal(item.riskLevel, "CRITICAL");
});

test("Evidence Vault 6: generate security posture report", () => {
  const items = [
    buildComplianceEvidenceItem({
      evidenceType: "POLICY",
      title: "Policy enabled",
      summary: "Policy controls are enabled.",
      controlName: "Policy enforcement",
      status: "PASS",
      evidence: {},
    }),
    buildComplianceEvidenceItem({
      evidenceType: "GUARD_DECISION",
      title: "Guard blocked attack",
      summary: "A prompt injection attempt was blocked.",
      controlName: "Prompt and output guard",
      status: "PASS",
      riskLevel: "HIGH",
      evidence: {},
    }),
  ].map((item, index) => ({ ...item, id: `evidence-${index}` }));
  const report = generateComplianceEvidenceReport({
    reportName: "Security posture",
    reportType: "SECURITY_POSTURE",
    items,
  });
  assert.equal(report.status, "GENERATED");
  assert.equal(report.evidenceIds.length, 2);
  assert.match(report.summary, /2 evidence items/);
});

test("Evidence Vault 7: report and export do not include raw secrets", () => {
  const item = {
    ...buildComplianceEvidenceItem({
      evidenceType: "CUSTOM",
      title: "Secret handling",
      summary: `Secret ${SECRET} was redacted.`,
      controlName: "Custom control",
      status: "PASS",
      evidence: { token: SECRET, note: `value=${SECRET}` },
    }),
    id: "evidence-secret",
  };
  const report = generateComplianceEvidenceReport({
    reportName: "Secret-safe report",
    reportType: "AUDIT_EXPORT",
    items: [item],
  });
  const exported = exportComplianceEvidenceReport({
    reportId: "report-1",
    projectId: "project-1",
    reportName: report.reportName,
    reportType: report.reportType,
    summary: report.summary,
    evidenceIds: report.evidenceIds,
    reportJson: report.reportJson,
  });
  assert.equal(JSON.stringify(report).includes(SECRET), false);
  assert.equal(JSON.stringify(exported).includes(SECRET), false);
  assert.match(exported.contentHash as string, /^[a-f0-9]{64}$/);
});

test("Evidence Vault 8: cross-project access is denied by scoped SQL", () => {
  const source = readFileSync("lib/evidence-vault/server.ts", "utf8");
  assert.match(source, /WHERE "projectId" = \$\{projectId\}/);
  assert.match(source, /WHERE "projectId" = \$\{projectId\} AND "id" = \$\{id\}/);
  assert.match(source, /WHERE "projectId" = \$\{auth\.project\.id\} AND "id" = \$\{id\}/);
});

test("Evidence Vault 9: export API and dashboard routes exist", () => {
  assert.equal(existsSync("app/dashboard/evidence-vault/page.tsx"), true);
  assert.equal(existsSync("app/api/evidence/collect/route.ts"), true);
  assert.equal(existsSync("app/api/evidence/items/route.ts"), true);
  assert.equal(existsSync("app/api/evidence/report/generate/route.ts"), true);
  assert.equal(existsSync("app/api/evidence/reports/route.ts"), true);
  assert.equal(existsSync("app/api/evidence/reports/[id]/route.ts"), true);
  assert.equal(existsSync("app/api/evidence/reports/[id]/export/route.ts"), true);
  assert.equal(existsSync("packages/sdk/src/evidence-vault.ts"), true);
});

test("Evidence Vault 10: existing guard APIs still pass", () => {
  assert.equal(existsSync("app/api/guard/input/route.ts"), true);
  assert.equal(existsSync("app/api/guard/output/route.ts"), true);
  assert.equal(existsSync("app/api/guard/analyze/route.ts"), true);
});

test("Evidence Vault 11: sanitizer redacts secret-like keys recursively", () => {
  const safe = sanitizeEvidenceJson({ nested: { password: "super-secret", note: `token ${SECRET}` } });
  const serialized = JSON.stringify(safe);
  assert.equal(serialized.includes("super-secret"), false);
  assert.equal(serialized.includes(SECRET), false);
});
