# Retention Runbook

## Destructive Prerequisites

Before performing any deletion operations:

- **Backup** all data that may be affected
- Obtain written **confirmation** from the organization owner
- Verify the cutoff using `retentionCutoff` utility
- Ensure audit logs are exported before purging

## Procedure

1. Confirm deletion scope with organization owner
2. Run backup scripts for affected data
3. Execute deletion with proper confirmation strings
4. Verify deletion in audit logs
