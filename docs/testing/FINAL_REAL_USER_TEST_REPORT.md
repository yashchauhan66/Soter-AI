# Final Real User Test Report

Date: 2026-06-15

## 1. Executive Summary

CyberRakshak Guard has a strong tested core: guard decisions/redaction, API-key auth, project isolation, RBAC, dashboard surfaces, RAG controls, signed webhook logic, reports, public badges, SDKs, and production build all have evidence. It is suitable for a controlled beta with clear feature flags and operational supervision.

The previous main application blocker — production signup consistency/email verification (`CRG-RT-005`) — is now **FIXED and VERIFIED** (idempotent, fail-fast, atomic signup with verified-email-gated login; see Section 16). It is still not ready for unrestricted production: real email, KMS, vector, SIEM, SAML/SCIM, and Razorpay payment lifecycles remain unverified pending user-supplied credentials and authorization.

## 2. Test Environment

- Windows workspace on OneDrive; Node 22.16.0; Python 3.12.8.
- Next.js 15.5.19; Prisma 5.22; local PostgreSQL.
- Chromium via Playwright 1.60.0.
- Production build for stable E2E; development mode used only for mock/local provider behavior.

## 3. Commands Run

`npm install`, `npx prisma validate`, `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`, `npm audit --json`, Playwright suites, SDK JS/Python tests, integration verification, WordPress packaging, and guard load tests at concurrency 1/10/50/100.

## 4. Functional Results

- Guard safe/injection/PII/secret/system-leak behavior: PASS.
- Project + API key + one-time raw-key behavior: PASS after fix.
- Logs redaction/details: PASS; filters/pagination UI PARTIAL.
- Policy behavior/audit logic: PASS in regression tests; manual policy toggle journey not completed.
- Webhooks: PASS in development; production BLOCKED by missing KMS.
- Reports: dashboard PASS; PDF download and delivery provider NOT VERIFIED.
- RAG: safe upload browser PASS in development; scanner/quarantine/ACL PASS in tests; real vector provider NOT VERIFIED.
- Agency/enterprise: surfaces render; full lifecycle and providers PARTIAL.
- Billing: receipt/CSP/signatures PASS; real payment NOT RUN.
- Support/incidents: routes/surfaces exist; complete reply/status journey NOT VERIFIED.

## 5. Real User Journeys

- Signup: PASS in development mock mode; production now fails fast and consistently — `CRG-RT-005` fixed (idempotent create/resend, atomic user+token, verified-email login gate). Real-provider deliverability still pending user credentials.
- Sign-in/dashboard: PASS.
- First project: PASS after `CRG-RT-004` fix.
- API key and guard requests: PASS.
- Logs: PASS for redacted details; filter journey unavailable.
- Webhook: local PASS; production provider blocked.
- Reports/RAG: partial runtime evidence plus strong regression coverage.
- Admin denial and tenant isolation: PASS.

## 6. E2E Results

- Original suite: 4/4 PASS.
- Expanded production suite: 6 PASS, 2 failures that identified signup provider/consistency and project navigation issues.
- Project navigation fixed and browser flow progressed through key/guard/logs to the expected production KMS block.
- Public badge privacy, API auth/validation, and page timing tests PASS.
- Signup test is skipped in default production E2E until an authorized real email provider is supplied; development mock execution previously passed.

## 7. API Results

See `API_TEST_REPORT.md`. Critical auth, RBAC, tenant, validation, redaction, and public field boundaries passed. Provider-backed routes are not overstated.

## 8. Performance Results

- Guard component p95: 0.22-0.61 ms through concurrency 100, 0% errors.
- Local production navigation: 294-548 ms across tested public/dashboard/admin pages.
- Production build: 106-145 seconds locally.
- Full HTTP saturation, memory, worker backlog, and Lighthouse remain unmeasured.

## 9. Security Results

Core regression controls pass, including open redirects, badge privacy, API-key hashing, redaction, SSRF guards, viewer/admin denial, tenant isolation, RAG ACL, SCIM token safety, and SAML exchange logic. Production signup verification remains a high issue.

## 10. Provider Results

Only local PostgreSQL is runtime verified. All other real providers are configured-but-unverified or blocked; see `PROVIDER_TEST_REPORT.md`.

## 11. Bugs

- Found: 8 tracked items.
- Fixed/verified: Razorpay receipt, Razorpay CSP/loader, lint cache traversal, project creation navigation, and production signup consistency/verification (`CRG-RT-005`).
- Infrastructure mitigated: Turbopack/OneDrive E2E instability.
- Open: none of the original HIGH/MEDIUM application bugs remain. `CRG-RT-005` (signup), `CRG-RT-006` (logs filters/pagination), and `CRG-RT-008` (RAG E2E locator) are all FIXED. Remaining work is provider verification and load testing (credential-gated / infra).

