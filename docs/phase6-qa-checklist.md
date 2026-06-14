# Phase 6 QA Checklist

## Recovery And Audit

- [x] Create `docs/phase6-recovery-state.md`.
- [x] Audit package scripts, Prisma schema, migrations, env docs, README, enterprise routes/pages, SCIM, SAML, ML, deployment, tests, and admin pages.
- [x] Document known limitations honestly.

## SCIM v2

- [x] ServiceProviderConfig, ResourceTypes, and Schemas routes exist.
- [x] Users list/create/detail/PATCH/PUT/DELETE routes exist.
- [x] Groups list/create/detail/PATCH/DELETE routes exist.
- [x] Bearer tokens are hashed at rest and raw values are returned once.
- [x] Requests are organization scoped by token.
- [x] User deprovisioning marks SCIM mapping inactive and removes org membership without deleting user data.
- [x] Group names map to organization roles.
- [x] SCIM actions create organization audit logs.

## Enterprise Deployment

- [x] Dockerfile, Dockerfile.worker, and docker-compose.prod.yml exist.
- [x] Compose includes app, workers, Postgres, Redis, and Qdrant.
- [x] Health and readiness endpoints exist.
- [x] Backup, restore, and healthcheck scripts exist.
- [x] Helm chart includes deployment, worker, service, ingress, secrets, configmap, and migrations job.

## Compliance And Trust Center

- [x] Public trust, security, privacy, responsible disclosure, subprocessors, data retention, OWASP, SOC 2 readiness, and ISO 27001 readiness pages exist.
- [x] Required compliance docs exist.
- [x] Public wording avoids false certification claims and complete-protection promises.

## Data Controls

- [x] Retention policy supports 7, 30, 90, 180, 365, and custom windows.
- [x] Deletion requests require confirmation phrases.
- [x] Organization deletion is owner-only.
- [x] Retention and deletion actions are audit logged.

## Enterprise Admin Controls

- [x] Enterprise security API covers IP allowlist, sessions, API key rotation, project disable, organization disable, quota override, and audit logging.
- [x] API key verification blocks disabled projects and organizations.
- [x] Platform admin organization and project pages exist.

## Verification

- [x] `npm install`
- [x] `npm run typecheck`
- [x] `npm test`
- [x] `npx prisma validate`
- [x] `npm run build`
- [x] `npm audit --audit-level=high`
- [x] `npm --prefix packages/sdk run typecheck`
- [x] `npm run verify`

External SAML, KMS, SIEM, OCR, vector, and marketplace provider behavior: **Not verified locally - requires external provider configuration**.
