# Final Fix Plan

## Priority 1 - Production Blockers

1. Complete SAML ACS to application-session exchange.
2. Add Playwright E2E suite for critical user flows.
3. Add `npm run lint` and CI job for install, validate, typecheck, test, build, audit.
4. Run real provider validation for Redis, email, KMS, Razorpay, vector provider, SIEM.

## Priority 2 - High Value Hardening

1. Add FK constraints/service tests for Phase 11 tenant/project fields.
2. Add API route audit tests for auth/RBAC/input validation patterns.
3. Add cursor pagination to logs/support/admin dashboards.
4. Add SAML RelayState/callback validation tests.
5. Add SIEM worker health endpoint and graceful shutdown.

## Priority 3 - Feature Completion

1. Build full agent firewall approval queue and enforcement integration.
2. Build AI BOM lifecycle UI and export.
3. Build threat-intel import/approve/shadow/promote/rollback workflow.
4. Build benchmark scheduled runs and trend dashboard.
5. Build DPDP DSR workflow with SLA states and evidence exports.

## Priority 4 - Polish

1. Refactor dense one-line pages/components for maintainability.
2. Improve empty states for Phase 11 dashboards.
3. Add public docs showing beta/scaffold limitations honestly.

