import { z } from "zod";
import { jsonResponse } from "@/lib/apiResponse";
import { authenticateAdvancedSecurity, routeError } from "@/lib/advanced-security/server";
import { db } from "@/lib/db";
import {
  COMPLIANCE_EVIDENCE_STATUSES,
  COMPLIANCE_EVIDENCE_TYPES,
  COMPLIANCE_REPORT_TYPES,
  COMPLIANCE_RISK_LEVELS,
  buildComplianceEvidenceItem,
  createComplianceEvidenceItemId,
  createComplianceEvidenceReportId,
  exportComplianceEvidenceReport,
  generateComplianceEvidenceReport,
  sanitizeEvidenceJson,
  sanitizeEvidenceText,
  type ComplianceEvidenceInput,
  type ComplianceEvidenceItemSnapshot,
  type ComplianceEvidenceType,
} from "@/lib/evidence-vault";

const evidenceType = z.enum(COMPLIANCE_EVIDENCE_TYPES);
const evidenceStatus = z.enum(COMPLIANCE_EVIDENCE_STATUSES);
const reportType = z.enum(COMPLIANCE_REPORT_TYPES);
const riskLevel = z.enum(COMPLIANCE_RISK_LEVELS);

export const evidenceCollectSchema = z.object({
  evidenceType: evidenceType.default("CUSTOM"),
  title: z.string().trim().min(1).max(300).optional(),
  summary: z.string().trim().min(1).max(5000).optional(),
  riskLevel: riskLevel.optional(),
  controlName: z.string().trim().min(1).max(200).optional(),
  status: evidenceStatus.default("ACTIVE"),
  evidence: z.record(z.unknown()).optional(),
  autoCollect: z.boolean().default(false),
  include: z.array(evidenceType).max(20).default([]),
}).refine((value) => value.autoCollect || (Boolean(value.title) && Boolean(value.summary) && Boolean(value.controlName)), {
  message: "title, summary, and controlName are required unless autoCollect is true.",
});

export const evidenceReportGenerateSchema = z.object({
  reportName: z.string().trim().min(1).max(200),
  reportType: reportType.default("SECURITY_POSTURE"),
  evidenceIds: z.array(z.string().trim().min(1).max(200)).max(500).default([]),
  includeTypes: z.array(evidenceType).max(20).default([]),
});

export const evidenceReportExportSchema = z.object({
  format: z.enum(["JSON"]).default("JSON"),
});

type EvidenceAuth = Extract<Awaited<ReturnType<typeof authenticateAdvancedSecurity>>, { ok: true }>["auth"];

type EvidenceItemRow = {
  id: string;
  projectId: string;
  evidenceType: string;
  title: string;
  summary: string;
  riskLevel: string | null;
  controlName: string;
  status: string;
  evidenceJson: unknown;
  contentHash: string | null;
  createdAt: Date;
};

type EvidenceReportRow = {
  id: string;
  projectId: string;
  reportName: string;
  reportType: string;
  status: string;
  summary: string;
  evidenceIdsJson: unknown;
  reportJson: unknown;
  createdAt: Date;
  updatedAt: Date;
};

export async function collectComplianceEvidence(auth: EvidenceAuth, input: z.infer<typeof evidenceCollectSchema>) {
  const candidates: ComplianceEvidenceInput[] = [];
  if (input.autoCollect) {
    candidates.push(...await collectAutomaticEvidence(auth.project.id, input.include.length ? input.include : [...COMPLIANCE_EVIDENCE_TYPES]));
  } else {
    candidates.push({
      evidenceType: input.evidenceType,
      title: input.title ?? `${input.evidenceType} evidence`,
      summary: input.summary ?? "Evidence collected.",
      riskLevel: input.riskLevel,
      controlName: input.controlName ?? input.evidenceType,
      status: input.status,
      evidence: input.evidence,
    });
  }

  const items = [];
  for (const candidate of candidates) {
    const item = buildComplianceEvidenceItem(candidate);
    const id = await persistEvidenceItem(auth.project.id, item);
    items.push({ ...item, id, projectId: auth.project.id });
  }
  return jsonResponse({ items }, { status: 201 });
}

