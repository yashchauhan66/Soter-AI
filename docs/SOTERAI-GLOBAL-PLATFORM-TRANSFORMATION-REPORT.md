# SoterAI Global Platform Transformation Report

Permanent source of truth for the autonomous SoterAI platform transformation.

Last updated: 2026-07-26 20:54 IST

## 1. Initial Repository Baseline

Baseline evidence was collected before code changes in this session.

| Item | Evidence |
| --- | --- |
| Branch | `main` |
| Commit | `59714827c32c43317ac1f2ae0e72579880e3aed6` |
| Report status at session start | `docs/SOTERAI-GLOBAL-PLATFORM-TRANSFORMATION-REPORT.md` was missing |
| Approximate file inventory | `rg --files -g '!*node_modules*' -g '!*.tsbuildinfo' -g '!*.zip'` returned 6326 files |
| Worktree | Dirty before this session; many modified and untracked files existed and are treated as pre-existing user work |
| Primary stack | Next.js 15 app, React 18, TypeScript, Prisma, Node test runner, browser extension, local AI broker, VS Code extension, SDKs, integrations, ML/dataset assets |

Pre-existing modified/untracked areas included `app/`, `apps/extension/`, `apps/local-ai-broker/`, `lib/`, `packages/`, `tests/`, `datasets/`, `models/`, `notebooks/`, and several docs/reports. This report does not classify those changes as created by this session unless noted in the completed-component ledger.

## 2. Current Architecture

SoterAI is a broad monorepo with these major surfaces:

| Area | Evidence |
| --- | --- |
| Web control plane | `app/` with dashboard, admin, auth, billing, RAG, agent firewall, extension, enterprise, logs, reports, SIEM, usage governance and public marketing/docs pages |
| API surface | Large Next.js API tree under `app/api/` covering guard APIs, extension APIs, admin policy APIs, agent/MCP APIs, RAG APIs, billing, SCIM, SAML, webhooks, SIEM and support/ops |
| Data model | `prisma/schema.prisma` includes 130+ models for users, organizations, projects, policies, API keys, logs, billing, RAG, SIEM, enterprise identity, agent governance, ML evaluation, privacy and AI usage governance |
| Browser extension | `apps/extension` Manifest V3 extension with content scripts, background service worker, side panel, popup, enrollment, destination policy, file scan and response scan code |
| Local AI broker | `apps/local-ai-broker` with OpenAI/Anthropic-compatible routes and tests |
| Developer tools | `packages/vscode-extension`, `packages/ide-common`, `packages/ide-protocol` |
| SDKs and middleware | `packages/sdk`, `packages/python-sdk`, `packages/langchain-middleware`, `packages/llamaindex-middleware`, `packages/vercel-ai-sdk-middleware` |
| Integrations | `packages/integrations` and `integrations/wordpress-plugin` |
| Workers | `workers/backgroundWorker.ts`, `workers/siemWorker.ts`, `workers/threatIntelWorker.ts`, `workers/webhookWorker.ts` |
| ML/detection | `lib/classifiers`, `lib/ml`, `packages/guard-core`, `datasets/`, `models/`, `notebooks/`, `scripts/ml/` |

## 3. Complete Product and Service Inventory

Evidence level key: 1 Not present, 2 Planned, 3 Interface/API shell, 4 Partially implemented, 5 Implemented untested, 6 Unit-tested, 7 Integration-tested, 8 Runtime-verified locally, 9 Staging-verified, 10 Production-proven, 11 Independently validated.

| Product Area | Current Evidence | Evidence Level | Notes |
| --- | --- | ---: | --- |
| Unified policy and decisions | `packages/guard-core`, `packages/policy-engine`, admin AI policy routes, extension policy bundle tests | 6 | Needs cross-adapter contract audit |
| Detection/classification | Guard tests, extension scanner tests, ML docs/datasets, fresh honest benchmark artifact | 8 | Local deterministic benchmark complete; third-party benchmark/certification remains external |
| AI gateway/local broker | `apps/local-ai-broker` with tests, runtime smoke, and local latency gate | 8 | Local HTTP latency proof complete; paid-provider and staging SLO validation remain external |
| Browser protection | Manifest V3 extension, 120 passing extension tests, build passes, local service-worker runtime smoke | 8 | Store/readiness and enrollment-to-protected-prompt runtime-smoked locally; store approval and managed-device pilot remain external |
| IDE/developer protection | VS Code package typecheck passes; docs and tests exist | 5-6 | Runtime marketplace proof not rerun |
| Automation platforms | n8n/Botpress/shared integration code | 4-6 | Publication and live-platform validation unknown |
| Chatbot/app protection | SDK and guard APIs, chatbot docs/pages | 6 | End-to-end live app validation not rerun |
| Agents/MCP systems | Many agent/MCP routes and tests | 6 | Needs focused route/auth audit |
| RAG/knowledge systems | RAG models, routes, tests, shared re-scan planner and runtime smoke | 8 | Re-scan ACL/vector planning runtime-smoked locally; live external vector provider proof remains |
| Files/documents | RAG scanners, extension file scanner, PDF inspector | 6 | Binary/document parser isolation needs deeper review |
| APIs/SDKs | JS SDK builds/tests pass, OpenAPI v1 contract exists, SDK route validator passes | 8 | Local contract route and SDK version checks verified; public deployment validation remains |
| Enterprise control plane | Org/project/user/RBAC/SAML/SCIM models/routes and local route-level SSO/SCIM smoke | 8 | SCIM/SAML runtime-smoked locally; live IdP and directory validation remains external |
| SOC/SIEM | SIEM routes, webhooks, workers and tests | 6 | Live SIEM delivery not rerun |
| Platform security | Auth guards, permissions, rate limit tests | 6 | Large route surface needs continuous audit |
| Privacy/compliance | Privacy routes/docs/models, retention/deletion tests | 6 | Legal review/certification external |
| Reliability/infrastructure | Docker, workers, health/ready routes, migrations | 5-6 | Build and broad runtime smoke currently incomplete |
| Performance | Guard/broker/vscode benchmarks, extension perf tests | 6 | Fresh full benchmark not run yet |

## 4. Complete Market-Problem Inventory

Current market research used official/vendor documentation and product pages on 2026-07-26. Sources include OWASP GenAI Security Project, Chrome/Edge extension docs, Google Cloud Model Armor, Microsoft Defender for Cloud Apps, Lakera, Prompt Security, HiddenLayer, Cisco AI Defense and Palo Alto Prisma AIRS.

| Market Problem | User | Buyer | Severity | Frequency | Current Alternative | Alternative Weakness | SoterAI Current Coverage | Missing Capability | Revenue Potential | Priority |
| -------------- | ---- | ----- | -------: | --------: | ------------------- | -------------------- | ------------------------ | ------------------ | ----------------: | -------: |
| Employees leaking sensitive data into browser AI tools | Employee, security analyst | CISO, CIO | 5 | 5 | Prompt Security, Defender for Cloud Apps, browser DLP | Often split between discovery, DLP and AI-specific context | Browser extension, policy, redaction, audit | Store validation, live enrollment proof, admin UX hardening | High | 1 |
| Prompt injection against AI apps and agents | App developer, AppSec | CISO, VP Eng | 5 | 4 | Lakera Guard, Model Armor, Prisma AIRS, Cisco AI Defense | Often API/runtime focused, less unified with IDE/browser | Guard engine, SDK, broker, agent routes | Fresh benchmark, streaming/runtime proof, contracts | High | 2 |
| Shadow AI discovery and enforcement | Security team | CISO | 4 | 5 | Defender for Cloud Apps, Prompt Security | CASB may not protect prompt contents inside every workflow | Admin shadow AI, extension discovered apps | Fleet runtime evidence and reporting workflow | High | 3 |
| Secure AI-assisted development in IDE/browser coding tools | Developer | CISO, VP Eng | 4 | 5 | IDE plugins, code scanners, DLP | Often code-centric, not AI context-aware across tools | VS Code package, browser coding adapters | Package validation, marketplace proof, developer UX | High | 4 |
| Agent/MCP tool governance | Agent developer, platform team | CISO, CTO | 5 | 3 | Cisco, Prisma AIRS, emerging MCP scanners | Fast-moving ecosystem, limited standards | Agent/MCP routes, policy, passports | Runtime end-to-end MCP flow proof | High | 5 |
| RAG ingestion and retrieval poisoning | AI platform team | CISO, data owner | 5 | 4 | Model Armor, Prisma AIRS, RAG security tools | Many tools inspect prompt only, not source lineage | RAG scanners/models/routes | Parser sandbox proof, vector ACL runtime tests | Medium-High | 6 |
| Enterprise AI audit/compliance evidence | Security/compliance | CISO, compliance lead | 4 | 4 | AI governance platforms, SIEM, GRC | Evidence often fragmented | Evidence vault, audit logs, reports | Formal evidence mapping and external review | Medium | 7 |
| AI gateway provider controls/cost/rate policies | Platform engineer | CTO, FinOps | 4 | 4 | Model gateways, LiteLLM, provider controls | Security, cost and audit often separate | Local broker, guard APIs | Provider live tests, retries/fallback hardening | Medium | 8 |

