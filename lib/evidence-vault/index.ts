import { createHash, randomUUID } from "crypto";
import { sanitizeLogText } from "@/lib/guard/logSafety";

export const COMPLIANCE_EVIDENCE_TYPES = [
  "POLICY",
  "GUARD_DECISION",
  "REDACTION",
  "APPROVAL",
  "INCIDENT",
  "RAG_SCAN",
  "AGENT_PASSPORT",
  "TOOL_CHAIN",
  "CANARY",
  "RED_TEAM",
  "DATA_FLOW",
  "COST_CONTROL",
  "CUSTOM",
] as const;

export const COMPLIANCE_EVIDENCE_STATUSES = ["ACTIVE", "PASS", "FAIL", "WARNING", "RESOLVED"] as const;
export const COMPLIANCE_REPORT_TYPES = ["SECURITY_POSTURE", "INCIDENT_SUMMARY", "CUSTOMER_TRUST", "AUDIT_EXPORT", "AI_RISK_REVIEW"] as const;
export const COMPLIANCE_REPORT_STATUSES = ["DRAFT", "GENERATED", "EXPORTED"] as const;
export const COMPLIANCE_RISK_LEVELS = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;

export type ComplianceEvidenceType = (typeof COMPLIANCE_EVIDENCE_TYPES)[number];
export type ComplianceEvidenceStatus = (typeof COMPLIANCE_EVIDENCE_STATUSES)[number];
export type ComplianceReportType = (typeof COMPLIANCE_REPORT_TYPES)[number];
export type ComplianceReportStatus = (typeof COMPLIANCE_REPORT_STATUSES)[number];
export type ComplianceRiskLevel = (typeof COMPLIANCE_RISK_LEVELS)[number];

export interface ComplianceEvidenceInput {
  evidenceType: ComplianceEvidenceType;
  title: string;
  summary: string;
  riskLevel?: ComplianceRiskLevel;
  controlName: string;
  status?: ComplianceEvidenceStatus;
  evidence?: Record<string, unknown>;
}

export interface ComplianceEvidenceItemSnapshot extends ComplianceEvidenceInput {
  id?: string;
  projectId?: string;
  status: ComplianceEvidenceStatus;
  evidenceJson: Record<string, unknown>;
  contentHash: string;
  createdAt?: Date | string;
}

export interface ComplianceEvidenceReportInput {
  reportName: string;
  reportType: ComplianceReportType;
  items: ComplianceEvidenceItemSnapshot[];
}

export function createComplianceEvidenceItemId() {
  return `evidence_item_${randomUUID()}`;
}

export function createComplianceEvidenceReportId() {
  return `evidence_report_${randomUUID()}`;
}

export function hashEvidenceContent(value: unknown) {
  return createHash("sha256").update(stableStringify(value)).digest("hex");
}

export function buildComplianceEvidenceItem(input: ComplianceEvidenceInput): ComplianceEvidenceItemSnapshot {
  const safeEvidence = sanitizeEvidenceRecord(input.evidence ?? {});
  const item = {
    evidenceType: input.evidenceType,
    title: sanitizeEvidenceText(input.title),
    summary: sanitizeEvidenceText(input.summary),
    riskLevel: input.riskLevel,
    controlName: sanitizeEvidenceText(input.controlName),
    status: input.status ?? "ACTIVE",
    evidenceJson: safeEvidence,
  };
  return {
    ...item,
    contentHash: hashEvidenceContent(item),
  };
}

export function generateComplianceEvidenceReport(input: ComplianceEvidenceReportInput) {
  const items = input.items.map(normalizeEvidenceItem);
  const byType = countBy(items, "evidenceType");
  const byStatus = countBy(items, "status");
  const riskSummary = countRisk(items);
  const failedOrWarning = items.filter((item) => item.status === "FAIL" || item.status === "WARNING" || item.riskLevel === "HIGH" || item.riskLevel === "CRITICAL");
  const evidenceIds = items.map((item) => item.id).filter((id): id is string => Boolean(id));
  const enabledControls = [...new Set(items.map((item) => item.controlName))].sort();

  const reportJson = sanitizeEvidenceJson({
    sections: [
      section("Executive summary", `${items.length} evidence items packaged across ${enabledControls.length} controls.`),
      section("Enabled AI security controls", enabledControls),
      section("Attack prevention summary", summarizeTypes(items, ["GUARD_DECISION", "TOOL_CHAIN", "CANARY", "RED_TEAM", "INCIDENT"])),
      section("Data protection summary", summarizeTypes(items, ["REDACTION", "RAG_SCAN", "DATA_FLOW", "POLICY"])),
      section("Agent security summary", summarizeTypes(items, ["AGENT_PASSPORT", "APPROVAL", "TOOL_CHAIN"])),
      section("RAG security summary", summarizeTypes(items, ["RAG_SCAN", "DATA_FLOW"])),
      section("Human approval evidence", summarizeTypes(items, ["APPROVAL"])),
      section("Incident history", summarizeTypes(items, ["INCIDENT", "CANARY"])),
      section("Remaining risks", failedOrWarning.map((item) => ({
        id: item.id,
        title: item.title,
        status: item.status,
        riskLevel: item.riskLevel ?? "LOW",
      }))),
      section("Recommendations", buildRecommendations(items)),
    ],
    coverage: {
      byType,
      byStatus,
      riskSummary,
      controlCount: enabledControls.length,
      itemCount: items.length,
    },
    generatedAt: new Date().toISOString(),
  });

  const summary = sanitizeEvidenceText(`${input.reportType.replace(/_/g, " ")} report includes ${items.length} evidence items, ${failedOrWarning.length} open warnings or high-risk items, and ${enabledControls.length} controls.`);
  return {
    reportName: sanitizeEvidenceText(input.reportName),
    reportType: input.reportType,
    status: "GENERATED" as ComplianceReportStatus,
    summary,
    evidenceIds,
    reportJson,
  };
}

