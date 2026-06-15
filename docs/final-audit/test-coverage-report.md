# Test Coverage Report

## Covered

- Core guard detectors and decision boundaries.
- PII/secrets redaction and no raw original text in public results/logs.
- API key generation/hashing.
- Rate limiter memory behavior.
- RBAC permission matrix.
- Project policy modes and custom patterns.
- Audit exports.
- Razorpay signatures.
- Auth token hashing and email template safety.
- RAG scanner, OCR sandbox, vector ACL, grounding guard, private leakage.
- KMS/local secret store behavior.
- Classifier benchmark/regression metrics.
- Red-team authorization constraints.
- SIEM/webhook redaction and outbound SSRF protection.
- SCIM token hashing, users/groups, route presence.
- Retention/deletion helper behavior.
- Trust/compliance pages avoiding false certification claims.
- Phase 9/10 growth asset integrity.
- Phase 11 AI BOM, agent firewall, RAG security, threat-intel validation, multilingual, privacy, abuse, WordPress/middleware scaffolds.
- New audit tests: sign-in callback sanitizer, badge script injection sink, prose system-prompt leakage.

## Weak / Missing

- Browser E2E tests for signup/login/logout/password reset/email verification.
- Browser E2E tests for dashboard/project/API key/webhook/policy/report/RAG flows.
- Real provider integration tests for Razorpay, Redis, KMS, email, SIEM, Qdrant/pgvector.
- SAML ACS real session completion tests.
- Phase 11 tenant isolation and FK/service-level tests.
- Performance/load tests for guard API and dashboard queries.
- API route table-driven tests for auth/RBAC/rate-limit/validation on every route.

## Priority

Highest priority missing test: **Playwright critical-path suite** covering sign-in, dashboard, project creation, API key generation, guard input/output calls, logs, webhooks, report generation, RAG upload/scan, admin access denial.

