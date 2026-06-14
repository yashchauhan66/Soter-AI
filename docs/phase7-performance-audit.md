# Phase 7 Performance Audit

Status: audit only. No launch features or performance fixes were implemented in this pass.

Date: 2026-06-14

## Audit Scope

- Identify slow routes, APIs, database queries, bundle/client-boundary issues, and background jobs running inline.
- Confirm the app baseline without changing runtime behavior.
- Produce a prioritized fix queue for the next Phase 7 implementation pass.

## Baseline Checks

- `npm run typecheck`: passed.
- `npx prisma validate`: passed.
- `npm audit --audit-level=high`: passed, 0 high severity vulnerabilities found.
- Recent Phase 6 exact `npm run verify`: passed after clearing stale `.next` output and stopping the stale dev server.

## Executive Summary

The app is likely slow because several pages and API routes perform heavy analytics, export, report generation, document scanning, red-team execution, ML evaluation, webhook delivery, and external health checks directly in request or server-render paths.

The highest-risk performance issue is not one single bundle or query. It is the combination of:

1. Unpaginated or under-selected dashboard queries over growing tables.
2. Multiple count/aggregate scans per page render.
3. Heavy jobs executed synchronously inside API requests.
4. Large rows returned to client components when only summary fields are displayed.
5. Many routes forced dynamic, preventing static rendering or cache opportunities.

## Slow Routes And Pages

### Critical

- `/dashboard`
  - Runs usage lookup plus 7 GuardLog queries on every render.
  - `riskRows` loads all `riskTypes` for the selected project without `take`, date bounds, or aggregation.
  - Recent logs fetch full GuardLog rows, including text and metadata fields, for a table that only needs a subset.
  - Counts for total, blocked, PII redactions, secrets, and average risk are separate table scans.

- `/dashboard/rag`
  - Loads all RAG collections and all documents for each collection in one render.
  - No pagination, no per-collection limit, and no selected fields.
  - Will degrade quickly as users upload documents and versions.

- `/admin`
  - Performs multiple global counts over user, organization, project, guard log, payment, feedback, and audit tables.
  - These are reasonable at small scale but become expensive once GuardLog, audit logs, and payment events grow.

- `/admin/system-health`
  - Performs database counts and secret/vector provider health checks in the page render path.
  - External provider checks can make the admin page feel slow even when the database is healthy.

### High

- `/dashboard/logs`
  - Fetches the latest 100 GuardLog records with full rows.
  - No cursor pagination, date filter, or selected fields.

- `/dashboard/projects`
  - Loads all projects for the current user with `_count.guardLogs`.
  - Needs pagination or summary materialization for larger tenants.

- `/dashboard/webhooks`
  - Loads all projects and webhook endpoints with delivery counts.
  - No pagination by project or endpoint.

- `/dashboard/enterprise/audit`
  - Caps organization audit logs and security events at 100 each, but includes metadata payloads.
  - Needs filters and field selection for larger enterprises.

- `/admin/organizations` and `/admin/projects`
  - Take 100 rows with nested counts across members, projects, security events, API keys, guard logs, and webhooks.
  - Counts over large relation tables will be noticeable in production.

## Slow APIs And Inline Work

### Critical

- `GET /api/reports`
  - Calls `generateAndStoreMonthlyReport()` inline.
  - This can scan monthly GuardLog data and write report rows while the request waits.

- `GET /api/reports/pdf`
  - Builds PDF output inline using the monthly report pipeline.
  - PDF generation should be queued or cached after report generation.

- `POST /api/exports`
  - Fetches up to 25,000 GuardLog or webhook rows into memory.
  - Converts the whole result to CSV/JSONL in-process and returns it in the request.
  - Large exports can cause high memory use and long request latency.

- `POST /api/rag/documents`
  - Reads the full upload into memory with `Buffer.from(await file.arrayBuffer())`.
  - Runs document sandboxing, extraction, scanning, chunk creation, finding creation, and event emission inline.
  - This is a prime candidate for a RAG worker.

- `POST /api/redteam/run`
  - Creates the suite and runs the red-team suite inline.
  - Should enqueue execution and return a job or suite id immediately.

- `POST /api/admin/ml/evaluations`
  - Loads the full dataset with `include: { examples: true }`.
  - Runs model evaluation inline.
  - Should enqueue evaluation work and stream/status-poll results.

### High

- `POST /api/webhooks/test`
  - Enqueues a webhook delivery, then immediately calls `attemptDelivery()` inline.

- `POST /api/webhooks/replay`
  - Marks delivery pending, then calls `attemptDelivery()` inline.

- `POST /api/admin/actions` with `RETRY_DELIVERY`
  - Retries webhook delivery inline from an admin action.

- `POST /api/scheduled-reports`
  - Calls `deliverScheduledReport(id)` inline.

- `POST /api/admin/reports/process`
  - Processes due scheduled reports inside the request. Acceptable for a cron endpoint, but the request waits for all work.

- Billing and auth email paths
  - Payment failed emails, signup emails, password reset emails, and member invite emails are sent inline.
  - These are not the biggest CPU cost, but provider latency can slow user-facing flows.

## Database Query Hotspots

### GuardLog

Current helpful indexes:

- `@@index([projectId, createdAt])`
- `@@index([action])`

Hotspots:

- Dashboard counts and aggregates repeatedly scan GuardLog.
- Risk-type analytics use array filters and full risk-type reads.
- Exports join GuardLog through Project by organization and fetch up to 25,000 rows.
- Log tables return full text fields and metadata when summary fields would be enough.

Likely future index/materialization work:

