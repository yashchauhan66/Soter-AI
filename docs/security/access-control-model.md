# Access Control Model

## Scope and boundaries

SoterAI uses organization membership as the primary tenant boundary and project ownership as a secondary boundary. Authentication establishes identity; authorization is enforced server-side for every protected resource. Hiding a control in the UI is never an authorization decision.

The permission source of truth is `lib/auth/permissions.ts`. The roles defined by the database are OWNER, ADMIN, DEVELOPER, SECURITY_ANALYST, BILLING, and VIEWER. OWNER has every organization permission. ADMIN has broad operational permissions but owner-only lifecycle actions remain restricted. The remaining roles receive only the capabilities listed in the source-of-truth mapping; unknown roles receive no permissions.

## Enforcement rules

1. Session routes authenticate the user and resolve an organization membership.
2. API-key routes hash and resolve the key, then bind access to its project and organization.
3. Resource queries include the tenant identifier; scalar project IDs are checked for same-tenant ownership before writes.
4. Route handlers use `requirePermission` or `requireProjectPermission` for mutations and sensitive reads.
5. RAG retrieval applies organization, project, role, document status, and ACL filters before returning chunks.
6. SAML and SCIM configuration, tokens, role mappings, and audit records remain tenant-scoped.
7. Denied access must not disclose whether another tenant's object exists; use 403/404 consistently.

## Privileged access

Internal administration is separate from organization roles. It must not silently confer customer-tenant access. Emergency access requires a documented incident, least privilege, time limitation, audit evidence, and post-incident review.

## Validation

Unit and integration tests are necessary but not sufficient. Before enterprise release, execute the two-account battery in `docs/enterprise-runtime-test-report.md` against the deployed environment.
