import { db } from "../../lib/db";

const SUPPORTED_TYPES = [
  "guard_logs",
  "audit_logs",
  "webhook_delivery_logs",
  "incident_events",
  "report_events",
  "worker_events",
] as const;

type CleanupType = (typeof SUPPORTED_TYPES)[number];

const args = process.argv.slice(2);
const type = valueArg("--type") as CleanupType | undefined;
const beforeRaw = valueArg("--before");
const confirmation = valueArg("--confirm");
const force = args.includes("--force");
const execute = args.includes("--execute");

async function main() {
  if (!type || !SUPPORTED_TYPES.includes(type)) {
    throw new Error(`--type is required and must be one of: ${SUPPORTED_TYPES.join(", ")}`);
  }
  if (!beforeRaw) throw new Error("--before YYYY-MM-DD is required.");
  const before = new Date(beforeRaw);
  if (Number.isNaN(before.getTime())) throw new Error("--before must be a valid date.");
  const minimumAge = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  if (before > minimumAge && !force) {
    throw new Error("Refusing to delete data newer than 30 days. Pass --force only after backup and verification.");
  }
  const expected = `DELETE ${type} BEFORE ${beforeRaw}`;
  if (confirmation !== expected) {
    throw new Error(`--confirm must exactly equal: ${expected}`);
  }

  const count = await countRows(type, before);
  console.log(`Matched ${count} PostgreSQL rows for ${type} before ${before.toISOString()}.`);
  if (!execute) {
    console.log("DRY RUN: no rows deleted. Re-run with --execute after backup and DynamoDB verification.");
    return;
  }
  const deleted = await deleteRows(type, before);
  console.log(`Deleted ${deleted} rows from ${type}. Core users, organizations, projects, API keys, policies, and billing tables were not touched.`);
}

async function countRows(selected: CleanupType, before: Date) {
  if (selected === "guard_logs") return db.guardLog.count({ where: { createdAt: { lt: before } } });
  if (selected === "audit_logs") return db.aiUsageGovernanceAuditLog.count({ where: { createdAt: { lt: before } } });
  if (selected === "webhook_delivery_logs") return db.webhookDelivery.count({ where: { createdAt: { lt: before } } });
  if (selected === "incident_events") return db.incidentUpdate.count({ where: { createdAt: { lt: before } } });
  if (selected === "report_events") return db.scheduledReportDelivery.count({ where: { createdAt: { lt: before } } });
  return db.backgroundJob.count({ where: { createdAt: { lt: before } } });
}

async function deleteRows(selected: CleanupType, before: Date) {
  if (selected === "guard_logs") return (await db.guardLog.deleteMany({ where: { createdAt: { lt: before } } })).count;
  if (selected === "audit_logs") return (await db.aiUsageGovernanceAuditLog.deleteMany({ where: { createdAt: { lt: before } } })).count;
  if (selected === "webhook_delivery_logs") return (await db.webhookDelivery.deleteMany({ where: { createdAt: { lt: before } } })).count;
  if (selected === "incident_events") return (await db.incidentUpdate.deleteMany({ where: { createdAt: { lt: before } } })).count;
  if (selected === "report_events") return (await db.scheduledReportDelivery.deleteMany({ where: { createdAt: { lt: before } } })).count;
  return (await db.backgroundJob.deleteMany({ where: { createdAt: { lt: before } } })).count;
}

function valueArg(name: string) {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
}

main()
  .catch((error) => {
    console.error("Cleanup refused or failed:", error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());