## 5. Customer and Buyer Analysis

Primary users are security engineers, AppSec teams, developers using AI coding assistants, platform engineers running AI gateways/agents, and compliance operators. Economic buyers are CISOs for risk reduction, CIOs for employee AI governance, VP Engineering/CTOs for secure AI delivery, and founders/agency owners for customer-facing AI safety.

The strongest wedge is browser and developer AI governance because it touches immediate employee AI usage, produces visible policy decisions, and connects naturally to the wider control plane.

## 6. Competitor Landscape

| Category | Strong Alternatives | Evidence |
| --- | --- | --- |
| Prompt/app guardrails | Lakera Guard, Google Cloud Model Armor, Palo Alto Prisma AIRS, Cisco AI Defense | Official pages describe prompt injection, jailbreak, sensitive data leak and unsafe output protection |
| Employee/shadow AI governance | Prompt Security, Microsoft Defender for Cloud Apps, Check Point AI Security | Official pages describe employee AI, shadow AI discovery, policy and data protection |
| AI lifecycle/security platform | HiddenLayer, Protect AI/Prisma AIRS, Cisco AI Defense | Official pages describe AI asset inventory, model/app protection, red teaming and runtime defense |
| Browser/extension governance | Chrome/Edge extension platform controls, enterprise browser/DLP products | Official extension docs emphasize minimal permissions, host permissions and permission warnings |

## 7. Market-Gap Register

| Capability | SoterAI Current | Competitor Best | Customer Outcome | Gap | Required Improvement | Evidence |
| ---------- | --------------- | --------------- | ---------------- | --- | -------------------- | -------- |
| Browser AI DLP store/runtime readiness | Extension tests/build pass, validator and runtime smoke pass | Store-ready minimal-permission extension with enrollment proof | Deployable employee AI protection | Permission docs mismatch and no current runtime enrollment/protected-prompt proof at baseline | Align docs/validator; add build-backed service-worker runtime smoke | Local validator and runtime smoke complete |
| Shadow AI governance | Routes/admin pages exist | Defender/Prompt Security broad discovery | Visibility and enforcement | Live fleet evidence not rerun | Runtime journey and report proof | Not verified this session |
| AI app prompt defense | Guard SDK/tests pass, honest benchmark and gateway latency smoke complete | Lakera/Model Armor/Prisma runtime APIs | Protected apps and agents | Third-party/public benchmark and production traffic replay still external | Run local honest benchmark plus gateway latency gate; later add external corpus replay | Local benchmark/latency proof complete |
| Agent/MCP governance | Many routes/tests | Cisco/Prisma/HiddenLayer lifecycle controls | Controlled tool execution | Deeper MCP snapshot-to-policy deployment linkage still open | Focused component loop plus runtime smoke | Internally complete for ledger/scan slice |
| RAG security | Code/tests and runtime smoke present | Runtime contextual/grounding controls | Safer knowledge systems | Live parser/vector provider proof incomplete | RAG provider/runtime audit | Local re-scan smoke complete |
| SDK/API contracts | SDK routes and docs exist | Stable OpenAPI/versioned API contracts | Safer app integrations and lower enterprise adoption friction | Machine-readable contract/version negotiation absent | Add OpenAPI v1, SDK version headers, validator and docs | Local contract validation complete |
| Enterprise SSO/SCIM | SAML/SCIM routes and tests exist | Okta/Azure/Google directory-ready enterprise onboarding | Enterprise identity teams can automate user lifecycle and SSO | Route-level runtime evidence absent | Add local smoke for SCIM provisioning/deprovisioning and SAML metadata/login redirect | Local route-level smoke complete |

## 8. Component Priority Queue

Scoring uses the requested rule: Value x Urgency x Strategic Importance / Cost and Dependency Risk, normalized to 100 by judgment from current evidence.

| Rank | Component | Security Impact | Customer Pain | Revenue Impact | Strategic Importance | Cost/Risk | Score | Status |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| 1 | Browser extension marketplace/readiness controls | 5 | 5 | 5 | 5 | 2 | 96 | Internally complete with runtime smoke; externally blocked |
| 2 | Lint/build hygiene and generated artifact exclusions | 4 | 4 | 4 | 5 | 2 | 90 | Internally complete |
| 3 | Unified route auth/tenant permission audit | 5 | 4 | 5 | 5 | 4 | 88 | Active: fail-closed project lookup fixed |
| 4 | AI gateway/local broker runtime hardening | 5 | 4 | 4 | 5 | 3 | 84 | Internally complete with runtime smoke |
| 5 | Agent/MCP governance end-to-end verification | 5 | 4 | 4 | 5 | 4 | 82 | Internally complete with runtime smoke |
| 6 | RAG ingestion/retrieval security loop | 5 | 4 | 4 | 4 | 4 | 78 | Internally complete with runtime smoke |
| 7 | SDK/API contracts and OpenAPI/versioning | 4 | 4 | 4 | 4 | 3 | 75 | Internally complete with contract validation |
| 8 | Enterprise SSO/SCIM runtime evidence | 4 | 4 | 4 | 4 | 5 | 68 | Internally complete with local runtime smoke; externally constrained for live provider proof |
| 9 | Fresh guard benchmark and gateway latency proof | 4 | 4 | 4 | 4 | 3 | 72 | Internally complete with local benchmark artifact |

## 9. Active Component

Active component: Fresh honest guard benchmark and gateway latency proof.

Previous active component completed internally: browser extension marketplace/readiness controls. It had a clear failing command, high security/privacy/commercial value, low implementation risk, and supports the platform wedge of protecting employee browser-based AI usage. Chrome and Edge extension guidance emphasizes declared permissions, host access and permission warnings as security and user-trust boundaries; a permission-documentation mismatch is therefore not merely cosmetic.

Previous component completed internally: lint/build hygiene and generated artifact exclusions. `npm run lint` was a repository-wide quality gate and failed because it scanned nested worktrees, temporary runtime workspaces and generated extension/static artifacts. That blocked reliable release verification, hid real source issues among generated-code noise, and contributed to the full-build confidence gap.

Reason current component was selected: the API surface is very large and route authorization/tenant isolation is a platform-wide security primitive. Existing tests cover some routes, but the next highest-value work is to audit sensitive route families for consistent `requireProjectAccess`, `requireProjectPermission`, API-key auth, tenant scoping, validation and rate limiting.

Route auth/tenant audit remains open for deeper coverage, but one high-risk fail-closed gap was fixed and verified. AI gateway/local broker runtime hardening is now internally complete for bounded retry, buffered-safe OpenAI streaming and local runtime smoke proof. Agent/MCP governance is now internally complete for the current ledger/passport/MCP-scan slice with a repeatable runtime smoke. RAG ingestion/retrieval security is now internally complete for the re-scan ACL/vector planning slice, including local runtime smoke evidence that poisoned or stale knowledge is not silently reintroduced into retrieval context. SDK/API contracts are now internally complete for the v1 OpenAPI/SDK-alignment slice, including route-level OpenAPI serving, SDK version headers, fail-closed incompatible-version handling and a validator that compares 35 SDK endpoints against the spec. Enterprise SSO/SCIM runtime evidence is now internally complete for local route-level SCIM provisioning/deprovisioning, tenant isolation, SAML metadata and login redirect checks. Browser extension enrollment/protected-prompt runtime verification is now internally complete with a build-backed service-worker smoke; it also fixed a sender-origin precedence bug where caller-supplied message URLs could override Chrome-provided sender URLs. Fresh guard benchmark and gateway latency proof is now internally complete with a combined market-gap artifact covering 1218 single-turn cases, 10 multi-turn sessions, analyzer latency, and local broker HTTP latency. The next executable market gap is live external vector-provider proof for RAG when infrastructure credentials are available; without those credentials, the next internal-only gap is deeper parser sandbox proof.

