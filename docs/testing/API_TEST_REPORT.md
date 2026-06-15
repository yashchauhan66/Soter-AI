# API Test Report

Date: 2026-06-15

## Runtime Verified

- `/api/health`: local PostgreSQL reachable.
- `/api/guard/analyze`: safe request succeeds; public result omits original text; invalid body rejected.
- `/api/guard/input` and `/api/guard/output`: authenticated browser-created key; injection/output leakage blocked; original text omitted.
- `/api/projects`: unauthenticated denied; tenant list excludes foreign project; create succeeds.
- `/api/projects/policy`: viewer denied and foreign tenant denied with distinct safe errors.
- `/api/api-keys`: one-time raw key created; raw value absent after refresh.
- `/api/badge/[slug]`: exact public allowlist and CORS/cache behavior verified.
- `/api/admin/actions`: unauthenticated denied.

## Regression Verified

The 168-test baseline covers route inventory, auth/RBAC helpers, API-key rotation, rate limiting, billing signatures, webhook signatures/retries, reports, RAG ACL/grounding, SAML/SCIM, retention, SIEM redaction, SSRF defenses, and validation.

## Partial / Provider Blocked

- Webhook create works in development local-secret mode; production fails closed without KMS/Vault.
- Billing order/signature code is covered; real Razorpay payment/subscription was not authorized.
- RAG scanner/vector ACL is covered locally; no external vector provider was used.
- SCIM/SAML route logic is covered locally; no IdP interoperability test was run.

## Gaps

- No full response matrix for every route/method.
- No end-to-end rate-limit exhaustion against real Redis.
- No destructive data-deletion execution.
