# SoterAI final technical and competitor comparison

Date: 2026-07-30

## Executive conclusion

SoterAI now demonstrates a broad, coherent security architecture across hosted LLM traffic, routed
MCP calls, agent tool execution, browser and IDE surfaces, model-file inspection, RAG ingestion,
identity-aware policy, and audit evidence. The repository's complete test run is green.

An overall technical-supremacy claim is **not justified**. Several competitors publicly document
broader enterprise deployment, model scanning, network enforcement, multilingual coverage, or
managed-cloud integration. Those claims were not independently benchmarked here, while SoterAI
still has external/runtime validation gaps.

## Final architecture

```text
Applications / SDKs / Agents / Browser / IDE / Workflows
                         |
        canonical identity + destination + policy context
                         |
      Hosted AI Gateway / MCP Gateway / Local Broker
                         |
       canonical decision and privacy-safe evidence
  ALLOW | REDACT | TRANSFORM | WARN | REQUIRE_APPROVAL
             BLOCK | QUARANTINE | ABSTAIN
                         |
     model scan | RAG sandbox | action check | DLP
                         |
    audit events | metrics | background jobs | AI-BOM
```

Only traffic crossing a listed enforcement point is protected. A direct provider connection,
direct MCP connection, WebSocket MCP connection, or unwrapped framework tool is a bypass.

## Before and after

| Capability | Before remaining-work pass | Current repository evidence |
|---|---|---|
| Decision vocabulary | Canonical gateway contract, fragmented legacy verbs | 12 pure adapters with evidence-preserving mappings and fail-safe `ABSTAIN` |
| Framework tool calls | Advisory/text middleware | LangChain/Vercel wrappers check before execution and suppress blocked/pending calls |
| Model formats | Pickle-focused plus shallow formats | Bounded GGUF, ONNX, SafeTensors, archive checks, JSON/SARIF CLI, deployment evaluator, AI-BOM evidence |
| RAG documents | Partial common-file validation | Bounded OpenXML/HTML inspection with active-content quarantine |
| Job failures | Basic retries | Exponential retry, dead-letter event, stale-lease recovery, graceful drain |
| Capability claims | Six runtime engines marked unknown | Zero unknown remain; advisory OS preflights are detection-only; checkpoint rollback is PARTIAL_ENFORCEMENT |
| IDE artifact | Source/runtime tests | VSIX packaged and inspected |
| Root regression | Partial focused gates | **966/966 full root tests pass** |

## Enforcement coverage

| Surface | Evidence | Blocking point | Known bypass |
|---|---|---|---|
| Hosted OpenAI/Anthropic gateway | Runtime-verified core (local real HTTP); production-server variant externally blocked | Before upstream request and before/within downstream response | Direct provider calls |
| MCP stdio | Runtime-verified | Before `tools/call`; result inspection before return | Direct server launch |
| MCP Streamable HTTP/SSE | Integration-tested | Authenticated, identity-bound proxy | Unrouted endpoint |
| MCP WebSocket | Unsupported | None | All WebSocket traffic |
| LangChain/Vercel AI SDK tools | Integration-tested | Wrapper before tool invocation | Unwrapped tools |
| Local AI broker | Runtime-verified | Broker request/stream path | Direct local-model access |
| Checkpoint rollback | Integration-tested | Broker filesystem snapshot/restore via real adapter | Outside configured isolation root |
| Browser extension | Build- and test-verified | Page/AI interaction and document-DLP hooks | Unsupported/disabled extension |
| VS Code and Windsurf extensions | Packaged-runtime verified | Broker/secret/terminal paths | Disabled/uninstalled extension |
| Cursor extension | Packaged install/list/uninstall verified; host runtime blocked | Not runtime-proven | Cursor host failed MCP IPC readiness before probe |
| Model deployment | Integration-tested supported loader | Mandatory before the ONNX runtime import/load | External loaders and training scripts |
| File/network/process/governance | Detection-only | Authenticated preflight response | Caller can ignore it; no universal OS mediation |

