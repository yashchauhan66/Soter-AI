# Database Storage Plan

## Goal

Run the product as a hybrid database system that can serve ~5000 concurrent users
without letting high-volume security logs overload PostgreSQL, and without opening
more database connections than the managed Postgres tier can accept.

## Actual Production Stack

| Concern | Service | Notes |
| --- | --- | --- |
| Relational system of record | **Neon PostgreSQL** (`DATABASE_URL`) | Serverless Postgres. Must use the **pooled** endpoint at scale — see below. |
| Heavy append-only event logs | **DynamoDB** `soterai_events` (`ap-south-1`) | On-demand billing, TTL per event type, 4 GSIs. |
| Rate limiting + distributed state | **Upstash Redis (REST)** (`UPSTASH_REDIS_REST_URL`) | HTTP-based; no socket pool to exhaust. Falls back to in-memory if unset. |
| Vector store (RAG) | **Qdrant** | Runs as a container alongside the app. |

> The app reads DynamoDB only when `DYNAMODB_EVENTS_ENABLED=true`. If that flag is
> unset or `false`, every heavy log is written to PostgreSQL instead and DynamoDB is
> never contacted — which looks exactly like "DynamoDB won't connect."

## Keep In PostgreSQL

PostgreSQL remains the system of record for relational, transactional, and strongly
consistent data:

- Users, sessions, organizations, memberships, invites, RBAC, SSO, SCIM, and auth tokens.
- Projects, API key hashes, project policies, quotas, billing, subscriptions, invoices, plan changes, and onboarding state.
- Webhook endpoint configuration and the current delivery queue rows while SQL locking/retry workers depend on them.
- Incident, report, scheduled report, SIEM integration, red-team suite/run, RAG document, classifier, support, and admin metadata.
- `UsageCounter` and other pre-aggregated counters used by dashboards and billing. Do not scan raw event history for these.
- Queue/control tables such as `BackgroundJob` until the worker queue is moved to a dedicated queue service.

Rule of thumb: if a row is **read-modified-updated**, **joined**, or must be **strongly
consistent** (auth, billing, quotas), it stays in PostgreSQL.

## Put In DynamoDB

DynamoDB stores append-only, high-write, time-ordered event streams with TTL:

- Guard decisions and previews after redaction.
- Governance audit event history.
- Webhook delivery lifecycle history.
- Incident timeline events.
- Payload, report, worker, RAG security, red-team, and SIEM delivery lifecycle events.

Rule of thumb: if a row is **write-once, time-ordered, queried by a known partition
key** (project / org / webhook / incident / report / job) and **safe to auto-expire**,
it belongs in DynamoDB.

Raw prompts, raw responses, authorization headers, cookies, passwords, API keys, and
original bodies must **not** be stored in DynamoDB. Store redacted previews, hashes,
IDs, status, decision, risk score, categories, latency, and small metadata only.

## Rollout

1. Create and verify `soterai_events` in `ap-south-1` (`dynamodb:events:create` → `:ttl` → `:verify`).
2. Enable `DYNAMODB_EVENTS_ENABLED=true`.
3. Keep `DYNAMODB_EVENTS_DUAL_WRITE=true` during migration so PostgreSQL still receives legacy guard/audit rows.
4. Keep `DYNAMODB_EVENTS_READ_FALLBACK_POSTGRES=true` so dashboards survive a DynamoDB read issue.
5. Observe guard logs, webhooks, workers, reports, SIEM, and dashboards through a full reporting cycle.
6. Set `DYNAMODB_EVENTS_DUAL_WRITE=false` after validation to stop heavy guard/audit growth in PostgreSQL.
7. Backfill old heavy rows only if needed (`logs:backfill:dynamodb`), then clean old PostgreSQL heavy rows after a verified backup (`logs:cleanup:postgres`).

## 5000-Concurrent-User Baseline

The bottleneck at this scale is **PostgreSQL connections**, not CPU. Address it in order:

### 1. Use the Neon POOLED endpoint (highest impact)

`DATABASE_URL` currently points at the **direct** endpoint
(`ep-bold-boat-adv2w3ct.c-2.us-east-1.aws.neon.tech`). The direct endpoint is for
migrations and admin tasks and caps concurrent connections hard. For app runtime,
switch to Neon's PgBouncer pooler by inserting `-pooler` into the host and telling
Prisma it is behind a transaction pooler:

```dotenv
# Runtime (app + workers): pooled, thousands of clients OK
DATABASE_URL="postgresql://neondb_owner:PASS@ep-bold-boat-adv2w3ct-pooler.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require&pgbouncer=true&connection_limit=5"
# Migrations only (prisma migrate deploy): keep the DIRECT endpoint
DIRECT_URL="postgresql://neondb_owner:PASS@ep-bold-boat-adv2w3ct.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require"
```

Keep `connection_limit` small **per process** and multiply by process count:
`app containers × replicas × connection_limit + workers` must stay under the Neon
compute's max connections. Example: 3 app replicas × 5 + 4 workers × 3 ≈ 27 pooled
client slots — comfortably within a pooled tier.

### 2. Co-locate the datastores by region (latency)

Postgres (Neon) is in `us-east-1`; DynamoDB is `ap-south-1`. If EC2 is in `ap-south-1`
(Mumbai), every Postgres query pays a ~200 ms cross-region round trip, which caps
throughput long before 5000 users. Pick one region for EC2 + Neon + DynamoDB
(recommended: everything in `ap-south-1` for an India audience) so hot-path queries
stay single-digit-millisecond.

### 3. DynamoDB capacity

- Start on **on-demand** billing (already configured). It absorbs bursty guard traffic with no capacity planning.
- Move to provisioned + auto-scaling only after CloudWatch shows a stable, predictable pattern and cost justifies it.
- All reads are `Query` against a partition key (project/org/webhook/incident/report/job) — **never `Scan`**. Do not introduce production scans.

### 4. Redis

- Keep Upstash (or another distributed Redis) enabled — the in-memory fallback is per-process and breaks rate limiting across multiple app replicas.
- Upstash REST has no socket pool, so it does not compete with Postgres connections.

### 5. Retention (keeps DynamoDB and Postgres small)

Guard 7 days, webhook/worker 14 days, reports/RAG/red-team 30 days, governance audit
90 days, incident 180 days — unless compliance requires more. TTL is set on `expiresAt`
at write time, so expiry is automatic and free.

### 6. Scale app and workers separately

Web/API replicas scale with request traffic; webhook/background/SIEM workers scale with
queue depth. Each process keeps its own small Prisma pool (see step 1).

## Quick Health Checklist

- [ ] `DATABASE_URL` uses the `-pooler` host with `pgbouncer=true&connection_limit=5`.
- [ ] EC2, Neon, and DynamoDB are in the same region (or the cross-region latency is accepted).
- [ ] `DYNAMODB_EVENTS_ENABLED=true` and `dynamodb:events:verify` passes.
- [ ] `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` are **unset** (not blank) so the EC2 role is used.
- [ ] IMDS hop limit = 2 on the EC2 instance (Docker containers reach the role).
- [ ] Upstash Redis is configured (no in-memory rate-limit fallback in production).
