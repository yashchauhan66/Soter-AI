# Performance and Scale Plan

## Measurement boundary

Never combine these numbers without labels:

1. **Detector CPU:** normalization + detector + policy in-process.
2. **Guard service:** HTTP, auth, Redis, policy load and serialization, excluding client network.
3. **Durable decision:** guard service plus required event durability.
4. **Customer end-to-end:** customer network and model/tool path.

The checked-in honest benchmark currently supports only a deterministic classifier CPU claim: approximately 4.59ms p50, 7.05ms p95 and 10.55ms p99 in its recorded environment. It does not prove full API latency.

## Proposed SLOs

These are targets to validate, not current claims.

| Signal | Pilot target | Measurement |
|---|---:|---|
| Fast detector CPU p95 | ≤50ms at 10KB | fixed hardware, warm process |
| Authenticated guard service p95 | ≤150ms at 10KB, healthy dependencies | server span, excludes client network |
| Guard service p99 | ≤300ms | same environment |
| Availability | 99.9% monthly for paid pilot | valid requests excluding planned maintenance |
| Redacted event durability | ≥99.99%, no silent loss | accepted decisions vs durable events |
| Webhook p95 delivery lag | ≤60s when destination healthy | decision to 2xx |
| Worker queue age | <120s normal; alert above | oldest pending task |
| Dashboard p95 | ≤2s for 30-day tenant view | server response |
| Recovery objectives | RPO ≤15m core; RTO ≤2h pilot | restore drill |

## Pipeline design

- Normalize once and share immutable normalized views.
- Run independent deterministic detectors in bounded parallel groups only after profiling; regex-first is not automatically faster if patterns cause repeated scans.
- Compile regexes and policies once; cache by signed policy/version with bounded TTL.
- Use deep/LLM analysis only for ambiguous or policy-selected cases, with deadline/cost budgets.
- Set byte, token, nesting, archive, OCR page, tool-depth and session-turn limits before expensive work.
- Keep raw sensitive content out of caches, metrics and async jobs.
- Use async event persistence only when policy permits; high-risk actions may require durable acknowledgement.
- Apply backpressure and circuit breakers rather than unlimited queues.

## Data plan

### Postgres

- Core tenant, policy, identity, billing, configuration and compact audit indexes.
- Review `EXPLAIN (ANALYZE, BUFFERS)` for top dashboard/API queries.
- Keyset pagination; bounded projections; partial indexes for pending/failed queues.
- Connection-pool budget per app/worker replica; transaction timeouts and lock metrics.
- RLS feasibility for tenant-critical tables.

### DynamoDB

- Heavy redacted events keyed for project/org/time and use-case GSIs.
- On-demand initially, then provisioned/autoscaling only with traffic evidence.
- TTL by tenant retention policy; export/legal-hold exception workflow.
- Idempotent writes, sequence/checksum, dual-write reconciliation and dead-letter/replay.
- Monitor throttles, consumed capacity, item size, hot partitions, stream lag and reconciliation drift.

### Redis/queues

- Atomic rate/cost reservations and idempotency.
- No in-memory fallback in production.
- Namespaced tenant keys, explicit TTL, outage/cold-start behavior and eviction monitoring.
- Queue concurrency by task class; OCR/report tasks cannot starve security events.

### Vector store

- Namespace/collection strategy validated for tenant count, chunk volume and deletion.
- Provider-native filters plus application post-filter.
- Batch embeddings with classified/redacted input and bounded retries.
- Track query p95, recall quality, filter rejects and stale ACL count.

## Benchmark matrix

| Dimension | Values |
|---|---|
| Payload | 100B, 1KB, 10KB, 100KB, maximum |
| Concurrency | 1, 10, 50, 100, saturation |
| State | cold/warm process, cold/warm cache |
| Decision | allow, redact, review, block |
| Dependency | healthy, slow, timeout, unavailable |
| Tenant pattern | one hot tenant, many tenants, noisy neighbor |
| Endpoint | input, output, unified, RAG, agent action, logs/dashboard |

Record p50/p95/p99/max, throughput, error/timeout rate, CPU, memory, DB connections, Redis latency, event loss/lag and estimated cost per 1,000 requests. Commit methodology and machine/container versions with results.

## Scaling and rollback

- Scale stateless guard replicas on p95/CPU; workers on queue age, not only CPU.
- Keep app and heavy OCR/report workers isolated.
- Canary new detector/policy versions by tenant and compare shadow decisions.
- Roll back by immutable image digest and last-known-good policy; keep schema expand-compatible.
- Capacity changes require a saturation test and cost estimate.
