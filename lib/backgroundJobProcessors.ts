import { Prisma } from "@prisma/client";
import { claimNextBackgroundJob, markJobComplete, markJobFailed, type BackgroundJobType } from "./backgroundJobs";
import { db } from "./db";
import { generateAndStoreMonthlyReport } from "./reports";
import { buildMonthlyReportPdf } from "./pdf/monthlyReport";
import {
  fetchGuardLogs,
  fetchWebhookDeliveries,
  guardLogToRow,
  signManifest,
  webhookDeliveryToRow,
} from "./audit/export";
import { sandboxDocument } from "./rag/documentSandbox";
import { emitSecurityEvent } from "./events/emit";
import { runRedTeamSuite } from "./redteam/runner";
import { evaluateModel, getDefaultBackend, HeuristicMLBackend } from "./ml";
import { deliverScheduledReport } from "./reports/scheduled";

const DEFAULT_RAG_ROLES = ["OWNER", "ADMIN", "DEVELOPER", "SECURITY_ANALYST", "BILLING", "VIEWER"];

type Payload = Record<string, unknown>;

export async function processOneBackgroundJob(types?: BackgroundJobType[]) {
  const job = await claimNextBackgroundJob(types);
  if (!job) return null;
  try {
    const result = await processJob(job.type, job.payload as Payload);
    await markJobComplete(job.id, result as Prisma.InputJsonValue);
    return { id: job.id, type: job.type, ok: true };
  } catch (error) {
    await markJobFailed(job.id, error);
    return { id: job.id, type: job.type, ok: false };
  }
}

async function processJob(type: BackgroundJobType, payload: Payload) {
  if (type === "MONTHLY_REPORT") return processMonthlyReport(payload);
  if (type === "PDF_REPORT") return processPdfReport(payload);
  if (type === "AUDIT_EXPORT") return processAuditExport(payload);
  if (type === "RAG_DOCUMENT_SCAN") return processRagScan(payload);
  if (type === "REDTEAM_RUN") return processRedTeamRun(payload);
  if (type === "ML_EVALUATION") return processMlEvaluation(payload);
  if (type === "SCHEDULED_REPORT_DELIVERY") return processScheduledReport(payload);
  throw new Error(`Unsupported background job type: ${type}`);
}

async function processMonthlyReport(payload: Payload) {
  const projectId = stringPayload(payload, "projectId");
  const month = numberPayload(payload, "month");
  const year = numberPayload(payload, "year");
  const summary = await generateAndStoreMonthlyReport(projectId, new Date(Date.UTC(year, month - 1, 1)));
  return { projectId, month: summary.month, year: summary.year, totalRequests: summary.totalRequests };
}

async function processPdfReport(payload: Payload) {
  const projectId = stringPayload(payload, "projectId");
  const month = numberPayload(payload, "month");
  const year = numberPayload(payload, "year");
  const buffer = await buildMonthlyReportPdf({ projectId, month, year });
  return { projectId, month, year, byteLength: buffer.byteLength };
}

async function processAuditExport(payload: Payload) {
  const exportId = stringPayload(payload, "exportId");
  const organizationId = stringPayload(payload, "organizationId");
  const kind = stringPayload(payload, "kind") as "GUARD_LOGS" | "WEBHOOK_DELIVERIES";
  const fromDate = typeof payload.fromDate === "string" ? new Date(payload.fromDate) : null;
  const toDate = typeof payload.toDate === "string" ? new Date(payload.toDate) : null;
  const projectId = typeof payload.projectId === "string" ? payload.projectId : null;
  const rows = kind === "GUARD_LOGS"
    ? (await fetchGuardLogs({ organizationId, fromDate, toDate, projectId })).map(guardLogToRow)
    : (await fetchWebhookDeliveries({ organizationId, fromDate, toDate, projectId })).map(webhookDeliveryToRow);
  const generatedAt = new Date().toISOString();
  const signature = signManifest(rows.length, kind, organizationId, generatedAt);
  await db.auditExport.update({
    where: { id: exportId },
    data: { status: "READY", rowCount: rows.length, signature },
  });
  return { exportId, rows: rows.length, signature };
}

