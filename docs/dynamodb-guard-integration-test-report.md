# DynamoDB Guard Integration Test Report

**Date:** 2026-07-04
**Auditor:** QA Integration Test (automated)
**Project:** SoterAI / cybersecurityguard
**Region:** ap-south-1

---

## Summary

| Check | Result |
|-------|--------|
| DynamoDB connection | **FAIL** — table does not exist in ap-south-1 |
| Table exists | **FAIL** — `ResourceNotFoundException: Table: soterai_events not found` |
| TTL enabled | **NOT TESTED** — table must exist first |
| IAM/permissions | **FAIL** — local env has empty AWS credentials; EC2 IAM role not reachable from local |
| Guard logs to DynamoDB | **NOT ACTIVE** — `DYNAMODB_EVENTS_ENABLED` not set (defaults `false`) |
| Audit logs to DynamoDB | **NOT ACTIVE** — same flag |
| Webhook logs to DynamoDB | **NOT ACTIVE** — same flag |
| Incident events to DynamoDB | **NOT ACTIVE** — same flag |
| Dashboard reads from DynamoDB | **PASS (code)** — read path uses DynamoDB when enabled, with Postgres fallback |
| Secrets redacted | **PASS** — unit tests confirm; redaction layer verified in code |
| Postgres heavy log reduction | **N/A** — DynamoDB not enabled, Postgres still receiving all heavy logs |
| Rollback flags available | **PASS** — `DYNAMODB_EVENTS_DUAL_WRITE` and `DYNAMODB_EVENTS_READ_FALLBACK_POSTGRES` exist |
| Unit tests | **PASS** — all 10/10 DynamoDB event store tests pass |
| Code integration completeness | **PASS** — all guard/heavy event flows route through event store abstraction |

---

## Environment

| Variable | .env | .env.example | .env.production.example | Status |
|----------|------|-------------|------------------------|--------|
| `AWS_REGION` | `ap-south-1` | `ap-south-1` | `ap-south-1` | Present |
| `AWS_ACCESS_KEY_ID` | empty | empty | empty | **Missing credentials** |
| `AWS_SECRET_ACCESS_KEY` | empty | empty | empty | **Missing credentials** |
| `AWS_PROFILE` | — | empty | empty | Not set |
| `DYNAMODB_ENDPOINT` | — | empty | empty | Not set (uses AWS default) |
| `DYNAMODB_EVENTS_ENABLED` | **not set** | `false` | `false` | Defaults to `false` |
| `DYNAMODB_EVENTS_TABLE` | **not set** | `soterai_events` | `soterai_events` | Defaults to `soterai_events` |
| `DYNAMODB_EVENTS_DUAL_WRITE` | **not set** | `false` | `false` | Defaults to `false` |
| `DYNAMODB_EVENTS_READ_FALLBACK_POSTGRES` | **not set** | `true` | `true` | Defaults to `true` |

### TTL Variables (all in .env.example and .env.production.example)

| Variable | Default | Status |
|----------|---------|--------|
| `DYNAMODB_EVENTS_TTL_GUARD_DAYS` | 7 | Defined |
| `DYNAMODB_EVENTS_TTL_AUDIT_DAYS` | 90 | Defined |
| `DYNAMODB_EVENTS_TTL_WEBHOOK_DAYS` | 14 | Defined |
| `DYNAMODB_EVENTS_TTL_INCIDENT_DAYS` | 180 | Defined |
| `DYNAMODB_EVENTS_TTL_PAYLOAD_DAYS` | 7 | Defined |
| `DYNAMODB_EVENTS_TTL_REPORT_DAYS` | 30 | Defined |
| `DYNAMODB_EVENTS_TTL_WORKER_DAYS` | 14 | Defined |
| `DYNAMODB_EVENTS_TTL_RAG_DAYS` | 30 | Defined |
| `DYNAMODB_EVENTS_TTL_RETEAM_DAYS` | 30 | Defined |
| `DYNAMODB_EVENTS_MAX_INPUT_PREVIEW_CHARS` | 2000 | Defined |
| `DYNAMODB_EVENTS_MAX_OUTPUT_PREVIEW_CHARS` | 2000 | Defined |
| `DYNAMODB_EVENTS_MAX_METADATA_BYTES` | 12000 | Defined |