- Add query-specific indexes such as `[action, createdAt]` and `[riskScore, createdAt]`.
- Consider denormalized `organizationId` on GuardLog or a materialized analytics table for organization-level reporting.
- Add daily/project summary rollups for dashboard cards and top risk types.

### ApiKey

Current indexes:

- `@@index([projectId])`
- `@@index([prefix])`

Hotspots:

- Guard request verification loads candidates by prefix and includes project plus organization.
- This runs on every guarded API request.

Likely future work:

- Add `[prefix, isActive]` and `[projectId, isActive]` indexes.
- Add a short-lived cache for active key metadata by prefix. Never cache or expose raw API keys.

### WebhookDelivery

Current indexes:

- `@@index([endpointId, createdAt])`
- `@@index([status, nextAttemptAt])`

Hotspots:

- Replay/test/admin retries call delivery work inline.
- Delivery history pages and export paths will grow quickly.

Likely future work:

- Add `[endpointId, status]` and possibly `[createdAt]` depending on history/export filters.
- Move retries and tests fully through `workers/webhookWorker.ts`.

### RAG Tables

Current helpful indexes:

- `RagDocument`: `@@unique([collectionId, hash, version])`, `@@index([collectionId, status])`
- `RagChunk`: `@@unique([documentId, chunkIndex])`, `@@index([documentId, riskScore])`

Hotspots:

- RAG page loads all documents per collection.
- Document upload creates documents, chunks, findings, and events inline.

Likely future work:

- Add pagination by `collectionId, createdAt`.
- Consider indexes for review queues, such as `[collectionId, status, createdAt]`.
- Queue extraction/scanning/chunking.

### Audit And Event Tables

Current helpful indexes:

- `SecurityEvent`: organization/project createdAt indexes and `[eventType, severity, createdAt]`.
- `OrganizationAuditLog`: `[organizationId, createdAt]` and `[category, createdAt]`.
- `AuditExport`: `[organizationId, createdAt]`.
- `PaymentEvent`: `[organizationId, receivedAt]` and `[eventType]`.

Likely future work:

- Add filters before adding indexes blindly.
- Candidate indexes: `SecurityEvent [severity, createdAt]`, `PaymentEvent [eventType, receivedAt]`, `AuditExport [status, createdAt]`, `OrganizationAuditLog [actorUserId, createdAt]`.

## Bundle And Rendering Issues

- Build output from the recent successful verify showed shared first-load JS around 102 kB and middleware around 87.3 kB.
- Many pages and API routes use `export const dynamic = "force-dynamic"`.
- Public pages such as docs, pricing, security, trust, contact, and marketing-style pages appear dynamic in the build output, which prevents static rendering benefits.
- `middleware.ts` wraps `NextAuth(authConfig)` for broad route matching. Middleware size is worth monitoring because it runs on most non-static requests.

Largest source/client candidates:

- `components/dashboard/WebhookManager.tsx`
- `components/dashboard/PolicyForm.tsx`
- `components/dashboard/WhiteLabelReportPrint.tsx`
- `components/dashboard/LogsTable.tsx`
- `components/dashboard/RagManager.tsx`
- `components/dashboard/PlaygroundClient.tsx`
- `components/DemoChatClient.tsx`

Notes:

- The largest client components are scoped to dashboard pages, which is good.
- `WebhookManager` mixes endpoint management, test/replay actions, forms, and delivery display in one client bundle.
- `LogsTable` receives larger GuardLog payloads than it needs.
- Server-only heavy libraries such as PDF generation and document scanning should remain out of client imports.

## Background Jobs Running Inline

Existing workers:

- `workers/webhookWorker.ts`
- `workers/siemWorker.ts`

Work currently running inline that should be queued:

- Monthly report generation.
- PDF report generation.
- Audit export generation.
- RAG document extraction/scanning/chunking.
- Red-team suite execution.
- ML evaluation.
- Scheduled report delivery.
- Webhook test/replay/manual retry.
- Provider email sends where user latency matters.

Recommended worker additions for Phase 7 implementation:

- `workers/reportWorker.ts`
- `workers/ragWorker.ts`
- `workers/evaluationWorker.ts`
- `workers/exportWorker.ts`
- `workers/retentionWorker.ts`

## Priority Fix Queue

### P0

1. Fix `/dashboard` analytics:
   - Remove unbounded `riskRows`.
   - Select only fields needed by `LogsTable`.
   - Replace repeated GuardLog scans with summary tables or bounded date windows.

2. Queue heavy request work:
   - Reports, PDFs, exports, RAG scans, red-team runs, and ML evaluations should enqueue jobs and return status ids.

3. Add pagination and field selection:
   - Logs, RAG documents, webhook deliveries, admin organizations/projects, audit events.

### P1

4. Add targeted indexes after query changes:
   - GuardLog, ApiKey, WebhookDelivery, RAG review queues, PaymentEvent, AuditExport.

5. Add cached or materialized analytics:
   - Dashboard stat cards, top risks, admin global counts, report summaries.

6. Narrow dynamic rendering:
   - Remove `force-dynamic` where route data does not require it.
   - Make public documentation/trust/security pages static where possible.

### P2

7. Split large client components:
   - Lazy-load webhook delivery history, report print views, and advanced policy sections.

8. Add observability:
   - Route timing logs, Prisma query timing, worker queue metrics, export/report job durations.

9. Add load tests:
   - Guard API p95/p99, dashboard with large GuardLog tables, RAG upload queue, export throughput, webhook retry volume.

## Next Step

The next Phase 7 pass should implement P0 only: dashboard query reduction, job queue boundaries for the heaviest inline work, and pagination/select changes. Launch features should remain blocked until these performance foundations are in place.
