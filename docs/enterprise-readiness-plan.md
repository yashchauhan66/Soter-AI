# Enterprise Readiness Plan

## Control maturity

| Domain | Current base | Required for enterprise evidence | Priority |
|---|---|---|---|
| RBAC | Organization roles and explicit permissions | Custom roles or scoped groups, separation of duties, quarterly access review | P1 |
| SSO | SAML routes/providers | Live IdP certification, signed metadata, replay/audience/clock tests, break-glass | P1 |
| Provisioning | SCIM users/groups/tokens | Okta/Entra sandbox conformance, deprovision SLO, group conflict behavior | P1 |
| Non-human identity | Agent identities/passports | Owner, lifecycle, federation, short-lived scopes, automated rotation | P1 |
| Tenant isolation | Application checks | Behavioral route matrix, storage RLS/provider isolation, admin break-glass audit | P0/P1 |
| Audit | Admin/org/security/event logs | Append-only integrity, sequence/digest, export verification, time sync | P1 |
| SIEM | Webhooks/export workers | Stable schema/version, Splunk/Sentinel/Elastic sandbox validation, replay | P1 |
| Retention/deletion | Policy and deletion models | End-to-end delete including vectors/events/backups, legal hold, evidence | P1 |
| Encryption | TLS/provider encryption; secret stores | BYOK lifecycle, rotation/versioning, envelope encryption, restore access | P1/P2 |
| Residency | Region-oriented deployment inputs | Documented data-flow/processor/backup region options and tenant selection | P2 |
| Privacy | Redaction, extension privacy controls | Data inventory, purpose/retention, DPA/subprocessors, DSAR process | P1 |
| Availability | Health/workers | SLO/SLA, on-call, DR, restore/region failure drills, status page | P1 |
| Secure SDLC | CI build/test | threat model, review gates, SAST/SCA/secrets/SBOM/signing, vuln SLAs | P0 |
| Compliance | OWASP/NIST mappings/evidence | SOC 2 readiness program and evidence owners; ISO 27001/42001 crosswalk | P1/P2 |
| Private deployment | Docker/EC2 | Supported reference architecture, upgrade/telemetry/support boundaries | P2 |

## RBAC target

- Permissions are resource/action-specific and enforced server-side.
- Billing cannot read sensitive prompts/events; viewers cannot create feedback that changes enforcement without workflow.
- Policy publish, key reveal/rotation, retention reduction, export and break-glass require elevated roles; optional two-person approval for critical changes.
- Global admin access is time-bound with reason/ticket and immutable tenant-visible audit where contractually appropriate.
- Sessions and API keys can be revoked rapidly; sensitive actions require recent authentication/MFA when the identity provider supports it.

## SAML/OIDC and SCIM acceptance

- Reject unsigned/invalid assertions, wrong audience/recipient/issuer, expired/not-yet-valid assertions and replayed IDs.
- Safe RelayState/callback handling; no open redirect.
- IdP-initiated behavior explicitly supported or rejected.
- JIT and SCIM conflicts are deterministic; deprovision revokes sessions, keys and agent grants within SLO.
- Group mapping cannot self-elevate to owner/global admin without approved mapping.
- Provide IdP-specific setup/test evidence for Entra ID and Okta before claiming support.

## Data governance

Create a data inventory for prompt content, redacted content, hashes, findings, user/device IDs, IP-derived identifiers, vectors, metrics, exports and backups. For each: purpose, lawful basis/contract role, source, destinations, region, encryption, access roles, retention, deletion and incident handling.

Retention changes should be versioned and prospective by default. Destructive shortening requires confirmation, impact preview and audit. Legal hold must prevent deletion without silently extending other tenants. Deletion jobs must emit a signed manifest of affected stores and any backup expiry limitation.

## Evidence package

- Architecture/data-flow/trust-boundary diagrams.
- Control inventory mapped to NIST AI RMF, OWASP, CSA AICM, SOC 2 criteria and ISO controls.
- Policies: secure SDLC, vulnerability, access, incident, change, backup, vendor, privacy and AI risk.
- Last access review, restore drill, incident tabletop, penetration test, vulnerability scan and key-rotation evidence.
- Subprocessor and residency list, DPA/security addendum, support/SLA and shared-responsibility matrix.

“SOC 2 ready” may only mean a scoped readiness assessment is complete. Do not imply certification until an accredited auditor has issued the relevant report.