### Docker Configuration

- `docker-compose.yml`: Uses `env_file: .env.production` — DynamoDB vars will be loaded from there
- No explicit `environment:` entries for AWS/DynamoDB in compose (relies on env_file pass-through)
- EC2 production: expected to use IAM role (no access keys needed)

---

## Phase 2 — Table Verification

```
$ npm run dynamodb:events:verify
DynamoDB verification failed: Requested resource not found: Table: soterai_events not found
```

**Result: FAIL** — The table has not been created in the target AWS account/region.

### Expected table design (from `scripts/aws/create-dynamodb-events-table.ts`):

- **Primary key:** `pk` (HASH) + `sk` (RANGE)
- **Billing:** PAY_PER_REQUEST (on-demand)
- **GSIs:**
  - `gsi1-org-project-time-index` (gsi1pk/gsi1sk)
  - `gsi2-project-type-time-index` (gsi2pk/gsi2sk)
  - `gsi3-project-decision-time-index` (gsi3pk/gsi3sk)
  - `gsi4-webhook-time-index` (gsi4pk/gsi4sk)
- **TTL:** `expiresAt` attribute

### Remediation commands:
```bash
# From EC2 instance with IAM role, or with configured AWS credentials:
npm run dynamodb:events:create
npm run dynamodb:events:ttl
npm run dynamodb:events:verify
```

---

## Phase 3 — Code Integration Map

### Event Store Architecture

The event store abstraction is at `lib/events/store/index.ts` and implements:

1. **Feature-flag routing:** `DYNAMODB_EVENTS_ENABLED` controls whether DynamoDB writes fire
2. **Dual-write support:** `DYNAMODB_EVENTS_DUAL_WRITE` keeps Postgres writes active alongside DynamoDB
3. **Read fallback:** `DYNAMODB_EVENTS_READ_FALLBACK_POSTGRES` falls back to Postgres on DynamoDB read failure
4. **Redaction:** All previews pass through `redactEventPreview()` and metadata through `minimizeEventMetadata()`
5. **Error isolation:** DynamoDB write failures are caught, logged, and do not crash the request

### Write Function Routing

| Write Function | Type | Postgres (when enabled=false) | DynamoDB (when enabled=true) | Dual-write capable |
|---|---|---|---|---|
| `writeGuardEvent` | `guard_event` | Yes (in transaction) | Yes | Yes |
| `writeAuditEvent` | `audit_event` | Yes (hybrid write) | Yes | Yes |
| `writeWebhookDeliveryEvent` | `webhook_delivery_event` | No (mirror only) | Yes | No |
| `writeIncidentEvent` | `incident_event` | No (mirror only) | Yes | No |
| `writePayloadEvent` | `payload_event` | No (mirror only) | Yes | No |
| `writeReportEvent` | `report_event` | No (mirror only) | Yes | No |
| `writeWorkerTaskEvent` | `worker_task_event` | No (mirror only) | Yes | No |
| `writeRagSecurityEvent` | `rag_security_event` | No (mirror only) | Yes | No |
| `writeRedTeamEvent` | `redteam_event` | No (mirror only) | Yes | No |
| `writeSiemDeliveryEvent` | `siem_delivery_event` | No (mirror only) | Yes | No |
| `mirrorAuditEvent` | `audit_event` | No (mirror only) | Yes | No |

**Note:** "Mirror" functions (`writeMirrorEvent`) only write to DynamoDB when enabled; they silently no-op when disabled. This means webhook delivery, incident, report, worker, RAG, redteam, and SIEM events are **only logged when DynamoDB is enabled**.

