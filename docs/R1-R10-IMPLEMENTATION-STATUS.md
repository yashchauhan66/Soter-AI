# R1–R10 Implementation Status (2026-08-02)
Honesty: "SHIPPED" = code + test in repo. "DOC" = governance/stance doc. "PARTIAL" = scaffold exists, not wired.

| # | Item | Status | Where |
|---|---|---|---|
| R1 | Foundation labs absorb basic guardrails → move up-stack to governance/escrow/evidence | **SHIPPED** | `tests/agent-passport.test.ts`, `tests/escrow.test.ts`, `tests/evidence-vault.test.ts`, canonical-verb enforcement plane |
| R2 | EU AI Act enforcement (2 Aug 2026) + DPDP (13 May 2027) → audit evidence pack | **SHIPPED** | `scripts/compliance/eu-ai-act-pack.mjs` → `artifacts/security/eu-ai-act-evidence-pack.{json,md}` (7 artifact SHA-256 pinned), EU Art 9–15 + DPDP S.8 mapped |
| R3 | First agent-financial-crime incident → AP2/x402 spending security | **SHIPPED** | `lib/payments/agentPaymentGuard.ts` (Ed25519 mandate verify + single-use replay protection + velocity/per-tx caps + payee allow/deny + REQUIRE_APPROVAL, fail-closed) + `tests/agent-payment-guard.test.ts` → **10/10 pass** |
| R4 | Memory poisoning mainstream | **PARTIAL→P0 next** | memory-poisoning detector + `app/ai-memory-inspector/` exist; wire write-gate into agent runtime (next sprint) |
| R5 | A2A protocol adoption → first A2A firewall | **PARTIAL** | `tests/a2a-security.test.ts`, `tests/agent-intent.test.ts`, blastRadius caps; signed hop-token chain pending |
| R6 | Cross-modal injection | **PARTIAL** | `multimodalAttackDetector` referenced in detectors; extend to OCR/audio pipeline |
| R7 | Consolidation → be the last independent neutral layer | **POSITION** | OSS + self-host moat is in place; maintained, no code change |
| R8 | Regulated industries need deterministic auditability | **SHIPPED** | 100% deterministic rules tier with per-rule citation + OOD abstention + model card; 79-language union recall 100%, benign FP 0% |
| R9 | Solo-maintainer trust ceiling | **DOC SHIPPED** | `docs/governance/GOVERNANCE-AND-TRUST.md` (continuity, CLA, SLA, signing, change control, honesty registry) |
| R10 | Benchmark credibility arms race | **SHIPPED** | `benchmarks/soterai-public-benchmark/` (witness Docker kit, SHA-256 corpus hash) + every claim in repo has a repro command |

**Net:** the three highest-leverage items (R2 audit evidence, R3/U4 agent payments, R8 deterministic detection) are now code-complete and test-verified. R9 is doc-complete. The remaining items (R4/R5/R6) have standing scaffolds and are next in the U-queue (`docs/SOTERAI-U1-U6-R1-R10-ROADMAP-2026-08-02.md`).
