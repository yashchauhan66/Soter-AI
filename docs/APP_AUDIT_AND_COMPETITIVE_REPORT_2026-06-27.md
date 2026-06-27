# SoterAI Complete App Audit and Competitive Report

**Audit date:** 2026-06-27  
**Repository version:** `package.json` 0.2.0  
**Scope:** Next.js application, 167 API route files, dashboard/admin/public UI, guard engine, agent-security modules, database schema, workers, SDKs, integrations, deployment assets, tests, documentation, and current market comparison.

## 1. Executive verdict

SoterAI is a large, technically serious AI-security platform rather than a single prompt filter. Its strongest differentiation is the combination of LLM input/output protection with agent-action governance: approvals, intent verification, tool-chain analysis, memory protection, MCP drift, context lineage, semantic egress, canaries, passports, escrow, evidence, and blast-radius analysis.

The repository is healthy at the code/build level. The audited baseline passed TypeScript, ESLint, the production Next.js build, Prisma validation, 566 existing Node tests, 74 additional attack-pack tests, 15 JavaScript SDK tests after the audit fix, 56 Python SDK tests, and n8n/Zapier builds. No failing implementation regression was left by this audit.

It is not yet honest to call every surface enterprise-production-complete. Several modules explicitly identify themselves as Preview, runtime enforcement hooks are incomplete, external benchmark validation is absent, the safe-input benchmark sample is small, and production customer/traffic claims are not supported by repository evidence. The best positioning today is:

> A self-hostable, agent-native AI security control plane with unusually broad governance primitives, currently strongest for technical pilots, security-conscious SaaS teams, Indian PII use cases, and design partners.

## 2. Audited size and inventory

| Area | Audited count | Meaning |
|---|---:|---|
| Documented product services | 33 | Six product layers: Monitor, Protect, Detect, Control, Compliance, Manage |
| Next.js pages | 149 | Public, authentication, dashboard, enterprise, and admin surfaces |
| API route files | 167 | Guard, agent, enterprise, RAG, billing, operations, SCIM/SAML, reporting, and admin APIs |
| Prisma models | 158 | Broad persistence model covering product, audit, enterprise, and operations workflows |
| Database migrations | 25 | Versioned PostgreSQL schema evolution |
| Node test files | 45 | Unit, regression, security, tenant, integration, performance, and phase tests |
| Documentation files | 268 | Product, API, operations, deployment, compliance, sales, and audit material |
| React components | 73 | Dashboard, auth, guard, onboarding, operations, docs, and marketing UI |
| TypeScript library modules | 171 | Core detection, policy, agent security, enterprise, reporting, RAG, and infrastructure code |

Counts describe repository surface area, not 167 independent customer-ready products. A route can be an internal workflow endpoint, and a page can be a Preview/admin surface.

## 3. The 33 documented product services

### Monitor (4)

1. Guard Logs: tenant-scoped decisions, filters, pagination, and safe log fields.
2. Reports: aggregate security reporting, PDF and scheduled-report support.
3. Detection Feedback: false-positive/false-negative review workflow.
4. Customer Success: product activation and account-health operations surface.

### Protect (4)

5. Agent Firewall: pre-action inspection and policy decisions.
6. Policy Engine: strict/balanced/monitor behavior, thresholds, topics, regex, allow/deny domains, and fallback messages.
7. RAG Security: document scanning, poisoning detection, quarantine/review, ACL-aware vector retrieval, and grounding checks.
8. Webhooks: signed events, rotation, delivery tracking, replay, retry/dead-letter behavior, and response redaction.

### Detect (5)

9. Shadow AI: provider/tool/model signature discovery and risk assessment.
10. Red Team Lab: authorized adversarial scenarios and OWASP mappings.
11. Forensics: incident and evidence investigation workflow.
12. Canary Network: hashed tripwire tokens, leak detection, and incident persistence.
13. Semantic Egress: exact and paraphrased confidential-data leak detection.

### Control (7)

14. Agent Passports: scoped agent identity/session tokens, validation, expiry, and revocation.
15. Transaction Escrow: approval, denial, edit-and-approve, and controlled execution.
16. Intent Guard: compare actions with original user intent and detect drift.
17. Tool Chain: stateful multi-step risk analysis across tools and data sources.
18. Dry-run Sandbox: simulate side effects before execution.
19. Memory Firewall: scan, redact, quarantine, restore, and inspect persistent agent memory.
20. MCP Drift: snapshot MCP tools and detect schema, description, capability, and risk changes.
21. Legal Boundary Guard: approvals/takeover/block rules for login, OTP, payments, legal acceptance, scraping, access controls, and regulated actions.