export async function listComplianceEvidenceItems(auth: EvidenceAuth) {
  const rows = await loadEvidenceItems(auth.project.id);
  return jsonResponse({ items: rows.map(publicItem) });
}

export async function generateEvidenceReport(auth: EvidenceAuth, input: z.infer<typeof evidenceReportGenerateSchema>) {
  const rows = await loadEvidenceItems(auth.project.id);
  const selected = rows
    .filter((item) => input.evidenceIds.length === 0 || input.evidenceIds.includes(item.id))
    .filter((item) => input.includeTypes.length === 0 || input.includeTypes.includes(item.evidenceType as ComplianceEvidenceType))
    .slice(0, 500)
    .map(snapshotItem);

  const report = generateComplianceEvidenceReport({
    reportName: input.reportName,
    reportType: input.reportType,
    items: selected,
  });
  const id = createComplianceEvidenceReportId();
  await db.$executeRaw`
    INSERT INTO "ComplianceEvidenceReport" (
      "id", "projectId", "reportName", "reportType", "status", "summary", "evidenceIdsJson", "reportJson", "createdAt", "updatedAt"
    )
    VALUES (
      ${id},
      ${auth.project.id},
      ${report.reportName},
      ${report.reportType}::"ComplianceEvidenceReportType",
      ${report.status}::"ComplianceEvidenceReportStatus",
      ${report.summary},
      ${JSON.stringify(report.evidenceIds)}::jsonb,
      ${JSON.stringify(report.reportJson)}::jsonb,
      NOW(),
      NOW()
    )
  `;

  return jsonResponse({ report: { id, projectId: auth.project.id, ...report } }, { status: 201 });
}

export async function listEvidenceReports(auth: EvidenceAuth) {
  const rows = await loadReports(auth.project.id);
  return jsonResponse({ reports: rows.map(publicReport) });
}

export async function getEvidenceReport(auth: EvidenceAuth, id: string) {
  const report = await findReport(auth.project.id, id);
  if (!report) return jsonResponse({ error: true, message: "Evidence report not found." }, { status: 404 });
  return jsonResponse({ report: publicReport(report) });
}

export async function exportEvidenceReport(auth: EvidenceAuth, id: string) {
  const report = await findReport(auth.project.id, id);
  if (!report) return jsonResponse({ error: true, message: "Evidence report not found." }, { status: 404 });
  const exported = exportComplianceEvidenceReport({
    reportId: report.id,
    projectId: report.projectId,
    reportName: report.reportName,
    reportType: report.reportType,
    summary: report.summary,
    evidenceIds: report.evidenceIdsJson,
    reportJson: report.reportJson,
  });

  await db.$executeRaw`
    UPDATE "ComplianceEvidenceReport"
    SET "status" = 'EXPORTED'::"ComplianceEvidenceReportStatus", "updatedAt" = NOW()
    WHERE "projectId" = ${auth.project.id} AND "id" = ${id}
  `;

  return jsonResponse({ export: exported });
}

export { routeError };

async function persistEvidenceItem(projectId: string, item: ComplianceEvidenceItemSnapshot) {
  const id = createComplianceEvidenceItemId();
  await db.$executeRaw`
    INSERT INTO "ComplianceEvidenceItem" (
      "id", "projectId", "evidenceType", "title", "summary", "riskLevel", "controlName",
      "status", "evidenceJson", "contentHash", "createdAt"
    )
    VALUES (
      ${id},
      ${projectId},
      ${item.evidenceType}::"ComplianceEvidenceType",
      ${item.title},
      ${item.summary},
      ${item.riskLevel ?? null},
      ${item.controlName},
      ${item.status}::"ComplianceEvidenceStatus",
      ${JSON.stringify(item.evidenceJson)}::jsonb,
      ${item.contentHash},
      NOW()
    )
  `;
  return id;
}