## 10. Sub-Component Map

| Sub-component | Files |
| --- | --- |
| RAG security library | `lib/rag/security/index.ts`, `lib/rag/scanner.ts`, `lib/rag/documentSandbox.ts` |
| RAG routes | `app/api/rag/*`, `app/api/rag/chunks/acl/route.ts`, `app/api/rag/document/trust-score/route.ts` |
| RAG re-scan planning | `lib/rag/rescanPlan.ts`, `scripts/runtime-smoke-rag-rescan.ts` |
| RAG tests | `tests/rag-authorization-continuity.test.ts`, `tests/rag-rescan.test.ts`, `tests/phase4.test.ts`, `tests/phase5.test.ts` |
| SDK/API contract | `docs/api/openapi.v1.json`, `app/api/openapi/route.ts`, `lib/apiContract.ts`, `packages/sdk/src/contract.ts`, `scripts/validate-api-contract.mjs`, `tests/api-contract.test.ts` |
| Browser extension runtime evidence | `scripts/runtime-smoke-extension-browser-flow.ts`, `apps/extension/src/background/service-worker.ts`, `apps/extension/src/lib/enrollment.ts`, `apps/extension/src/lib/scanner.ts`, `apps/extension/manifest.json` |
| Guard benchmark and gateway latency evidence | `scripts/runtime-smoke-guard-market-benchmark.ts`, `scripts/guard-benchmark/market-gap-results.json`, `scripts/guard-benchmark/honest-results.json`, `lib/benchmarks/honestBenchmark.ts`, `apps/local-ai-broker/src/BrokerServer.ts` |
| Enterprise SSO/SCIM runtime evidence | `scripts/runtime-smoke-enterprise-sso-scim.ts`, `app/api/scim/v2/*`, `app/api/sso/saml/*`, `lib/enterprise/scim.ts`, `lib/enterprise/saml.ts` |
| Prior Agent/MCP evidence | `scripts/runtime-smoke-agent-mcp-governance.ts`, `tests/deep-agent-control-governance.test.ts` |
| Tests/gates | Guard market smoke, honest benchmark tests, guard latency tests, local broker tests, root typecheck |

## 11. Current Weaknesses

- `npm run lint` failed largely because ESLint scans nested `.claude` worktrees and generated JupyterLab static artifacts.
- `npm run build` initially timed out after 304 seconds; rerun with a longer timeout passed in 438.51 seconds.
- `getCurrentProjectById(projectId)` previously caught explicit project access failures and silently fell back to the user's default project. This could convert an unauthorized or stale project request into a successful operation on another project instead of failing closed.
- Local AI broker provider routing had no bounded retry path for transient provider 429/5xx/network/parse failures. A single upstream blip could fail the protected AI workflow even when an immediate retry would recover.
- Local AI broker rejected OpenAI-compatible `stream: true` requests with `streaming_not_supported`, blocking chat apps and SDK clients that require SSE-style streaming responses.
- Local AI broker fixes had no runnable end-to-end smoke that stood up a broker plus a real local HTTP provider and proved retry, scan and buffered SSE behavior outside unit-test internals.
- Agent action ledger accepted caller-supplied `sessionId`, `agentIdentityId` and `passportId` without validating the session passport before inserting lineage. This allowed action records to be written without binding them to a valid passport authorization result.
- Agent policy API loaded policy by caller-provided `organizationId` using device-agent auth and did not enforce the dashboard governance permission expected by the policy-management surface.
- Agent/MCP governance lacked a repeatable runtime smoke proving unauthorized ledger writes block before persistence, validated passports bind ledger lineage, and MCP scan results persist tool inventory evidence.
- RAG document re-scan previously recreated chunks with broad default roles and did not refresh vector embeddings. That could silently widen chunk access after a detector update and leave stale indexed vectors retrievable after a document became quarantined.
- Legacy `lib/rag/vectorAccess.ts` treated missing `allowedRoles` as public access, while the newer authorization continuity path correctly fails closed.
- RAG ingestion/retrieval security still needs deeper parser sandbox and live external vector-provider proof beyond this local re-scan/ACL runtime-smoke slice.
- API docs previously had stale request/response examples and no machine-readable contract tied to SDK routes, increasing integration drift risk.
- SDK requests previously did not advertise a supported API contract version and did not fail closed when a server explicitly returned an incompatible API version.
- SDK transient HTTP 5xx retry behavior was expected by tests but not actually implemented for HTTP responses.
- Enterprise SSO/SCIM had unit and source-level coverage but lacked a repeatable route-level runtime smoke proving SCIM bearer auth, provisioning/deprovisioning, tenant isolation, SAML metadata and SAML login redirect behavior together.
- Enterprise SSO/SCIM still needs live Okta/Azure AD/Google Workspace provider validation before marketplace claims can say production directory integrations are proven.
- Browser extension had tests and builds but no single build-backed runtime smoke proving self-service enrollment, policy sync, destination activation, blocked protected prompt, privacy-safe backend payloads, lineage audit and heartbeat together through the service-worker message path.
- Browser extension content-script trust previously preferred the caller-supplied message URL over Chrome's sender URL for tab messages. A spoofed content script message from an untrusted page could claim a trusted AI URL and reach the scan path.
- Guard accuracy/performance claims previously depended on scattered benchmark scripts and tests. There was no single gate tying honest classifier metrics, multi-turn adaptive detection and local gateway latency into a repeatable artifact.
- Guard benchmark evidence remains local and deterministic; it does not replace third-party corpora, external red-team certification, production-traffic replay or paid-provider latency measurement.

## 12. Improvements Implemented

