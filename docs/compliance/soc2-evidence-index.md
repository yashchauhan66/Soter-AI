# SOC2 Evidence Index (Readiness)

**Status:** 🟡 Readiness collection. No auditor has reviewed these. Presence of an artifact ≠ effective operation over a period (Type II requirement).
**Date:** 2026-07-11

| Control | Evidence artifact | Location | Dated? | Auditor-reviewed? |
|---|---|---|---|---|
| Change mgmt (CC8) | Test/build/typecheck/lint gate results | `docs/final-enterprise-ga-baseline-results.md` | ✅ 2026-07-11 | ❌ |
| Dependency integrity (CC6.8) | `npm audit --omit=dev` = 0 vulns | `/tmp/ga_audit.log` (regenerate in CI) | ✅ 2026-07-11 | ❌ |
| Access control (CC6.1) | RBAC/tenant tests | `tests/` (governance/auth/security suites) | ✅ | ❌ |
| Logging/monitoring (CC7) | Policy + event pipeline | `docs/security/logging-monitoring-policy.md` | ✅ | ❌ |
| Incident response (CC7.3) | IR plan | `docs/security/incident-response-plan.md` | ✅ | ❌ |
| Backup/restore (CC7.5) | Plan (drill evidence PENDING) | `docs/security/backup-restore-plan.md` | 🟡 | ❌ |
| Encryption (CC6.6/6.7) | Key mgmt + encryption policy | `docs/security/key-management-policy.md`, `docs/compliance/encryption.md` | ✅ | ❌ |
| Vendor risk (CC9) | Vendor register | `docs/compliance/vendor-risk.md` | ✅ | ❌ |
| Vulnerability mgmt | Pentest scope + remediation tracker | `docs/security/pentest-scope.md`, `pentest-remediation-tracker.md` | ✅ | ❌ (external pentest = EVR-02) |
| Availability (A1) | Deployed load test | **MISSING → EVR-03** | ❌ | ❌ |
| Provisioning (CC6.2) | SCIM live run | **MISSING → EVR-08** | ❌ | ❌ |

## Missing evidence blocking a real audit

1. **EVR-03** — deployed availability/load evidence (A1).
2. **EVR-08** — live IdP provisioning/deprovisioning evidence (CC6.2/6.3).
3. **EVR-02** — independent vulnerability assessment (CC-level assurance).
4. **Operating-period evidence** — access reviews, change tickets, monitoring alerts collected over the observation window. Cannot be manufactured retroactively.