## Detection and multilingual posture

SoterAI combines deterministic detectors, normalization/decoding, semantic classification, optional
LLM judging, and policy thresholds. This gives transparent local decisions and strong regression
coverage, but it is not independently validated and the held-out multilingual/content-harm ceiling
remains material.

Check Point's acquisition announcement publicly claims Lakera coverage above 98%, sub-50 ms latency,
false positives below 0.5%, and more than 100 languages. These are vendor claims, not reproduced
results. Palo Alto Networks documents multilingual red teaming, while Cisco documents continuously
updated threat intelligence and more than 200 validation subcategories. SoterAI is
**weaker/unverified** on externally demonstrated multilingual scale until a controlled same-corpus
evaluation exists.

## Model and supply-chain security

SoterAI's scanner does not deserialize or execute model artifacts. It performs bounded static
inspection, digest/provenance evaluation, archive safety checks, format-aware structure checks, and
emits JSON, SARIF, and CycloneDX-linked evidence.

The supported ONNX runtime loader is now fail-closed behind digest pinning, a signed manifest,
approved-source policy, operator-configured trust roots, chain validation, rotation validity, and
revocation. Authenticated Hugging Face acquisition is HTTPS-only, repository/domain allowlisted,
redirect-, timeout-, and size-bounded, and hash-pinned. SoterAI remains **weaker** than managed
competitor lifecycle products on registry discovery, external loader coverage, and production fleet
evidence.

## Agent, MCP, and A2A security

A real MCP child-process test proves blocked calls never reach the upstream tool, approval executes
exactly once, and returned secrets are redacted. Authenticated HTTP/SSE tests bind tenant, project,
principal, session, and upstream identity. Agent passports, intent, capability policy, approval,
escrow, dry-run, semantic egress, and an action ledger provide a wider control model.

Prompt Security publicly describes endpoint/reverse-proxy MCP enforcement, server risk scoring, and
shadow-MCP discovery. Check Point describes runtime control over unsafe tools and unauthorized agent
actions; Cisco describes network-layer enforcement over MCP-mediated interactions. SoterAI is:

- **Strong locally** on reproducible pre-execution and result-redaction behavior.
- **At parity in architectural intent** for routed MCP and action policy.
- **Weaker** on WebSocket coverage, endpoint discovery, network-wide interception, reputation/risk
  intelligence, and production-scale evidence.

## Browser, IDE, and workflow controls

SoterAI has a tested browser extension, packaged VS Code extension, local broker, controlled
terminal, secret brokering, and workflow/SDK integrations. Prompt Security also publicly documents
browser, endpoint, IDE, desktop, MCP, and internal-application monitoring, so no uniqueness or
superiority claim is made.

The packaged VSIX executed inside isolated VS Code and Windsurf profiles and passed seven host checks
in each before clean uninstall. Cursor install/list/uninstall passed, but Cursor's own MCP utility
timed out before extension-host evidence; Cursor is therefore not runtime-verified.

## RAG and document security

SoterAI now statically inspects common OpenXML formats and HTML, applies tenant/project continuity,
and quarantines macros, ActiveX, embedded objects, unsafe archive entries, and active/hidden HTML.
It avoids executing document content. Residual gaps include broader parser isolation,
deletion/stale-vector propagation evidence, and production adversarial document corpora.

Google Model Armor publicly documents prompt, response, agent-interaction, and document screening;
Cisco discusses RAG application risk; Check Point/Lakera describes guarding RAG data flows. Public
descriptions do not provide a reproducible head-to-head corpus here, so this area is **not
comparatively validated**.

## Reliability, privacy, and observability

The repository includes bounded payloads/timeouts, quotas, identity-bound evidence, privacy-safe
scan records, metrics, stale-job recovery, dead-letter transitions, and graceful worker drain. Raw
model bytes are not included in AI-BOM evidence.

