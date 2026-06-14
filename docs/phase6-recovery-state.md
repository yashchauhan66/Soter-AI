# Phase 6 Recovery State

## Snapshot

- Timestamp: 2026-06-14T16:38:50.6899235+05:30
- Git branch: main
- Working tree: repository files are currently untracked in this checkout; preserve all existing files.

## Package Scripts

- `dev`: `next dev`
- `build`: `next build`
- `start`: `next start`
- `typecheck`: `tsc --noEmit`
- `test`: `tsx --test tests/guard.test.ts tests/security.test.ts tests/webhooks.test.ts tests/phase2.test.ts tests/phase3.test.ts tests/phase4.test.ts tests/phase5.test.ts tests/phase6.test.ts`
- `verify`: `npm run typecheck && npm --prefix packages/sdk run typecheck && npm test && npx prisma validate && npm run build`
- `db:push`: `prisma db push`
- `db:migrate`: `prisma migrate dev`
- `db:deploy`: `prisma migrate deploy`
- `db:seed`: `tsx prisma/seed.ts`
- `worker:webhooks`: `tsx workers/webhookWorker.ts`
- `worker:siem`: `tsx workers/siemWorker.ts`
- `eval:classifiers`: `tsx scripts/evalClassifiers.ts`
- `postinstall`: `prisma generate`

## Current Phase 6 Modules Found

- Partial SCIM API: `app/api/scim/v2/*`
- Enterprise SCIM token API: `app/api/enterprise/scim-tokens/route.ts`
- SCIM helpers: `lib/enterprise/scim.ts`
- SAML/SSO APIs: `app/api/sso/saml/*`, `app/api/enterprise/saml/route.ts`, `app/api/enterprise/sso/route.ts`
- SAML helpers: `lib/enterprise/saml.ts`, `lib/enterprise/samlProvisioning.ts`, `lib/enterprise/samlReplayStore.ts`, `lib/enterprise/sso.ts`
- ML classifier workflow: `lib/ml/*`, `app/api/admin/ml/*`
- Compliance docs: `docs/compliance/*`
- Self-hosted scaffold: `Dockerfile`, `docker-compose.prod.yml`, `.dockerignore`, `.env.example`
- Phase 5/earlier tests: `tests/*.test.ts`

## Current Failing/Passing Commands

- Passed:
  - `npm install`
  - `npm run typecheck`
  - `npm --prefix packages/sdk run typecheck`
  - `npm test`
  - `npm run build`
  - `npx prisma validate`
  - `npm audit --audit-level=high`
- `npm run verify` equivalent completed through the individual commands above.

## Initial Incomplete Tasks To Verify

- Full SCIM v2 users and groups provisioning, including nested user/group routes.
- SCIM tests are not wired into `npm test`.
- Self-hosted deployment may be missing worker Dockerfile, health scripts, backup/restore scripts, Helm chart, and dedicated docs.
- Public trust/compliance pages may be missing.
- Data retention/deletion controls may be missing or partial.
- Enterprise admin controls may be missing or partial.
- README and `.env.example` likely need Phase 6 updates.
- Phase 6 QA checklist is missing.

## Files Planned For Audit Or Possible Touch

- `package.json`
- `prisma/schema.prisma`
- `prisma/migrations/*`
- `.env.example`
- `README.md`
- `docs/phase6-recovery-state.md`
- `docs/phase6-qa-checklist.md`
- `app/api/scim/v2/*`
- `app/api/enterprise/*`
- `app/dashboard/enterprise/*`
- `app/admin/*`
- `app/(public trust/compliance routes)`
- `lib/enterprise/*`
- `lib/retention/*`
- `lib/admin/*`
- `tests/*`
- `Dockerfile`, `Dockerfile.worker`, `docker-compose.prod.yml`, `.dockerignore`
- `scripts/backup.sh`, `scripts/restore.sh`, `scripts/healthcheck.sh`
- `docs/self-hosted.md`, `docs/kubernetes.md`, `docs/backup-restore.md`
- `helm/cyberrakshak/*`

## Checkpoints

- 2026-06-14T16:38:50.6899235+05:30: Recovery file created before implementation edits. Audit in progress.
- 2026-06-14T17:05:00+05:30: Baseline found TypeScript failures in a Next 15 route signature and SCIM expression precedence; Prisma validate passed; tests required unsandboxed subprocess execution.
- 2026-06-14T17:35:00+05:30: Completed SCIM Users detail/PATCH/PUT/DELETE and Groups list/create/detail/PATCH/DELETE routes with tenant-scoped bearer auth and audit logs.
- 2026-06-14T18:05:00+05:30: Added retention/deletion APIs and pages, enterprise security API and pages, platform admin organization/project pages, and disabled-organization guard enforcement.
- 2026-06-14T18:30:00+05:30: Added public trust/compliance pages, compliance docs, self-hosted Docker/Helm/runbook assets, marketplace scaffold, public launch pages, Phase 6 migration, and Phase 6 tests.
- 2026-06-14T18:45:00+05:30: `npm run typecheck`, `npx prisma validate`, and `npx tsx --test tests/phase6.test.ts` pass after fixes. Full final verification pending.
- 2026-06-14T18:58:00+05:30: Full Phase 6 verification completed. `npm test` passed 94/94, production build completed successfully, SDK typecheck passed, Prisma validate passed, and npm audit found 0 high/critical vulnerabilities.
- 2026-06-14T19:10:00+05:30: Exact `npm run verify` passed after stopping the stale dev server on port 3000 and clearing generated `.next` artifacts. Earlier `/` and `/docs` 500s were stale dev-server/cache state; clean dev server returned 200 for both routes.

## Audit Summary

### Completed Phase 6 Features Found

- ML classifier workflow models, libraries, admin routes, and dashboard pages were already present.
- SAML SSO route and helper structure was already present.
- SCIM token model/helper and Users collection route were partially present.
- Phase 5 self-hosted Docker Compose scaffold was present.

### Partial Or Missing Phase 6 Features Found

- SCIM Users detail/PATCH/DELETE and all Groups routes were missing.
- SCIM token listing and audit logging were incomplete.
- Phase 6 schema additions existed in `schema.prisma` but were not fully represented in migrations.
- Enterprise retention/deletion APIs and dashboard pages were missing.
- Enterprise security controls and audit pages were missing.
- Public trust/compliance pages and required docs were incomplete or differently named.
- Docker worker image, Redis Compose service, readiness endpoint, scripts, Helm chart, and Phase 6 deployment docs were missing.
- Phase 6 tests were not wired into `npm test`.

### Risky Implementations Found And Addressed

- `ScimUserMapping.userId` was globally unique; changed to per-organization uniqueness for cross-org safety.
- API key verification blocked disabled projects but not disabled organizations; organization disable is now enforced.
- README and Phase 5 QA still documented SCIM/SAML as incomplete deployment integrations; updated for Phase 6.
- Public copy contained forbidden complete-protection style wording; replaced with readiness/risk-reduction language.
