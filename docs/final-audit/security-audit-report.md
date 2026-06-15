# Security Audit Report

## Security Posture

The product is defensive-only and OWASP LLM Top 10 aligned. It focuses on risk reduction, defense-in-depth, detect/block/redact/monitor/report workflows, and tenant-scoped SaaS access.

## Strengths Verified

- API keys are random, prefixed, pepper-hashed, and compared safely.
- Raw API keys, webhook secrets, SCIM tokens, password reset tokens, and email verification tokens use hash/preview/one-time patterns.
- Guard public results omit original text; guard persistence uses redacted/safe log content.
- Webhook and SIEM outbound URLs reject non-HTTPS, credential-bearing, private hostnames, and private IPs.
- Razorpay webhook/payment signatures are verified in tests.
- SCIM requests require bearer token validation and are organization-scoped.
- RAG vector namespace and ACL tests cover tenant isolation and private-source leakage.
- Production hard-fails exist for auth secret, local secret store, in-memory vectors, deterministic embeddings, mock email, Redis fallback, and billing mock activation.
- Red-team suite requires explicit confirmation and project authorization.

## Issues Fixed

- Sign-in callback open redirect risk.
- Public badge script `innerHTML`/color injection risk.
- Output detector prose system-prompt leakage gap.
- Example config stale secret/database placeholders.

## Remaining Security Risks

| Severity | Area | Risk | Fix |
| --- | --- | --- | --- |
| HIGH | SAML | ACS validates but does not complete real app session minting. | Implement secure SAML session completion with replay/audience/RelayState tests. |
| HIGH | E2E auth/RBAC | Unit tests cover helpers, but full browser/session authorization flows are not automated. | Add E2E tests for cross-tenant access and admin denial. |
| MEDIUM | Phase 11 models | New Phase 11 tables use scalar tenant/project IDs without Prisma relations/FKs. | Add FK constraints or strict service-layer access tests before production use. |
| MEDIUM | SCIM mapping | `ScimUserMapping.raw Json?` can store provider payloads if used later. | Ensure only redacted/minimized SCIM data is stored. |
| MEDIUM | Public badge data | Public badge endpoint intentionally exposes status metadata. | Keep public fields minimal; add tests for no internal project names/secrets. |
| MEDIUM | SAML RelayState | RelayState is passed into sign-in query after assertion flow. | Validate it with the same relative-path callback sanitizer before use. |
| LOW | Docs/demo test secrets | Dummy `sk-proj-*` secrets exist in tests/playground examples. | Acceptable as detector fixtures; never use live secrets. |

## Route Security Summary

- SAFE/WORKING: guard input/output/analyze/grounding, webhooks, billing webhook, API keys, projects, policy, RAG, reports, exports, SCIM, enterprise retention/security routes based on code and tests.
- NEEDS_FIX/PARTIAL: SAML ACS/session completion, integrations external provider verification, Phase 11 agent firewall persistence/approval workflow.
- PUBLIC BY DESIGN: `/api/auth/*`, `/api/guard/analyze`, `/api/badge*`, `/api/billing/webhook`, health/ready, SAML login/ACS/metadata, SCIM metadata endpoints.

