# Test Coverage Gaps — CyberRakshak Guard

Date: 2026-06-16 · Branch: `final-project-audit`

Baseline: `npm test` = 211/211 passing (204 prior + 7 added this session) across 20 suites.

## Tests added this session

| Test | Covers | File |
|------|--------|------|
| CRG-RT-009 ×3 (WARN no-downgrade, REDACT no-downgrade, genuine UNSAFE_OUTPUT still honors WARN) | Policy denylist hard-block precedence over `unsafeOutputMode` | `tests/phase3.test.ts` |
| CRG-RT-010 | Webhook signature check ordered before persistence/dedup | `tests/billing.test.ts` |
| CRG-RT-011 | Logs route enforces `logs:read`; BILLING lacks it, VIEWER/OWNER have it | `tests/logs-filters.test.ts` |
| CRG-RT-012 | Replay route resets `attempts` to 0 | `tests/webhooks.test.ts` |
| CRG-RT-013 | Rate-limit self-heals a leaked (no-TTL) key | `tests/security.test.ts` |

## Well-covered areas

Guard detectors & policy modes, RBAC matrix, tenant isolation helpers, API-key rotation/one-time display, rate limiting, billing signatures/receipt/CSP, webhook signing/retries/dedup, audit export, RAG ACL/grounding, SAML/SCIM logic, retention, SIEM redaction, SSRF defenses, signup/email-verification policy, logs filters/keyset pagination, route auth/validation invariants (`api-route-audit.test.ts`).

## Remaining gaps (provider/infra gated — cannot be closed locally without credentials)

1. Real email deliverability + bounce handling (needs Resend/SES/SMTP keys).
2. Razorpay live payment/subscription/failure lifecycle (needs authorized sandbox keys + explicit permission).
3. Real vector DB ACL/embedding (needs Qdrant/pgvector setup).
4. SIEM collector round-trip (needs authorized HTTPS endpoint + token).
5. SAML/SCIM IdP interoperability (needs IdP metadata/cert/test accounts).
6. WordPress plugin `php -l`/runtime (PHP unavailable locally; ZIP packaging passes).
7. End-to-end HTTP load test at concurrency 100 against a real deployment.
8. UI robustness items (WebhookManager error surfacing, NewProjectForm finally, LogsFilterBar controlled selects) — documented in UI_UX_ISSUES, not yet unit/E2E covered.

## E2E

Default Playwright suite runs against a production build (`next start`) to avoid the OneDrive/Turbopack `.next` manifest instability (CRG-RT-007). Critical-flow, authorization, and authenticated-surface specs pass; the signup spec correctly skips under production+mock email (blocked-by-design state).
