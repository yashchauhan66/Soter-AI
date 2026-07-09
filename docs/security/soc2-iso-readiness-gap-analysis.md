# SOC 2 / ISO 27001 Readiness Gap Analysis — SoterAI

**Status:** Self-assessment — **readiness**, NOT certification.
**Date:** 2026-07-08

> SoterAI is **not** SOC 2 or ISO 27001 certified. This document is an honest
> internal gap analysis so we can (a) describe our posture accurately to buyers
> and (b) plan a real audit. Public-facing pages must say **"SOC 2 / ISO 27001
> readiness"** or **"SOC 2 preparation"** — never "certified" — until a real
> certificate exists.

## Summary

| Framework | Target | Current state | Blocking gap |
|---|---|---|---|
| SOC 2 Type I | Design of controls at a point in time | **Partial — readiness** | No auditor engagement; no formal control evidence package |
| SOC 2 Type II | Operating effectiveness over 3–12 months | **Not started** | Requires Type I first + an observation window |
| ISO 27001 | ISMS certification | **Partial — readiness** | No ISMS scope statement, risk treatment plan, or Stage 1/2 audit |

## Trust Service Criteria — self-assessed

| Criterion | Have (evidence in repo/product) | Gap |
|---|---|---|
| **Security** | SSRF-hardened webhooks, HMAC signing, RBAC (`lib/auth/rbac.ts`), tenant scoping, CSP+nonce webviews, SecretStorage, `npm audit` 0 vulns, detection engine | No external pentest; no formal access-review cadence evidence |
| **Availability** | Health endpoint, rate limiting, docker/helm deploy | No published SLA/SLO; no proven uptime record; scale unproven |
| **Confidentiality** | Redaction, secret hashing w/ pepper, retention + deletion routes | No data-classification policy signed off; encryption-at-rest attestation pending infra |
| **Processing Integrity** | 669 passing tests, honest benchmark, typed SDK | No change-management audit trail formalized |
| **Privacy** | `/privacy`, `/terms`, data-handling policy, DPDP/GDPR described | Not legally reviewed; no DPA template published |

## Required before a real SOC 2 Type I

1. Engage a licensed CPA firm / auditor.
2. Formal control matrix + evidence collection (access reviews, onboarding/offboarding, incident-response runbook, vendor management).
3. Risk assessment document + treatment plan.
4. Policies: information security, access control (see `docs/security/access-control-model.md`), data retention (`docs/security/data-retention-policy.md`), incident response, BCP/DR.
5. Third-party penetration test (`docs/security/pentest-scope.md`).

## Required before ISO 27001

1. Defined ISMS scope + Statement of Applicability (Annex A controls).
2. Risk assessment + risk treatment plan.
3. Internal audit + management review.
4. Stage 1 (documentation) and Stage 2 (implementation) certification audits by an accredited body.

## Honest positioning language (approved)

- ✅ "SOC 2 readiness" / "SOC 2 preparation" / "working toward SOC 2 Type I".
- ✅ "ISO 27001 readiness".
- ❌ "SOC 2 certified" / "ISO 27001 certified" / "compliant" (until a certificate exists).

**EVIDENCE REQUIRED to change this file's status:** a signed SOC 2 report and/or
an ISO 27001 certificate from an accredited auditor.