- Added the permanent transformation report at `docs/SOTERAI-GLOBAL-PLATFORM-TRANSFORMATION-REPORT.md`.
- Updated `docs/extension-store/permission-justification.md` to document `https://soterai.in/*`, remove the stale optional broad-host claim, and state that optional host permissions are not requested.
- Updated Chrome and Edge store listing docs to document every declared host permission with a purpose.
- Updated `docs/extension-store/reviewer-notes.md` to remove stale broad-host and clipboard-permission claims.
- Expanded `scripts/validate-manifest-permissions.js` to include reviewer notes and fail if store docs mention broad host permissions or clipboard permissions that the manifest does not request.
- Updated `eslint.config.mjs` to ignore nested agent worktrees, temporary runtime workspaces, generated distributions and packaged JupyterLab artifacts.
- Updated `lib/auth.ts` so explicit `getCurrentProjectById(projectId)` calls delegate to `requireProjectAccess(projectId)` and fail closed instead of falling back to another project.
- Added a regression test in `tests/tenant-authorization-guards.test.ts` to prevent reintroducing catch-and-fallback behavior for explicit project lookups.
- Added bounded provider retries to `apps/local-ai-broker/src/BrokerServer.ts` via `providerRetryAttempts`, capped by an internal maximum. The broker retries transient provider `429` and `5xx` statuses plus network/invalid-JSON provider errors, but still fails closed for unsafe provider URLs, oversized provider responses and other local policy errors.
- Added broker regression tests proving a transient provider `503` can recover and that the broker does not exceed the configured retry budget.
- Added OpenAI-compatible buffered-safe SSE support for `stream: true` requests in `apps/local-ai-broker/src/BrokerServer.ts`. The broker scans the request, forwards a non-streamed provider call, scans the complete provider output, and only then emits SSE chunks with `x-soterai-streaming-mode: buffered_scan`.
- Added broker regression tests proving streamed-safe output is returned as `text/event-stream`, provider forwarding disables raw provider streaming for scanability, and unsafe provider output is blocked before any SSE is emitted.
- Added `scripts/runtime-smoke-local-ai-broker.ts` and `npm run smoke:broker` to stand up a local mock OpenAI-compatible provider, start the broker on an ephemeral port, prove public health, prove transient provider retry, prove scanned non-streamed completion, and prove buffered OpenAI-compatible SSE emission.
- Updated `app/api/agent/action/ledger/route.ts` so ledger writes require a `sessionId`, validate the raw `passportToken` through `checkAgentPassportForAction`, block non-`ALLOW` passport decisions before insert, and persist the server-resolved `sessionId`, `agentIdentityId` and `passportId`.
- Updated `app/api/agent/policy/route.ts` so the governance policy route requires `projectId`, enforces `requireProjectPermission(projectId, "policy:manage")`, and loads policy only for the authenticated project's organization.
- Added Agent/MCP governance regressions in `tests/deep-agent-control-governance.test.ts` to keep ledger inserts behind passport authorization and prevent client-supplied lineage IDs from being stored.
- Added `scripts/runtime-smoke-agent-mcp-governance.ts` and `npm run smoke:agent-mcp` to exercise real route handlers with mocked persistence: missing passport token blocks before ledger insert, valid passport writes server-bound lineage IDs, MCP scan persists tool inventory evidence, and critical command/secret tool metadata is blocked.
- Updated `app/api/rag/documents/[id]/rescan/route.ts` so re-scan preserves previous chunk ACL, source URL, sensitivity label and authorization metadata per chunk index. New chunks without prior ACL fall back to security-review-only roles and `RESTRICTED` sensitivity.
- Updated RAG re-scan vector behavior so previously indexed documents delete stale embeddings before DB mutation and reindex fresh chunks only if the document remains `INDEXED`; quarantined re-scans remove vectors instead of leaving stale retrieval paths.
- Added `lib/rag/rescanPlan.ts` as the shared production planner for re-scan status, vector synchronization decisions and chunk ACL/source/sensitivity/authorization continuity.
- Updated `lib/rag/vectorAccess.ts` so legacy retrieval post-filtering denies chunks with missing or empty `allowedRoles` instead of treating them as public.
- Added RAG regression tests covering missing-ACL denial, re-scan ACL preservation, restricted fallback for new chunks, and vector delete/reindex behavior.
- Added `scripts/runtime-smoke-rag-rescan.ts` and `npm run smoke:rag-rescan` to prove safe indexed re-scans preserve ACL metadata and reindex fresh vectors, unsafe indexed re-scans delete stale vectors without reindexing, new chunks fall back to security review, and legacy vector retrieval denies missing ACL/quarantined chunks.
- Added `lib/apiContract.ts` and `packages/sdk/src/contract.ts` to define the shared v1 API contract and SDK integration metadata.
- Updated `jsonResponse` so JSON API responses include `X-SoterAI-API-Version: v1` and `X-SoterAI-Contract-Version: 2026-07-26`.
- Added public `GET /api/openapi` serving `docs/api/openapi.v1.json`, covering 35 SDK-routed endpoints across guard, agent, RAG, lineage, memory, MCP and compliance surfaces.
- Updated the JS SDK to send `Accept`, `X-SoterAI-API-Version`, `X-SoterAI-SDK`, `X-SoterAI-SDK-Version` and current `User-Agent` headers.
- Updated the JS SDK to fail closed with `api_version_unsupported` if a server explicitly returns an incompatible `X-SoterAI-API-Version`.
- Fixed SDK transient HTTP `5xx` retry handling so configured retries apply to retryable server responses as well as network failures.
- Added `scripts/validate-api-contract.mjs` and `npm run validate:api-contract` to compare SDK route calls against the OpenAPI contract.
- Added API contract regression tests and refreshed API docs/SDK README with current request fields, version headers and OpenAPI location.
- Added `scripts/runtime-smoke-enterprise-sso-scim.ts` and `npm run smoke:enterprise-sso-scim` to exercise real SCIM and SAML route handlers with mocked Prisma persistence.
- The enterprise smoke proves public SCIM ServiceProviderConfig shape, SCIM bearer-token failure envelopes, user create/list/deprovision audit flow, cross-organization lookup denial, SAML SP metadata XML, and SAML login redirect with sanitized RelayState.
- Updated `apps/extension/src/background/service-worker.ts` so content-script sender validation uses Chrome-provided `sender.url` before any caller-supplied message URL.
- Added `scripts/runtime-smoke-extension-browser-flow.ts` and `npm run smoke:extension-runtime` to build the extension and run a Chrome API shim over the real background service worker.
- The extension smoke proves built manifest references exist, self-service enrollment stores organization/device state, policy sync and heartbeat run with the device token, ChatGPT destination context activates, spoofed untrusted senders are rejected, protected prompts are blocked/redacted, and audit/scan/lineage backend payloads do not contain the raw API key prompt.
- Added `scripts/runtime-smoke-guard-market-benchmark.ts` and `npm run smoke:guard-market` to run the honest guard benchmark, multi-turn benchmark and local broker HTTP latency checks behind one repeatable gate.
- Added `scripts/guard-benchmark/market-gap-results.json` as the generated market-gap evidence artifact. Current local result: 1218 single-turn cases, ROC-AUC 0.9974, Recall@1%FPR 1.0000, production precision 0.9231, production FPR 0.0081, analyzer p95 8.051ms, analyzer p99 16.891ms, multi-turn recall 1.0000, multi-turn FPR 0.0000, broker `/v1/scan` p95 12.007ms.
- Refreshed `scripts/guard-benchmark/honest-results.json` with `npm run benchmark:honest`.

## 13. Security and Privacy Findings

| Finding | Severity | Evidence | Status |
| --- | --- | --- | --- |
| Extension store docs and manifest disagree on host permissions | High | Failing permission validator | Fixed internally |
| Extension docs mention broad optional `*://*/*` not in manifest | High | `permission-justification.md`, `reviewer-notes.md` | Fixed internally |
| Lint scans generated/nested artifacts | Medium | `npm run lint` 113 errors, most under `.claude` and generated extension assets | Fixed internally |
| Explicit project lookup used unsafe fallback | High | `lib/auth.ts` caught `requireProjectAccess(projectId)` failures and returned `getCurrentProject()` | Fixed internally |
| Broker lacked bounded provider retry recovery | Medium-High | `forwardProvider` made one provider call and immediately returned/failed on transient upstream failures | Fixed internally |
| Broker rejected OpenAI-compatible streaming clients | Medium-High | `proxyOpenAI` returned `streaming_not_supported` for `stream: true` | Fixed internally with buffered-safe SSE |
| Broker runtime behavior lacked end-to-end smoke proof | Medium | Previous evidence was unit-test focused and did not start broker plus provider over real HTTP | Fixed internally with `smoke:broker` |
| Agent action ledger did not bind lineage to validated passport authorization | High | `app/api/agent/action/ledger/route.ts` inserted caller-supplied passport identifiers without `checkAgentPassportForAction` | Fixed internally |
| Agent policy route missed `policy:manage` guard | High | Focused governance suite failed `DEEP-SEC-005` before route fix | Fixed internally |
| Agent/MCP lacked runtime proof for ledger and scan paths | Medium-High | No repeatable smoke for route-level ledger blocking, passport-bound lineage and MCP scan persistence | Fixed internally with `smoke:agent-mcp` |
| RAG re-scan widened chunk ACL and left stale vectors | High | `rescan` recreated chunks with all roles and did not delete/reindex vector embeddings | Fixed internally |
| Legacy vector access failed open on missing chunk ACL | High | `filterByRole` allowed chunks with empty/missing `allowedRoles` | Fixed internally |
| SDK/API contract drift risk | Medium-High | SDK routes were not backed by a machine-readable OpenAPI contract and docs used stale request fields | Fixed internally |
| SDK incompatible API version handling absent | Medium | SDK did not check server-declared `X-SoterAI-API-Version` | Fixed internally |
| SDK configured HTTP 5xx retry not effective | Medium | `fetchWithNetworkRetry` retried thrown network errors but returned 5xx responses directly | Fixed internally |
| Enterprise SSO/SCIM runtime proof absent | Medium-High | SAML/SCIM routes existed, but no repeatable route-level smoke tied bearer auth, tenant scope, audit and redirect behavior together | Fixed internally with `smoke:enterprise-sso-scim` |
| Extension content-script sender origin could be spoofed through message URL | High | Runtime smoke showed an `evil.example` sender could reach scan handling when the message body claimed `https://chatgpt.com/` | Fixed internally by trusting `sender.url` first |
| Browser extension enrollment-to-protected-prompt runtime proof absent | Medium-High | Existing tests covered parts of the flow, but no command exercised build output plus service-worker enrollment, policy, scan, audit and heartbeat together | Fixed internally with `smoke:extension-runtime` |
| Guard market benchmark evidence fragmented | Medium-High | Honest benchmark, latency tests and broker benchmarks existed separately, but no single pass/fail artifact combined quality and gateway latency evidence | Fixed internally with `smoke:guard-market` |

## 14. UI and UX Findings

