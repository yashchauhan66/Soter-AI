# 1. Information Security Policy

**Version 1.0 · 2026-08-02 · Owner: Founder/CEO · Review: Quarterly**

## Purpose
Protect the confidentiality, integrity and availability of customer data and the SoterAI guard platform.

## Scope
All code, data, credentials, infrastructure, endpoints and personnel with access to production or customer data. System description: Next.js SaaS + hosted AI gateway + local broker + browser/IDE extensions; data stores: PostgreSQL, object storage; providers listed at `/subprocessors`.

## Policy statements
1. **Security ownership:** One named security owner (founder) accountable for this policy and its enforcement.
2. **Least privilege:** Access to prod data/keys on need-to-know, least-privilege basis (see 02-access-control-matrix).
3. **Authentication:** All API access via API keys with fail-closed auth; SSO (SAML/SCIM) for enterprise; rate+quota enforced per key.
4. **Encryption:** TLS in transit; secrets never logged; PII redacted by `packages/soter-pii`.
5. **Change management:** All code via PR + full regression gate (966/966 tests) before merge; capability registry regenerated in CI.
6. **Detection & response:** Audit events on every guard decision; incident handling per `05-incident-response-runbook.md`.
7. **Honest disclosure:** Known bypasses and UNSUPPORTED capabilities are published in `artifacts/security/capabilities.json` (`honest:true`); we do not overclaim enforcement.
8. **Availability:** Health (`/api/health`) and readiness (`/api/ready`) endpoints; status at `/status`.

## Enforcement
Violations → access revocation. Exceptions require written approval by the security owner with an expiry date.