Production proof remains missing for multi-instance failover, sustained load, queue-provider
outages, and disaster recovery. The normal Next.js production build compiles, validates, prerenders
all 221 static pages, and terminates cleanly. A real-HTTP isolated runtime smoke of the production
gateway handler passed 12/12 and captured latency/load/resource metrics. The production-built
Next.js plus ephemeral PostgreSQL variant remains externally blocked by access denial to the local
Docker configuration and engine pipe.

## Performance

Re-measured 2026-07-31 under a controlled protocol: five independent 300-iteration trials, paired
per-iteration direct-versus-gateway timing, a fresh child process per bucket, 20 discarded warm-up
iterations, cache state declared, payloads sha256-fingerprinted, the rate limiter armed and the
decision path re-verified in every bucket of every trial. The median trial is reported with the
cross-trial range, never a best-of. Full protocol, stage profile and artifacts: section 9 of
`SOTERAI-TECHNICAL-SUPREMACY-REPORT.md`.

| Path | Cache | Gateway p95, median trial | p95 range over 5 trials | Budget | Outcome |
|---|---|---:|---|---:|---|
| Simple allow | warm | 4.222 ms | 3.04–4.72 ms | 8 ms | PASS |
| Simple allow | cold | 8.106 ms | 5.61–10.51 ms | 8 ms | MISS by 1.3% |
| 8 KB allow | warm | 5.432 ms | 3.45–9.26 ms | 25 ms | PASS |
| 8 KB allow | cold | 21.272 ms | 19.49–22.44 ms | 25 ms | PASS |
| Block | not cached | 3.000 ms | 2.30–3.04 ms | 8 ms | PASS |
| Result redaction | not cached | 4.078 ms | 2.74–5.75 ms | 12 ms | PASS |

These supersede the earlier single-run figures (simple allow 14.17 ms, 8 KB 6.66 ms, block 5.47 ms,
redaction 6.76 ms), which conflated warm and cold cache state and reported no variance. Correctness
held in both campaigns: BLOCK was answered locally and never forwarded upstream in any trial. The one
remaining miss was earned honestly — no detector disabled, no finding weakened, no argument scan
skipped, no raw data cached, no budget relaxed.

Adjacent local thresholds: broker `/v1/scan` p95 10.52–12.13 ms against 30 ms (PASS); broker
`/health` p95 8.93–13.42 ms against 10 ms (load-dependent, **not** a stable pass); VS Code 10 KB scan
p95 7.99–17.22 ms against 20 ms (PASS, superseding a stale 35.75 ms reading). Extension bundle-size
budgets remain missed and are packaging work rather than latency work.

Everything above was measured on a single loaded consumer laptop (4-core Intel i5-8350U, 33.7–84.5%
pre-run CPU busy, cross-trial coefficient of variation 5.6–41.3%). It is not comparable to
managed-service latency because hardware, network, payloads, policy and measurement boundaries all
differ, and it supports no comparative performance claim in either direction.

The hosted gateway core smoke measured p50/p95/p99 overhead of 13.123/19.269/22.545 ms, first-token
overhead of 12.762 ms, and 77.4 requests/s at concurrency 20. No equivalent same-boundary competitor
run was performed.

## Competitor comparison from current public documentation

