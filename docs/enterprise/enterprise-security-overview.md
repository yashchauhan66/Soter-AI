# Enterprise Security Overview

Soter enterprise security uses organization-scoped membership, RBAC, project ownership checks, SAML SSO, SCIM provisioning, and organization audit logs.

## Controls

- Tenant isolation through `OrganizationMember` and project `organizationId`.
- RBAC through `lib/auth/permissions.ts`.
- SAML issuer, audience, timing, destination, recipient, signature, and replay checks.
- SCIM bearer tokens hashed at rest and scoped to one organization.
- Audit logs for SAML/SCIM configuration and provisioning events.
- Secret minimization in audit metadata.

## Evidence Status

- Local source and script evidence: PASS.
- Live Okta/Entra SAML/SCIM evidence: REQUIRED.
- Live two-account tenant isolation evidence: REQUIRED.