### Call Site Map

| Guard Flow / Heavy Task | File | Calls | Status |
|---|---|---|---|
| Input guard | `lib/guard/persistence.ts:74` | `writeGuardEvent` | Correctly integrated |
| Output guard | `lib/guard/persistence.ts:74` | `writeGuardEvent` (via `scheduleGuardResultPersistence`) | Correctly integrated |
| Streaming guard | `lib/guard/scheduledPersistence.ts` → `persistence.ts` | `writeGuardEvent` | Correctly integrated |
| Analyze guard | `lib/guard/persistence.ts:74` | `writeGuardEvent` | Correctly integrated |
| RAG grounding guard | `app/api/guard/grounding/route.ts:46` | `writeRagSecurityEvent` | Correctly integrated |
| RAG vector security | `lib/rag/vector/vectorProvider.ts:74` | `writeRagSecurityEvent` | Correctly integrated |
| Audit logs (governance) | `lib/usage-governance/index.ts:343,365` | `writeAuditEvent` | Correctly integrated |
| Webhook deliveries | `lib/webhooks/delivery.ts:204` | `writeWebhookDeliveryEvent` | Correctly integrated |
| Incident events | `app/api/ops/incidents/route.ts:19,52` | `writeIncidentEvent` | Correctly integrated |
| Report events | `lib/reports.ts:62`, `lib/reports/scheduled.ts:22,47,61` | `writeReportEvent` | Correctly integrated |
| Background job events | `lib/backgroundJobs.ts:159` | `writeWorkerTaskEvent` | Correctly integrated |
| Red team events | `app/api/redteam/run/route.ts:51`, `lib/backgroundJobProcessors.ts:177,194`, `lib/redteam/lab.ts:196` | `writeRedTeamEvent` | Correctly integrated |
| SIEM delivery events | `lib/siem/exporters.ts:59,76` | `writeSiemDeliveryEvent` | Correctly integrated |

### Direct Postgres Writes (Bypass Check)

| Location | Context | Issue? |
|---|---|---|
| `lib/guard/persistence.ts:54` | Inside `!flags.enabled` branch | **No** — only fires when DynamoDB is disabled |
| `lib/events/store/postgres-event-store.ts:10` | Part of the abstraction layer | **No** — called by `writeHybridEvent` |
| `prisma/seed.ts:109` | Seed script | **No** — not production code |

**Conclusion:** No guard/heavy event bypasses the event store abstraction.

---

## Phase 4 — Guard Write Path Tests

**BLOCKED** — Cannot execute live guard requests against DynamoDB because:
1. DynamoDB table does not exist
2. `DYNAMODB_EVENTS_ENABLED` is `false`
3. No valid AWS credentials are configured locally

### Unit Test Results (all pass)

```
✓ DynamoDB guard key builder creates project, org, type, and decision keys
✓ TTL calculation uses the event-specific retention window
✓ metadata minimization removes credential fields and caps serialized size
✓ stored guard item never includes raw API keys, Authorization headers, or raw prompts
✓ writeGuardEvent storage uses PutItem with an idempotency condition
✓ listGuardEventsByProject uses Query, never Scan, and returns LastEvaluatedKey cursor
✓ audit, webhook, incident, report, worker, RAG, and red-team keys match the table design
✓ feature flags default disabled, support dual-write, and keep PostgreSQL read fallback
✓ logs API enforces tenant ownership before project-scoped DynamoDB reads
✓ DynamoDB guard records retain the legacy list DTO fields
```

---

## Phase 5 — Postgres Heavy Log Behavior

**Current state:** Since `DYNAMODB_EVENTS_ENABLED=false`:

