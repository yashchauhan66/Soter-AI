# Database Audit

## Status

- Prisma schema validation: PASS.
- Migration status: PASS, 9 migrations found, database up to date.
- `npm run db:deploy`: PASS, no pending migrations.
- `npm run db:seed`: PASS, demo user/org/project retained/seeded.

## Strengths

- Major tenant-scoped models include `organizationId` and/or `projectId`.
- API keys, SCIM tokens, webhooks, auth tokens, sessions store hashes/previews instead of raw credentials.
- Guard logs have indexes for project/time/action/risk.
- Webhook deliveries have retry/status indexes.
- RAG collections/documents/chunks/findings have collection/document indexes.
- Enterprise audit/security event models are indexed by organization/time.
- Phase 11 tables include tenant/project scalar fields and indexes.

## Risks / Notes

- Phase 11 competitive tables use scalar tenant/project IDs without Prisma relations/FKs. This reduces migration risk but should be tightened before production use.
- `ScimUserMapping.raw Json?` should remain minimized/redacted if used.
- `ProductEvent`, `ProductionMetric`, `ContactLead`, `Incident` intentionally allow nullable org/project fields for public/operational events; downstream queries must avoid cross-tenant exposure.
- Some large operational tables need retention/partitioning strategy before scale.

## Migration List

1. `20260613160000_init`
2. `20260613170000_phase2`
3. `20260614100000_phase3`
4. `20260614140000_phase4`
5. `20260614190000_phase5`
6. `20260614230000_phase6_enterprise_readiness`
7. `20260615000000_phase8_launch_operations`
8. `20260615120000_background_jobs`
9. `20260615130000_phase11_competitive_gaps`

