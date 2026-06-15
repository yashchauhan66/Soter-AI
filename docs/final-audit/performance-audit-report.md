# Performance Audit Report

## Build/Bundle

- Clean production build passed.
- Shared first-load JS is about 102 kB; dashboard-heavy pages are generally 103-114 kB.
- Middleware bundle is 87.5 kB.
- Build warning: `next-auth`/`jose` uses `CompressionStream`/`DecompressionStream` APIs unsupported by Edge Runtime.

## Performance Risks

| Severity | Area | Finding | Recommendation |
| --- | --- | --- | --- |
| MEDIUM | Dashboard overview | Reads up to 2,000 guard logs for charting. | Pre-aggregate daily/hourly metrics or paginate. |
| MEDIUM | Admin production page | Reads up to 10,000 `ProductionMetric` rows for 24h stats. | Use DB aggregation and indexed rollups. |
| MEDIUM | Support/admin queues | Some pages list 100-250 rows with nested includes. | Add cursor pagination and server-side filters. |
| MEDIUM | Dynamic rendering | Most dashboard/admin pages are `force-dynamic`. | Expected for authenticated pages; keep public pages static where possible. |
| MEDIUM | Workers | SIEM worker lacks the health/shutdown parity of webhook/background workers. | Add health endpoint and graceful shutdown. |
| LOW | Client components | API key, webhook, billing, policy pages are modest; no large OCR/PDF client imports found. | Keep heavy PDF/OCR/vector libs server-side. |

## Verified Fast Paths

- Guard API smoke requests returned 200 locally.
- Production build completed in about 95 seconds on this machine after clean.
- Public page smoke GETs returned 200.

## Quick Wins

- Add `npm run lint`.
- Add route timing metrics around dashboard pages with high row counts.
- Move dashboard chart queries to aggregated metrics.
- Add worker health endpoints consistently.