No UI changes in the active component yet. Store-review UX is documentation and permission transparency rather than in-app interface.

## 15. Tests and Commands Executed

| Command | Working Directory | Date | Duration | Exit | Result | Limitations |
| --- | --- | --- | ---: | ---: | --- | --- |
| `git branch --show-current` | repo root | 2026-07-26 | <1s | 0 | `main` | None |
| `git rev-parse HEAD` | repo root | 2026-07-26 | <1s | 0 | `59714827c32c43317ac1f2ae0e72579880e3aed6` | None |
| `git status --short` | repo root | 2026-07-26 | 1.3s | 0 | Dirty worktree before session | Large output |
| `npm run typecheck` | repo root | 2026-07-26 | 51.68s | 0 | Root TypeScript passed | No runtime proof |
| `npx prisma validate` | repo root | 2026-07-26 | 16.04s | 0 | Prisma schema valid | Does not apply migrations |
| `npm --prefix packages/sdk run typecheck` | repo root | 2026-07-26 | 14.19s | 0 | SDK typecheck passed | No package publish proof |
| `npm --prefix apps/extension run typecheck` | repo root | 2026-07-26 | 15.15s | 0 | Extension typecheck passed | No browser runtime proof |
| `npm --prefix packages/vscode-extension run typecheck` | repo root | 2026-07-26 | 14.57s | 0 | VS Code extension typecheck passed | No VSIX runtime proof |
| `npm run test:sdk:js` | repo root | 2026-07-26 | 19.79s | 0 | 18/18 SDK tests passed | Uses local tests |
| `npm run test:extension` | repo root | 2026-07-26 | 11.85s | 0 | 120/120 extension tests passed | Local tests, not live store review |
| `npm run validate:extension-permissions` | repo root | 2026-07-26 | 2.74s | 1 | Failed: `https://soterai.in/*` undocumented | Active fix target |
| `npm run build:extension` | repo root | 2026-07-26 | 29.85s | 0 | Extension build passed | Vite warnings only |
| `npm run build:sdk:js` | repo root | 2026-07-26 | 14.03s | 0 | JS SDK build passed | None |
| `npm run test:otp` | repo root | 2026-07-26 | 6.32s | 0 | 35/35 auth/API audit tests passed | Focused suite |
| `npm run lint` | repo root | 2026-07-26 | 177.26s | 1 | 299 problems, 113 errors | Many errors from generated/nested worktree files |
| `npm run build` | repo root | 2026-07-26 | 304s | 124 | Timed out | No output captured; not evidence of pass |
| `npm run validate:extension-permissions` | repo root | 2026-07-26 | 1.72s | 0 | Passed after docs/validator fix | Store approval still external |
| `npm run test:extension` | repo root | 2026-07-26 | 10.42s | 0 | 120/120 extension tests passed after fix | Local tests |
| `npm run build:extension` | repo root | 2026-07-26 | 25.46s | 0 | Extension build passed after fix | Vite warnings only |
| `npm run lint` | repo root | 2026-07-26 | 124.16s | 0 | Passed after generated-artifact ignore updates; 92 warnings remain | Warnings are not blocking but should be reduced |
| `npm run build` | repo root | 2026-07-26 | 438.51s | 0 | Next build passed; compiled successfully and generated 194 static pages | Long runtime and warnings remain |
| `npm run test:otp` | repo root | 2026-07-26 | 4.92s | 0 | 35/35 auth/API audit tests passed after project lookup fix | Focused suite |
| `npx tsx --test tests/tenant-authorization-guards.test.ts tests/api-route-audit.test.ts` | repo root | 2026-07-26 | 6.63s | 0 | 13/13 focused auth/route tests passed | Static regression, not live multi-tenant runtime |
| `npm run typecheck` | repo root | 2026-07-26 | 43.55s | 0 | Root TypeScript passed after project lookup fix | No runtime proof |
| `npx tsx --test apps/local-ai-broker/src/__tests__/broker.test.ts` | repo root | 2026-07-26 | 6.11s | 0 | 23/23 broker tests passed after bounded retry fix | Mock provider tests, not live provider proof |
| `npm run typecheck` | repo root | 2026-07-26 | 17.92s | 0 | Root TypeScript passed after broker retry fix | No runtime proof |
| `npm --prefix apps/local-ai-broker run typecheck` | repo root | 2026-07-26 | 5.91s | 0 | Broker package typecheck passed | None |
| `npm --prefix apps/local-ai-broker run build` | repo root | 2026-07-26 | 6.38s | 0 | Broker package build passed | None |
| `npx tsx --test apps/local-ai-broker/src/__tests__/broker.test.ts` | repo root | 2026-07-26 | 9.99s | 0 | 25/25 broker tests passed after buffered SSE streaming fix | Mock provider tests, not live provider proof |
| `npm --prefix apps/local-ai-broker run typecheck` | repo root | 2026-07-26 | 9.00s | 0 | Broker package typecheck passed after streaming fix | None |
| `npm --prefix apps/local-ai-broker run build` | repo root | 2026-07-26 | 9.41s | 0 | Broker package build passed after streaming fix | None |
| `npm run typecheck` | repo root | 2026-07-26 | 19.29s | 0 | Root TypeScript passed after streaming fix | No runtime proof |
| `npm run smoke:broker` | repo root | 2026-07-26 | 3.2s | 0 | Broker runtime smoke passed: health, real HTTP mock provider retry, non-streamed scan path and buffered SSE | Uses local synthetic provider, not an external paid model |
| `npm --prefix apps/local-ai-broker run typecheck` | repo root | 2026-07-26 | 6.6s | 0 | Broker package typecheck passed after runtime smoke script | None |
| `npm run typecheck` | repo root | 2026-07-26 | 68.5s | 0 | Root TypeScript passed after runtime smoke script | No full build rerun after smoke script |
| `npx tsx --test tests/deep-agent-control-governance.test.ts tests/agent-passport.test.ts tests/agent-market-gap-features.test.ts` | repo root | 2026-07-26 | 7.3s | 1 | Initial Agent/MCP focused suite failed `DEEP-SEC-005`: agent policy route lacked expected `policy:manage` guard | Used as fix signal |
| `npx tsx --test tests/deep-agent-control-governance.test.ts tests/agent-passport.test.ts tests/agent-market-gap-features.test.ts` | repo root | 2026-07-26 | 7.3s | 0 | 121/121 Agent/MCP focused tests passed after ledger binding and policy guard fixes | Static/source-heavy governance suite |
| `npm run typecheck` | repo root | 2026-07-26 | 27.3s | 0 | Root TypeScript passed after Agent/MCP fixes | No full build rerun after Agent/MCP fixes |
| `npx tsx --test tests/api-route-audit.test.ts tests/tenant-authorization-guards.test.ts` | repo root | 2026-07-26 | 4.4s | 0 | 13/13 route auth and tenant guard tests passed after Agent/MCP fixes | Static/focused route audit |
| `npm run smoke:agent-mcp` | repo root | 2026-07-26 | 12.4s | 0 | Agent/MCP runtime smoke passed: unauthorized ledger write blocked before insert, valid passport-bound ledger write recorded, MCP scanner persisted inventory and blocked critical command/secret metadata | Uses mocked Prisma persistence, not a live database |
| `npx tsx --test tests/deep-agent-control-governance.test.ts tests/agent-passport.test.ts tests/agent-market-gap-features.test.ts` | repo root | 2026-07-26 | 12.7s | 0 | 121/121 focused Agent/MCP tests passed after runtime smoke addition | Static/source-heavy governance suite |
| `npx tsx --test tests/api-route-audit.test.ts tests/tenant-authorization-guards.test.ts` | repo root | 2026-07-26 | 14.7s | 0 | 13/13 route auth and tenant guard tests passed after runtime smoke addition | Static/focused route audit |
| `npm run typecheck` | repo root | 2026-07-26 | 40.0s | 0 | Root TypeScript passed after Agent/MCP runtime smoke addition | No full build rerun after smoke script |
| `npx tsx --test tests/rag-rescan.test.ts tests/rag-authorization-continuity.test.ts tests/phase4.test.ts tests/phase5.test.ts` | repo root | 2026-07-26 | 23.3s | 0 | 50/50 focused RAG tests passed after re-scan ACL/vector fixes | Includes source-level route regression, not live DB/vector runtime |
| `npm run typecheck` | repo root | 2026-07-26 | 57.3s | 0 | Root TypeScript passed after RAG fixes | No full build rerun after RAG fixes |
| `npx tsx --test tests/api-route-audit.test.ts tests/tenant-authorization-guards.test.ts` | repo root | 2026-07-26 | 7.8s | 0 | 13/13 route auth and tenant guard tests passed after RAG fixes | Static/focused route audit |
| `npm run smoke:rag-rescan` | repo root | 2026-07-26 | 6.5s | 0 | RAG runtime smoke passed: safe indexed re-scan preserves ACL/source/sensitivity/authorization and reindexes fresh vectors; unsafe indexed re-scan deletes stale vectors without reindexing; new chunks are restricted; missing ACL/quarantined chunks are denied | Uses actual scanner and shared planner locally; does not connect to a live database or external vector provider |
| `npx tsx --test tests/rag-rescan.test.ts tests/rag-authorization-continuity.test.ts tests/phase4.test.ts tests/phase5.test.ts` | repo root | 2026-07-26 | 11.0s | 0 | 50/50 focused RAG tests passed after shared planner and smoke addition | Local/focused tests |
| `npm run typecheck` | repo root | 2026-07-26 | 37.3s | 0 | Root TypeScript passed after shared RAG planner and smoke addition | No full build rerun |
| `npx tsx --test tests/api-route-audit.test.ts tests/tenant-authorization-guards.test.ts` | repo root | 2026-07-26 | 8.8s | 0 | 13/13 route auth and tenant guard tests passed after shared RAG planner and smoke addition | Static/focused route audit |
| `npm run validate:api-contract` | repo root | 2026-07-26 | 3.3s | 0 | OpenAPI v1 contract validated against 35 SDK-routed endpoints; SDK/server/spec versions match | Local source/spec validation only |
| `npx tsx --test tests/api-contract.test.ts packages/sdk/tests/client.test.ts tests/integration-ease.test.ts` | repo root | 2026-07-26 | 19.5s | 0 | 57/57 API contract, SDK client and integration-doc tests passed | Local/focused tests |
| `npm --prefix packages/sdk run typecheck` | repo root | 2026-07-26 | 14.2s | 0 | SDK TypeScript passed after contract constants and header/version checks | None |
| `npm --prefix packages/sdk run build` | repo root | 2026-07-26 | 15.8s | 0 | SDK build passed after contract exports | None |
| `npm --prefix packages/sdk test` | repo root | 2026-07-26 | 16.6s | 0 | SDK package build and 18/18 packaged JS tests passed | Package publish not performed |
| `npm run typecheck` | repo root | 2026-07-26 | 52.9s | 0 | Root TypeScript passed after OpenAPI route and JSON import | No full Next build rerun |
| `npx tsx --test tests/api-route-audit.test.ts tests/tenant-authorization-guards.test.ts` | repo root | 2026-07-26 | 7.2s | 0 | 13/13 route auth and tenant guard tests passed after classifying `/api/openapi` as intentional public read-only route | Static/focused route audit |
| `npm run smoke:enterprise-sso-scim` | repo root | 2026-07-26 | 6.8s | 0 | Enterprise SSO/SCIM runtime smoke passed: SCIM config shape, bearer auth failure, user create/list/deprovision audit flow, cross-org 404, SAML metadata and sanitized login redirect | Uses mocked Prisma persistence and synthetic IdP settings, not live Okta/Azure/Google provider validation |
| `npx tsx --test tests/phase5.test.ts tests/phase6.test.ts tests/api-route-audit.test.ts tests/tenant-authorization-guards.test.ts` | repo root | 2026-07-26 | 12.7s | 0 | 51/51 focused enterprise, route audit and tenant guard tests passed after SSO/SCIM smoke addition | Local/focused tests |
| `npm run typecheck` | repo root | 2026-07-26 | 26.6s | 0 | Root TypeScript passed after Enterprise SSO/SCIM runtime smoke addition | No full Next build rerun |
| `npm run smoke:extension-runtime` | repo root | 2026-07-26 | 26.4s | 1 | Initial extension runtime smoke failed because a spoofed `evil.example` sender was accepted when message body claimed ChatGPT URL | Used as fix signal |
| `npm run smoke:extension-runtime` | repo root | 2026-07-26 | 38.6s | 0 | Extension runtime smoke passed after sender-origin fix: build, service worker handlers, enrollment, policy sync, destination activation, spoofed sender rejection, blocked/redacted protected prompt, privacy-safe audit/scan/lineage calls and heartbeat | Uses Chrome API shim and mocked backend endpoints, not a real browser profile or store-installed extension |
| `npm run test:extension` | repo root | 2026-07-26 | 14.0s | 0 | 120/120 extension tests passed after sender-origin fix and runtime smoke addition | Local test suite |
| `npm run typecheck:extension` | repo root | 2026-07-26 | 21.8s | 0 | Extension TypeScript passed after sender-origin fix and smoke script addition | None |
| `npm run typecheck` | repo root | 2026-07-26 | 36.5s | 0 | Root TypeScript passed after extension runtime smoke addition | No full Next build rerun |
| `npm run validate:extension-permissions` | repo root | 2026-07-26 | 2.3s | 0 | Manifest permissions and store docs still match after extension runtime work | Store approval still external |
| `npm run smoke:guard-market` | repo root | 2026-07-26 | 13.8s | 0 | Guard market smoke passed: 1218-case honest benchmark, ROC-AUC 0.9974, Recall@1%FPR 1.0000, production precision 0.9231, production FPR 0.0081, analyzer p95 8.051ms/p99 16.891ms, multi-turn recall 1.0000/FPR 0.0000, broker `/v1/scan` p95 12.007ms | Local deterministic classifier and local broker HTTP only; not third-party certification or production traffic replay |
| `npx tsx --test tests/benchmarks/honest-benchmark.test.ts tests/guard/latency.test.ts apps/local-ai-broker/src/__tests__/broker.test.ts` | repo root | 2026-07-26 | 32.2s | 0 | 34/34 benchmark, guard latency and local broker tests passed | Local/focused tests |
| `npm run typecheck` | repo root | 2026-07-26 | 28.2s | 0 | Root TypeScript passed after guard market benchmark script and artifact | No full Next build rerun |
| `npm run benchmark:honest` | repo root | 2026-07-26 | 10.7s | 0 | Refreshed honest benchmark artifact: 1218 cases, ROC-AUC 0.9974, Recall@1%FPR 100.00%, production FPR 0.81%, analyzer p50 4.44ms/p95 9.24ms/p99 27.32ms | Local deterministic benchmark only |

