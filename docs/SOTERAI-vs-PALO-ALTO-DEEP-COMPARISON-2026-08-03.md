# SoterAI vs Palo Alto Networks — Deep Feature Comparison (2026-08-03)

**Scope:** SoterAI (current repository) vs Palo Alto Networks’ **Prisma AIRS** (AI Runtime Security) + **AI Access Security** / SaaS + **AI Model Security** (publicly documented products).

**Honesty rule (kept throughout):** a claim is only as strong as its *verified* evidence level. Detection ≠ enforcement. Vendor marketing numbers are treated as *claims*, not measured facts. This is **not** a same-corpus, independently witnessed head-to-head benchmark — that evaluation has not been performed. Where SoterAI is verified, we cite the test/artifact. Where Palo Alto is cited, we cite only their public documentation.

---

## 1) Verified evidence used for this report (fresh this session)

| Evidence | Value | Source |
|---|---:|---|
| Capability registry | 22 entries, `honest: true` | `artifacts/security/capabilities.json` → 10 STRONG_ENFORCEMENT, 8 DETECTION_ONLY, 1 VISIBILITY_ONLY, 1 PARTIAL_ENFORCEMENT, 2 UNSUPPORTED |
| Root suite (historical) | 966 pass / 6 skipped / 0 fail | `docs/SOTERAI-TECHNICAL-COMPETITOR-COMPARISON-2026-07-31.md` |
| Guard red-team benchmark | 3/3 subtests pass | `tests/guard-redteam-benchmark.test.ts` (fresh 3.6 s run) |
| Phase-3 expanded detectors | 7/7 pass, recall ≥90–95% per family, benign FP <1% | `tests/guard/jailbreak-expanded.test.ts`, `system-prompt-leak-expanded.test.ts`, `data-exfiltration-expanded.test.ts`, `tool-abuse-expanded.test.ts`, `rag-poisoning-expanded.test.ts`, `multilingual-hinglish-expanded.test.ts`, `benign-false-positive-expanded.test.ts` (fresh 10.18 s) |
| 100-language eval artifact | 79 languages; union recall 100% (rules 24.1% + ONNX 86.1%), benign 10/10 rules; ONNX benign 1/10 (documented FP) | `artifacts/security/multilingual-100lang-eval-2026-08-02.json` |
| Public benchmark snapshot | 3200 cases, 2200 attack, 1000 benign; precision/recall/F1 100%, p50 9.30 ms, p95 17.83 ms, p99 31.31 ms | `benchmarks/results/latest.md` (2026-07-22; *internally maintained, not independent*) |
| Detection stack | Rules + normalization/decoding + feature-hash semantic classifier + optional LLM judge; tier “rules/hybrid/semantic” | `lib/guard/analyze.ts` |
| MCP gateway | Stdio + HTTP/SSE; bounded JSON-RPC proxy; session/identity binding; argument inspection; approval exactly-once; result redaction | `packages/mcp-gateway/src/MCPJsonRpcGateway.ts` |
| Pricing | Public INR plans (₹0 → ₹9,999/mo, Enterprise custom) | `app/pricing/page.tsx` |
| Palo Alto public docs | Prompt attacks, harmful text/image, denied topics, sensitive information handling, contextual grounding across apps/agents/models/datasets/API intercepts/network deployments/discovery/posture/red teaming/MCP | `docs/competitor-gap-and-differentiation.md`, `docs/SOTERAI-FINAL-TECHNICAL-COMPETITOR-COMPARISON.md` (public URLs) |

---

## 2) The “overall winner” — blunt answer (Hinglish summary)

- **Palo Alto Networks strong hai** operational scale, networks/discovery/red-teaming/production fleet aur sustained latency SLAs theek se claim karne me.
- **SoterAI strong hai** single-repo breadth, transparent capability grading, MCP tool-call pre-execution enforcement (result redaction included), reproducible local security gates, aur **cost/access** me.

**Net:** Pure enterprise-scale network/visibility/fleet battles me Palo Alto jeetega. Self-hosted, developer-first, **browser/IDE/MCP/local-gateway** workflows me — especially where you want local reproducible policy/evidence and low TCO — SoterAI is materially competitive and often stronger *inside its enforcement surface*.

---

## 3) Feature-by-feature deep matrix (winner per feature)

Legend: **SoterAI** ✅ **strong** / ⚖ **parity** / ❌ **weaker** vs Palo Alto’s *publicly documented* capability.

