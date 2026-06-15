# Real User Test Plan

Date: 2026-06-15

## Objective

Verify CyberRakshak Guard as a customer, developer, viewer, agency user, and platform admin without destructive testing or unauthorized provider calls.

## Environments

- Local Windows/OneDrive workspace, Node 22.16.0, npm, Python 3.12.8.
- Next.js 15.5.19 production build and local PostgreSQL.
- Development mode for mock email/local secret-store behavior.
- Production mode for fail-closed provider behavior and browser timing.

## Coverage

1. Install, schema, typecheck, lint, unit/regression, build, and dependency audit.
2. Signup, sign-in, project, API key, guard request, logs, webhook, reports, RAG, admin denial, and tenant isolation.
3. Guard/API validation, authentication, RBAC, redaction, rate-limit logic, and public badge privacy.
4. JS/TS SDK, Python SDK, middleware packages, examples, and WordPress packaging.
5. Component load at concurrency 1/10/50/100 and production browser navigation timing.
6. Provider status without sending real payment, email, SIEM, SAML, or SCIM traffic.

## Test Data

- Seeded demo admin and demo organization.
- Seeded E2E viewer and foreign tenant.
- Timestamped E2E users, projects, API keys, webhooks, badge projects, RAG collections, and documents.
- Fake `example.test` identities and `example.com` webhook URLs only.

## Safety Boundaries

- No Razorpay payment was attempted because explicit payment authorization was not provided.
- No unauthorized external endpoint received traffic.
- No destructive retention/deletion operation was executed.
- Reports never include raw credentials from `.env`.

## Exit Criteria

- Local gates pass or failures are recorded.
- Critical journeys have runtime evidence or a named provider blocker.
- Critical/high bugs are fixed or explicitly open/blocked.
- Final scores do not exceed evidence.