export function exportComplianceEvidenceReport(input: {
  reportId: string;
  projectId: string;
  reportName: string;
  reportType: ComplianceReportType | string;
  summary: string;
  evidenceIds: unknown;
  reportJson: unknown;
  exportedAt?: string;
}) {
  const payload = sanitizeEvidenceRecord({
    format: "cybersecurityguard.compliance-evidence.v1",
    reportId: input.reportId,
    projectId: input.projectId,
    reportName: input.reportName,
    reportType: input.reportType,
    summary: input.summary,
    evidenceIds: input.evidenceIds,
    report: input.reportJson,
    exportedAt: input.exportedAt ?? new Date().toISOString(),
  });
  return {
    ...payload,
    contentHash: hashEvidenceContent(payload),
  };
}

export function sanitizeEvidenceText(value: string) {
  return sanitizeLogText(value).slice(0, 10_000);
}

export function sanitizeEvidenceJson(value: unknown, depth = 0): Record<string, unknown> | unknown[] | string | number | boolean | null {
  if (depth > 5) return "[TRUNCATED]";
  if (value === null || typeof value === "number" || typeof value === "boolean") return value;
  if (typeof value === "string") return sanitizeEvidenceText(value);
  if (Array.isArray(value)) return value.slice(0, 100).map((item) => sanitizeEvidenceJson(item, depth + 1));
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value as Record<string, unknown>).slice(0, 100)) {
      if (/token|secret|password|authorization|api.?key|cookie|private.?key|otp/i.test(key)) {
        out[key] = "[REDACTED_KEY]";
      } else {
        out[sanitizeEvidenceText(key).slice(0, 120)] = sanitizeEvidenceJson(item, depth + 1);
      }
    }
    return out;
  }
  return null;
}

export function sanitizeEvidenceRecord(value: unknown): Record<string, unknown> {
  const safe = sanitizeEvidenceJson(value);
  return safe && typeof safe === "object" && !Array.isArray(safe) ? safe : {};
}

function normalizeEvidenceItem(item: ComplianceEvidenceItemSnapshot): ComplianceEvidenceItemSnapshot {
  return {
    id: item.id,
    projectId: item.projectId,
    evidenceType: item.evidenceType,
    title: sanitizeEvidenceText(item.title),
    summary: sanitizeEvidenceText(item.summary),
    riskLevel: item.riskLevel,
    controlName: sanitizeEvidenceText(item.controlName),
    status: item.status,
    evidenceJson: sanitizeEvidenceRecord(item.evidenceJson),
    contentHash: item.contentHash,
    createdAt: item.createdAt,
  };
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  return `{${Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`).join(",")}}`;
}

function countBy(items: ComplianceEvidenceItemSnapshot[], key: "evidenceType" | "status") {
  return items.reduce<Record<string, number>>((acc, item) => {
    const value = String(item[key] ?? "UNKNOWN");
    acc[value] = (acc[value] ?? 0) + 1;
    return acc;
  }, {});
}

function countRisk(items: ComplianceEvidenceItemSnapshot[]) {
  return items.reduce<Record<string, number>>((acc, item) => {
    const value = item.riskLevel ?? "LOW";
    acc[value] = (acc[value] ?? 0) + 1;
    return acc;
  }, {});
}

function summarizeTypes(items: ComplianceEvidenceItemSnapshot[], types: ComplianceEvidenceType[]) {
  return items.filter((item) => types.includes(item.evidenceType)).map((item) => ({
    id: item.id,
    type: item.evidenceType,
    title: item.title,
    status: item.status,
    riskLevel: item.riskLevel ?? "LOW",
    controlName: item.controlName,
  }));
}

function section(title: string, content: unknown) {
  return { title, content };
}

function buildRecommendations(items: ComplianceEvidenceItemSnapshot[]) {
  const recommendations = new Set<string>();
  if (!items.some((item) => item.evidenceType === "POLICY")) recommendations.add("Collect current policy evidence before sharing posture reports.");
  if (!items.some((item) => item.evidenceType === "APPROVAL")) recommendations.add("Attach approval evidence for high-risk agent actions.");
  if (!items.some((item) => item.evidenceType === "RAG_SCAN")) recommendations.add("Attach RAG scan evidence for retrieval-heavy deployments.");
  if (items.some((item) => item.status === "FAIL" || item.riskLevel === "CRITICAL")) recommendations.add("Resolve critical or failed controls before customer distribution.");
  if (recommendations.size === 0) recommendations.add("Continue periodic evidence collection and review aging evidence before renewal cycles.");
  return [...recommendations];
}