async function processRagScan(payload: Payload) {
  const collectionId = stringPayload(payload, "collectionId");
  const fileName = stringPayload(payload, "fileName");
  const fileType = stringPayload(payload, "fileType");
  const fileSize = numberPayload(payload, "fileSize");
  const uploadedById = stringPayload(payload, "uploadedById");
  const contentBase64 = stringPayload(payload, "contentBase64");
  const collection = await db.ragCollection.findUnique({ where: { id: collectionId } });
  if (!collection) throw new Error("RAG collection not found.");
  const sandbox = await sandboxDocument({ fileName, declaredMimeType: fileType, content: Buffer.from(contentBase64, "base64") });
  const scan = sandbox.scan;
  const previous = await db.ragDocument.findFirst({ where: { collectionId, hash: scan.hash }, orderBy: { version: "desc" }, select: { version: true } });
  const document = await db.ragDocument.create({
    data: {
      collectionId,
      fileName,
      fileType: fileType || "application/octet-stream",
      fileSize,
      hash: scan.hash,
      version: (previous?.version ?? 0) + 1,
      status: scan.status,
      trustScore: scan.trustScore,
      riskTypes: scan.riskTypes,
      uploadedById,
      pageCount: sandbox.pageCount,
      extractionMethod: sandbox.extractionMethod,
      sandboxMetadata: sandbox.metadata as Prisma.InputJsonValue,
      chunks: {
        create: scan.chunks.map((chunk) => ({
          chunkIndex: chunk.chunkIndex,
          textRedacted: chunk.textRedacted,
          hash: chunk.hash,
          riskScore: chunk.riskScore,
          riskTypes: chunk.riskTypes,
          allowedRoles: DEFAULT_RAG_ROLES,
          metadata: chunk.metadata as Prisma.InputJsonValue,
        })),
      },
    },
    include: { chunks: { select: { id: true, chunkIndex: true } } },
  });
  const chunkIds = new Map(document.chunks.map((chunk) => [chunk.chunkIndex, chunk.id]));
  if (scan.findings.length) {
    await db.ragScanFinding.createMany({
      data: scan.findings.map((finding) => ({
        documentId: document.id,
        chunkId: chunkIds.get(finding.chunkIndex),
        type: finding.type,
        severity: finding.severity,
        message: finding.message,
        redactedSnippet: finding.redactedSnippet,
      })),
    });
  }
  if (scan.quarantine) {
    await emitSecurityEvent({
      organizationId: collection.organizationId,
      projectId: collection.projectId,
      eventType: "rag.document_quarantined",
      severity: scan.riskScore >= 86 ? "CRITICAL" : "HIGH",
      riskTypes: scan.riskTypes,
      action: "QUARANTINE",
      source: "rag.document_sandbox",
      metadata: { documentId: document.id, fileType: sandbox.validation.detectedMimeType, extractionMethod: sandbox.extractionMethod },
    });
  }
  return { documentId: document.id, status: document.status, trustScore: document.trustScore };
}

async function processRedTeamRun(payload: Payload) {
  const runId = stringPayload(payload, "runId");
  const projectId = stringPayload(payload, "projectId");
  const authorizedProjectId = stringPayload(payload, "authorizedProjectId");
  const suite = await db.redTeamSuite.findUnique({ where: { id: stringPayload(payload, "suiteId") }, include: { scenarios: true } });
  if (!suite) throw new Error("Red-team suite not found.");
  const run = await runRedTeamSuite({ projectId, authorizedProjectId, confirmed: true });
  await db.redTeamRun.update({
    where: { id: runId },
    data: {
      status: "COMPLETED",
      passed: run.passed,
      failed: run.failed,
      completedAt: new Date(),
      results: {
        create: run.results.map((result) => ({
          scenarioId: suite.scenarios.find((scenario) => scenario.key === result.scenario.key)!.id,
          passed: result.passed,
          observedAction: result.observedAction,
          riskTypes: result.riskTypes,
          recommendation: result.recommendation,
        })),
      },
    },
  });
  return { runId, passed: run.passed, failed: run.failed };
}

async function processMlEvaluation(payload: Payload) {
  const modelVersionId = stringPayload(payload, "modelVersionId");
  const datasetId = stringPayload(payload, "datasetId");
  const backendName = typeof payload.backend === "string" ? payload.backend : "default";
  const [model, dataset] = await Promise.all([
    db.mLModelVersion.findUnique({ where: { id: modelVersionId } }),
    db.mLDataset.findUnique({ where: { id: datasetId } }),
  ]);
  if (!model || !dataset) throw new Error("Model version or dataset not found.");
  const backend = backendName === "heuristic" ? new HeuristicMLBackend() : getDefaultBackend();
  const outcome = await evaluateModel(model, dataset, backend);
  return { evaluationId: outcome.evaluation.id, totalExamples: outcome.metrics.totalExamples, f1: outcome.metrics.f1 };
}

async function processScheduledReport(payload: Payload) {
  const delivery = await deliverScheduledReport(stringPayload(payload, "scheduleId"));
  return delivery;
}

function stringPayload(payload: Payload, key: string) {
  const value = payload[key];
  if (typeof value !== "string" || !value) throw new Error(`Missing background job payload string: ${key}`);
  return value;
}

function numberPayload(payload: Payload, key: string) {
  const value = payload[key];
  if (typeof value !== "number" || !Number.isFinite(value)) throw new Error(`Missing background job payload number: ${key}`);
  return value;
}
