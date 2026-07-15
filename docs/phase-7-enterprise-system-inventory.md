# Phase 7 Enterprise System Inventory

## Models Found

- User: email, password hash, admin flag, SSO-only flag, JIT source, memberships, sessions, SAML session exchanges, SCIM mappings.
- Organization: slug, plan, disabled state, members, projects, SAML providers, SCIM tokens, SCIM mappings, sessions, audit logs, retention/security/integration settings.
- OrganizationMember: unique `(organizationId, userId)` with `OrgRole`.
- Project: owner user, optional organization, API keys, guard logs, reports, webhooks, RAG collections, disabled state.
- ApiKey: per-project key hash/prefix, active flag, last-used timestamp.
- Audit: `OrganizationAuditLog`, `AdminAuditLog`, `AuditExport`, plus feature-specific security/governance logs.
- SAML: `SamlProvider`, `SamlLoginAttempt`, `SamlSessionExchange`.
- SCIM: `ScimToken`, `ScimUserMapping`, `ScimGroupMapping`.
- Session: `UserSession` and NextAuth session models.

## Routes Found

- Enterprise config: `app/api/enterprise/saml`, `scim-tokens`, `sso`, `security`, `data-retention`, `data-deletion`.
- SAML runtime: `app/api/sso/saml/login`, `metadata`, `acs`, `test`.
- SCIM runtime: `app/api/scim/v2/ServiceProviderConfig`, `Schemas`, `ResourceTypes`, `Users`, `Groups`.
- Admin routes: `app/api/admin/**` for policies, destination controls, SIEM, extension enrollment, data lineage, fingerprint vault, emergency lockdown.

## Middleware And Helpers

- Tenant/RBAC: `lib/auth/guards.ts`, `lib/auth/permissions.ts`, `lib/auth/rbac.ts`.
- SAML: `lib/enterprise/saml.ts`, `samlProvisioning.ts`, `samlReplayStore.ts`, `samlSessionExchange.ts`.
- SCIM: `lib/enterprise/scim.ts`.
- Tenant ownership: `lib/phase11/tenantIsolation.ts`.
- Audit export: `lib/audit/export.ts`.

## Tests Found

- `tests/phase6.test.ts`: SAML/SCIM/config/security tests, now including ACS destination/recipient/size regressions.
- `tests/phase3.test.ts`: RBAC permissions.
- `tests/api-route-audit.test.ts`: route auth/security coverage.
- `tests/logs-filters.test.ts`: log RBAC.
- `tests/enterprise/*`: broader enterprise/security pattern tests, not full live IdP proof.

## Missing Or Partial Pieces

- No live Okta or Microsoft Entra credentials/configuration in the workspace.
- No real two-browser-account tenant-isolation run against a deployed/staging app in this pass.
- SAML XML signature handling is lightweight and should be replaced with a mature XMLDSig/SAML library before GA.
- Replay protection is in-memory; production should use Redis or durable storage.
- SAML/SCIM admin permissions reuse `member:manage`; dedicated `saml:manage`, `scim:manage`, and `audit:read` permissions are absent.
- Cross-tenant denial audit logging is partial.

## Current Risks

- Enterprise pilot can proceed only with a design-partner caveat.
- Enterprise GA is blocked until live Okta/Entra SAML and SCIM evidence exists.
- Tenant isolation is locally/source-proven but not live two-account proven.