- Guard logs (`guardLog` table): **Still receiving all writes** via `persistence.ts` Postgres branch
- Audit logs (`aiUsageGovernanceAuditLog`): **Still receiving all writes** via `writeHybridEvent` Postgres fallback
- Webhook delivery events: **Not logged anywhere** (mirror-only, DynamoDB disabled)
- Incident events: **Not logged to event store** (mirror-only, DynamoDB disabled)
- Report events: **Not logged to event store** (mirror-only, DynamoDB disabled)
- Worker task events: **Not logged to event store** (mirror-only, DynamoDB disabled)
- RAG security events: **Not logged to event store** (mirror-only, DynamoDB disabled)
- Red team events: **Not logged to event store** (mirror-only, DynamoDB disabled)
- SIEM delivery events: **Not logged to event store** (mirror-only, DynamoDB disabled)

---

## Phase 6 — Read Path and Dashboard Compatibility

### Code verification (from `app/api/logs/route.ts`):

- Dashboard reads route through `listGuardEventsByProject` / `listGuardEventsByOrg`
- These functions check `flags.enabled` — if DynamoDB is enabled, they query DynamoDB first
- If DynamoDB returns empty results AND `readFallbackPostgres` is true, they fall back to Postgres
- **No `ScanCommand` in production read paths** — all reads use `QueryCommand` with partition key
- Tenant isolation enforced: project must belong to the active organization before query

**Result: PASS (code architecture)** — Read paths are correctly wired.

---

## Phase 7 — Redaction / Security Verification

### Redaction mechanisms verified:

1. **`redactEventPreview()`** (`lib/events/store/redaction.ts`):
   - Uses `createPrivacySafePreview` from shared privacy module
   - Applies to both input and output previews
   - Respects configurable max character limits

2. **`minimizeEventMetadata()`** (`lib/events/store/redaction.ts`):
   - Blocks sensitive keys: `authorization`, `cookie`, `password`, `apikey`, `secret`, `token`, `prompt`, `body`, etc.
   - Caps total metadata size to `DYNAMODB_EVENTS_MAX_METADATA_BYTES`
   - Recursively sanitizes nested objects up to depth 6
   - Strings pass through `sanitizePrivacyPayload`

3. **`pickCommonFields()`** (`lib/events/store/keys.ts:183`):
   - Applies `redactEventPreview` to both input/output previews before storage
   - Error messages are redacted via `redactSensitiveText` and capped at 2000 chars
   - `originalText` is **never stored** in the DynamoDB item (not in `pickCommonFields`)

4. **Unit test confirmation:**
   - Test "stored guard item never includes raw API keys, Authorization headers, or raw prompts" verifies:
     - Raw API key (`sk-proj-...`) not in serialized output
     - Raw `Authorization` header not in serialized output
     - `originalText` field not present on stored item

**Result: PASS** ��� secrets are properly redacted before any DynamoDB write.

---

## Phase 8 — Error and Fallback Behavior

### Code analysis of failure handling:

1. **Guard event write failure** (`lib/events/store/index.ts:38-44`):
   ```typescript
   try {
     await new DynamoDbEventStore().write(prepared);
   } catch (error) {
     console.error("[SoterAI] DynamoDB guard event write failed", { ... });
   }
   ```
   - Failure is caught, logged, and does **not** crash the guard request
   - Guard API still returns the detection result to the caller

2. **Mirror event write failure** (`lib/events/store/index.ts:176-179`):
   - Same pattern: catch, log, return `null`

3. **Read path fallback** (`lib/events/store/index.ts:92-97`):
   - If DynamoDB read throws AND `readFallbackPostgres` is true → falls back to Postgres query
   - If `readFallbackPostgres` is false → re-throws the error

4. **`scheduleGuardResultPersistence`** (`lib/guard/scheduledPersistence.ts`):
   - Uses `next/server after()` — persistence runs after the response is sent
   - `.catch()` wraps the entire persistence call

**Result: PASS (code design)** — logging failures cannot block user-facing guard responses.

---

