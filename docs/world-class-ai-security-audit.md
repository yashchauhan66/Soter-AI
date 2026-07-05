# SoterAI World-Class AI Security Audit

Audit date: 2026-07-05  
Scope: repository at `Ai-Agent-Security-Guard`  
Status: code-informed architecture and product audit; not a penetration test or certification

## Executive summary

SoterAI is not an early guardrail prototype. The repository contains a broad AI-security control plane: input/output guards, 20 detector modules, agent identity and passports, tool-chain and intent checks, action escrow, RAG scanning and namespace controls, browser protection, SIEM/webhooks, SAML/SCIM, reports, SDKs, and automation integrations. The breadth is a genuine differentiator.

The main problem is assurance, not feature count. A 266-route, 189-model system has outgrown source-pattern tests as its primary authorization proof. Several controls are implemented but not validated against a real multi-tenant database, external identity provider, browser store build, cloud KMS, DynamoDB cutover, or production load. One code-level P0 was confirmed: `lib/credentials/vault.ts` uses a predictable hard-coded encryption fallback when deployment secrets are missing. Current detector evidence is transparent but not yet strong enough for broad efficacy claims: the checked-in 1,218-case benchmark reports 84.26% single-turn recall, 0.54% false-positive rate, 36.36% recall for its small jailbreak subset, and 60% multi-turn recall.

Current readiness score: **66/100**. This means suitable for controlled beta/pilot use with explicit limitations, not yet independently proven enterprise production readiness.

## Audit method and evidence

The audit inspected the project brief; repository topology; `package.json`; Prisma schema and 33 migrations; authentication/RBAC helpers; guard API routes and response contracts; detector, policy, redaction, logging, RAG, agent, webhook, DynamoDB, Redis, extension, SDK, n8n, Docker, and CI paths; existing audit/test reports; and the current honest benchmark artifact.

Local verification on 2026-07-05:

- `npm test`: PASS, 665/665 tests.
- `npm run typecheck`: PASS.
- `npm run typecheck:extension`: PASS.
- Production build, live database tests, browser-store E2E, cloud-provider integration tests, SAST/SCA, container scan, and external penetration test were not run in this audit phase.

Framework baseline:

- [OWASP Top 10 for LLM Applications 2025](https://genai.owasp.org/llm-top-10/)
- [OWASP Top 10 for Agentic Applications 2026](https://genai.owasp.org/resource/owasp-top-10-for-agentic-applications-for-2026/)
- [NIST AI RMF Generative AI Profile, NIST AI 600-1](https://www.nist.gov/publications/artificial-intelligence-risk-management-framework-generative-artificial-intelligence)
- [MITRE ATLAS](https://atlas.mitre.org/)
- [CSA AI Controls Matrix v1.1](https://cloudsecurityalliance.org/artifacts/ai-controls-matrix-v1-1)
- [CISA/NCSC Guidelines for Secure AI System Development](https://www.cisa.gov/news-events/alerts/2023/11/26/cisa-and-uk-ncsc-unveil-joint-guidelines-secure-ai-system-development)
- [Chrome Manifest V3 security model](https://developer.chrome.com/docs/extensions/develop/migrate/what-is-mv3)

## Readiness scorecard

| Domain | Weight | Score | Evidence-based assessment |
|---|---:|---:|---|
| Guard/detector correctness | 15 | 10 | Strong breadth and regression suite; benchmark recall gaps remain. |
| Identity, auth, tenant isolation | 15 | 10 | Central guards and scoped queries exist; runtime cross-tenant API suite is incomplete. |
| Agent/tool/MCP security | 12 | 9 | Unusually broad controls; production interception and containment evidence are limited. |
| RAG/data security | 10 | 7 | Quarantine, ACL, namespace, retrieval audit, OCR/image paths exist; provider-backed isolation proof is incomplete. |
| Privacy/secrets/crypto | 10 | 5 | Safe log/redaction controls are good; credential-vault fallback is P0. |
| Observability/IR/SIEM | 8 | 6 | Rich event, webhook, SIEM, evidence and reports surface; SLO/backlog drills missing. |
| Enterprise governance | 8 | 5 | RBAC, SAML, SCIM, retention exist; live IdP, deletion, residency and control evidence incomplete. |
| Extension/integrations/DX | 8 | 6 | Broad integrations and MV3 extension; wildcard content-script/privacy and marketplace proof need hardening. |
| Performance/reliability | 7 | 4 | Excellent in-process numbers; authenticated end-to-end and degraded dependency SLOs unproven. |
| SDLC/deployment/supply chain | 7 | 4 | CI builds/tests and Docker deploy exist; no required SAST/SCA/SBOM/container/signing gates. |
| **Total** | **100** | **66** | Controlled-pilot readiness with material P0/P1 work. |

## What is already strong

1. Central session, organization, project, permission, and API-key authorization helpers in `lib/auth/guards.ts`, `lib/auth/permissions.ts`, `lib/apiKey.ts`, and `lib/apiKeyMiddleware.ts`.
2. API keys are peppered, prefix-indexed, timing-safe compared, returned raw only at creation, and scoped to projects.
3. Guard endpoints enforce API-key auth, distributed rate limiting in production, quota checks, schema validation, policy evaluation, public response shaping, and deferred persistence.
4. Guard logs deliberately omit raw prompt content and sanitize metadata; tests cover secrets and system-prompt leakage.
5. Detector breadth covers prompt injection, jailbreak, Unicode/obfuscation, secrets, general and India-specific PII, SSRF, exfiltration, unsafe output, toxicity, bias, hallucination indicators, and multilingual attacks.
6. Agent controls cover identity, passports, intent verification, tool-chain risk, permission drift, approval, escrow, dry-run, semantic egress, memory poisoning, inter-agent checks, cascade breaking, legal boundaries, and rollback ledgers.
7. RAG includes document validation, OCR/image inspection, sandboxing, trust scoring, quarantine/review, authorization continuity, namespace derivation, retrieval filtering, and retrieval audit.
8. Redis fails closed in production if no distributed backend is configured.
9. Webhook signing, retry/dead-letter mechanics, SIEM workers, reports, evidence records, and retention paths are present.
10. CI applies migrations, typechecks, builds, and runs the main test suite.
11. The extension uses Manifest V3 and avoids remotely hosted code.
12. JS/TS and Python SDKs plus WordPress, n8n, LangChain, LlamaIndex, Vercel AI SDK, Flowise, and Botpress integration assets exist.
13. Marketing already contains several explicit defense-in-depth disclaimers and an unusually transparent benchmark artifact.

## Top 20 gaps

| ID | Priority | Gap | Evidence / affected files | Impact |
|---|---|---|---|---|
| G01 | P0 | Credential vault has a predictable hard-coded encryption fallback. | `lib/credentials/vault.ts:14-16` | Offline database compromise can become secret disclosure if deployment secrets are absent. |
| G02 | P0 | Authorization audit is mainly source-pattern recognition, not runtime denial. | `tests/api-route-audit.test.ts`; 266 routes | A route can call a recognized guard incorrectly or after unsafe work and still pass. |
| G03 | P0 | Credential URL validation accepts private, loopback, link-local, and metadata endpoints. | `lib/credentials/vault.ts:validateServerUrl` | Stored endpoints can become SSRF targets when a connector uses them. |
| G04 | P0 | Extension injects a lineage content script on `<all_urls>` and requests optional wildcard host access. | `apps/extension/manifest.json` | Large privacy/trust blast radius and store-review burden. |
| G05 | P0 | Public `<50ms` language conflates CPU-only analyzer latency with full authenticated API latency. | `app/page.tsx`, `components/marketing/Hero.tsx`, `FAQ.tsx` | Misleading performance claim; enterprise trust risk. |
| G06 | P0 | No required dependency, secret, SAST, container, SBOM, provenance, or image-signing gate in CI. | `.github/workflows/ci-cd.yml` | Supply-chain vulnerabilities can ship despite green tests. |
| G07 | P0 | DynamoDB dual-write/read-fallback migration lacks a checked-in production reconciliation SLO and cutover gate. | `lib/events/**`, migration scripts, compose flags | Missing or divergent audit events during failure/cutover. |
| G08 | P0 | High-risk routes lack a real Postgres two-tenant negative integration matrix. | tests are often module/source-level | IDOR/tenant regressions may evade static assertions. |
| G09 | P1 | Jailbreak and multi-turn recall are below a strong production bar. | honest benchmark: 36.36% subset, 60% multi-turn | Material bypass risk. |
| G10 | P1 | Benchmark attack categories are small and internally curated; no independent corpus or production replay. | `scripts/guard-benchmark/honest-results.json` | Efficacy generalization is unknown. |
| G11 | P1 | Guard response lacks a stable, versioned unified contract with request ID, detector versions, confidence calibration, and evidence policy. | three guard endpoints/types | Integration churn and weak forensic reproducibility. |
| G12 | P1 | Many advanced modules are broad but production proof is uneven; existence tests can overstate readiness. | phase/advanced tests and preview pages | Feature-count illusion; support burden. |
| G13 | P1 | RAG vector isolation is application-enforced; no database RLS/provider policy proof. | `lib/rag/vector/**` | A query construction defect can cross tenant boundaries. |
| G14 | P1 | Outbound destinations are not governed through one universal egress policy layer. | SIEM/webhook/ML/embedding/KMS/provider fetches | SSRF and data egress controls can drift by connector. |
| G15 | P1 | Policy changes need systematic version/rollback/concurrency and enforcement-continuity tests across every guard surface. | policy/admin policy modules | Different clients may enforce different policy states. |
| G16 | P1 | Enterprise SAML/SCIM/KMS/retention flows are not live-provider certified. | enterprise and secret-store modules | Enterprise procurement and operational risk. |
| G17 | P1 | No published operational SLOs for guard availability, queue lag, event loss, webhook lag, or incident response. | monitoring/docs | Operations cannot distinguish healthy from silently degraded. |
| G18 | P1 | EC2 Compose path exposes app port directly and does not encode TLS proxy/WAF/network policy/backup controls. | `docker-compose.prod.yml`, deployment workflow | Production hardening depends on undocumented external state. |
| G19 | P2 | Data residency, BYOK lifecycle, legal hold, and tenant-managed retention are incomplete as provable controls. | enterprise roadmap/state | Limits regulated-enterprise fit. |
| G20 | P2 | Multimodal/audio/video and model/fine-tune supply-chain controls are mostly partial or adjacent modules. | RAG image/OCR and model scan paths | Emerging attack coverage remains incomplete. |

## Top 20 highest-impact improvements

1. Fail closed on missing credential-vault key material and add key-version/rotation tests.
2. Build a real two-organization API authorization harness and cover every object-ID mutation.
3. Route every outbound URL through DNS-rebinding-resistant egress validation and network policy.
4. Remove always-on `<all_urls>` injection; use explicit or runtime-granted hosts with local-only default processing.
5. Separate analyzer CPU latency from end-to-end API latency everywhere public.
6. Add mandatory SCA, secret scan, CodeQL/Semgrep, SBOM, container scan, signed image, and provenance gates.
7. Add DynamoDB dual-write reconciliation, loss alarms, replay tooling, and a reversible cutover runbook.
8. Improve jailbreak/multi-turn recall against independent, versioned corpora while holding an explicit FPR budget.
9. Introduce `/v1/guard` as an additive, versioned facade; preserve existing endpoints.
10. Include request ID, policy version, detector versions, calibrated confidence, timing, and safe evidence references in responses/events.
11. Enforce tenant isolation in storage where possible: Postgres RLS and provider-native vector filters/credentials.
12. Centralize egress, connector identity, retry, timeout, redaction, and audit behavior.
13. Define fail-open/fail-closed policy by action risk and dependency, then chaos-test it.
14. Establish measurable guard/event/webhook/worker SLOs and alerting.
15. Verify SAML, SCIM, KMS/Vault, deletion, retention, and audit exports against live sandbox providers.
16. Add extension Playwright/Chrome enterprise-policy E2E and publish a permission/data-flow inventory.
17. Add deployment TLS/WAF/private subnets/backup restore/immutable image/rollback evidence.
18. Turn preview modules into a maturity registry with owner, SLO, support tier, and evidence link.
19. Add multimodal extraction isolation and provenance-aware media scanning.
20. Commission independent red-team and penetration testing after P0/P1 closure.

## Architecture and control findings by area

### Guard APIs and policy

Current state: `/api/guard/input`, `/output`, `/streaming`, `/analyze`, and `/grounding` exist. Authenticated routes bind requests to the API key's project, validate payloads, rate-limit, meter usage, evaluate policy, and shape public results. Public analysis is IP-rate-limited.

Gaps: no additive `/v1/guard` facade; response schema omits stable contract version, request ID, detector version map, and calibrated confidence; input and output routes duplicate governance handling; rate-limit and persistence failure semantics are not expressed as customer-configurable risk policy.

Recommendation: implement the facade after P0 assurance work, delegate to existing engines, and version both policy and detector metadata. Do not replace old routes.

### Detectors and redaction

Current state: deterministic low-latency detectors plus semantic similarity and multi-turn state. Redaction and log-safety paths have direct tests.

Gaps: small internal benchmark slices, uneven category recall, pattern-heavy detection, uncertain language calibration, and no independent adversarial evaluation. Some categories represented in benchmark labels are broader than the public `RiskType` taxonomy.

Recommendation: treat rules as the fast tier, add normalization/provenance, calibrated statistical or model tier for ambiguous cases, and measure every release at fixed FPR budgets. See `detector-improvement-plan.md`.

### Authentication, tenant isolation, and RBAC

Current state: centralized membership and permission checks, organization/project scoping, admin guard, and project-bound API keys. Permission roles are explicit.

Gaps: broad public middleware prefixes make route-local auth correctness critical; source-pattern audit is not behavioral; application-only isolation has no database backstop; admin global access needs stronger break-glass audit semantics.

Recommendation: behavioral matrix, deny-by-default route wrapper, object ownership helpers, RLS for critical tables, and immutable admin access logs.

### RAG and vector security

Current state: upload limits, type validation, OCR/image inspection, sandbox, quarantine, trust, ACL, namespace derivation, retrieval post-filtering, retrieval audit, grounding and citation checks.

Gaps: memory vector provider can be accidentally non-durable outside production safeguards; provider-backed isolation and deletion need live tests; embeddings may leave the environment through a configurable endpoint; poison recall is not independently measured.

Recommendation: per-tenant provider credentials or enforced filters, cryptographic document provenance, egress classification before embeddings, rescan on detector version change, and RAG-specific benchmark gates.

### Agent, MCP, memory, and workflow security

Current state: strong conceptual coverage matching the shift highlighted by OWASP Agentic Top 10 and MITRE ATLAS: identity, privilege, tool misuse, memory poisoning, inter-agent messages, cascading failures, dry-run, approval, escrow, canaries, and audit.

Gaps: most controls are advisory APIs rather than an unavoidable execution boundary; tool identity/attestation and sandbox enforcement vary by integration; long-running state and race conditions need database-backed tests.

Recommendation: signed agent/tool manifests, short-lived capability tokens, mandatory pre-execution hook, postcondition verification, idempotent approvals, and containment profiles by autonomy tier.

### Browser extension

Current state: MV3, service worker, prompt/output scanning, file/clipboard/lineage controls, managed policy, enrollment, signing, rate limits, and extensive unit/privacy tests.

Gaps: `<all_urls>` content-script injection, wildcard optional host access, dynamic DOM adapters, and incomplete live store/browser evidence.

Recommendation: host-minimal architecture, explicit enablement, local redaction default, telemetry minimization, adapter contract tests, and a store-release privacy evidence pack.

### SDKs, n8n, and integrations

Current state: unusually broad developer surface with typed JS/TS, Python, WordPress, n8n and framework middleware.

Gaps: contract drift risk, uneven release automation, no compatibility matrix, and incomplete integration E2E against a deployed API.

Recommendation: generate clients/types from one OpenAPI/JSON Schema contract, add consumer contract tests, signed packages/SBOM, retry budgets, idempotency, streaming semantics, and sample workflows.

### Events, webhooks, SIEM, reports

Current state: Postgres core data, DynamoDB heavy-event abstraction, signed webhooks, dead letters/replay, SIEM workers, evidence and PDF/CSV exports.

Gaps: dual-write reconciliation and cutover proof, no event-loss SLO, unclear delivery ordering guarantees, and limited live SIEM verification.

Recommendation: outbox or durable queue boundary, per-tenant event sequence/idempotency, reconciliation dashboards, signed export manifests, and provider sandbox tests.

### Deployment, operations, and SDLC

Current state: standalone Next.js Docker image, separate workers, Postgres dependency, Redis and Qdrant Compose services, health checks, migration/build/test CI, EC2 deployment.

Gaps: no security scanning gates, no immutable digest deploy in the shown Compose path, direct app port, no encoded reverse proxy/WAF/backup/restore, and no deployment attestation.

Recommendation: deploy by digest, sign/verify images, private networks, TLS/WAF, least-privilege IAM, encrypted backups with restore drills, and staged canary rollback.

## Failure-mode policy

| Dependency/control failure | Low-risk read | Sensitive data | External write/tool action | Required behavior |
|---|---|---|---|---|
| Detector tier unavailable | Allow only if fast deterministic tier passes and policy opts in | Review/block | Block | Risk-tiered fail behavior, never a universal fail-open. |
| Policy store unavailable | Cached signed last-known-good | Cached strict policy | Block if policy stale/absent | Record policy age/version. |
| Redis unavailable | Single-node dev fallback only | 503/limited service in production | 503/block | Production already fails configuration; add runtime outage handling. |
| Event store unavailable | Continue only within bounded durable buffer | Buffer redacted event | Block high-risk irreversible action if audit is mandatory | Surface degraded mode. |
| Approval store unavailable | N/A | Hold | Block/hold | Never treat missing approval as approval. |
| Vector provider unavailable | No answer or clearly degraded answer | No retrieval | No tool action based on missing evidence | Avoid silent hallucinated fallback. |

## Audit limitations and remaining blockers

- No live production configuration, secrets, AWS account, network topology, DNS/TLS, WAF, backups, or IAM policy was inspected.
- No real Postgres/DynamoDB/Qdrant/Redis failure injection or reconciliation run was performed.
- No live SAML/SCIM/KMS/Vault/Razorpay/email/SIEM provider was exercised.
- No Chrome/Edge store package was manually reviewed in a visible browser during this pass.
- No dependency advisory, SAST, container, IaC, or external penetration scan was completed.
- Existing uncommitted user changes were preserved and must be separated from audit/P0 commits during review.

## Decision

Proceed with small P0 fixes behind tests. Do not start a unified API rewrite, schema-wide tenant refactor, detector-model replacement, or infrastructure migration until P0 assurance tasks and rollback criteria in `implementation-next-steps.md` are complete.