## 16. Runtime Verification

Broker runtime verification was performed with `npm run smoke:broker`. The script starts a real local HTTP mock provider and a real broker process, then verifies public health, a transient `503` provider retry, scanned non-streamed completion, and buffered OpenAI-compatible SSE with `x-soterai-streaming-mode: buffered_scan`.

Agent/MCP runtime verification was performed with `npm run smoke:agent-mcp`. The smoke uses the real Next route handlers with mocked Prisma persistence to prove missing passport token blocks before `AgentActionLedger` insert, a valid passport writes server-resolved lineage IDs instead of caller-supplied spoofed IDs, MCP tool scan persists inventory evidence, file-read tools require approval, and terminal/secret-capable MCP metadata is blocked as critical.

RAG runtime verification was performed with `npm run smoke:rag-rescan`. The smoke runs the actual RAG scanner, shared production re-scan planner and legacy vector post-filter to prove safe indexed re-scans preserve ACL/source/sensitivity/authorization metadata and reindex fresh vectors, unsafe indexed re-scans delete stale vectors without reindexing, new chunks fall back to restricted security-review roles, and missing-ACL or quarantined chunks are denied from retrieval. A live database/external vector-provider run was not performed in this slice.

SDK/API contract verification was performed with `npm run validate:api-contract` and `tests/api-contract.test.ts`. The validator parsed the SDK source, found 35 SDK-routed endpoints, and confirmed every route has a matching OpenAPI v1 operation. The route test executed `GET /api/openapi` locally and verified the returned spec plus no-store/version headers. SDK client tests verified v1 request headers, compatible-version acceptance, incompatible-version fail-closed behavior, and transient HTTP 5xx retry recovery.

