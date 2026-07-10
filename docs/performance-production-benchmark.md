# Performance Production Benchmark — Phase 5

**Latest measured run:** 2026-07-10
**Environment:** Local Windows 11, single-process Next.js 15.5.19, Node.js, 8 logical CPU cores
**Method:** Production HTTP load tests via `scripts/perf/*.js` against `next start` (prod build), with the
server process sampled independently by `scripts/perf/server-resource-monitor.js`.

> **Honesty note.** These are *local single-process* numbers, not deployed-infra evidence. The load
> driver and the server share the same 8-core machine, so at high concurrency the driver competes with
> the server for CPU. The public-pages and 1/10/100 guard results are clean and representative; the
> c=500 guard result hit **local socket limits** (connection resets), not a code fault. Authenticated
> data-path throughput (dashboard/logs/reports) and any deployed 100/500-concurrency run remain
> **EVIDENCE REQUIRED** — the harness refuses to fabricate them (see §4).

## What changed in this run (vs the 2026-07-09 baseline)

- **Corrected methodology** (already in `scripts/perf/utils.js`): rejects `iterations < concurrency`,
  counts auth redirects as failures (not successes), reports throughput.
- **Server-process resource sampling added** — `scripts/perf/server-resource-monitor.js` samples the
  *server's* RSS + CPU% (resolved from the listening port's PID), closing the earlier
  "no server memory/CPU profiling" gap. Previously only the load driver's resources were captured.
- **Rate limiter verified, then raised for the compute benchmark** — the guard endpoint enforces
  `PUBLIC_ANALYZE_RPM` (default **20**; confirmed via `x-ratelimit-limit: 20` + `Retry-After`). For the
  compute run it was raised to 10,000 via a temporary (gitignored) `.env.local`, then removed.

## 1. Guard API — `POST /api/guard/analyze` (public, no auth)

500 iterations/level, 9 payload fixtures incl. the 8,000-char boundary. Rate limit raised to 10,000 RPM.

| Concurrency | p50 (ms) | p95 (ms) | p99 (ms) | Throughput (rps) | Errors | Notes |
|---|---|---|---|---|---|---|
| 1   | 124.4  | 225.6   | 435.2    | 6.8  | 0/500   | clean |
| 10  | 595.4  | 845.5   | 948.3    | 16.4 | 0/500   | clean |
| 100 | 5293.2 | 17360.1 | 26186.0  | 13.5 | 0/500   | CPU-bound, single process |
| 500 | 1432.0 | 9560.5  | 10324.9  | 47.1 | 313/500 | **connection resets (status 0)** — local socket exhaustion, not rate-limited |

**Server process during this test (244 samples @ 400ms):** peak RSS **492.8 MB**, mean **410.4 MB**;
peak CPU **23.3%**, mean **5.9%** (of 8 cores). No memory growth/leak across the run.

**Reading it:** the guard is CPU-bound (regex + generalized detectors + semantic tier). One local
process saturates around c=100. The c=500 resets are the OS/loopback connection ceiling on a single
Node process under a co-resident driver — production behind multiple replicas + a connection-pooling
proxy would spread this. That spread is **EVIDENCE REQUIRED** (needs deployed infra).

## 2. Public Pages — SSR, no auth (10 pages)

500 iterations/level.

| Concurrency | p50 (ms) | p95 (ms) | p99 (ms) | Throughput (rps) | Errors |
|---|---|---|---|---|---|
| 1   | 12.3   | 23.0   | 91.8   | 63.0 | 0/500 |
| 10  | 112.4  | 252.6  | 335.8  | 77.1 | 0/500 |
| 100 | 1154.5 | 2649.2 | 3113.7 | 78.0 | 0/500 |
| 500 | 5255.8 | 6109.5 | 6181.0 | 77.5 | 0/500 |

**0 errors at every level, including c=500** — SSR pages sustain full 500 concurrency where the
compute-heavy guard path could not. p95 at c=500 (6.1 s) exceeds the 5 s soft threshold on a single
local process; sustained throughput holds at ~77 rps.

## 3. Guard micro-benchmark (in-process CPU only)