async function collectAutomaticEvidence(projectId: string, include: ComplianceEvidenceType[]): Promise<ComplianceEvidenceInput[]> {
  const items: ComplianceEvidenceInput[] = [];
  const wants = (type: ComplianceEvidenceType) => include.includes(type);

  if (wants("POLICY")) {
    const policyCount = await safeCount(`SELECT COUNT(*)::int AS "count" FROM "ProjectPolicy" WHERE "projectId" = $1`, projectId);
    items.push({
      evidenceType: "POLICY",
      title: "AI security policy configuration",
      summary: policyCount > 0 ? "Project policy controls are configured." : "Project policy row is not present; defaults may apply.",
      controlName: "Policy enforcement",
      status: policyCount > 0 ? "PASS" : "WARNING",
      evidence: { policyCount },
    });
  }

  if (wants("GUARD_DECISION")) {
    const total = await safeCount(`SELECT COUNT(*)::int AS "count" FROM "GuardLog" WHERE "projectId" = $1`, projectId);
    const blocked = await safeCount(`SELECT COUNT(*)::int AS "count" FROM "GuardLog" WHERE "projectId" = $1 AND "action" = 'BLOCK'`, projectId);
    items.push({
      evidenceType: "GUARD_DECISION",
      title: "Guard decisions collected",
      summary: `Guard recorded ${total} decisions and ${blocked} blocked requests.`,
      controlName: "Prompt and output guard",
      status: total > 0 ? "ACTIVE" : "WARNING",
      riskLevel: blocked > 0 ? "HIGH" : "LOW",
      evidence: { total, blocked },
    });
  }

  if (wants("REDACTION")) {
    const redacted = await safeCount(`SELECT COUNT(*)::int AS "count" FROM "GuardLog" WHERE "projectId" = $1 AND "redactedText" IS NOT NULL`, projectId);
    items.push({
      evidenceType: "REDACTION",
      title: "Redaction evidence",
      summary: `Redaction controls produced ${redacted} redacted log rows.`,
      controlName: "Sensitive data redaction",
      status: redacted > 0 ? "PASS" : "WARNING",
      evidence: { redacted },
    });
  }

  if (wants("APPROVAL")) {
    const agentApprovals = await safeCount(`SELECT COUNT(*)::int AS "count" FROM "AgentApproval" WHERE "projectId" = $1`, projectId);
    const escrows = await safeCount(`SELECT COUNT(*)::int AS "count" FROM "AgentEscrowTransaction" WHERE "projectId" = $1`, projectId);
    items.push({
      evidenceType: "APPROVAL",
      title: "Human approval and escrow evidence",
      summary: `${agentApprovals} agent approvals and ${escrows} escrow transactions are available as approval evidence.`,
      controlName: "Human-in-the-loop approval",
      status: agentApprovals + escrows > 0 ? "ACTIVE" : "WARNING",
      evidence: { agentApprovals, escrows },
    });
  }

  if (wants("INCIDENT")) {
    const incidents = await safeCount(`SELECT COUNT(*)::int AS "count" FROM "Incident" WHERE "projectId" = $1`, projectId);
    const securityEvents = await safeCount(`SELECT COUNT(*)::int AS "count" FROM "SecurityEvent" WHERE "projectId" = $1`, projectId);
    const lineageIncidents = await safeCount(`SELECT COUNT(*)::int AS "count" FROM "LineageIncident" WHERE "projectId" = $1`, projectId);
    items.push({
      evidenceType: "INCIDENT",
      title: "Incident evidence",
      summary: `${incidents} incidents, ${securityEvents} security events, and ${lineageIncidents} lineage incidents are tracked.`,
      controlName: "Incident response",
      status: incidents + securityEvents + lineageIncidents > 0 ? "ACTIVE" : "PASS",
      riskLevel: incidents > 0 ? "HIGH" : "LOW",
      evidence: { incidents, securityEvents, lineageIncidents },
    });
  }

  if (wants("RAG_SCAN")) {
    const findings = await safeCount(`SELECT COUNT(*)::int AS "count" FROM "RagScanFinding" WHERE "projectId" = $1`, projectId);
    const trusts = await safeCount(`SELECT COUNT(*)::int AS "count" FROM "RagDocumentTrust" WHERE "projectId" = $1`, projectId);
    items.push({
      evidenceType: "RAG_SCAN",
      title: "RAG scan evidence",
      summary: `${findings} RAG scan findings and ${trusts} document trust rows are available.`,
      controlName: "RAG security scanning",
      status: findings + trusts > 0 ? "ACTIVE" : "WARNING",
      evidence: { findings, trusts },
    });
  }

  if (wants("AGENT_PASSPORT")) {
    const passports = await safeCount(`SELECT COUNT(*)::int AS "count" FROM "AgentSessionPassport" WHERE "projectId" = $1`, projectId);
    items.push({
      evidenceType: "AGENT_PASSPORT",
      title: "Agent passport evidence",
      summary: `${passports} agent session passports are tracked.`,
      controlName: "Agent identity and session passport",
      status: passports > 0 ? "ACTIVE" : "WARNING",
      evidence: { passports },
    });
  }

  if (wants("TOOL_CHAIN")) {
    const findings = await safeCount(`SELECT COUNT(*)::int AS "count" FROM "ToolChainFinding" WHERE "projectId" = $1`, projectId);
    items.push({
      evidenceType: "TOOL_CHAIN",
      title: "Tool-chain detector evidence",
      summary: `${findings} tool-chain findings are recorded.`,
      controlName: "Tool-chain attack detector",
      status: findings > 0 ? "ACTIVE" : "WARNING",
      riskLevel: findings > 0 ? "HIGH" : "LOW",
      evidence: { findings },
    });
  }

  if (wants("CANARY")) {
    const tokens = await safeCount(`SELECT COUNT(*)::int AS "count" FROM "CanaryToken" WHERE "projectId" = $1`, projectId);
    const leaks = await safeCount(`SELECT COUNT(*)::int AS "count" FROM "CanaryLeakEvent" WHERE "projectId" = $1`, projectId);
    items.push({
      evidenceType: "CANARY",
      title: "Prompt injection canary evidence",
      summary: `${tokens} canary tokens and ${leaks} leak events are tracked.`,
      controlName: "Prompt injection canary network",
      status: tokens > 0 ? "ACTIVE" : "WARNING",
      riskLevel: leaks > 0 ? "CRITICAL" : "LOW",
      evidence: { tokens, leaks },
    });
  }

  if (wants("RED_TEAM")) {
    const runs = await safeCount(`SELECT COUNT(*)::int AS "count" FROM "RedTeamRun" WHERE "projectId" = $1`, projectId);
    items.push({
      evidenceType: "RED_TEAM",
      title: "Red-team run evidence",
      summary: `${runs} red-team runs are available for audit review.`,
      controlName: "AI red-team validation",
      status: runs > 0 ? "ACTIVE" : "WARNING",
      evidence: { runs },
    });
  }

  if (wants("DATA_FLOW")) {
    const flows = await safeCount(`SELECT COUNT(*)::int AS "count" FROM "ContextFlow" WHERE "projectId" = $1`, projectId);
    items.push({
      evidenceType: "DATA_FLOW",
      title: "Data-flow control evidence",
      summary: `${flows} context flow decisions are recorded.`,
      controlName: "Context lineage firewall",
      status: flows > 0 ? "ACTIVE" : "WARNING",
      evidence: { flows },
    });
  }

  if (wants("COST_CONTROL")) {
    const budgets = await safeCount(`SELECT COUNT(*)::int AS "count" FROM "CostBudget" WHERE "projectId" = $1`, projectId);
    const throttles = await safeCount(`SELECT COUNT(*)::int AS "count" FROM "ThrottleEvent" WHERE "projectId" = $1`, projectId);
    items.push({
      evidenceType: "COST_CONTROL",
      title: "AI cost control evidence",
      summary: `${budgets} budgets and ${throttles} throttle events are tracked.`,
      controlName: "AI cost firewall",
      status: budgets + throttles > 0 ? "ACTIVE" : "WARNING",
      evidence: { budgets, throttles },
    });
  }

  if (items.length === 0 && include.includes("CUSTOM")) {
    items.push({
      evidenceType: "CUSTOM",
      title: "Custom evidence placeholder",
      summary: "No automatic source was selected; custom evidence can be attached manually.",
      controlName: "Custom control",
      status: "WARNING",
      evidence: {},
    });
  }
  return items;
}

