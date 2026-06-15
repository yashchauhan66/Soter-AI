# Performance Issues — CyberRakshak Guard

Date: 2026-06-16 · Branch: `final-project-audit`

See also `docs/testing/PERFORMANCE_REPORT.md` for the prior measured baselines (guard component p95 0.22–0.61 ms through concurrency 100, 0% errors; local production navigation 294–548 ms; build 106–145 s).

## Fixed this session

| ID | Issue | Severity | Status |
|----|-------|----------|--------|
| CRG-RT-013 | Redis rate-limit `incrBy` + `expire` non-atomic; a lost `expire` left the key with no TTL → permanent lockout for that identifier (`lib/rateLimit.ts`). | LOW (availability) | FIXED + tested (self-heal re-applies TTL when `ttl === -1`) |

## Verified-acceptable

- **Guard engine**: pure, synchronous, sub-millisecond; deduped risk-type scoring. No DB or network in the hot path.
- **Logs**: keyset (`createdAt,id`) cursor pagination, `take: limit+1`, no OFFSET, clamped 10–100.
- **Dashboard top-risk**: bounded SQL aggregation (`GROUP BY`, `LIMIT`) instead of fetching rows; no content columns selected.
- **Webhook/SIEM/report delivery**: durable queue + workers, not inline in the request path; 5 s delivery timeout, exponential backoff.
- **Policy load**: cached 30 s in-process (`loadProjectPolicy`).

## Not measured (infra / load — pre-production)

- End-to-end authenticated guard API p95/p99 under 100 concurrent HTTP clients against a real deployment.
- Memory/CPU/DB connection-pool saturation; worker queue backlog under sustained load.
- Lighthouse FCP/LCP/TBT.

A `scripts/httpLoadTest.ts` exists (`npm run test:load:http`) for HTTP saturation; running it meaningfully requires a deployed instance with real Redis/DB sizing (provider/infra gated).
