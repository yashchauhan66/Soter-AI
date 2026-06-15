# Production Operations Runbook

## First Response

1. Confirm impact using `/api/health`, `/api/ready`, `/admin/production`, worker health ports, and provider dashboards.
2. Open an incident with a public-safe summary if customers are affected.
3. Preserve logs and audit records without copying raw sensitive content into tickets or chat tools.
4. Identify the affected component and recent deployment or configuration change.
5. Mitigate through rollback, queue pause, provider failover, or capacity adjustment.

## Component Checks

- Database: connectivity, pool saturation, slow queries, migration state, backups.
- Redis: connectivity, latency, eviction, and multi-instance consistency.
- Guard API: p50/p95, error rate, rate limits, detector regressions.
- Workers: backlog, retries, dead letters, heartbeat.
- Razorpay: signature failures, event replay, subscription and invoice state.
- KMS/vector/email/SIEM: health checks and provider status.

## Recovery

Publish status updates using only approved public information. Verify customer-visible recovery, monitor for recurrence, resolve the incident, and create follow-up actions with owners and dates.