async function safeCount(sql: string, projectId: string) {
  try {
    const rows = await db.$queryRawUnsafe<Array<{ count: number }>>(sql, projectId);
    return Number(rows[0]?.count ?? 0);
  } catch {
    return 0;
  }
}

async function loadEvidenceItems(projectId: string) {
  return db.$queryRaw<EvidenceItemRow[]>`
    SELECT "id", "projectId", "evidenceType", "title", "summary", "riskLevel", "controlName",
      "status", "evidenceJson", "contentHash", "createdAt"
    FROM "ComplianceEvidenceItem"
    WHERE "projectId" = ${projectId}
    ORDER BY "createdAt" DESC
    LIMIT 500
  `;
}

async function loadReports(projectId: string) {
  return db.$queryRaw<EvidenceReportRow[]>`
    SELECT "id", "projectId", "reportName", "reportType", "status", "summary", "evidenceIdsJson",
      "reportJson", "createdAt", "updatedAt"
    FROM "ComplianceEvidenceReport"
    WHERE "projectId" = ${projectId}
    ORDER BY "createdAt" DESC
    LIMIT 100
  `;
}

async function findReport(projectId: string, id: string) {
  const rows = await db.$queryRaw<EvidenceReportRow[]>`
    SELECT "id", "projectId", "reportName", "reportType", "status", "summary", "evidenceIdsJson",
      "reportJson", "createdAt", "updatedAt"
    FROM "ComplianceEvidenceReport"
    WHERE "projectId" = ${projectId} AND "id" = ${id}
    LIMIT 1
  `;
  return rows[0] ?? null;
}

function snapshotItem(row: EvidenceItemRow): ComplianceEvidenceItemSnapshot {
  return {
    id: row.id,
    projectId: row.projectId,
    evidenceType: row.evidenceType as ComplianceEvidenceType,
    title: row.title,
    summary: row.summary,
    riskLevel: row.riskLevel as ComplianceEvidenceItemSnapshot["riskLevel"],
    controlName: row.controlName,
    status: row.status as ComplianceEvidenceItemSnapshot["status"],
    evidenceJson: sanitizeEvidenceJson(row.evidenceJson) as Record<string, unknown>,
    contentHash: row.contentHash ?? "",
    createdAt: row.createdAt,
  };
}

function publicItem(row: EvidenceItemRow) {
  return snapshotItem(row);
}

function publicReport(row: EvidenceReportRow) {
  return {
    id: row.id,
    projectId: row.projectId,
    reportName: sanitizeEvidenceText(row.reportName),
    reportType: row.reportType,
    status: row.status,
    summary: sanitizeEvidenceText(row.summary),
    evidenceIds: Array.isArray(row.evidenceIdsJson) ? row.evidenceIdsJson : [],
    report: sanitizeEvidenceJson(row.reportJson),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
