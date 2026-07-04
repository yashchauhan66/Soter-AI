# DynamoDB Heavy Events Migration Discovery

## Scope

This migration is intentionally hybrid. PostgreSQL remains the system of record for users, organizations, memberships, projects, API keys and hashes, policies, RBAC, billing, webhook configurations, incident/report metadata, scheduled report configuration, and operational queue state. DynamoDB is used for append-only guard and high-volume lifecycle events with TTL retention.

## Files Inspected

- `prisma/schema.prisma`
- `lib/db.ts`
- `lib/guard/persistence.ts`
- `lib/guard/scheduledPersistence.ts`
- `lib/guard/logSafety.ts`
- `lib/guard/logFilters.ts`
- `lib/guard/logSelect.ts`
- `app/api/guard/input/route.ts`
- `app/api/guard/output/route.ts`
- `app/api/guard/analyze/route.ts`
- `app/api/guard/streaming/route.ts`
- `app/api/guard/grounding/route.ts`
- `app/api/logs/route.ts`
- `app/dashboard/logs/page.tsx`
- `lib/webhooks/delivery.ts`
- `workers/webhookWorker.ts`
- `lib/events/emit.ts`
- `lib/siem/exporters.ts`
- `workers/siemWorker.ts`
- `lib/backgroundJobs.ts`
- `lib/backgroundJobProcessors.ts`
- `workers/backgroundWorker.ts`
- `lib/reports.ts`
- `lib/reports/scheduled.ts`
- `lib/forensics/index.ts`
- `app/api/ops/incidents/route.ts`
- `lib/rag/vector/vectorProvider.ts`
- `app/api/rag/query/route.ts`
- `lib/redteam/lab.ts`
- `app/api/redteam/run/route.ts`
- `lib/usage-governance/index.ts`
- `app/dashboard/usage-governance/audit/page.tsx`
- `lib/audit/export.ts`
- `lib/retention/policy.ts`
- `.env.example`
- `.env.production.example`
- `docker-compose.yml`
- `docker-compose.prod.yml`
- `Dockerfile`
- `Dockerfile.worker`
- `package.json`
- `tsconfig.json`
- `eslint.config.mjs`

## Existing PostgreSQL Heavy Models

Primary migration targets:

- `GuardLog`
- `WebhookDelivery`
- `ScheduledReportDelivery`
- `AdminAuditLog`
- `OrganizationAuditLog`
- `AiUsageGovernanceAuditLog`
- `AiAdminPolicyAuditLog`
- `RetrievalAuditLog`
- `RagAnswerAuditLog`
- `IncidentUpdate`
- `SecurityEvent`
- `SiemDelivery`
- `IntegrationEvent`
- `IntegrationDelivery`
- `BackgroundJob`
- `RedTeamResult`
- `ProductEvent`
- `DataLineageEvent`
- `AIFileScanEvent`
- `McpCredentialAccessLog`

Related metadata/control models that must remain relational include `WebhookEndpoint`, `Incident`, `Report`, `ScheduledReport`, `AuditExport`, `RedTeamRun`, `RedTeamSuite`, `SiemIntegration`, and `BackgroundJob` while it is used as a transactional worker queue.

## Existing Write Paths

Guard decisions converge on `persistGuardResult` through input/output routes and scheduled persistence. Streaming guard previously did not persist and is now connected to the same hook. Public analyze has no tenant/project identity and remains non-persistent. Grounding writes RAG audit information.

Webhook delivery writes occur in `enqueueWebhook` and `attemptDelivery`. PostgreSQL rows are active queue records, not only logs, so they remain for retry locking while every lifecycle transition is mirrored to DynamoDB.

Worker job writes occur in `enqueueBackgroundJob`, `claimNextBackgroundJob`, `markJobComplete`, and `markJobFailed`. The PostgreSQL job row remains the queue/control record; lifecycle history is mirrored.