| Product | Publicly documented emphasis | Evidence-based SoterAI position |
|---|---|---|
| Palo Alto Networks Prisma AIRS | Runtime inspection, agent security, model scanning, red teaming, enterprise discovery | Weaker on lifecycle breadth, discovery, managed deployment, and production evidence |
| Cisco AI Defense | Model/application validation, 200+ subcategories, network enforcement, MCP/agent workflows, cloud visibility | Weaker on network-estate coverage and threat intelligence; comparable inline architecture goal |
| Check Point / Lakera | Runtime prompt/RAG/MCP guardrails, agent actions, red teaming, 100+ language vendor claim | Weaker/unverified on multilingual scale and published performance; action non-execution is locally reproducible |
| SentinelOne / Prompt Security | Browser/endpoint sensors, MCP gateway, shadow-MCP discovery, risk scoring, IDE/desktop visibility | Weaker on endpoint discovery/reputation and fleet proof; comparable multi-surface intent |
| HiddenLayer | Model scanner, CI/registry integrations, AI detection and response | Weaker on scanner breadth, integrations, and operational proof |
| Google Cloud Model Armor | LLM-agnostic API/inline prompt, response, agent and document screening; Google integrations | Weaker on managed integrations and cloud enforcement |
| Amazon Bedrock Guardrails | Account/organization enforcement and content, topic, word, sensitive-data and grounding controls | Weaker on organization-scale managed enforcement; broader locally across other surfaces, but not like-for-like |
| Noma | Agent/MCP/tool inventory, access policy, runtime enforcement and behavioral monitoring | Weaker on enterprise discovery/integration proof; comparable routed access-control intent |
| Zenity | Cross-SaaS/cloud/endpoint agent observability, posture, inline prevention and response | Weaker on enterprise platform breadth and operational proof |
| Cyberhaven | DSPM/DLP/insider-risk controls and endpoint/cloud/AI data-flow lineage | Weaker on enterprise-wide data discovery and endpoint DLP; SoterAI covers more AI execution surfaces locally |
| Portkey, Kong, LiteLLM and OpenGuardrails | Provider routing, extensible gateway plugins/guardrails, operations and in some cases MCP | Weaker on provider breadth, gateway maturity and deployed scale; broader locally in IDE/model/document proof |

## Dimension-by-dimension evidence matrix

Labels compare documented architecture and available evidence, not detection quality. “Parity”
means architectural parity only. Missing public detail is never treated as competitor inferiority.

| Dimension | SoterAI evidence | Competitor-best pattern | Stronger / Parity / Weaker | Limitation |
|---|---|---|---|---|
| Inline runtime enforcement | Runtime-verified gateway core, MCP stdio, broker, VS Code/Windsurf; integration-tested HTTP/SSE and tool wrappers | AIRS/Cisco network and API intercept; managed fleet enforcement | Parity in routed architecture; Weaker operationally | Direct provider/MCP/tool paths bypass; no production fleet |
| AI gateway | 12/12 local real-HTTP handler smoke; OpenAI/Anthropic, auth, redaction, stream cancellation, tenant isolation | Managed multi-provider gateways with policy, routing, failover and global operations | Weaker | Production-built server/PostgreSQL smoke externally blocked; two upstream families |
| MCP and A2A | Runtime child-process non-execution/result redaction; authenticated HTTP/SSE; passport/A2A policy | Cisco/AIRS/Prompt/Noma discovery, reputation and network/endpoint enforcement | Parity inline; Weaker discovery | WebSocket and unrouted MCP bypass; A2A fleet evidence absent |
| Agent identity/action safety | Integration-tested identity/passport, approvals, capability checks and pre-execution wrappers | AIRS/Noma/Zenity enterprise identity inventory, least privilege and behavioral chains | Parity in control model; Weaker deployment | Unwrapped tools bypass; no enterprise identity estate |
| Model supply-chain security | Source-verified static formats; integration-tested mandatory signed-manifest ONNX loader and AI-BOM | AIRS/HiddenLayer/Cisco registry discovery, many formats, threat intelligence, CI/MLOps fleet | Weaker | Supported loader only; external loaders bypass; no production registry proof |
| Browser and IDE protection | Browser 145/145; packaged runtime VS Code/Windsurf; Cursor package-only | Prompt Security/Zenity/Cyberhaven endpoint/browser/IDE fleet sensors and discovery | Parity in local surfaces; Weaker fleet | Cursor host blocked; no managed endpoint estate |
| RAG/document security | Integration-tested bounded OpenXML/HTML static inspection and quarantine | Model Armor/Check Point/Cisco managed document/RAG screening | Parity in pattern | Parser isolation and production adversarial corpus incomplete |
| Multilingual detection | Source/integration-tested hybrid pipeline; provisional Hinglish data and external-run package | Check Point/Lakera vendor-documented 100+ languages and managed calibration | Weaker/unverified | No accelerator run, independent native holdout, or same-corpus result |
| Policy architecture | Source/integration-tested canonical eight-verb evidence envelope and 12 adapters | Central enterprise control planes with identity, posture, runtime and compliance context | Parity conceptually | Legacy/external callers may avoid the policy point |
| Privacy | Local scanning, bounded evidence, credential non-forwarding and redaction runtime proof | Cyberhaven data lineage/DSPM/DLP; enterprise regional and compliance controls | Strong local minimization; Weaker enterprise coverage | No independent privacy certification or enterprise data map |
| Reliability | Bounded timeouts/payloads, retry/DLQ/stale lease/drain tests, clean smoke shutdown, build exit 0 | Managed multi-region SLOs, failover, fleet telemetry and support | Weaker | No multi-instance, disaster-recovery or provider-outage runtime proof |
| Performance | Gateway percentiles/resource capture; MCP 300-iteration correctness; current threshold misses disclosed | Vendor-scale managed latency/SLO claims and optimized OSS gateways | Weaker/unverified | No normalized hardware/network boundary or stable MCP simple-ALLOW pass |
| Extensibility | SDKs, workflows, adapters, browser/IDE, local/hosted/MCP paths, JSON/SARIF/CycloneDX | OSS gateway provider/plugin ecosystems and enterprise integration catalogs | Parity in surface diversity; Weaker ecosystem | Smaller provider/plugin/install base |

