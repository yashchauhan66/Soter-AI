# Implementation Next Steps

This is the exact execution queue after the audit. Complete one P0 at a time and keep each change independently reviewable.

## P0 queue

### P0-01: Credential vault fail-closed key handling

Files: `lib/credentials/vault.ts`, a focused test under `tests/`, then environment/runbook documentation if needed.

Steps:

1. Add a failing unit test proving missing/short/placeholder key material is rejected.
2. Remove the hard-coded fallback without changing stored ciphertext format.
3. Preserve compatibility for deployments already using `API_KEY_PEPPER` or the existing auth-secret fallback.
4. Add tests for allowed key sources and deterministic derivation boundaries without exposing key bytes.
5. Run focused test, `npm test`, typecheck and build.

Acceptance: no credential can be stored/revealed/rotated with predictable or invalid root key material; existing configured deployments retain decrypt compatibility; no schema/data rewrite.

Rollback: revert code only. No data migration.

### P0-02: Behavioral tenant-isolation harness

Files: new `tests/integration/tenant-isolation-routes.test.ts`, shared test DB/auth factories, critical routes.

Create two organizations, users, roles, projects, keys and objects. Exercise read/update/delete/reveal/export/replay/approve paths with foreign IDs. Require denial and prove no state change. Generate route/object coverage report. Start with credentials, API keys, policies, logs/exports, webhooks, RAG documents/chunks, reports, agent identities/passports/approvals/ledger and extension devices/tokens.

Acceptance: 100% tested cross-tenant attempts denied; tests query post-state; CI runs against Postgres.

### P0-03: Universal outbound egress guard

Files: central `lib/security/outbound-url.ts` (or consolidate existing SSRF helper), webhook/SIEM/embedding/ML/KMS/Vault/connector clients.

Reject non-HTTPS unless an explicit local-development policy applies; credentials in URL; localhost, private, loopback, link-local, multicast, unspecified and cloud metadata ranges; forbidden ports; redirects to forbidden targets; DNS answers that change to forbidden ranges. Enforce network-layer egress too.

Acceptance: IPv4, IPv6, mixed notation, redirects, DNS-rebinding simulations and metadata endpoints fail; allowlisted public endpoints pass.

### P0-04: Extension permission minimization

Files: `apps/extension/manifest.json`, lineage content script/background/policy, extension tests and store permission docs.

Remove always-on `<all_urls>` injection or require explicit managed/runtime grant. Add migration UX and telemetry-free adapter health.

Acceptance: permission diff approved; protected sites work; ungranted sites receive no content script; no raw-data regression.

### P0-05: Claims accuracy

Files: homepage/Hero/FAQ/demo/video scripts/README and legacy assessment reports clearly marked historical.

Acceptance: CPU analyzer metrics are labeled; no full guard `<50ms` claim without authenticated HTTP evidence; benchmark sample/method/limitations adjacent; no absolute protection language.

### P0-06: CI supply-chain security

Files: `.github/workflows/ci-cd.yml`, security workflow/config, release docs.

Add secret scanning, dependency review/SCA, CodeQL or reviewed SAST, SBOM, container and IaC scan, package/image signing and provenance. Pin actions by commit for high-assurance releases.

Acceptance: required checks block high/critical unaccepted findings; artifacts carry SBOM/signature/provenance; exception process has owner/expiry.

### P0-07: DynamoDB durability and cutover proof

Files: event store, migration scripts, monitoring/admin health and runbook.

Acceptance: deterministic idempotency, reconciliation counts/digests, lag/loss alarms, replay checkpoint, tested Postgres fallback, reversible flag sequence and sandbox failure report.

### P0-08: Critical detector bypass floor

Files: benchmark datasets, multi-turn sequences, detector/version registry.

First add failures for the current jailbreak/multi-turn misses. Improve without exceeding the approved FPR. Do not tune on final holdout.

Acceptance: agreed category floors and fixed holdout; benchmark JSON includes commit, detector versions, environment and confidence intervals.

## P1 after P0

1. Add `/v1/guard` as a facade over existing routes and publish OpenAPI/JSON Schema.
2. Add request/trace ID, policy/detector versions, confidence and timing contract.
3. Enforce provider-native vector isolation and ACL continuity.
4. Turn agent checks into an unavoidable capability-receipt execution boundary.
5. Version and compile policy templates across API, extension, RAG and agent surfaces.
6. Live-certify SAML/SCIM/KMS/SIEM and retention/deletion flows.
7. Establish guard/event/worker SLO dashboards and incident runbooks.
8. Run end-to-end staging load and chaos tests.
9. Generate SDKs/consumer contracts from the unified schema.
10. Commission independent penetration and AI red-team assessments.

## Change discipline

- One P0 per branch/commit set.
- Add the failing test first where practical.
- No destructive migration or API removal.
- Use feature flags for behavior changes that may affect false positives or availability.
- Record files, tests, benchmark delta, rollout, rollback and residual risk in each P0 closure note.

## Exact next command

After reviewing the audit documents, start P0-01 with its focused test. The intended focused command will be:

```powershell
npx tsx --test tests/credential-vault-security.test.ts
```
