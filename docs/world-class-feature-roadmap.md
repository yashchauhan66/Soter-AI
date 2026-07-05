# World-Class Feature Roadmap

Principles: preserve APIs and data; use additive contracts and feature flags; tests before enforcement changes; one P0 at a time; no large rewrite until assurance gates pass.

| Phase | Goal | Exact tasks / files | Tests | Acceptance criteria | Risk / complexity | Dependencies |
|---|---|---|---|---|---|---|
| 0. Audit | Establish evidence baseline | Create this document set; inventory routes/models/tests; record benchmark and build state | Existing test/typecheck baseline | Findings have file evidence, priority, owner placeholder and measurable exit | Low / M | None |
| 1. P0 correctness | Close exploitable assurance gaps | Vault key fail-closed (`lib/credentials/vault.ts`); egress URL policy; tenant route harness; extension host minimization; claim fixes; CI security gates; Dynamo reconciliation | Focused unit first, then integration/security/extension/CI tests | Every P0 has regression test and rollback; 0 known critical/high unaccepted findings | Med / H | Phase 0 |
| 2. Detector expansion | Raise recall at bounded FPR | Normalization pipeline; jailbreak/indirect/multilingual datasets; detector version registry; calibration | External and holdout corpora; metamorphic tests | ≥95% agreed critical-family recall at ≤1% FPR on disclosed holdout; no category below agreed floor | High / H | P0 logging/privacy |
| 3. Dynamo validation | Prove heavy-event durability | Reconciliation job/dashboard; dual-write counters; backfill checkpoint; cutover flag; rollback | LocalStack/AWS sandbox failure and replay tests | Measured loss 0 in test; lag/loss alarms; reversible cutover | High / H | Event schema freeze |
| 4. Policy templates | Consistent policy UX | Versioned templates; compile per surface; policy simulator; signed digest | Golden policy decisions across API/extension/agent/RAG | Same input/context + policy version yields same action everywhere | Med / M | Unified taxonomy |
| 5. RAG/agent hardening | Enforce trust and least privilege | Provider-native isolation; signed document provenance; capability tokens; mandatory execution proxy; postconditions | Two-tenant Qdrant/pgvector; malicious MCP; race/replay | Cross-tenant retrieval impossible in tested providers; dangerous actions require valid receipt | High / XL | P0 auth/egress |
| 6. Extension hardening | Privacy-first enterprise browser release | Remove always-on wildcard injection; runtime host grants; local mode; adapter API; managed policy; store pack | Chrome/Edge Playwright, permission, privacy, 10KB performance | No raw sensitive telemetry; explicit host scope; p95 within published budget | High / H | Policy contract |
| 7. Automation security | Own low-code AI security | Harden n8n credentials/actions; batch/IF outputs; Zapier/Make adapters; signed workflow examples | Deployed API E2E and malicious workflow suite | Secret-safe, idempotent, documented workflows; verification submission ready | Med / H | `/v1/guard` |
| 8. Enterprise governance | Procurement readiness | Live SAML/SCIM; RLS; IP policy; retention/deletion/legal hold; BYOK lifecycle; residency model | IdP and KMS sandbox, deletion, audit trail tests | Enterprise control evidence pack; break-glass and separation of duties | High / XL | Tenant model |
| 9. Observability/IR | Operable security product | SLOs, traces, event sequence, SIEM schemas, incident workflows, report builder | Queue lag, replay, export integrity, SIEM sandbox | Guard/event/webhook/worker SLO dashboards and runbooks | Med / H | Event durability |
| 10. Performance/scale | Prove predictable cost and latency | End-to-end load; payload bands; concurrency; cache; worker backpressure; capacity model | k6/HTTP, chaos, DB explain plans | Published p50/p95/p99, error rate, cost/1k under named environment | High / H | Stable API/event schema |
| 11. Red-team suite | Continuous adversarial assurance | Independent corpora, adaptive/multi-turn, RAG, MCP, multimodal, tenant, insider packs | Nightly/full and PR smoke gates | Versioned scorecard with FP/FN/bypass trends and review workflow | High / H | Detector registry |
| 12. Launch readiness | Evidence-backed GA | External pentest/red team; DR restore; support/SLA; claims review; marketplace releases | Full verification + external closure | No open P0; accepted P1 risk register; rollback/IR drill; signed release | High / XL | Phases 1-11 |

## P0 execution order

1. **P0-01 Credential vault key fallback:** fail closed; preserve decrypt compatibility; add unit tests; no schema change.
2. **P0-02 Tenant isolation behavioral harness:** two orgs/users/projects/keys; negative matrix for every sensitive object route.
3. **P0-03 Central outbound egress guard:** normalize, resolve, reject private/link-local/metadata, revalidate redirects and connections.
4. **P0-04 Extension permission reduction:** eliminate always-on `<all_urls>` lineage injection or gate it behind explicit managed/runtime grant.
5. **P0-05 Claims correction:** label CPU-only benchmark; remove full-path `<50ms` until end-to-end evidence exists.
6. **P0-06 CI supply-chain gates:** secret scan, SCA, SAST, SBOM, image scan, artifact signing/provenance.
7. **P0-07 Dynamo durability gate:** dual-write reconciliation and cutover/rollback evidence.
8. **P0-08 Detector bypass floor:** add failing jailbreak/multi-turn cases before changing thresholds or models.

## Release gates

- P0: focused test, main tests, typecheck, build, documented rollback.
- P1 detector: fixed holdout, fixed FPR budget, category floor, benchmark artifact review.
- Data/schema: forward migration, compatibility period, backup/restore, rollback or compensating migration.
- Extension: permission diff, privacy data-flow diff, Chrome and Edge smoke, store-package hash.
- Infrastructure: IaC review, least privilege, vulnerability scan, signed immutable artifact, canary health.

## Complexity guide

- S: ≤2 focused engineering days, no migration.
- M: 3-7 days, bounded subsystem.
- H: 1-3 weeks, cross-surface or provider validation.
- XL: multi-sprint, migration/external assurance/organizational dependency.