### Compliance (4)

22. Evidence Vault: sanitized evidence items, reports, exports, hashes, and signing workflows.
23. Context Lineage: source registration, flow checks, incidents, and cross-domain leakage controls.
24. Blast Radius: estimate the consequences of compromised tool permissions and policy changes.
25. Credential Vault: encrypted server-side credential storage with local/AWS/GCP/Vault provider abstractions.

### Manage (8)

26. Projects: tenant/project organization and switching.
27. API Keys: one-time raw keys, peppered hashes, rotation, and scoping.
28. Cost Firewall: budgets, quotas, model-cost estimation, and spike helpers.
29. Security Badges: public-safe project protection status.
30. Billing: Razorpay checkout, activation, cancellation, reactivation, lifecycle, and webhook validation.
31. Settings: account/project administration UI.
32. Audit Exports: signed JSONL/CSV export and safe manifests.
33. Onboarding: role-specific onboarding, integration guidance, and product tours.

## 4. Detection and security coverage

The core guard contains dedicated detectors for prompt injection, jailbreaks, system-prompt leakage, PII, India-specific PII, secrets, spam/malicious URLs, and unsafe outputs. Its classifier layer adds multilingual/Hinglish logic, semantic prompt-injection support, fallback rules, evaluation helpers, and red-team datasets.

Important defense-in-depth behavior verified by tests includes:

- Input and output inspection with ALLOW, rewrite/redact, review, and block decisions.
- Secret-safe public responses and persistence; raw system-prompt leaks are withheld.
- Tenant-scoped SQL and ownership checks across high-risk modules.
- RBAC across owner/admin/billing/viewer roles.
- Cookie-mutation origin enforcement plus API-key authentication where applicable.
- Rate limiting with Redis TTL repair and in-memory fallback behavior.
- SSRF-oriented outbound restrictions for webhook/integration destinations.
- One-time hashed tokens for password reset, email verification, SCIM, approvals, and passports.
- SAML/SCIM enterprise paths, data retention/deletion, SIEM exporters, and signed audit evidence.
- RAG PDF/OCR inspection, secret redaction, vector namespace isolation, and grounding-source authorization.

## 5. Architecture and operations

### Application stack

- Next.js 15.5 + React 18 + TypeScript 5.7.
- PostgreSQL through Prisma 5.22.
- Redis/Upstash for distributed rate limits and queues.
- Optional Qdrant/pgvector-style vector provider abstractions for RAG.
- NextAuth v5, credentials flow, password reset, verification, SAML, and SCIM.
- Razorpay billing.
- Docker standalone output, production Compose, Helm templates, Nginx, EC2/SSL scripts, and backup/restore documentation.

### Background processing

- Webhook delivery worker.
- SIEM export worker.
- Threat-intelligence worker.
- General background worker.
- Health and readiness endpoints with database checks.

### Integration surface

- JavaScript/TypeScript SDK.
- Python SDK.
- LangChain, LlamaIndex, and Vercel AI SDK middleware packages.
- WordPress and framework examples.
- n8n, Zapier, Make, Botpress, Dify, Flowise, Langflow, Voiceflow, and shared integration packages/directories.

Marketplace presence must not be inferred merely from a package directory. Several integrations are Preview or require provider-side publishing/validation.

## 6. Bugs and product-trust defects fixed in this audit

### FIX-01: documented SDK environment variables did not work

Public README/service snippets use `SOTERAI_API_KEY`, `SOTERAI_PROJECT_ID`, and `SOTERAI_BASE_URL`, but the JavaScript SDK only resolved `SOTER_*` and legacy names. The SDK now accepts both documented `SOTERAI_*` aliases and canonical `SOTER_*` variables. A regression test makes a real protected request through the resolved alias configuration.

### FIX-02: all 31 displayed service API references used a nonexistent `/api/v1` surface

The service catalog displayed API methods and paths that did not correspond to the implemented Next.js routes. References now point to actual `/api/...` routes and methods. Customer Success and Settings no longer claim APIs that do not exist.

A new regression test resolves every displayed service API reference to its route file and verifies that the documented HTTP method is exported. It also rejects future `/api/v1` metadata regressions.

