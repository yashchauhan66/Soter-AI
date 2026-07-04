import { db } from "../../lib/db";
import { writeEventDirectToDynamo, type HeavyEvent } from "../../lib/events/store";

const SUPPORTED_TYPES = [
  "guard_logs",
  "audit_logs",
  "webhook_delivery_logs",
  "incident_events",
  "report_events",
  "worker_events",
] as const;

type BackfillType = (typeof SUPPORTED_TYPES)[number];

const args = process.argv.slice(2);
const type = valueArg("--type") as BackfillType | undefined;
const dryRun = !args.includes("--execute");
const batchSize = clamp(Number(valueArg("--batch-size") ?? 100), 1, 500);
const from = dateArg("--from", new Date(0));
const to = dateArg("--to", new Date());

async function main() {
  if (!type || !SUPPORTED_TYPES.includes(type)) {
    throw new Error(`--type is required and must be one of: ${SUPPORTED_TYPES.join(", ")}`);
  }
  if (from >= to) throw new Error("--from must be before --to.");

  console.log(JSON.stringify({
    mode: dryRun ? "DRY_RUN" : "EXECUTE",
    type,
    from: from.toISOString(),
    to: to.toISOString(),
    batchSize,
  }));

  let processed = 0;
  let written = 0;
  let skipped = 0;
  let cursor: string | undefined;

  do {
    const rows = await loadBatch(type, cursor);
    if (!rows.length) break;
    for (const row of rows) {
      processed += 1;
      const events = mapRow(type, row);
      for (const event of events) {
        if (dryRun) continue;
        try {
          await writeEventDirectToDynamo(event);
          written += 1;
        } catch (error) {
          if ((error as { name?: string }).name === "ConditionalCheckFailedException") {
            skipped += 1;
            continue;
          }
          throw error;
        }
      }
    }
    cursor = String(rows[rows.length - 1].id);
    console.log(`Processed ${processed}; written ${written}; already present ${skipped}; cursor ${cursor}`);
  } while (cursor);

  console.log(JSON.stringify({ complete: true, dryRun, processed, written, skipped }));
}

async function loadBatch(selected: BackfillType, cursor?: string): Promise<any[]> {
  const page = {
    where: { createdAt: { gte: from, lt: to } },
    orderBy: { id: "asc" as const },
    take: batchSize,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  };
  if (selected === "guard_logs") {
    return db.guardLog.findMany({
      ...page,
      include: {
        project: { select: { organizationId: true } },
        apiKey: { select: { prefix: true } },
      },
    });
  }
  if (selected === "audit_logs") {
    return db.aiUsageGovernanceAuditLog.findMany(page);
  }
  if (selected === "webhook_delivery_logs") {
    return db.webhookDelivery.findMany({
      ...page,
      include: {
        endpoint: {
          select: {
            projectId: true,
            project: { select: { organizationId: true } },
          },
        },
      },
    });
  }
  if (selected === "incident_events") {
    return db.incidentUpdate.findMany({
      ...page,
      include: { incident: { select: { organizationId: true, impact: true } } },
    });
  }
  if (selected === "report_events") {
    return db.scheduledReportDelivery.findMany({
      ...page,
      include: {
        scheduledReport: { select: { organizationId: true, projectId: true } },
      },
    });
  }
  return db.backgroundJob.findMany(page);
}

function mapRow(selected: BackfillType, row: any): HeavyEvent[] {
  if (selected === "guard_logs") {
    return [{
      id: `pg-guard-${row.id}`,
      type: "guard_event",
      orgId: row.project.organizationId,
      projectId: row.projectId,
      apiKeyPrefix: row.apiKey?.prefix,
      guardType: row.direction,
      decision: row.action,
      riskScore: row.riskScore,
      categories: row.riskTypes,
      redactedInputPreview: row.direction !== "OUTPUT" ? row.redactedText ?? row.safeText : null,
      redactedOutputPreview: row.direction === "OUTPUT" ? row.redactedText ?? row.safeText : null,
      metadata: { ...(objectValue(row.metadata)), reason: row.reason, sourceId: row.id },
      createdAt: row.createdAt,
    }];
  }
  if (selected === "audit_logs") {
    return [{
      id: `pg-audit-${row.id}`,
      type: "audit_event",
      orgId: row.organizationId,
      userId: row.userId,
      provider: row.providerName,
      model: row.modelName,
      action: row.action,
      decision: row.decision,
      redactedInputPreview: row.contextRedacted,
      metadata: { ...(objectValue(row.metadata)), reason: row.reason, sourceId: row.id },
      createdAt: row.createdAt,
    }];
  }
  if (selected === "webhook_delivery_logs") {
    return [{
      id: `pg-webhook-${row.id}`,
      type: "webhook_delivery_event",
      orgId: row.endpoint.project.organizationId,
      projectId: row.endpoint.projectId,
      webhookId: row.endpointId,
      targetType: "WebhookDelivery",
      targetId: row.id,
      action: row.event,
      status: row.status,
      httpStatus: row.responseCode,
      errorMessage: row.errorMessage,
      metadata: {
        payloadHash: row.payloadHash,
        idempotencyKey: row.idempotencyKey,
        attempts: row.attempts,
      },
      createdAt: row.createdAt,
    }];
  }
  if (selected === "incident_events") {
    return [{
      id: `pg-incident-${row.id}`,
      type: "incident_event",
      orgId: row.incident.organizationId,
      incidentId: row.incidentId,
      actorUserId: row.authorId,
      action: "incident.updated",
      status: row.status,
      severity: row.incident.impact,
      targetType: "IncidentUpdate",
      targetId: row.id,
      metadata: { message: row.message, public: row.public },
      createdAt: row.createdAt,
    }];
  }
  if (selected === "report_events") {
    return [{
      id: `pg-report-${row.id}`,
      type: "report_event",
      orgId: row.scheduledReport.organizationId,
      projectId: row.scheduledReport.projectId,
      reportId: row.reportId ?? `scheduled-${row.scheduledReportId}`,
      targetType: "ScheduledReportDelivery",
      targetId: row.id,
      action: "scheduled_report.delivery",
      status: row.status,
      errorMessage: row.error,
      metadata: { signature: row.signature, sentAt: row.sentAt?.toISOString() ?? null },
      createdAt: row.createdAt,
    }];
  }
  const payload = objectValue(row.payload);
  return [{
    id: `pg-worker-${row.id}`,
    type: "worker_task_event",
    orgId: stringValue(payload.organizationId),
    projectId: stringValue(payload.projectId),
    jobId: row.id,
    action: row.type,
    status: row.status,
    errorMessage: row.error,
    metadata: {
      attempts: row.attempts,
      maxAttempts: row.maxAttempts,
      runAfter: row.runAfter.toISOString(),
    },
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }];
}

function valueArg(name: string) {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
}

function dateArg(name: string, fallback: Date) {
  const raw = valueArg(name);
  if (!raw) return fallback;
  const value = new Date(raw);
  if (Number.isNaN(value.getTime())) throw new Error(`${name} must be a valid date.`);
  return value;
}

function clamp(value: number, min: number, max: number) {
  return Number.isFinite(value) ? Math.min(max, Math.max(min, Math.trunc(value))) : min;
}

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function stringValue(value: unknown): string | null {
  return typeof value === "string" && value ? value : null;
}

main()
  .catch((error) => {
    console.error("Backfill failed:", error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());

