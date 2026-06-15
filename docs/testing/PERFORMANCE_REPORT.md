# Performance Report

Date: 2026-06-15

## Guard Component Load

This measures detector + policy execution in-process. It excludes HTTP, auth, PostgreSQL, Redis, persistence, and network latency.

| Concurrency | Iterations | p50 | p95 | p99 | Error rate |
| ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | 400 | 0.31 ms | 0.61 ms | 2.10 ms | 0% |
| 10 | 1,000 | 0.14 ms | 0.22 ms | 0.48 ms | 0% |
| 50 | 2,000 | 0.14 ms | 0.22 ms | 0.48 ms | 0% |
| 100 | 4,000 | 0.28 ms | 0.54 ms | 1.11 ms | 0% |

## Production Browser Navigation

Measured with Chromium against local `next start`; values include local navigation and server response, not internet transit.

| Page | Duration |
| --- | ---: |
| `/` | 352 ms |
| `/pricing` | 530 ms |
| `/docs` | 294 ms |
| `/dashboard` | 548 ms |
| `/dashboard/logs` | 356 ms |
| `/dashboard/reports` | 321 ms |
| `/dashboard/rag` | 457 ms |
| `/admin/production` | 411 ms |

## Build / Bundle

- Production build: 106-145 seconds on this Windows/OneDrive machine.
- Shared first-load JS: approximately 102 kB.
- Largest tested dashboard route first-load JS: webhooks approximately 114 kB.
- Middleware bundle: approximately 87.5 kB.

## Not Measured

- End-to-end authenticated guard API p95/p99 under 100 concurrent network clients.
- Memory/CPU/connection-pool saturation.
- Worker queue backlog and provider latency.
- Lighthouse FCP/LCP/TBT scores; Lighthouse was not installed/run.

## Assessment

Local rendering and detector execution are responsive. Production capacity is not proven until HTTP load is run against a deployment with real Redis, database sizing, workers, and observability.