### FIX-03: unverified copy-paste examples were customer-visible

Many legacy service-catalog snippets still describe an unreleased `/api/v1` contract or SDK methods/packages that are not covered by executable integration tests. The service pages now hide those legacy snippets and show only verified implemented-route metadata plus links to the tested REST/framework guides. The source snippets remain technical debt and can be restored one by one after executable contract tests are added.

### FIX-04: unsupported “1M+ production requests” claim

The README claimed the app had processed more than one million production requests, while repository go-to-market limitations say no live customers or production traffic are claimed. The unsupported traction statement was removed and replaced with a precise “production-oriented” description of deployment assets.

### FIX-05: unsupported `<50ms SDK latency` claim

The checked-in benchmark records HTTP latency of 891 ms p50, 1,656 ms p95, and 2,719 ms p99. It does not record a separate inline SDK measurement. README, homepage, badge, and benchmark text now use the recorded HTTP number and explicitly state benchmark limitations.

### FIX-06: internal benchmark represented as independent review

Benchmark metadata called the evaluation independent, and homepage structured data created a five-star “Independent Benchmark” review/aggregate rating. The dataset is self-authored. The false independent-review schema was removed; titles and copy now label it an internal regression benchmark.

### FIX-07: product-service count drift

The README said 32 services while the canonical catalog contains 33. It now reports 33 and warns that some are Preview.

### FIX-08: compliance wording was too strong

The README badge said “OWASP LLM Top 10 Compliant,” which suggests certification. It now says “Mapped,” matching the evidence actually present in tests and documentation.

## 7. Verification evidence from this audit

| Check | Result |
|---|---|
| TypeScript application check | Pass, zero errors |
| ESLint | Pass |
| Existing Node suite | 566/566 pass |
| Additional attack-pack regression | 74/74 pass |
| New service-catalog contract tests | 2/2 pass |
| JavaScript SDK after env fix | 15/15 pass; typecheck and build pass |
| Python SDK | 56 pass, 21 skipped optional/integration cases |
| n8n integration | TypeScript build pass |
| Zapier integration | TypeScript build/test pass |
| Prisma schema | Valid |
| Production Next.js build | Pass; 154 static pages generated by build and full route manifest completed |

The npm advisory endpoint was attempted but did not return, even with approved external registry access. Therefore this report does **not** claim a current zero-vulnerability dependency audit. CI should run `npm audit --omit=dev` or a dedicated SCA tool in a network environment with reliable registry access.

## 8. Current competitor comparison (June 2026)

This comparison uses public official product/documentation pages and repository evidence. “Better” means capability/architecture fit, not independently proven detection quality.

| Capability | SoterAI | Check Point AI Guardrails (Lakera) | Prisma AIRS | AWS Bedrock Guardrails | Azure AI Content Safety | NVIDIA NeMo / Guardrails AI |
|---|---|---|---|---|---|---|
| Prompt injection/jailbreak | Yes, rule/semantic/multilingual layers | Mature managed runtime screening | Enterprise runtime firewall/API | Managed prompt-attack filters | Prompt Shields | Programmable/validator-based |
| PII/secrets | Global + India patterns, redact/block | Managed data-leakage controls | Data leakage/masking controls | Built-in PII + regex masking/blocking | Content-safety/data features | Depends on configured rails/validators |
| Harmful text | Yes | Yes | Yes | Yes | Strong text categories | Configurable |
| Image/multimodal moderation | Limited OCR/PDF inspection; not a mature image moderation API | Vendor runtime supports broader managed research/product surface | Broader enterprise AI traffic/model surface | Text and image content filters | Strong text, image, and multimodal APIs | Extensible, configuration/model dependent |
| RAG poisoning/grounding | Poisoning scan, ACL, lineage, source checks | Reference/tool-response screening | Dataset/runtime protection | Contextual grounding checks | Strong groundedness modes/correction | Native retrieval rails |
| Agent tool/action governance | Major strength: firewall, intent, escrow, dry run, legal boundaries | Tool calls/responses/descriptions screened | Strong agent/MCP lifecycle platform | Mostly guardrail/content layer | Task adherence is available but managed/preview | Execution/dialog rails are flexible |
| Stateful chain/memory controls | Tool-chain + memory firewall | Multi-step calls can be screened | Centralized agent/session visibility | Limited compared with an agent control plane | Task-focused APIs | Dialog flows possible; custom implementation needed |
| MCP security | Scanner, drift snapshots, capability/risk changes | Agent workflow screening | Strong MCP server and enterprise agent discovery | No comparable full MCP posture product in Guardrails | Not a full MCP governance platform | Can be extended with execution rails |
| Human approval/escrow | Built-in approval and transaction escrow | Customer mitigation logic around API response | Enterprise policy/control plane | Application implements workflow | Application implements workflow | Programmable, application-owned |
| Evidence/compliance workflow | Evidence vault, signed exports, lineage, retention, SIEM | Enterprise product/reporting | Strong enterprise logs/posture/reporting | AWS-native governance integration | Azure-native governance/RBAC/CMK | Mostly toolkit-level |
| Deployment | SaaS-oriented app plus self-host Docker/Helm assets | SaaS and self-hosted product | Enterprise API/network/cloud deployments | AWS managed | Azure managed | Open-source/self-host toolkit choices |
| Cloud/vendor neutrality | Strong | Strong API product | Multi-cloud enterprise platform | AWS-centered | Azure-centered | Strong |
| Independent scale/quality proof | Not yet | Stronger vendor research/production maturity | Enterprise vendor and network-security maturity | Hyperscale managed service | Hyperscale managed service | Large ecosystems; outcome depends on configuration |