Enterprise SSO/SCIM runtime verification was performed with `npm run smoke:enterprise-sso-scim`. The smoke executes the real SCIM and SAML route handlers with mocked Prisma persistence to prove SCIM ServiceProviderConfig shape, authenticated provisioning/listing/deprovisioning with redacted audit metadata, cross-organization lookup denial, SAML SP metadata XML and SAML login redirect construction with malicious external RelayState sanitized back to `/dashboard`. Live IdP/directory validation remains external.

Browser extension runtime verification was performed with `npm run smoke:extension-runtime`. The command builds the current extension and then executes the real background service worker inside a Chrome API shim. It proves manifest-referenced build files exist, self-service enrollment stores device state and syncs policy, heartbeat uses the enrolled device token, ChatGPT destination context activates for the enrolled employee, an untrusted sender from `evil.example` is rejected even if its message body claims a ChatGPT URL, and a protected prompt containing an API key is blocked/redacted while audit, scan and lineage backend payloads avoid the raw secret. Real managed-browser deployment and Chrome/Edge store-installed runtime remain external.

Guard benchmark and gateway runtime verification was performed with `npm run smoke:guard-market`. The smoke runs the production `analyzeText` benchmark over 1218 labeled local cases, runs the multi-turn Crescendo benchmark over 10 sessions, starts a real local `BrokerServer`, and measures `/health`, `/v1/scan`, `/v1/decision` and `/v1/redact` over HTTP using a 10KB payload. It writes `scripts/guard-benchmark/market-gap-results.json` with quality gates, latency gates, exact metrics and limitations.

## 17. Performance Evidence

Current session evidence: extension test suite includes local performance assertions for prompt scan and policy evaluation and passed. Guard market benchmark evidence now includes analyzer p95 8.051ms/p99 16.891ms from `smoke:guard-market`, refreshed honest benchmark analyzer p50 4.44ms/p95 9.24ms/p99 27.32ms from `benchmark:honest`, and local broker `/v1/scan` p95 12.007ms for a 10KB payload.

## 18. Before-Versus-After Metrics

| Metric | Before | After |
| --- | ---: | ---: |
| Extension permission validator | Failed | Pass |
| Extension tests | 120/120 pass | 120/120 pass |
| Extension build | Pass | Pass |
| Root lint | Failed: 113 errors | Pass with 92 warnings |
| Root build | Timed out at 304s | Pass in 438.51s |
| Root typecheck | Pass | Pass |
| Explicit unauthorized project lookup behavior | Fallback to default project | Fail closed through `requireProjectAccess` |
| Broker transient provider recovery | No retry | Bounded retry configurable up to capped maximum |
| OpenAI-compatible broker streaming | Rejected `stream: true` | Buffered-safe SSE with output scan before release |
| RAG re-scan ACL behavior | Recreated chunks with broad default roles | Preserves prior ACL; new unbound chunks are restricted |
| RAG re-scan vector behavior | Could leave stale indexed embeddings | Deletes old vectors and reindexes only if still indexed |
| Legacy vector missing ACL behavior | Missing roles allowed retrieval | Missing/empty roles deny retrieval |
| Enterprise SSO/SCIM route-level proof | Unit/source-level evidence only | Local runtime smoke exercises real SCIM/SAML handlers |
| Extension content-script sender trust | Message URL could override sender URL | Chrome-provided sender URL is trusted first |
| Extension runtime enrollment/protected prompt proof | Separate tests/build only | Build-backed service-worker smoke proves enrollment, policy, scan, audit and heartbeat |
| Guard benchmark evidence | Fragmented tests/scripts, no single market-gap artifact | `smoke:guard-market` produces quality and latency gate artifact |
| Guard honest benchmark | Not refreshed in latest gap cycle | `honest-results.json` refreshed with 1218-case benchmark |

## 19. Commercial Impact

Passing store/permission gates reduces friction for private Chrome and hidden Edge distribution, improves buyer trust, and supports the browser-AI governance wedge. It does not by itself prove marketplace approval, production deployment, or customer adoption.

## 20. Completion-Gate Result

Browser extension marketplace/readiness controls are internally complete and externally blocked by store review. Completion gates achieved:

- Permission docs exactly match manifest permissions and host permissions.
- Validator rejects undocumented or stale broad host claims.
- `npm run validate:extension-permissions` passes.
- `npm run test:extension` passes.
- `npm run build:extension` passes.
- `npm run smoke:extension-runtime` passes and proves enrollment-to-protected-prompt behavior with the current build.

External gate remains: Chrome Web Store and Microsoft Edge Add-ons review/approval.

Lint/build hygiene component is internally complete. Gates achieved:

- `npm run lint` no longer scans generated/nested artifacts.
- Remaining first-party lint findings are warnings, not errors.
- Full `npm run build` passed with longer timeout.

Route auth/tenant audit component is partially improved but not complete. Minimum internal gate:

- Identify highest-risk route families.
- Verify sensitive routes consistently enforce authentication, tenant scoping, permission checks, validation and rate limiting.
- Add or strengthen focused tests for any gap found.
- Rerun affected route audit/auth tests.

AI gateway/local broker component is internally complete for the current gap. Evidence includes unit tests, package typecheck/build, root typecheck and `smoke:broker`.

- Low-latency token streaming remains future work; current implementation is compatibility-mode buffered SSE so output protection can scan before release.

Agent/MCP governance is internally complete for the current ledger/passport/MCP-scan slice. Remaining future work is deeper MCP snapshot-to-policy deployment linkage across real persisted policy versions.

RAG ingestion/retrieval component is internally complete for the re-scan ACL/vector planning slice. Remaining future work:

- Re-scan ACL/vector slice completed internally.
- Remaining: live external DB/vector-provider runtime smoke for re-scan downgrade/reindex behavior.
- Remaining: deeper parser sandbox proof and provider-specific Qdrant/pgvector ACL audit.

SDK/API contracts component is internally complete for the v1 OpenAPI/SDK-alignment slice. Remaining future work:

- Publish generated SDK artifacts through the release pipeline.
- Validate `/api/openapi` on a deployed environment.
- Expand endpoint-specific schemas beyond the generic advanced-security request/response objects.

Enterprise SSO/SCIM runtime-evidence component is internally complete for the local route-level slice. Remaining future work:

- Validate SCIM create/update/deactivate/group mapping with live Okta, Azure AD and Google Workspace directories.
- Validate SAML metadata import, login, ACS and session exchange with at least one live enterprise IdP.
- Capture deployment screenshots/logs that enterprise buyers can review during procurement.

Guard benchmark and gateway latency component is internally complete for the local evidence slice. Remaining future work:

- Run third-party corpora such as PINT/JailbreakBench/HarmBench if licensing/access permits.
- Replay representative production traffic with privacy-preserving labels after customer pilot data exists.
- Re-run latency gates in CI and staging hardware, including paid model provider round trips.

## 21. External Blockers

| Blocker | Required External Action | Evidence Required | Owner | Effect of Delay |
| --- | --- | --- | --- | --- |
| Chrome Web Store approval | Submit signed/private listing package | Approval status and listing URL | Founder/release owner | Cannot claim store-approved Chrome distribution |
| Edge Add-ons certification | Submit hidden listing package | Certification approval and package link | Founder/release owner | Cannot claim Edge marketplace availability |
| Independent security review | Third-party review or pen test | Signed report | Founder/CISO | Cannot claim independent validation |
| Customer deployment proof | Pilot install on managed devices | Tenant-scoped deployment evidence | Founder/customer success | Cannot claim production-proven extension |
| Live enterprise identity validation | Configure Okta/Azure AD/Google Workspace SCIM and SAML against a deployed environment | Provider-side provisioning logs, SAML login transcript, SoterAI audit events | Founder/enterprise engineer | Cannot claim production-proven SSO/SCIM integrations |
| Independent benchmark validation | Run external corpora and/or third-party red-team evaluation | Signed evaluation report, corpus provenance, replayable scripts | Founder/security reviewer | Cannot claim independently validated guard efficacy |

## 22. Completed-Component Ledger

