# Retention runbook (Preview)

This is the safe-defaults runbook for applying CyberRakshak Guard data retention policies. Execution against production data requires explicit authorization and a backup beforehand. This runbook does not authorize destructive execution by itself.

## Prerequisites

- Confirmed database backup taken within the last 24 hours and verified restorable.
- Maintenance window communicated to affected tenants.
- Explicit written authorization from the data owner.
- Typed confirmation string matching the expected scope label produced by `expectedDeletionConfirmation()`.

## Supported retention windows

`DAYS_7`, `DAYS_30`, `DAYS_90`, `DAYS_180`, `DAYS_365`, `CUSTOM` (positive integer days). Cutoffs are computed by `retentionCutoff()` and are strictly earlier than the current timestamp.

## Tables under policy

- `GuardLog` (when `applyToLogs` is enabled)
- `WebhookDelivery` (when `applyToWebhookDeliveries` is enabled)
- `SecurityEvent` (when `applyToSecurityEvents` is enabled)

## Procedure

1. Run `npm run test` to confirm retention policy tests still pass.
2. Inspect candidate counts in a read-only session — never run `deleteMany` first.
3. Take or verify a full database backup, including any object storage exports referenced by audit exports.
4. Apply the policy through `applyRetentionPolicy(organizationId)` in a maintenance shell. Capture the returned counts and the audit row in `OrganizationAuditLog`.
5. Verify post-run row counts and confirm `lastRunAt` advanced.
6. Update the incident ticket with deletion counts and the confirmation string used.

## Rollback

Deletion is non-reversible without a restore. If anomalies appear, halt further runs and follow the database restore runbook. Do not attempt forensic recovery by re-running the policy.

## Non-goals for this preview

- Partitioning, archival to object storage, and partition rotation are not yet implemented.
- Cross-region replication delay is not enforced by the helper; coordinate manually.
- Legal-hold or DPDP regulator preservation overrides are not yet automated. Manual review is required for any retention exception.
