import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";

import { awsCredentialSource, unsetBlankAwsCredentialEnv } from "../lib/dynamodb/aws-env";
import { eventStoreFlags } from "../lib/events/store";
import { DynamoDbEventStore } from "../lib/events/store/dynamodb-event-store";
import { buildStoredEvent, eventExpiresAt } from "../lib/events/store/keys";
import { minimizeEventMetadata } from "../lib/events/store/redaction";

const CREATED_AT = new Date("2026-07-04T12:00:00.000Z");
const RAW_KEY = "sk-proj-AbCdEfGhIjKlMnOpQrStUvWxYz123456";
const RAW_AUTH = `Bearer ${RAW_KEY}`;

test("DynamoDB guard key builder creates project, org, type, and decision keys", () => {
  const item = buildStoredEvent({
    id: "event-1",
    type: "guard_event",
    orgId: "org-1",
    projectId: "project-1",
    guardType: "INPUT",
    decision: "BLOCK",
    riskScore: 95,
    categories: ["PROMPT_INJECTION"],
    createdAt: CREATED_AT,
  });
  assert.equal(item.pk, "PROJECT#project-1");
  assert.equal(item.sk, "GUARD#2026-07-04T12:00:00.000Z#event-1");
  assert.equal(item.gsi1pk, "ORG#org-1");
  assert.equal(item.gsi2pk, "PROJECT#project-1#TYPE#guard_event");
  assert.equal(item.gsi3pk, "PROJECT#project-1#DECISION#BLOCK");
});

test("TTL calculation uses the event-specific retention window", () => {
  const previous = process.env.DYNAMODB_EVENTS_TTL_GUARD_DAYS;
  process.env.DYNAMODB_EVENTS_TTL_GUARD_DAYS = "7";
  try {
    assert.equal(
      eventExpiresAt("guard_event", CREATED_AT),
      Math.floor((CREATED_AT.getTime() + 7 * 86_400_000) / 1000),
    );
  } finally {
    restoreEnv("DYNAMODB_EVENTS_TTL_GUARD_DAYS", previous);
  }
});

test("metadata minimization removes credential fields and caps serialized size", () => {
  const previous = process.env.DYNAMODB_EVENTS_MAX_METADATA_BYTES;
  process.env.DYNAMODB_EVENTS_MAX_METADATA_BYTES = "512";
  try {
    const metadata = minimizeEventMetadata({
      authorization: RAW_AUTH,
      cookie: "session=raw",
      nested: { password: "raw-password", safe: "ok" },
      oversized: "x".repeat(10_000),
    });
    const serialized = JSON.stringify(metadata);
    assert.equal(serialized.includes(RAW_KEY), false);
    assert.equal(serialized.includes("raw-password"), false);
    assert.ok(Buffer.byteLength(serialized, "utf8") <= 512);
    assert.equal(metadata.truncated, true);
  } finally {
    restoreEnv("DYNAMODB_EVENTS_MAX_METADATA_BYTES", previous);
  }
});

test("stored guard item never includes raw API keys, Authorization headers, or raw prompts", () => {
  const item = buildStoredEvent({
    id: "event-sensitive",
    type: "guard_event",
    orgId: "org-1",
    projectId: "project-1",
    guardType: "INPUT",
    decision: "BLOCK",
    riskScore: 100,
    categories: ["SECRET_DETECTED"],
    redactedInputPreview: `Authorization: ${RAW_AUTH}`,
    metadata: {
      authorization: RAW_AUTH,
      apiKey: RAW_KEY,
      finding: `Detected ${RAW_KEY}`,
    },
    createdAt: CREATED_AT,
    originalText: `full prompt ${RAW_KEY}`,
  } as never);
  const serialized = JSON.stringify(item);
  assert.equal(serialized.includes(RAW_KEY), false);
  assert.equal(serialized.includes(RAW_AUTH), false);
  assert.equal(serialized.includes("full prompt"), false);
  assert.equal(Object.hasOwn(item, "originalText"), false);
});

test("writeGuardEvent storage uses PutItem with an idempotency condition", async () => {
  const calls: unknown[] = [];
  const client = { send: async (command: unknown) => { calls.push(command); return {}; } };
  const store = new DynamoDbEventStore(client as never, "test-events");
  const item = await store.write({
    id: "guard-write",
    type: "guard_event",
    orgId: "org-1",
    projectId: "project-1",
    guardType: "OUTPUT",
    decision: "ALLOW",
    riskScore: 0,
    categories: [],
    createdAt: CREATED_AT,
  });
  assert.equal(item.id, "guard-write");
  assert.equal(calls.length, 1);
  assert.ok(calls[0] instanceof PutCommand);
  assert.equal((calls[0] as PutCommand).input.TableName, "test-events");
  assert.match((calls[0] as PutCommand).input.ConditionExpression ?? "", /attribute_not_exists/);
});

test("listGuardEventsByProject uses Query, never Scan, and returns LastEvaluatedKey cursor", async () => {
  const calls: unknown[] = [];
  const client = {
    send: async (command: unknown) => {
      calls.push(command);
      return {
        Items: [{ id: "one", pk: "PROJECT#project-1", sk: "GUARD#x", type: "guard_event" }],
        LastEvaluatedKey: { pk: "PROJECT#project-1", sk: "GUARD#x" },
      };
    },
  };
  const store = new DynamoDbEventStore(client as never, "test-events");
  const page = await store.listGuardEventsByProject("project-1", { limit: 25 });
  assert.equal(page.items.length, 1);
  assert.ok(page.nextCursor);
  assert.ok(calls[0] instanceof QueryCommand);
  const input = (calls[0] as QueryCommand).input;
  assert.equal(input.ExpressionAttributeValues?.[":pk"], "PROJECT#project-1");
  assert.equal(input.ScanIndexForward, false);
  assert.equal(input.Limit, 25);
});

