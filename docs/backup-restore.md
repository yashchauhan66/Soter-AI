# Backup And Restore

Backups are required before destructive deletion workflows and before migrations.

## Backup

```sh
DATABASE_URL=postgresql://... BACKUP_DIR=./backups scripts/backup.sh
```

## Restore

Restore into staging first:


```sh
DATABASE_URL=postgresql://... BACKUP_FILE=./backups/cyberrakshak.dump scripts/restore.sh
```

After restore, run:

```sh
npx prisma validate
npm run typecheck
npm test
```

Document restore point objective, restore time objective, and the last successful restore drill.