| # | Feature dimension | SoterAI (verified) | Palo Alto (documented / public posture) | Verdict |
|---:|---|---|---|---|
| 1 | **Inline runtime prompt/response guard enforcement** | Hosted gateway: input scan, BLOCK/REDACT before upstream, per-SSE-frame mid-stream block; integration-tested 24/24; real-HTTP handler smoke 12/12 | Prisma AIRS: runtime inspection across applications/agents/models/datasets/API intercepts/network deployments | ⚖ **Parity in architecture**, ❌ **weaker in operable fleet scale** |
| 2 | **AI gateway breadth & routing** | 2 provider families (OpenAI + Anthropic), canonical gateway, tenant key hygiene, RPM/quota, bounded parse | Broad provider/model fleet + enterprise network integration and policy plane across estates | ❌ Palo Alto |
| 3 | **MCP / agent tool-call enforcement** | Stdio + HTTP/SSE; bounded JSON-RPC; session/identity binding; tool/arg inspection; approval exactly-once; result secret redaction; runtime-verified child-process smoke | Prisma AIRS runtime/agent security incl MCP/agent workflows; Prompt Security includes discovery/shadow-MCP (not Palo Alto) | ✅ **SoterAI local-enforcement depth**, ❌ **weaker on shadow-MCP discovery/network-wide interception** |
| 4 | **Model supply-chain / model-file scanning** | Static-only bounded inspection (pickle VM, GGUF/ONNX/SafeTensors, archive), signed-manifest fail-closed ONNX loader, JSON/SARIF/CycloneDX AI-BOM; no deserialization | Prisma AI Model Security (model scanning + governance) | ⚖ **parity on static architecture**, ❌ **weaker on registry/CI/integrations breadth** |
| 5 | **RAG/document sandbox** | Bounded OpenXML/HTML static inspection; macro/ActiveX/embedded-object/active-HTML quarantine; tenant continuity | Prisma AIRS documented RAG/data-flow screening across datasets and deployments | ⚖ **parity in pattern**, ❌ **weaker production corpus/parser isolation breadth** |
| 6 | **Detection quality evidence** | Phase-3 expanded: 7/7 pass; recall ≥90–95% per family; benign FP <1%; red-team benchmark 3/3 pass | Palo Alto publicly documents continuous threat intel + red teaming; concrete public recall tables are not same-corpus witnessed | ✅ **SoterAI on verified internal benchmarks**, ❌ **unverified against Palo Alto corpora** |
| 7 | **Multilingual detection at scale** | Union rules+ONNX recall 100% across 79 langs on self-corpus; ONNX benign FP known (1/10 benign pass); rules benign 10/10 | Palo Alto documented multilingual red-teaming/scale; no public same-corpus false-positive table from SoterAI’s exact method | ❌ **weaker on externally demonstrated multilingual scale** |
| 8 | **Policy plane — canonical verbs + adapters** | 8-verb canonical decision contract (ALLOW/REDACT/TRANSFORM/WARN/REQUIRE_APPROVAL/BLOCK/QUARANTINE/ABSTAIN) + 12 adapters, fail-safe ABSTAIN + evidence envelope | Enterprise policy plane and posture/compliance context (SaaS) | ⚖ **Parity in conceptual architecture**; SoterAI wins on explicit single-repo consistency |
| 9 | **IDE / browser / workflow surfaces** | VS Code + Windsurf packaged runtime verified (7/7 host checks), browser extension 145/145 tests, local broker, terminal + safe context, n8n etc | Palo Alto focuses on network/API/discovery not developer IDE depth | ✅ **SoterAI (developer-first coverage), ❌ weaker enterprise fleet coverage** |
| 10 | **Identity & access enforcement** | Auth fail-closed, tenant isolation, RPM/quota, per-tenant key hygiene, signed webhooks | Enterprise SSO/SCIM/org-scale identity plane + production fleet evidence | ⚖ / ❌ Palo Alto (stronger at org scale) |
| 11 | **Reliability/operations** | Retry/DLQ/stale-lease/drain, bounded timeouts/payloads, privacy-safe scan records, 221-page prerender, clean build exit 0 | Multi-region ops, failover, SLO-based managed cloud support | ❌ **Palo Alto** |
| 12 | **Threat intelligence & discovery** | Local detectors + ML augment + routing advisory; no estate-wide shadow inventory | Palo Alto best-known for discovery, posture, continuous intel across clouds and networks | ❌ **Palo Alto** |
| 13 | **LLM-output content harm / unsafe response handling** | TOXICITY/unsafe-output detectors deterministic + llmJudge tier (notably rules-only for low-FP) | Palo Alto’s prompt/rag filters with denied topics/harmful content evidence across apps | ⚖ parity in approach; ❌ weaker external validation |
| 14 | **Cost & access** | Public INR pricing ₹0 → ₹9,999/mo; self-hosting path in one repo | Enterprise procurement and usage-based managed cost | ✅ **SoterAI** |
| 15 | **Transparency / reproducibility** | `capabilities.json` honest registry (10/8/1/1/2), tests + artifacts + scripts to reproduce run | Public docs strong, but not repository reproduce-able | ✅ **SoterAI** |
| 16 | **Performance measured vs marketing** | Gateway p50 9.30 ms / p95 17.83 ms / p99 31.31 ms (internal artifact); MCP budget passed 5/6, one cold p95 miss (8.106 ms vs 8) | Palo Alto public SLAs may be documented but not same-corpus reproduced here | ⚖ / ❌ unclear without normalized benchmark |