Official sources:

- Check Point documents runtime screening across prompt attacks, data leakage, content violations, malicious links, tool calls, tool responses, and tool descriptions: https://docs.lakera.ai/guard
- Palo Alto documents Prisma AIRS runtime protection across applications, agents, models, datasets, API intercepts, network deployments, discovery, posture, red teaming, and MCP: https://docs.paloaltonetworks.com/ai-runtime-security and https://www.paloaltonetworks.com/resources/datasheets/prisma-airs-ai-agent-security
- AWS documents prompt-attack filters, harmful text/image filters, denied topics, sensitive-information handling, and contextual grounding: https://docs.aws.amazon.com/bedrock/latest/userguide/guardrails-components.html
- Azure documents Prompt Shields, groundedness, protected material, task adherence, text/image moderation, custom categories, Entra ID, and customer-managed keys: https://learn.microsoft.com/en-us/azure/ai-services/content-safety/overview
- NVIDIA documents five rail types: input, dialog, output, retrieval, and execution: https://docs.nvidia.com/nemo/guardrails/0.19.0/user-guides/guardrails-process.html
- Guardrails AI documents its mix-and-match validator Hub and remote validator inference: https://guardrailsai.com/guardrails/docs/concepts/hub and https://guardrailsai.com/guardrails/docs/concepts/remote_validation_inference
- Protect AI LLM Guard documents input/output scanners such as anonymization, prompt injection, token limits, toxicity, and bias: https://protectai.github.io/llm-guard/get_started/quickstart/

## 9. Where SoterAI is better

### 9.1 Agent-native governance breadth

Most classic guardrail products focus on scanning text before and after an LLM. SoterAI models the action lifecycle: identity/passport, stated intent, tool call, multi-tool chain, sensitive data flow, approval/escrow, dry-run effects, memory writes, MCP drift, and evidence. That combination is unusually broad in one self-hostable repository.

### 9.2 India and Hinglish orientation

India-specific PII detectors, Hinglish regression cases, Razorpay, and DPDP-readiness material create a credible regional wedge that global generic guardrails often do not prioritize.

### 9.3 Auditability and evidence by design

Hashed one-time tokens, signed exports, evidence packages, sanitized logs, lineage incidents, and explicit tenant tests make the product more useful for defensible security operations than a bare classifier library.

### 9.4 Self-hosting and inspectability

Docker, Helm, database schema, workers, detector logic, SDKs, and test suites are all inspectable. This is attractive for teams that cannot send sensitive prompts to a closed managed API.

### 9.5 Human control primitives

Transaction escrow, approval queues, takeover-required decisions, and legal-boundary rules address the practical question “should the agent be allowed to do this?”, not only “does this text look unsafe?”

These are architectural advantages. They do not prove better recall, precision, latency, support, or scale than Check Point, Palo Alto, AWS, or Azure.

## 10. Where competitors are better / current gaps

### Critical before strong enterprise claims