## Phase 9 — Performance

**BLOCKED** — Cannot run performance tests without a live DynamoDB table.

However, from code analysis:
- Writes use `PutCommand` (single-item, O(1))
- Reads use `QueryCommand` with specific partition keys (not Scan)
- `PutCommand` has `ConditionExpression: "attribute_not_exists(pk) AND attribute_not_exists(sk)"` for idempotency
- `ScanIndexForward: false` ensures descending time order without post-sort
- `Limit` is clamped to max 100 items per query

---

## Guards Coverage Matrix

| Guard/Flow | Route/File | DynamoDB write | DynamoDB read | Postgres still writing | Result |
|---|---|---|---|---|---|
| Input guard | `app/api/guard/input/route.ts` | `writeGuardEvent` | `listGuardEventsByProject` | Yes (when disabled) | Code ready |
| Output guard | `app/api/guard/output/route.ts` | `writeGuardEvent` | `listGuardEventsByProject` | Yes (when disabled) | Code ready |
| Streaming guard | `app/api/guard/streaming/route.ts` | `writeGuardEvent` | `listGuardEventsByProject` | Yes (when disabled) | Code ready |
| Analyze guard | `lib/guard/persistence.ts` | `writeGuardEvent` | `listGuardEventsByProject` | Yes (when disabled) | Code ready |
| Prompt injection | Detected by input guard | `writeGuardEvent` | Same | Same | Code ready |
| Jailbreak | Detected by input guard | `writeGuardEvent` | Same | Same | Code ready |
| Secrets | Detected by input/output guard | `writeGuardEvent` | Same | Same | Code ready |
| PII | Detected by input/output guard | `writeGuardEvent` | Same | Same | Code ready |
| Unsafe output | Detected by output guard | `writeGuardEvent` | Same | Same | Code ready |
| RAG/grounding | `app/api/guard/grounding/route.ts` | `writeRagSecurityEvent` | `listRagSecurityEventsByProject` | Conditional | Code ready |
| RAG vector security | `lib/rag/vector/vectorProvider.ts` | `writeRagSecurityEvent` | `listRagSecurityEventsByProject` | N/A | Code ready |
| Audit logs | `lib/usage-governance/index.ts` | `writeAuditEvent` | `listAuditEventsByOrg` | Yes (hybrid) | Code ready |
| Webhook delivery | `lib/webhooks/delivery.ts` | `writeWebhookDeliveryEvent` | `listWebhookDeliveryEvents` | Mirror only | Code ready |
| Incident events | `app/api/ops/incidents/route.ts` | `writeIncidentEvent` | `listIncidentEvents` | Mirror only | Code ready |
| Report events | `lib/reports.ts`, `lib/reports/scheduled.ts` | `writeReportEvent` | `listReportEvents` | Mirror only | Code ready |
| Worker/job events | `lib/backgroundJobs.ts` | `writeWorkerTaskEvent` | `listWorkerTaskEvents` | Mirror only | Code ready |
| Red team events | `app/api/redteam/run/route.ts`, `lib/backgroundJobProcessors.ts`, `lib/redteam/lab.ts` | `writeRedTeamEvent` | `listRedTeamEventsByProject` | Mirror only | Code ready |
| SIEM delivery | `lib/siem/exporters.ts` | `writeSiemDeliveryEvent` | N/A | Mirror only | Code ready |

---

## Failures

| # | Category | File | Function/Line | Reason | Fix Required |
|---|---|---|---|---|---|
| 1 | Infrastructure | AWS DynamoDB | — | Table `soterai_events` does not exist in `ap-south-1` | Run `npm run dynamodb:events:create` then `npm run dynamodb:events:ttl` |
| 2 | Configuration | `.env` / `.env.local` | — | `DYNAMODB_EVENTS_ENABLED` not set (defaults false) | Set `DYNAMODB_EVENTS_ENABLED="true"` in production env |
| 3 | Credentials | `.env` | — | `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` are empty | Configure AWS credentials OR attach IAM role to EC2 instance |
| 4 | Data gap | Mirror events | `writeMirrorEvent` | When DynamoDB is disabled, webhook/incident/report/worker/rag/redteam/siem events are **silently dropped** — no Postgres fallback | Acceptable if intentional; document this behavior |