## Evidence-level separation

| Evidence level | Current SoterAI examples |
|---|---|
| Source-verified | Canonical policy/adapters, static model/document scanners, capability registry |
| Integration-tested | Gateway routes, MCP HTTP/SSE, agent wrappers, mandatory supported loader, RAG sandbox |
| Runtime-verified | Gateway handler over real HTTP, MCP stdio child process, local broker, VS Code/Windsurf packaged hosts |
| Packaged verification | 0.2.1 VSIX; Cursor install/list/uninstall without host execution proof |
| Externally blocked | Production Next.js/PostgreSQL gateway variant; Cursor host startup; accelerator and independent multilingual evaluation; dependency audit network metadata |
| Independently validated | None for competitor-relative detection, latency, resilience, cost, or multilingual quality |

## Defensible conclusions

**Stronger:** No categorical competitor-superiority result is defensible.

**Distinctive and evidenced:** One repository combines a canonical decision envelope with hosted
gateway, routed MCP enforcement, framework tool wrappers, browser/packaged IDE controls, static model
and document inspection, and privacy-safe evidence. The combined implementation is reproducibly
tested locally.

**At parity in architecture:** Inline prompt/response inspection, agent action policy, MCP proxying,
model predeployment assessment, RAG controls, and audit evidence match patterns described by market
leaders.

**Weaker:** Production proof, enterprise discovery, network/endpoint interception, scanner ecosystem
breadth, external-loader coverage, and independent multilingual metrics.

**Unknown:** Same-corpus detection quality, false-positive rate, latency, resilience, and total cost
against any named competitor.

## Verification record

- Full root suite: **966 pass, 6 honestly skipped, 0 fail**.
- Guard core: **466/466 pass**.
- Checkpoint rollback (guard-core pure logic): **8/8 pass**.
- Checkpoint rollback (broker runtime): **16/16 pass**.
- MCP core/runtime/HTTP/security: **117/117 pass**.
- Browser extension: **145/145 pass**, typecheck/build pass.
- VS Code extension: **113/113 pass**, VSIX packaged.
- SDK: **18/18 pass**, build pass.
- New remaining-security slice: **41/41 pass**.
- Gateway enforcement pipeline: **24/24 pass**.
- Model scanner/loader/BOM: **31/31 pass**.
- Broker endpoint tests: **46/46 pass** (includes terminal, proxy, preflights and rollback).
- Prisma validation and affected typechecks pass.
- Full lint: exit 0, 0 errors and 104 warnings.
- Normal lint-enabled Next.js production build: PASS, 221/221 static pages, exit 0 in 475.3 s.
- MCP benchmark (2026-07-31, controlled 5×300-iteration protocol): five of six budgets pass on the
  median trial; `allow-simple-cold` p95 8.106 ms misses its 8 ms budget by 1.3%. Decision paths
  re-verified in every bucket of every trial. Supersedes both the historical all-pass claim and the
  14.17 ms single-run miss.