## 12. Feature Working Percentage

- Verified local/core functionality: approximately 76% of the requested journey inventory.
- Production-provider readiness: approximately 58%.
- Percentages are evidence-weighted estimates, not code-completion claims.

## 13. Scores

| Category | Score /10 |
| --- | ---: |
| Core Guard Functionality | 8 |
| Auth/RBAC/Tenant Isolation | 8 |
| Dashboard UX | 8 |
| API Stability | 8 |
| RAG Security | 7 |
| Reports/Webhooks | 6 |
| Billing | 5 |
| Enterprise Features | 5 |
| SDK/Integrations | 8 |
| Performance | 7 |
| Security | 8 |
| Test Coverage | 8 |
| Production Readiness | 6 |

- Beta readiness: 84/100 (was 78; signup consistency/verification and logs filters/pagination fixed).
- Production readiness: 64/100 (was 56; main application blocker `CRG-RT-005` and logs UX `CRG-RT-006` fixed; real email/KMS/payment/load testing remain).
- Enterprise readiness: 50/100.
- Competitor readiness: 55/100.
- Reliability score: 74/100 locally; production provider reliability not established.

## 14. Go / No-Go

**GO for a controlled, invited beta** using local/test provider modes, explicit feature flags, and operator monitoring. Self-service signup is now safe in beta: production+mock fails closed, signup is idempotent, and unverified users cannot start credentials sessions when mail is deliverable.

**NO-GO for unrestricted production launch** until real email/KMS are configured and verified, the Razorpay payment lifecycle is exercised or explicitly disabled, and deployment-level HTTP/worker/DB-pool load tests are completed. (`CRG-RT-008`, the RAG E2E locator, is now fixed and the local E2E suite — critical-flow, authorization, authenticated-surface — passes with the signup spec correctly skipped under production+mock.)

## 15. Next Fix Plan

1. Configure and test real email and KMS in staging (user credentials required).
2. Obtain explicit authorization and run Razorpay sandbox payment/webhook/failure lifecycle.
3. Run deployment-level HTTP load, worker backlog, memory, and database pool tests.
4. Verify real vector, SIEM, SAML, and SCIM integrations.

## 16. CRG-RT-005 Fix Detail (2026-06-15)

Root cause: the signup transaction committed user/org/membership/subscription/onboarding, then created the verification token and sent email OUTSIDE the transaction. A provider send failure (notably production with `EMAIL_PROVIDER=mock`) left a committed-but-unverified account behind a generic 500, and credentials login never required `emailVerifiedAt`.

Fix:
- New `lib/auth/signupPolicy.ts` — pure, unit-tested policy: `resolveEmailDeliveryMode` (live/mock/blocked), `requireVerifiedEmailForLogin`, `planSignup` (create/resend/reject-existing/blocked-email-provider), `canStartCredentialsSession`.
- `app/api/auth/signup/route.ts` — resolves delivery mode before any write (production+mock => 503, no write); idempotent (unverified resend => 200, verified/SSO/passwordless => 409, unique-race => 409); creates user + workspace + verification token in one `$transaction`; post-commit email failure is caught and reported as `emailSent:false` (recoverable via resend), never a 500 over a committed account.
- `lib/auth/tokens.ts` — `createEmailVerificationToken` accepts an optional transaction client for atomic user+token creation; tokens stay SHA-256 hashed, 24h-expiring, one-time, and resend invalidates prior unused tokens.
- `auth.ts` — credentials authorizer gates sessions on `canStartCredentialsSession` (verified email required for real-provider/production or `AUTH_REQUIRE_EMAIL_VERIFICATION=true`; dev-mock relaxed; SSO exempt).
- `components/auth/SignUpForm.tsx` — when verification is required, shows a check-your-email notice instead of attempting a sign-in that would fail; surfaces a resend hint if the email did not send.
- `.env.example` — documents `AUTH_REQUIRE_EMAIL_VERIFICATION`.

Tests: `tests/auth-signup.test.ts` (21 cases) covering all 11 required scenarios plus route-structure invariants. Verified: `npx prisma validate` valid; `npm run typecheck` clean; `npm test` 190/190 pass; `npm run lint` clean; `npm run build` succeeds. The E2E signup spec stays correctly skipped under the default production+mock build (mock email is a blocked state there by design); the demo-user critical-flow login still passes, confirming the verified-email gate does not regress seeded/SSO accounts.