| Order | Component | Customer Problem | Market Gap | Competitors | Gaps Found | Improvements | Tests | Runtime Proof | Before | After | Evidence Level | Status |
| ----: | --------- | ---------------- | ---------- | ----------- | ---------- | ------------ | ----- | ------------- | -----: | ----: | -------------- | ------ |
| 1 | Browser extension marketplace/readiness controls | Employees need safe browser AI use without overbroad permissions | Store/private deployment evidence | Prompt Security, Defender for Cloud Apps, Chrome/Edge extension standards | Permission docs mismatch manifest and stale broad-host reviewer notes | Permission docs aligned; validator hardened | `validate:extension-permissions`, `test:extension`, `build:extension` passed | None this session | Validator failed | Validator/tests/build passed | 7 | Internally complete, externally blocked |
| 2 | Lint/build hygiene and generated artifact exclusions | Engineering/release teams need trustworthy quality gates | Release verification blocked by noisy generated artifacts | Mature SaaS platforms keep source and generated artifacts separate in CI | `eslint .` scans `.claude`, `.tmp`, generated static assets | ESLint ignores generated/nested artifacts; full build rerun | `lint`, `build` passed | None | 113 lint errors; build timed out | 0 lint errors, 92 warnings; build passed | 7 | Internally complete |
| 3 | Unified route auth/tenant permission audit | Customers need assurance that tenant data and admin actions are protected | Large API surface increases auth drift risk | Enterprise SaaS security baselines | Explicit project lookup fell back after access failure | Explicit project IDs now fail closed; regression test added | `test:otp`, focused auth/route tests, typecheck passed | None | Unsafe fallback | Fail-closed lookup | 6 | Active: one high-risk gap fixed |
| 4 | AI gateway/local broker runtime hardening | AI workflows need to survive transient provider failures and streaming clients safely | Gateways need bounded recovery, timeout, streaming compatibility and observable failure behavior | Model gateways, cloud AI runtime products | No bounded retry; `stream: true` rejected; no end-to-end runtime smoke | Configurable capped provider retry; buffered-safe OpenAI SSE support; local runtime smoke added | Broker tests, root typecheck, broker typecheck/build, `smoke:broker` passed | Local broker plus local HTTP mock provider | Single attempt only; no streaming compatibility | Bounded retry; buffered SSE compatibility; runtime smoke proof | 7 | Internally complete |
| 5 | Agent/MCP governance end-to-end verification | Agentic workflows need provable tool authorization and non-spoofable action lineage | Many agent security demos classify actions but do not bind audit records to verified passports | Agent runtime security and MCP security platforms | Ledger accepted spoofable passport identifiers; policy route lacked `policy:manage` guard; no route-level runtime proof | Ledger validates passport before insert and stores server-resolved IDs; policy route enforces project permission; runtime smoke added for ledger and MCP scan | Focused Agent/MCP tests, route audit, root typecheck, `smoke:agent-mcp` passed | Real route handlers with mocked Prisma persistence | API-key auth plus caller-supplied lineage IDs | Passport-bound ledger, guarded policy route, MCP scan persistence proof | 7 | Internally complete |
| 6 | RAG ingestion/retrieval security loop | AI apps need retrieval that does not expose stale, poisoned, or unauthorized knowledge | RAG tools often scan documents but miss authorization continuity after re-scan/reindex | Model Armor, Prisma AIRS, RAG security tools | Re-scan widened chunk roles; stale indexed vectors could remain; legacy vector access allowed missing ACL | Re-scan preserves ACL/source/sensitivity/auth metadata; stale vectors deleted before reindex; missing ACL denies retrieval | Focused RAG tests, route audit, root typecheck, `smoke:rag-rescan` passed | Actual scanner/shared planner/vector post-filter local smoke | Re-scan could broaden access and stale vectors could survive | ACL-preserving re-scan, stale-vector cleanup and smoke proof | 8 | Internally complete |
| 7 | SDK/API contracts and OpenAPI/versioning | Developers need stable, typed, documented API integrations that do not drift silently | Enterprise buyers expect OpenAPI, version headers and SDK contract checks | Mature API/security platforms | No machine-readable contract tied to SDK routes; stale docs; no SDK API-version negotiation; HTTP 5xx retry expectation not implemented | OpenAPI v1 route/spec added; SDK/server contract constants; response/request version headers; fail-closed incompatible version; SDK route validator; docs refreshed | Contract validator, SDK tests/build/typecheck, integration docs tests, route audit, root typecheck passed | `/api/openapi` handler executed locally; validator matched 35 SDK endpoints | Manual docs and SDK routes could drift; incompatible server version could parse silently | Versioned OpenAPI contract with SDK validation and fail-closed version handling | 8 | Internally complete |
| 8 | Enterprise SSO/SCIM runtime evidence | Enterprise buyers need identity-provider proof before adopting a security platform | SSO and directory automation must be demonstrably tenant-scoped, auditable and safe | Okta/Azure/Google identity-backed enterprise SaaS | No route-level smoke proving SCIM auth/provisioning/deprovisioning, tenant isolation and SAML redirect behavior together | Added local smoke over real SCIM/SAML route handlers with mocked persistence and synthetic provider settings | `smoke:enterprise-sso-scim`, Phase 5/6 route suites and root typecheck passed | Real route handlers with mocked Prisma persistence | Unit/source-level evidence only | SCIM/SAML route-level runtime proof, live provider proof still external | 8 | Internally complete |
| 9 | Browser extension enrollment/protected-prompt runtime verification | Employees need deployable AI DLP that actually enrolls, syncs policy and blocks sensitive prompts in browser workflows | Browser security products must prove install-time and runtime enforcement, not only static package readiness | Prompt Security, Defender for Cloud Apps, enterprise browser DLP | No current build-backed service-worker smoke; sender validation trusted message URL before Chrome sender URL | Added extension runtime smoke and fixed sender-origin precedence | `smoke:extension-runtime`, `test:extension`, `typecheck:extension`, root typecheck and permission validator passed | Current extension build plus real service-worker handlers under Chrome API shim | Tests/build only; spoofable message URL path | Enrollment-to-blocked-prompt smoke proof and fail-closed sender validation | 8 | Internally complete, externally blocked by store/managed-device proof |
| 10 | Fresh honest guard benchmark and gateway latency proof | AppSec and platform buyers need credible guard efficacy plus latency evidence before trusting production AI workflows | AI guardrail products are judged on recall at controlled FPR, false-positive burden and runtime latency | Lakera Guard, Model Armor, Prisma AIRS, Cisco AI Defense | Benchmark evidence was fragmented; no single artifact combined classifier quality, multi-turn recall and gateway latency | Added combined market smoke, generated market-gap artifact, refreshed honest benchmark artifact | `smoke:guard-market`, honest benchmark tests, guard latency tests, broker tests and root typecheck passed | Production classifier plus real local broker HTTP server | Scattered local evidence | Repeatable local quality/latency artifact with explicit limitations | 8 | Internally complete |

## 23. Final Platform-Wide Verdict

Not yet available. Current evidence supports classifying the repository as a broad technical beta with many implemented/tested modules, but not as production-ready, enterprise GA-ready, independently validated, or market-leading.

## 24. Founder Action Plan

Immediate plan:

1. Add live external vector-provider proof for RAG when infrastructure credentials are available.
2. Add deeper parser sandbox proof for files/documents as the next internal-only gap.
3. Validate Enterprise SSO/SCIM with live Okta/Azure AD/Google Workspace providers after deployment credentials exist.
4. Run Chrome/Edge managed-device pilot after store/private deployment credentials exist.

Commercial wedge: private browser extension pilot for AI data-loss prevention across ChatGPT, Claude, Gemini, coding sandboxes and local AI tools, backed by redacted audit events in the control plane.

## 25. Sources Used for Market and Platform Context

- OWASP GenAI Security Project: https://genai.owasp.org/llmrisk/llm01-prompt-injection/
- Chrome extension permissions: https://developer.chrome.com/docs/extensions/develop/concepts/declare-permissions
- Chrome permission warnings: https://developer.chrome.com/docs/extensions/develop/concepts/permission-warnings
- Microsoft Edge extension permissions: https://learn.microsoft.com/en-us/microsoft-edge/extensions/developer-guide/declare-permissions
- Google Cloud Model Armor: https://cloud.google.com/security/products/model-armor
- Microsoft Defender for Cloud Apps: https://www.microsoft.com/en-us/security/business/siem-and-xdr/microsoft-defender-cloud-apps
- Microsoft generative AI app discovery docs: https://learn.microsoft.com/en-us/security/security-for-ai/discover
- Lakera: https://www.lakera.ai/
- Prompt Security: https://www.prompt.security/
- HiddenLayer: https://www.hiddenlayer.com/
- Cisco AI Defense: https://www.cisco.com/site/us/en/products/security/ai-defense/index.html
- Palo Alto Prisma AIRS: https://www.paloaltonetworks.com/ai-security/ai-runtime-security