---

## Final Verdict

### **PARTIAL PASS**

**Code integration: COMPLETE** — All 14 guard/heavy event write paths correctly route through the DynamoDB event store abstraction. The architecture is sound:
- Feature flags work correctly
- Dual-write and fallback mechanisms are implemented
- Redaction is applied before storage
- No raw secrets reach DynamoDB
- No Scan operations in production read paths
- Error isolation prevents DynamoDB failures from impacting guard responses
- Unit tests (10/10) confirm key generation, TTL, redaction, and query patterns

**Infrastructure: NOT DEPLOYED** — The DynamoDB table does not exist, credentials are not configured, and `DYNAMODB_EVENTS_ENABLED=false`. All heavy events are currently going to PostgreSQL (for guard/audit) or being silently dropped (for mirror-only events).

---

## Next Steps

### 1. Create the DynamoDB table (from EC2 or with configured credentials):
```bash
export AWS_REGION=ap-south-1
npm run dynamodb:events:create
npm run dynamodb:events:ttl
npm run dynamodb:events:verify
```

### 2. Configure production environment:
Add to `.env.production` (or the env file used by Docker):
```bash
DYNAMODB_EVENTS_ENABLED="true"
DYNAMODB_EVENTS_DUAL_WRITE="true"   # Keep Postgres writes during migration
DYNAMODB_EVENTS_READ_FALLBACK_POSTGRES="true"
```

### 3. Verify IAM permissions on EC2:
```bash
npm run dynamodb:events:iam-policy   # Prints required IAM policy
```
Attach the printed policy to the EC2 instance role.

### 4. Enable and test with dual-write:
```bash
# After table exists and IAM is configured:
DYNAMODB_EVENTS_ENABLED=true DYNAMODB_EVENTS_DUAL_WRITE=true npm run dev
# Send test guard request, verify item appears in DynamoDB
```

### 5. Migrate existing data (optional):
```bash
npm run logs:backfill:dynamodb
```

### 6. Disable dual-write after validation:
```bash
DYNAMODB_EVENTS_DUAL_WRITE="false"
```

### 7. Monitor:
- Watch `[SoterAI] DynamoDB guard event write failed` in logs
- Verify DynamoDB CloudWatch metrics (ConsumedWriteCapacity, ThrottledRequests)
- Confirm Postgres `guard_logs` table growth stops after dual-write is disabled

---

## Appendix: Key File Paths

| Component | Path |
|---|---|
| DynamoDB client singleton | `lib/dynamodb/client.ts` |
| DynamoDB config | `lib/dynamodb/config.ts` |
| Event store abstraction | `lib/events/store/index.ts` |
| DynamoDB store implementation | `lib/events/store/dynamodb-event-store.ts` |
| Postgres store implementation | `lib/events/store/postgres-event-store.ts` |
| Key/TTL generation | `lib/events/store/keys.ts` |
| Redaction | `lib/events/store/redaction.ts` |
| Types | `lib/events/store/types.ts` |
| Guard persistence (routing) | `lib/guard/persistence.ts` |
| Scheduled persistence | `lib/guard/scheduledPersistence.ts` |
| Table creation script | `scripts/aws/create-dynamodb-events-table.ts` |
| TTL enablement script | `scripts/aws/enable-dynamodb-events-ttl.ts` |
| Verification script | `scripts/aws/verify-dynamodb-events-table.ts` |
| Unit tests | `tests/dynamodb-events.test.ts` |
| Dashboard logs API | `app/api/logs/route.ts` |