test("audit, webhook, incident, report, worker, RAG, and red-team keys match the table design", () => {
  const cases = [
    buildStoredEvent({ id: "a", type: "audit_event", orgId: "o", createdAt: CREATED_AT }),
    buildStoredEvent({ id: "w", type: "webhook_delivery_event", webhookId: "wh", projectId: "p", createdAt: CREATED_AT }),
    buildStoredEvent({ id: "i", type: "incident_event", incidentId: "inc", createdAt: CREATED_AT }),
    buildStoredEvent({ id: "r", type: "report_event", reportId: "rep", createdAt: CREATED_AT }),
    buildStoredEvent({ id: "j", type: "worker_task_event", jobId: "job", createdAt: CREATED_AT }),
    buildStoredEvent({ id: "g", type: "rag_security_event", projectId: "p", orgId: "o", createdAt: CREATED_AT }),
    buildStoredEvent({ id: "t", type: "redteam_event", projectId: "p", orgId: "o", createdAt: CREATED_AT }),
  ];
  assert.deepEqual(cases.map((item) => item.pk), [
    "ORG#o",
    "WEBHOOK#wh",
    "INCIDENT#inc",
    "REPORT#rep",
    "JOB#job",
    "PROJECT#p",
    "PROJECT#p",
  ]);
});

test("feature flags default disabled, support dual-write, and keep PostgreSQL read fallback", () => {
  const previous = snapshotEnv([
    "DYNAMODB_EVENTS_ENABLED",
    "DYNAMODB_EVENTS_DUAL_WRITE",
    "DYNAMODB_EVENTS_READ_FALLBACK_POSTGRES",
  ]);
  try {
    delete process.env.DYNAMODB_EVENTS_ENABLED;
    delete process.env.DYNAMODB_EVENTS_DUAL_WRITE;
    delete process.env.DYNAMODB_EVENTS_READ_FALLBACK_POSTGRES;
    assert.deepEqual(eventStoreFlags(), {
      enabled: false,
      dualWrite: false,
      readFallbackPostgres: true,
    });
    process.env.DYNAMODB_EVENTS_ENABLED = "true";
    process.env.DYNAMODB_EVENTS_DUAL_WRITE = "true";
    process.env.DYNAMODB_EVENTS_READ_FALLBACK_POSTGRES = "false";
    assert.deepEqual(eventStoreFlags(), {
      enabled: true,
      dualWrite: true,
      readFallbackPostgres: false,
    });
  } finally {
    restoreSnapshot(previous);
  }
});

test("blank AWS credential env vars are ignored so EC2 IAM role can be used", () => {
  const env = {
    AWS_ACCESS_KEY_ID: "",
    AWS_SECRET_ACCESS_KEY: "   ",
    AWS_SESSION_TOKEN: "",
    AWS_PROFILE: "",
    AWS_EC2_METADATA_DISABLED: "false",
  } as NodeJS.ProcessEnv;

  assert.deepEqual(unsetBlankAwsCredentialEnv(env), [
    "AWS_ACCESS_KEY_ID",
    "AWS_SECRET_ACCESS_KEY",
    "AWS_SESSION_TOKEN",
    "AWS_PROFILE",
  ]);
  assert.equal(env.AWS_ACCESS_KEY_ID, undefined);
  assert.equal(env.AWS_SECRET_ACCESS_KEY, undefined);
  assert.equal(awsCredentialSource(env), "default-provider-chain");
});

test("explicit AWS environment credentials are preserved", () => {
  const env = {
    AWS_ACCESS_KEY_ID: "AKIAEXAMPLE",
    AWS_SECRET_ACCESS_KEY: "secret",
  } as NodeJS.ProcessEnv;

  assert.deepEqual(unsetBlankAwsCredentialEnv(env), []);
  assert.equal(awsCredentialSource(env), "environment");
});

test("logs API enforces tenant ownership before project-scoped DynamoDB reads", () => {
  const source = readFileSync("app/api/logs/route.ts", "utf8");
  assert.match(source, /organizationId:\s*active\.org\.id/);
  assert.match(source, /if \(!ownedProject\)/);
  assert.match(source, /listGuardEventsByProject/);
  assert.doesNotMatch(source, /\bScanCommand\b/);
});

test("DynamoDB guard records retain the legacy list DTO fields", () => {
  const item = buildStoredEvent({
    id: "dto",
    type: "guard_event",
    orgId: "org",
    projectId: "project",
    guardType: "ANALYZE",
    decision: "HUMAN_REVIEW",
    riskScore: 70,
    categories: ["JAILBREAK"],
    metadata: { reason: "Review required" },
    createdAt: CREATED_AT,
  });
  const dto = {
    id: item.id,
    createdAt: item.createdAt,
    direction: item.guardType,
    action: item.decision,
    riskScore: item.riskScore,
    riskTypes: item.categories,
    reason: item.metadata?.reason,
    redactedText: item.redactedInputPreview ?? item.redactedOutputPreview ?? null,
    safeText: null,
    metadata: item.metadata,
  };
  assert.deepEqual(Object.keys(dto), [
    "id",
    "createdAt",
    "direction",
    "action",
    "riskScore",
    "riskTypes",
    "reason",
    "redactedText",
    "safeText",
    "metadata",
  ]);
});

function restoreEnv(name: string, value: string | undefined) {
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
}

function snapshotEnv(names: string[]) {
  return new Map(names.map((name) => [name, process.env[name]]));
}

function restoreSnapshot(snapshot: Map<string, string | undefined>) {
  for (const [name, value] of snapshot) restoreEnv(name, value);
}