1. **Independent evaluation:** Current F1 is a small self-authored regression benchmark. Commission a blind third-party evaluation with disjoint attacks, realistic benign traffic, multilingual strata, confidence intervals, and competitor baselines.
2. **Production enforcement integration:** Agent Firewall preview notes say runtime execution hooks are incomplete. Provide maintained adapters that make pre-tool and post-tool enforcement unavoidable in supported runtimes.
3. **Measured scale/SLO evidence:** Publish reproducible p50/p95/p99 under concurrency, cold starts, Redis/database degradation, payload-size bands, and fail-open/fail-closed modes.
4. **Enterprise assurance:** SOC 2/ISO readiness pages are not certification. Competitors have larger assurance, support, procurement, and incident-response machinery.
5. **Multimodal security:** Azure/AWS and large enterprise vendors have stronger managed image/multimodal moderation. OCR/PDF inspection is useful but not equivalent.

### High priority product gaps

6. **Verified public API contract/OpenAPI:** Generate OpenAPI from real route schemas, version it, and contract-test every public example. The legacy catalog snippets must remain hidden until this is done.
7. **AI discovery/posture depth:** Prisma AIRS and Check Point provide broader organization-wide discovery and risk posture. SoterAI Shadow AI is currently signature/helper driven and needs real cloud/SaaS/network collectors.
8. **Model and dataset security:** Prisma AIRS covers models and datasets across the lifecycle. SoterAI supply-chain/AI-BOM functionality is explicitly Preview with incomplete create/update, review, export, and interoperability workflows.
9. **Threat-intelligence operations:** Remote signed feed ingestion, staged promotion, rollback UI, and partner attestation are incomplete.
10. **Abuse controls:** CAPTCHA/device heuristics, route-wide cost enforcement, admin overrides, and organization-tuned spike alerting remain incomplete.
11. **Privacy operations:** DSR assignment/SLA/reminders, consent approval, regulator workflows, and legal review are readiness aids rather than complete compliance automation.
12. **Streaming and multimodal contract:** Add first-class streaming inspection, structured tool-call schemas, images/audio, and large-document chunk policy.

### Commercial and ecosystem gaps

13. No repository evidence of paying customers, production request volume, retention, or externally validated case studies.
14. Marketplace directories do not prove installed/published integrations; certify each listing and maintain compatibility matrices.
15. Pricing is still a hypothesis in the project’s own readiness documentation.
16. Support SLA, on-call evidence, disaster-recovery exercises, and data-residency validation need real operational proof.

## 11. Recommended roadmap

### Next 30 days

1. Keep marketing claims evidence-bound; apply the same internal-benchmark caveat to remaining launch drafts.
2. Replace hidden legacy service snippets with generated, executable examples from a versioned OpenAPI contract.
3. Add dependency SCA in CI and produce a signed SBOM; fail builds on exploitable high/critical production advisories.
4. Run authenticated Playwright flows against disposable PostgreSQL/Redis: signup, project, key, guard call, policy, webhook, approval, RAG, billing sandbox, SSO/SCIM test tenant.
5. Build a disjoint benchmark corpus with at least thousands of benign samples and blind attack mutations.

### 31–90 days

6. Ship one hardened runtime integration (for example LangGraph/OpenAI Agents/MCP proxy) that enforces every tool call and response.
7. Add organization-wide discovery collectors and an agent/MCP inventory graph.
8. Complete AI-BOM, signed threat-feed lifecycle, route-wide cost enforcement, and approval notification routing.
9. Measure scale with repeatable k6 runs and publish methodology, hardware, concurrency, error rate, and latency percentiles.
10. Obtain design partners and publish only authorized, measurable case studies.

### 3–6 months

11. Independent red-team and benchmark audit.
12. SOC 2 Type I/II program or appropriate assurance milestone, without premature badge claims.
13. Multimodal inspection and streaming guard contracts.
14. Enterprise support/on-call, regional deployment, DR restore drills, and formal SLO reporting.

## 12. Final risk statement

No finite audit can prove an application has “all bugs” fixed or is 100% secure. This audit found and fixed the reproducible implementation/documentation defects listed above and ran broad automated verification. Remaining risk is concentrated in external systems and evidence not available locally: live database/browser flows, provider marketplaces, payment sandbox behavior, email delivery, cloud KMS/Vault, SAML identity providers, production load, dependency advisory availability, and third-party adversarial evaluation.

The codebase is a strong pilot candidate. The gap between today and defensible enterprise leadership is less about adding another detector and more about validated contracts, unavoidable runtime enforcement, independent measurement, real operational evidence, and disciplined claims.
