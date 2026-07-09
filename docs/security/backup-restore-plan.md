# Backup & Restore Plan

**Date:** 2026-07-09
**Status:** SOC2-ready / preparation

## Backup Strategy

### Database (PostgreSQL)

| Component | Frequency | Retention | Method |
|---|---|---|---|
| Full backup | Daily | 30 days | pg_dump / Neon automatic |
| WAL archiving | Continuous | 7 days | PostgreSQL replication |
| Logical backup | Weekly | 90 days | pg_dump --format=custom |

### Vector Store (Qdrant)

| Component | Frequency | Retention | Method |
|---|---|---|---|
| Snapshot | Daily | 7 days | Qdrant snapshot API |
| Collection backup | Weekly | 30 days | Export/import |

### File Storage

| Component | Frequency | Retention | Method |
|---|---|---|---|
| RAG documents | On upload | Until deletion | S3 versioning |
| Audit exports | On generation | 1 year | S3 lifecycle |

### Configuration

| Component | Frequency | Retention | Method |
|---|---|---|---|
| Environment variables | On change | Git history | Version control |
| Prisma schema | On change | Git history | Version control |
| Docker configs | On change | Git history | Version control |

## Restore Procedures

### Database Restore

```bash
# Restore from pg_dump
pg_restore -d soterai backup.dump

# Point-in-time recovery (Neon)
# Use Neon console to restore to specific timestamp
```

### Vector Store Restore

```bash
# Restore from Qdrant snapshot
curl -X PUT http://localhost:6333/collections/snapshots/restore \
  -H "Content-Type: multipart/form-data" \
  -F "snapshot=@snapshot.tar"
```

### File Restore

```bash
# Restore from S3 versioning
aws s3api get-object --bucket soterai-files --key doc.pdf doc.pdf \
  --version-id <version-id>
```

## Recovery Time Objectives

| Component | RTO | RPO |
|---|---|---|
| Database | 1 hour | 5 minutes (WAL) |
| Vector store | 2 hours | 24 hours (daily snapshot) |
| File storage | 1 hour | 0 (versioning) |
| Application | 30 minutes | 0 (git history) |

## Testing

- [ ] Monthly backup restore test
- [ ] Quarterly disaster recovery drill
- [ ] Annual full recovery test