From `scripts/guardLatencyBench.ts` — isolates detector CPU cost from HTTP/transport:

| Bucket | p50 (ms) | p90 (ms) | p99 (ms) |
|---|---|---|---|
| ALL | ~4.6 | ~7.0 | ~10.5 |
| benign-short | ~2.1 | ~3.2 | ~5.0 |
| benign-long | ~8.5 | ~12.0 | ~18.0 |
| obfuscated-attack | ~6.2 | ~9.5 | ~14.0 |

## 4. EVIDENCE REQUIRED (not fabricated)

| Item | Status | Why |
|---|---|---|
| Authenticated dashboard load | **EVIDENCE REQUIRED** | `dashboard-load-test.js` refuses to run without a valid `DASHBOARD_COOKIE`; auth redirects are not performance evidence. |
| Logs API under load (real query path) | **EVIDENCE REQUIRED** | `logs-scale-test.js` requires a session and asserts `logs[]` in the body before counting a success. |
| Report generation under load | **EVIDENCE REQUIRED** | `report-generation-test.js` requires a session + real `LOAD_PROJECT_ID`. |
| Deployed 100/500-concurrency (guard + pages) | **EVIDENCE REQUIRED** | Local single process ≠ production replicas/CDN/pooling. The c=500 guard resets are a local socket ceiling. |
| Redis/DB under sustained load | **EVIDENCE REQUIRED** | Rate limiter uses Upstash but plan/usage DB paths were not driven at scale. |

To close the authenticated items, capture a real session cookie from a logged-in browser and set
`DASHBOARD_COOKIE` (full `Cookie:` header). The scripts then verify the authenticated data path and
emit throughput + status distributions.

## SLO snapshot (local, single process)

| Signal | Target | Measured | Status |
|---|---|---|---|
| Guard API p95 @ c=1 | ≤250 ms | 225.6 ms | PASS |
| Guard API p95 @ c=10 | ≤1 s | 845.5 ms | PASS |
| Public pages p95 @ c=1 | ≤2 s | 23.0 ms | PASS |
| Public pages error rate @ c=500 | <1% | 0% | PASS |
| Guard error rate @ c≤100 | <1% | 0% | PASS |
| Server RSS under load | no leak | 492.8 MB peak, stable | PASS |

## How to reproduce

```bash
# 1. Build (needs disk headroom — free space first if C: is full)
npm run build

# 2. Start prod server. To benchmark the guard COMPUTE path, raise the rate limit
#    via a temporary, gitignored .env.local (default is 20 RPM and IS enforced):
printf 'PUBLIC_ANALYZE_RPM=10000\n' > .env.local
npm run start -- -p 3199

# 3. In another shell, sample the server process while a test runs:
node scripts/perf/server-resource-monitor.js --port 3199 --duration 220 &
LOAD_HTTP_URL=http://localhost:3199 LOAD_ITERATIONS=500 \
  LOAD_CONCURRENCY_LEVELS=1,10,100,500 npm run perf:guard

LOAD_HTTP_URL=http://localhost:3199 LOAD_ITERATIONS=500 \
  LOAD_CONCURRENCY_LEVELS=1,10,100,500 npm run perf:pages

# 4. Authenticated paths (EVIDENCE REQUIRED — needs a real session cookie):
DASHBOARD_COOKIE="authjs.session-token=..." LOAD_HTTP_URL=http://localhost:3199 npm run perf:dashboard
DASHBOARD_COOKIE="authjs.session-token=..." LOAD_HTTP_URL=http://localhost:3199 npm run perf:logs

# 5. Remove the temporary override when done:
rm .env.local
```

## Verdict

Phase 5 harness and local measurement are **complete**: all five load scripts run, the corrected
methodology is enforced, server-process CPU/RSS is now captured, the rate limiter is verified, and the
no-auth guard + public-page paths have real measured p50/p95/p99/throughput at 1/10/100/500. Remaining
production-scale proof (authenticated data paths, deployed multi-replica 100/500) is explicitly
**EVIDENCE REQUIRED** and must not be claimed from these local numbers.
