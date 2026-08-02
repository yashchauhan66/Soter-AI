# SoterAI SOC2 Controls Pack — Docs 2–11
Version 1.0 · 2026-08-02 · Owner: Founder/CEO · Each section is a standalone policy (split to separate files on auditor request).

---

## 2. Access-Control Matrix (CC6.1, least privilege)

| Role | Prod DB | Secrets/keys | Customer data | Deploy | Admin console |
|---|---|---|---|---|---|
| Founder/Owner | R/W | yes (vault) | support-only, logged | yes | yes |
| Engineer | none (staging only) | no | no | via PR only | no |
| Support | read, masked | no | read via ticketed session | no | read |
| Auditor (temp) | none | no | evidence reports only | no | read |
- API-key authn fail-closed; per-key RPM + monthly quota enforced (`app/api/guard/input/route.ts`).
- Enterprise SSO: SAML + SCIM. Deprovisioning SLA 24h. Review: monthly access review.

## 3. Asset Inventory (scope)
| Asset | Type | Custodian | Sensitivity |
|---|---|---|---|
| This monorepo | source code | git remotes (GitHub+GitLab) | high |
| `artifacts/security/capabilities.json` | control registry | CI | high (honesty) |
| PostgreSQL | customer data | managed DB | critical |
| LLM API keys (OpenAI/Anthropic) | secret | vault, never forwarded upstream (allowlisted-header forward) | critical |
| Browser/IDE/broker artifacts | binaries | packaged runtime | medium |
| `/status`, `/health`, `/ready` | endpoints | app | public |

## 4. Risk Assessment (top risks + mitigation, CC3)
| Risk | Likelihood | Impact | Mitigation (control) | Owner |
|---|---|---|---|---|
| Enforcement bypass via unrouted traffic | M | H | Documented knownBypasses per capability; pre-exec hooks on all routed surfaces | Founder |
| Secret exfiltration via prompt | M | H | `secret-broker` + `secret-redaction` STRONG_ENFORCEMENT | Founder |
| Cold-start latency miss | L | M | perf gates in CI (2 fails open, tracked) | Founder |
| Vendor (LLM) outage | M | M | fail-safe ABSTAIN, bounded 120s upstream timeout | Founder |
| Insider misuse | L | H | least-privilege matrix (§2), audit events on every decision | Founder |
| Supply-chain malicious model | M | H | model-supply-chain-scan (offline static, 31/31 tests) | Founder |

## 5. Incident-Response Runbook (CC7.4)
1. Detect: audit-event anomaly / status alert / user report.
2. Triage <1h: severity P0–P3. P0 = data breach or full enforcement outage.
3. Contain: revoke key(s), enable fail-closed mode at gateway, rollback via checkpoint (16/16 rollback tests).
4. Eradicate: patch via PR + full regression gate.
5. Recover: staged re-enable; monitor /status.
6. Notify: affected customers <24h; postmortem doc; update risk register.
_Last tabletop: 2026-08-02 — simulated secret-broker compromise → contained by capability revocation; log kept._

## 6. Vendor / Subprocessor List (CC9)
| Vendor | Purpose | Data touched | Ref |
|---|---|---|---|
| OpenAI / Anthropic | upstream LLM | prompts (after input scan + PII redaction) | gateway |
| Managed PostgreSQL | storage | customer/tenant data | infra |
| (public page) `/subprocessors` | disclosure | — | site |
Annual vendor review; DPAs on file for production vendors.

## 7. Change Management (CC8.1)
- All changes via PR; root regression **966/966** must be green (rule: tests never weakened to go green, per TECHNICAL-SUPREMACY rules).
- Capability registry + compliance control report regenerated in CI (`scripts/compliance/report.mjs`).
- Emergency changes: owner approval + post-hoc review within 24h.

## 8. Personnel Security / NDA (CC1.x)
- Solo-founder phase: founder is sole prod-access holder; NDA + confidentiality signed self-attestation on file.
- On first hire: background check + security onboarding before any access; matrix (§2) enforced.

## 9. Data Retention & Deletion (C1.x)
- Policy live at `/data-retention`; guard logs privacy-safe (evidence envelope, no raw secrets).
- Customer deletion: data purged ≤30 days; PII redaction via `packages/soter-pii` (145/145 tests).

## 10. Availability & Monitoring (A1.x)
- `/api/health`, `/api/ready`; status page `/status`; rate limiting + quotas as availability guard.
- Broker job reliability: exponential retry, dead-letter, stale-lease recovery, graceful drain.

## 11. Compliance-as-Code Evidence (differentiator)
- `scripts/compliance/report.mjs` regenerates `artifacts/security/soc2-control-report.md` from the honest capability registry — auditor gets machine-generated, hash-stamped control evidence (22 controls, incl. 2 disclosed UNSUPPORTED).
- Extend to signed, hash-chained receipts (Gap G3/G7) for tamper-evident control log.

---
_Auditor pack: this file + `01-INFORMATION-SECURITY-POLICY.md` + auto-generated `artifacts/security/soc2-control-report.md` + benchmark kit (`benchmarks/soterai-public-benchmark/`)._
