# Data Retention Policy

## Principles

Retain the minimum data needed for security operations, customer configuration, contractual obligations, and abuse prevention. Prefer hashes, redacted text, and structured findings over raw prompt or response content. Retention is tenant-scoped and deletion must preserve isolation.

## Product behavior

The product supports 7, 30, 90, 180, 365-day, and custom retention windows through `lib/retention/policy.ts`. A scheduled operator or worker must invoke policy enforcement; configuring a window alone is not proof that purging runs in production. The application records the last run and writes an audit event when a policy is applied.

## Data classes

| Class | Default treatment | Deletion trigger |
|---|---|---|
| Guard/security events | Tenant-configured window; content minimized | Retention job or tenant deletion |
| Webhook delivery metadata | Tenant-configured operational window | Retention job |
| API/SCIM tokens | Hash only; metadata retained while active | Revocation plus policy cleanup |
| Billing records | Retain as legally and contractually required | Approved finance schedule |
| Audit evidence | Tamper-evident metadata for the agreed period | Approved retention expiry |
| Backups | Encrypted, access-controlled, finite lifecycle | Backup rotation/expiry |

## Holds, exports, and deletion

A documented legal or security hold may pause deletion for a narrowly defined scope and duration. Tenant exports must be authorized and audited. Account deletion removes active data according to the runbook; expired backup copies age out rather than being selectively edited in place.

## Verification

Production readiness requires a scheduled-job run with before/after counts, cross-tenant checks, audit evidence, and a restore test demonstrating that expired data is not reintroduced.