Audit writes are distributed. The governance audit path is routed through the event store. Admin and organization audit records remain in their current tables for relational administration screens and are mirrored at newly touched high-volume/security paths.

Incident updates are written in `app/api/ops/incidents/route.ts`. Incident metadata remains in PostgreSQL and timeline events are mirrored to DynamoDB.

Report delivery writes occur in `lib/reports/scheduled.ts`; report metadata remains in PostgreSQL and generation/delivery lifecycle events are mirrored.

RAG audit writes occur in `auditRetrieval` and the grounding guard route. Red-team events are produced by the background processor and lab runner. SIEM delivery state is updated in `lib/siem/exporters.ts`.

## Existing Read Paths

- Guard logs API: `app/api/logs/route.ts`
- Guard logs dashboard: `app/dashboard/logs/page.tsx`
- Dashboard summaries and metrics: `app/dashboard/page.tsx`, `lib/dashboard/metrics.ts`
- Audit exports: `lib/audit/export.ts`
- Monthly reports: `lib/reports.ts`, `lib/pdf/monthlyReport.ts`
- Governance audit dashboard: `lib/usage-governance/index.ts`
- Webhook delivery dashboard API: `app/api/webhooks/deliveries/route.ts`
- Incident timeline and forensic reports: `lib/forensics/index.ts`
- Worker status API: `app/api/jobs/[id]/route.ts`
- Agency, badge, evidence, onboarding, customer-success, and white-label reporting surfaces contain additional aggregate `GuardLog` reads.

The primary log list/API, monthly report generation, governance audit list, webhook history, incident timeline, and worker history are DynamoDB-aware. Some aggregate dashboards still use PostgreSQL counters or legacy rows during rollout. `UsageCounter` remains in PostgreSQL specifically to avoid expensive event scans.

## Existing Redaction

- `lib/guard/logSafety.ts` redacts detector findings and sensitive metadata.
- `packages/shared/src/privacy.ts` removes raw content keys and redacts provider tokens, AWS keys, JWTs, database URLs, passwords, email, phone, Aadhaar, PAN, GSTIN, UPI, IFSC, cards, paths, and internal URLs.
- Extension and SIEM code already use the shared privacy utilities.

The DynamoDB layer adds an explicit storage allow-list. Internal fields such as `originalText`, raw bodies, authorization headers, cookies, passwords, and raw API keys are never marshalled into an event item. Clean full prompts/responses are replaced by non-content markers by default.

## Environment And Deployment Conventions

The project uses npm with `package-lock.json`, Next.js standalone Docker output, `.env.production` through Compose `env_file`, and separate worker containers. AWS SDK default credential resolution supports an EC2 instance role, environment access keys, or a local profile. No credentials are required while `DYNAMODB_EVENTS_ENABLED=false`.

## Risks

- Queue models cannot be deleted from PostgreSQL while workers depend on SQL locking, retries, and relational joins.
- Dual-write is not a distributed transaction. DynamoDB failures are logged and do not fail guard responses.
- TTL deletion is asynchronous and should not be treated as an exact deletion timestamp.
- GSI filtering can return fewer items than the requested page size when secondary filters are applied.
- Aggregate dashboards that still query old `GuardLog` rows should keep dual-write enabled until those aggregates are migrated to `UsageCounter` or DynamoDB query projections.
- Backfill is idempotent through deterministic IDs and conditional puts, but it must be run with the intended table/region and reviewed in dry-run mode first.

## Recommended Order

1. Create and verify the DynamoDB table and TTL.
2. Deploy with DynamoDB disabled.
3. Enable DynamoDB with dual-write and PostgreSQL read fallback.
4. Verify guard, webhook, audit, incident, report, worker, RAG, red-team, and SIEM events.
5. Keep dual-write until legacy aggregate dashboards and exports have been observed through a full reporting cycle.
6. Disable dual-write while retaining read fallback.
7. Run optional backfill.
8. Back up PostgreSQL, run cleanup dry-runs, and delete only explicitly selected old heavy rows.

