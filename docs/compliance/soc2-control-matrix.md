# SOC2 Control Matrix (Readiness — NOT an attestation)

**Status:** 🟡 **SOC2 READINESS PROGRAM IN PROGRESS.** No SOC2 examination has been performed. No independent CPA has issued a report. Per `docs/marketing-claims-policy.md`, the only permitted external claim today is **"SOC2 readiness program in progress"** — never "SOC2 compliant" or "SOC2 certified."
**Date:** 2026-07-11 · **Scope (proposed):** SoterAI Guard platform (web app, Guard/Agent/RAG APIs, data stores)

## Trust Services Criteria coverage (self-assessed readiness)

Legend: 🟢 control implemented + evidence exists · 🟡 partial / documented-only · 🔴 gap

| TSC | Control | Implementation evidence in repo | Readiness | Owner |
|---|---|---|---|---|
| CC1.1 Governance | Code of conduct, org structure | `CONTRIBUTING.md`, `CLA.md`, `SECURITY.md` | 🟡 | Compliance PM |
| CC2.x Communication | Security policies published | `docs/security/*`, `docs/compliance/*` | 🟢 | Compliance PM |
| CC3.x Risk assessment | Risk register, threat model | `docs/security/pentest-scope.md`, OWASP LLM mapping | 🟡 | Security |
| CC4.x Monitoring | Logging/monitoring policy | `docs/security/logging-monitoring-policy.md` | 🟡 (deployed observability = EVR-03) | DevSecOps |
| CC5.x Control activities | Change management | Git history, CI, PR review | 🟡 | Eng Lead |
| CC6.1 Logical access | AuthN/AuthZ, RBAC | `auth.ts`, `middleware.ts`, RBAC tests | 🟡 (2-account runtime proof = EVR-08) | Enterprise |
| CC6.2/6.3 Provisioning | User lifecycle, SCIM | SCIM code present | 🔴 (live IdP = EVR-08) | Enterprise |
| CC6.6 Encryption in transit | HTTPS/TLS | nginx TLS (per deployment memory), HSTS | 🟡 (verify headers on deploy) | DevSecOps |
| CC6.7 Encryption at rest | DB/secret encryption | `docs/compliance/encryption.md`, `docs/security/key-management-policy.md` | 🟡 | DevSecOps |
| CC6.8 Malware/integrity | Dependency hygiene | `npm audit --omit=dev` = 0 vulns (2026-07-11) | 🟢 | DevSecOps |
| CC7.1/7.2 Threat detection | Security event logging | Guard event pipeline, DynamoDB events | 🟡 | Security |
| CC7.3/7.4 Incident response | IR plan | `docs/security/incident-response-plan.md`, `docs/compliance/incident-response.md` | 🟢 (doc) / 🟡 (drill evidence) | Security |
| CC7.5 Recovery | Backup/restore | `docs/security/backup-restore-plan.md`, `docs/compliance/backup-restore.md` | 🟡 (restore drill evidence needed) | DevSecOps |
| CC8.1 Change mgmt | SDLC, testing | 679/679 tests, typecheck, lint, build gates | 🟢 | Eng Lead |
| CC9.x Vendor mgmt | Third-party risk | `docs/compliance/vendor-risk.md` | 🟡 | Compliance PM |
| A1.x Availability | Uptime, capacity | Health checks; deployed load = EVR-03 | 🔴 | DevSecOps |
| C1.x Confidentiality | Data classification, retention | `docs/compliance/data-retention.md`, `docs/security/data-retention-policy.md` | 🟡 | Compliance PM |
| P1–P8 Privacy | DPDP readiness | `docs/compliance/dpdp-readiness.md` | 🟡 | Compliance PM |

## Honest gap summary

- **Strongest:** change management (CC8), dependency integrity (CC6.8), policy documentation (CC2) — real, evidenced.
- **Documented-only (needs operating evidence over a period):** most CC6/CC7 controls — SOC2 Type II requires evidence they *operated effectively over 3–12 months*, which no code review can produce.
- **Hard gaps for GA claims:** availability (A1 → EVR-03), provisioning (CC6.2 → EVR-08).

## Path to a real SOC2 report

1. Select an independent CPA firm / auditor.
2. Choose Type I (point-in-time) then Type II (period-of-operation).
3. Fill the evidence index (`soc2-evidence-index.md`) with dated artifacts.
4. Run the observation period with monitoring/access-review evidence.
5. Auditor issues report → *only then* may "SOC2 Type II" be claimed, with scope + date + firm.

**Until step 5: claim = "SOC2 readiness program in progress." Nothing stronger.**
