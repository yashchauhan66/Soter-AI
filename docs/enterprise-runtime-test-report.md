# Enterprise Runtime Test Report

Date: 2026-07-10  
Overall status: AUTOMATED TENANT CONTROLS VERIFIED; TWO-ACCOUNT AND LIVE-IDP EVIDENCE REQUIRED

## Automated evidence

The repository contains server-side RBAC checks, organization/project ownership checks, direct authorization E2E specifications, SAML assertion validation and replay protection, SCIM bearer-token hashing, role mapping, retention helpers, and tenant-aware RAG filtering. The final Phase 16 report records the commands actually run.

## Runtime isolation battery

Run with two independently authenticated users in organizations A and B. For each resource, create it as A and attempt list, direct read, update, delete, export, and guessed-ID access as B.

| Resource/control | Expected result | Status |
|---|---|---|
| Organization and membership | B cannot enumerate or mutate A | EVIDENCE REQUIRED |
| Projects and API keys | B cannot read, rotate, or revoke A | EVIDENCE REQUIRED |
| Guard logs and reports | B receives no A records or aggregates | EVIDENCE REQUIRED |
| Webhooks and delivery history | B cannot view secrets or replay A deliveries | EVIDENCE REQUIRED |
| Billing and invoices | B cannot view or change A billing | EVIDENCE REQUIRED |
| RAG documents/chunks | Cross-tenant retrieval returns zero A chunks | EVIDENCE REQUIRED |
| Direct URLs and object IDs | Server returns 403/404 without data leakage | EVIDENCE REQUIRED |
| Viewer/editor/admin boundaries | Each mutation follows `lib/auth/permissions.ts` | EVIDENCE REQUIRED |
| Audit trail | Denials and privileged changes are attributable | EVIDENCE REQUIRED |

## SAML and SCIM battery

Against an authorized test IdP, verify metadata/configuration, signed login, audience/destination/time checks, response replay rejection, JIT provisioning, mapped roles, SCIM create/update/deactivate, revoked token rejection, and tenant-scoped group mapping. No live IdP was supplied, so all remain EVIDENCE REQUIRED.

## Release decision

Enterprise pilot: conditional GO only with a named operator and the runtime battery completed for that pilot tenant. General enterprise claim: NO-GO pending two-account and live-IdP evidence.