---

## 4) Where SoterAI aap clearly **stronger** hai (kon kon se features me aage)

1. **Reproducible enforcement depth in one repo** — hosted gateway + MCP stdio/HTTP/SSE + tool wrappers + browser + IDE + broker + model scanner + document sandbox all together with green tests in one checkout. Palo Alto splits across products and SaaS planes; SoterAI ships the whole stack as a locally buildable artifact.
2. **MCP tool-call enforcement before execution incl. result secret redaction + approval exactly-once.** This is a hard, enforceable technical claim; verified smoke + child process tests.
3. **Explicit honesty registry** — every capability is graded (STRONG_ENFORCEMENT / DETECTION_ONLY / etc), with bypasses listed; vendors rarely publish this. In head-to-head trust evaluations this is a differentiator.
4. **Model-file scanning approach:** non-deserializing, bounded, signed-manifest fail-closed loadable scanner with AI-BOM evidence. Architecturally cleaner for safety-critical environments where malicious model matters.
5. **Cost, self-hosting, developer/workspace coverage** — public pricing fewer restrictions, and the IDE/browser/CLI/n8n surfaces are integrated locally, reducing procurement friction for a startup/mid-market team.

---

## 5) Where Palo Alto is clearly **stronger** hai (kon kon se features me aage)

1. **Production fleet, discovery, posture management, red teaming across network/agents/apps/models/datasets** — SoterAI has no estate-wide interception or multi-tenant massively scaled fleet proof.
2. **Enterprise identity & operations at org scale** — SSO/SCIM, central control plane, SLO/SLA, multi-region failover, disaster recovery.
3. **Multilingual detection at vendor-claimed scale** — Palo Alto documents multilingual red-teaming; SoterAI’s ONNX v4 still shows documented multilingual-transfer false positives on benign non-English text on self-corpus.
4. **Model security ecosystem breadth** — registry discovery, CI/MLOps integration, third-party model scanning scale, AI governance workflows at production level.
5. **Threat-intel-driven detections** — continuous intelligence feeds, reputation/risk scoring across external estates, red teaming against modern cloud/network AI stacks.

---

## 6) Practical bottom line — aap kiske saath jaayein?

- **If you need enterprise-wide AI security across networks/clouds and large production fleets,** Palo Alto is stronger.
- **If you want developer-first AI-agent security with local reproducible policy + MCP enforcement + browser/IDE hooks + low-cost self-hosting,** SoterAI is stronger *inside its surfaces* and much easier to deploy today.
- **Riskiest reliance:** treating SoterAI’s local benchmark numbers as the same as an independent product benchmark. They are internally maintained artifacts; the road ahead is *normalized, same-corpus, witnessed* comparison to settle real detection quality across languages and production corpora.

---

## 7) Immediate next steps to close the gap vs Palo Alto

1. **Discovery & inventory**: add shadow-MCP/agent discovery + endpoint/fleet inventory panels.
2. **Enterprise org plane**: SSO/SCIM at scale, central control plane, tenant governance workflows.
3. **Independent evaluation**: same-corpus, third-party witnessed multilingual + harmful-content benchmark (separating rules vs ML vs union), with FPR/Recall and latency budgets.
4. **Production fleet evidence**: multi-instance failover, DR, sustained load, queue outage simulations.
5. **Model security ecosystem**: extend registry/CI/MLOps integrations and broaden supported loaders.Immediate next steps to close the gap vs Palo Alto

1. **Discovery & inventory**: add shadow-MCP/agent discovery + endpoint/fleet inventory panels.
2. **Enterprise org plane**: SSO/SCIM at scale, central control plane, tenant governance workflows.
3. **Independent evaluation**: same-corpus, third-party witnessed multilingual + harmful-content benchmark (separating rules vs ML vs union), with FPR/Recall and latency budgets.
4. **Production fleet evidence**: multi-instance failover, DR, sustained load, queue outage simulations.
5. **Model security ecosystem**: extend registry/CI/MLOps integrations and broaden supported loaders.

> Latest verified evidence in this workspace supports SoterAI as **architecturally competitive and locally reproducible**, while Palo Alto remains stronger on **operational scale, discovery, production fleet and enterprise org enforcement**.