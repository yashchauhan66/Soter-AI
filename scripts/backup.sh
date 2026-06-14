#!/usr/bin/env sh
set -eu

: "${DATABASE_URL:?DATABASE_URL is required}"
BACKUP_DIR="${BACKUP_DIR:-./backups}"
mkdir -p "$BACKUP_DIR"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
pg_dump "$DATABASE_URL" --format=custom --file="$BACKUP_DIR/cyberrakshak-$STAMP.dump"
echo "Backup written to $BACKUP_DIR/cyberrakshak-$STAMP.dump"