- Prefilter soundness gate: full guard suite with `SOTERAI_PREFILTER_VERIFY=1` re-running every skipped
  regex — **524 tests, 518 pass, 0 fail, 6 skipped**; prefilter suite 64/64; `tsc --noEmit` exit 0.
- Model/MCP/AI-BOM focused slice: 98/98 pass; root typecheck passes.
- **Authoritative runtime update:** hosted gateway smoke 12/12 over real local HTTP; the production
  server/database variant is blocked by Docker access. VS Code and Windsurf are packaged-runtime
  verified 7/7. Cursor package install/list/uninstall passed, but host execution was blocked before
  the extension probe. The three older bullets immediately below are superseded history.
- Built server startup: Ready in 878–997 ms; database-backed health is externally blocked.
- Gateway smoke script: created at scripts/gateway-smoke.mjs (enforcement pipeline proven by tests/gateway.test.ts 24/24).
- Editor runtime detection: VS Code, Cursor, Windsurf detected; detection script at scripts/detect-editor-runtimes.mjs.

## Primary sources

- [Palo Alto Networks Prisma AIRS runtime security](https://www.paloaltonetworks.com/prisma/prisma-ai-runtime-security/ai-runtime-security)
- [Palo Alto Networks AI Model Security](https://www.paloaltonetworks.com/prisma/ai-model-security)
- [Cisco AI Defense data sheet](https://www.cisco.com/c/en/us/products/collateral/security/ai-defense/ai-defense-ds.html)
- [Cisco model and application validation](https://www.cisco.com/site/us/en/products/security/ai-defense/ai-model-application-validation/index.html)
- [Check Point AI Agent Security](https://www.checkpoint.com/ai-security/ai-agent-security/)
- [Check Point/Lakera scope and vendor metrics](https://www.checkpoint.com/press-releases/check-point-acquires-lakera-to-deliver-end-to-end-ai-security-for-enterprises/)
- [Prompt Security agentic AI and MCP gateway](https://prompt.security/solutions/agentic-ai-security-and-governance)
- [Prompt Security browser and endpoint sensors](https://prompt.security/blog/the-key-layer-in-ai-security-browser-and-endpoint-sensors)
- [HiddenLayer model scanner integrations](https://www.hiddenlayer.com/news/hiddenlayer-announces-new-features-to-safeguard-enterprise-ai-models-with-improved-risk-detection)
- [Google Cloud Model Armor](https://cloud.google.com/security/products/model-armor)
- [Google Cloud Model Armor overview](https://docs.cloud.google.com/model-armor/overview)
- [Amazon Bedrock Guardrails enforcement](https://docs.aws.amazon.com/bedrock/latest/userguide/guardrails-enforcements.html)
- [Amazon Bedrock AgentCore policy guardrails](https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/policy-guardrails-in-policies.html)
- [Noma agentic access control](https://noma.security/platform/agentic-access-control/)
- [Zenity agent security platform](https://zenity.io/)
- [Cyberhaven AI and data security](https://www.cyberhaven.com/)
- [Portkey open-source AI gateway](https://github.com/Portkey-AI/gateway)
- [Kong API, AI and MCP gateway](https://github.com/Kong/kong)
- [OpenGuardrails AI security gateway](https://github.com/openguardrails/openguardrails)

Public product pages show what vendors document, not independent proof under SoterAI's workloads.
The next valid comparison is a same-corpus, boundary-normalized, independently witnessed evaluation.
