# Backup And Restore

Production self-hosted deployments should run scheduled Postgres backups and periodic restore drills.

Required practice:

- Back up Postgres with `scripts/backup.sh`.
- Restore to a staging environment with `scripts/restore.sh` before production restores.
- Keep database, Redis, vector, and object storage ports private.
- Record restore time objective and restore point objective in the customer runbook.

