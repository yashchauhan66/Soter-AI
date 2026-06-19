<<<<<<< HEAD
# PERFORMANCE ISSUES
## CyberRakshak Guard — Performance Audit

**Date:** 2026-06-16  
**Branch:** bug-stabilization-final

---

## Summary

| Issue ID | Severity | Title | Status |
|----------|----------|-------|--------|
| PERF-001 | HIGH | First `npm run build` intermittently fails (race condition) | DOCUMENTED |
| PERF-002 | MEDIUM | Badge API makes 4+ DB queries per request with no caching | DOCUMENTED |
| PERF-003 | MEDIUM | In-memory Redis fallback not suitable for multi-instance | DOCUMENTED |
| PERF-004 | MEDIUM | `loadBadgeStatus` uses `getMonthlyUsage` which makes a DB aggregate | DOCUMENTED |
| PERF-005 | LOW | next-auth Edge Runtime warnings for CompressionStream/DecompressionStream | DOCUMENTED |
| PERF-006 | LOW | Local in-process policy cache (30s TTL) not shared across instances | DOCUMENTED |

---

## PERF-001: Intermittent Build Failure (First Run)

**Severity:** HIGH  
**Status:** DOCUMENTED (Not fixable in codebase — Next.js 15 + Windows)

**Finding:** `npm run build` fails on the first run with:
```
unhandledRejection [Error [PageNotFoundError]: Cannot find module for page: /_document]
```
The second run always succeeds (82/82 pages).

**Root cause:** Next.js 15.5.19 race condition during parallel page data collection on Windows. The `_document` module error is an internal Next.js parallel worker timing issue.

**Impact:** CI pipelines that run `npm run build` once may fail spuriously. Docker builds on Linux are much less likely to hit this.

**Mitigation for CI:**
```sh
npm run build || npm run build
```
Or use `scripts/cleanNextBuild.mjs` (`npm run clean`) before each build.

**Recommendation:** Monitor next-auth and Next.js release notes. Consider adding a retry step in CI.

---

## PERF-002: Badge API — 4+ DB Queries Per Request, No Cache

**Severity:** MEDIUM  
**Status:** DOCUMENTED (Fix deferred to production hardening phase)

**Finding:** `lib/badge.ts` `loadBadgeStatus()` makes:
1. `db.project.findUnique` (with includes for branding)
2. `getMonthlyUsage` → `db.usageCounter.aggregate`
3. `db.guardLog.count` (blocked this month)
4. `db.guardLog.findFirst` (last activity)
5. `db.guardLog.findFirst` (recent issue in last 24h)

Total: 5 DB queries per badge request.

**Impact:** Public badge embeds on high-traffic pages could stress the database. Badge status rarely changes within a 30-60 second window.

**Recommendation:** Add Redis-backed cache with 60-second TTL:
```typescript
const cacheKey = `badge:${slug}`;
const cached = await redis.get<PublicBadgeStatus>(cacheKey);
if (cached) return cached;
// ... run queries ...
await redis.set(cacheKey, result, { ex: 60 });
return result;
```

---

## PERF-003: In-Memory Redis Fallback — Multi-Instance Unsafe

**Severity:** MEDIUM  
**Status:** DOCUMENTED (Warning already logged)

**Finding:** When neither `UPSTASH_REDIS_REST_URL` nor `REDIS_URL` is configured, the app uses `MemoryRedis` — an in-process HashMap. Rate limits and monthly usage are per-process, not shared.

**Impact in multi-instance deployment:**
- Each pod has its own rate limit bucket → effective rate limit = limit × pod count
- Monthly usage metering is per-pod → usage quota enforcement fails

**Current mitigation:** Warning logged on startup: `[CyberRakshak] UPSTASH_REDIS_REST_URL is not set. Using in-memory rate limit store. Do NOT run multi-instance in this state.`

**Status:** Warning present. Acceptable for single-instance development. Production MUST use Redis.

---

## PERF-004: Policy Cache is In-Process Only

**Severity:** LOW  
**Status:** DOCUMENTED

**Finding:** `lib/guard/policy.ts` `loadProjectPolicy()` uses `getLocalCache`/`setLocalCache` — an in-process Map with 30-second TTL. Policy changes take up to 30 seconds to propagate per pod.

**Impact:** In multi-instance deployments, a policy update may take up to 30 seconds to take effect per instance. In single-instance, this is fine.

**Recommendation:** For production with multiple pods, either reduce cache TTL or use Redis-backed policy cache.

---

## PERF-005: next-auth v5 Beta Edge Runtime Warnings

**Severity:** LOW  
**Status:** DOCUMENTED

**Finding:** Build produces warnings:
```
A Node.js API is used (CompressionStream at line: 10) which is not supported in the Edge Runtime.
A Node.js API is used (DecompressionStream at line: 26) which is not supported in the Edge Runtime.
```
These originate from `next-auth → jose → deflate.js`.

**Impact:** Build warnings only. The middleware (`auth.config.ts`) uses the edge-safe `authConfig` that does NOT import the jose JWE decrypt path. Runtime behavior is not affected.

**Fix:** Update to next-auth stable when it is released, or pin to a version without the jose web API dependency.

---

## PERF-006: No Production Load Testing

**Severity:** MEDIUM  
**Status:** BLOCKED_NEEDS_USER_PERMISSION

**Finding:** No `test:performance` script exists. Guard API latency, dashboard load times, and concurrent request handling have not been measured under load.

**Recommendation:** Implement load tests using `autocannon`, `k6`, or `hey`:
- Guard API: 1/10/50/100 concurrent requests per second
- Dashboard routes: response time P95/P99
- Logs endpoint with pagination: large result sets
- Admin production page: DB aggregation timing

**Blocked on:** Running dev server for testing.

---

## Build Output Analysis

| Route Type | Count | Notes |
|------------|-------|-------|
| Static (○) | ~45 | Prerendered, no server cost |
| Dynamic (ƒ) | ~37 | Server-rendered on demand |
| API routes | ~50 | All force-dynamic |
| Middleware | 87.5 kB | next-auth JWT verification |
| First Load JS | 102 kB | Shared chunk baseline |

**No `take: 2000` or `take: 10000` found in codebase** — queries use reasonable limits.  
**No heavy nested includes found in list views** — per-route selects are scoped appropriately.  
**No PDF/OCR libs bundled in client** — pdfkit and tesseract.js are server-side only.
=======
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
>>>>>>> main
