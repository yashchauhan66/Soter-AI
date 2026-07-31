# SoterAI — Full Technical Competitor Comparison (July 2026)

**Date:** 2026-07-31
**Verified evidence base:** full root test suite **966/966 pass, 6 skipped, 0 fail** (re-executed this session, ~63 s).
**Capability registry:** `artifacts/security/capabilities.json` v0.2.1 — 22 entries, `honest: true`
(10 STRONG_ENFORCEMENT, 8 DETECTION_ONLY, 1 PARTIAL_ENFORCEMENT, 1 VISIBILITY_ONLY, 2 UNSUPPORTED).

> **Honesty rule used throughout:** a claim is only as strong as its *verified* evidence level.
> Detection ≠ enforcement. Vendor marketing numbers are treated as *claims*, not measured facts.
> Nothing below is a same-corpus, independently witnessed head-to-head benchmark — that evaluation
> has not been performed for SoterAI or any competitor listed.

---

## 1. Executive summary

SoterAI is a **single-repository, locally reproducible AI-agent security platform** spanning:
hosted LLM gateway, MCP gateway (stdio + HTTP/SSE), framework tool wrappers, browser + IDE
extensions, local AI broker, static model-file scanning, RAG/document sandbox, canonical policy
plane, and privacy-safe evidence/audit.

**Net position vs. the market:**

- **Architecturally at parity** with leaders (Palo Alto Prisma AIRS, Cisco AI Defense,
  Check Point/Lakera, Prompt Security) on the *inline routed-enforcement model*: inspect → decide
  with a canonical verb set → enforce before execution → emit evidence.
- **Distinctive** in *breadth-in-one-repo*: no publicly documented competitor combines hosted
  gateway + MCP pre-execution enforcement + IDE/browser control + static model scanning + document
  sandbox + local broker with an 8-verb canonical evidence envelope, all with green tests in one
  checkout.
- **Weaker, honestly:** production/multi-tenant fleet proof, network/endpoint-scale interception,
  shadow-MCP/agent discovery, threat-intelligence-driven detection, multilingual detection at
  vendor-claimed scale (100+ languages), managed enterprise rollout, and independent validation.
- **Unknown:** same-corpus detection quality, false-positive rate, latency, resilience, and TCO
  against any named competitor. These require a normalized, witnessed benchmark.

---

## 2. What SoterAI verifiably does today (evidence-graded)

| Surface | What it does | Evidence level | Blocking point |
|---|---|---|---|
| Hosted AI Gateway (OpenAI + Anthropic shape) | Auth fail-closed, RPM/quota, bounded parse, input scan, BLOCK/REDACT before upstream, response scan, per-SSE-frame mid-stream block, per-tenant key hygiene | Integration-tested (24/24); real-HTTP handler smoke 12/12 | Before upstream call; during stream |
| MCP Gateway (`packages/mcp-gateway` + `lib/gateway/mcp`) | Bounded JSON-RPC proxy, session/identity binding, capability policy per tool, argument inspection, approval store (executes exactly-once), result inspection + secret redaction | Runtime-verified on stdio (real child-process smoke); integration-tested on HTTP/SSE; **117/117** pass | Before `tools/call`; on result return |
| Framework tool wrappers (LangChain / Vercel AI SDK) | Pre-execution check; blocked/pending calls suppressed | Integration-tested | Before tool invocation |
| IDE (VS Code, Windsurf) | Brokered credentials, safe-context, controlled terminal, clipboard-safe paste | Packaged-runtime verified (7/7 host checks each); 113/113 tests | Secret/terminal/context paths |
| Browser extension | Page/AI prompt guard, document DLP | **145/145** tests, build+typecheck pass | In-page interaction hooks |
| Local AI broker | Streaming guard, checkpoint rollback (filesystem snapshot/restore) | Runtime-verified; **46/46** broker endpoint tests incl. rollback 16/16 | Broker request/stream path |
| Model supply-chain scanner | Bounded **static** inspection (no deserialization/execution): pickle VM, GGUF/ONNX/SafeTensors structure, archive safety, digest/provenance, JSON + SARIF + CycloneDX AI-BOM | Source-verified; integration-tested mandatory signed-manifest ONNX loader; 31/31 | Pre-deployment gate (supported loader only) |
| RAG / document sandbox | Bounded OpenXML/HTML static inspection, macro/ActiveX/embedded-object/active-HTML quarantine, tenant continuity | Integration-tested | Ingestion-time |
| Policy plane | Canonical 8-verb decision contract (`ALLOW / REDACT / TRANSFORM / WARN / REQUIRE_APPROVAL / BLOCK / QUARANTINE / ABSTAIN`) + evidence envelope (category/severity/confidence/fingerprint/identity/destination/traceId) + **12 adapters** with fail-safe `ABSTAIN` | Source + contract tested | — |
| Detection stack | Deterministic detectors + normalization/decoding + semantic classifier + optional LLM judge + thresholds | Source/integration tested; held-out ceiling documented | — |

**Reliability evidence present:** exponential retry + dead-letter, stale-lease recovery, graceful
drain, bounded timeouts/payloads, privacy-safe scan records (raw model bytes excluded from evidence),
build exit 0, 221/221 static pages prerendered.

**Known bypasses (honestly registered):** direct provider/MCP connection, MCP-over-WebSocket,
unwrapped framework tools, direct local-model access outside broker, external model loaders, and any
caller that ignores a detection-only advisory. Detection-only capabilities (8) and UNSUPPORTED
arbitrary-process egress / child-process control are explicitly labeled as such — not marketed as
enforcement.

---

## 3. Side-by-side technical comparison

Legend: **S**tronger / **P**arity(architecture) / **W**eaker / **U**nverified — relative to the named
competitor’s *publicly documented* capability. Missing public detail is never read as competitor
weakness.

| Product | Their documented emphasis | SoterAI position | Verdict |
|---|---|---|---|
| **Palo Alto Prisma AIRS** | Inline runtime inspection, agent security, model scanning, red teaming, enterprise discovery + managed fleet | Routed inline parity on gateway/MCP/tool checks; no production fleet, discovery, or managed deployment | **W** (operational scale), **P** (inline model) |
| **Cisco AI Defense** | Network-layer enforcement, model/app validation, 200+ validation subcategories, MCP/agent workflows, cloud visibility, threat intel | Same inline-proxy intent; no network-estate interception or threat-intel feed | **W**, **P** on architecture |
| **Check Point / Lakera** | Runtime prompt/RAG/MCP guardrails, agent action control; vendor-claimed 98%+ detection, <50 ms, <0.5% FP, **100+ languages** | Locally reproducible pre-execution block + result redaction; multilingual holdout **unverified**, ceiling documented | **W/U** on detection scale & published perf; reproducible action-blocking locally |
| **Prompt Security (SentinelOne)** | Browser + endpoint sensors, MCP gateway, **shadow-MCP discovery**, server risk scoring, IDE/desktop visibility | Multi-surface like-for-like (browser/IDE/MCP); **no shadow-MCP discovery**, no reputation scoring, no endpoint fleet | **W** on discovery/fleet, **P** on surface coverage intent |
| **HiddenLayer** | Model scanner breadth, CI/registry integrations, AI detection & response | Static non-executing scanner, signed-manifest gated loader, AI-BOM evidence; narrower format/integrations | **W** on scanner ecosystem & ops proof |
| **Google Cloud Model Armor** | LLM-agnostic API/inline prompt, response, agent + document screening, GCP integration | Comparable screening pattern incl. document sandbox; no managed cloud integration | **W**, **P** on pattern |
| **Amazon Bedrock Guardrails** | Account/org-level enforcement: content, topic, word, sensitive-data, grounding | Org-scale managed enforcement absent in SoterAI; SoterAI broader on local execution surfaces (not like-for-like) | **W** (managed org enforcement) / n/a |
| **Noma Security** | Agent/MCP/tool inventory, access policy, runtime enforcement, behavioral monitoring | Comparable routed access-control intent; no enterprise discovery/integration estate | **W**, **P** |
| **Zenity** | Cross-SaaS/cloud/endpoint agent observability, posture, inline prevention, response | No enterprise platform breadth / operational proof | **W** |
| **Cyberhaven** | DSPM / DLP / insider risk, endpoint+cloud+AI **data-flow lineage** | SoterAI strong on local secret minimization + redaction; no enterprise-wide lineage/DSPM | **W** on enterprise DLP; **S**-local on execution-surface coverage |
| **Portkey / Kong / LiteLLM / OpenGuardrails** | Provider routing breadth, plugin ecosystems, gateway maturity, deployed OSS scale (Kong/Portkey also do MCP) | Fewer upstream families (2), smaller plugin/provider/install base; SoterAI broader *locally* on IDE/model/document proof | **W** on gateway maturity/scale; **S**-local on combined security breadth |

---

## 4. Dimension-by-dimension matrix (evidence, not adjectives)

| Dimension | SoterAI (verified) | Competitor-best pattern | Verdict | Honest limitation |
|---|---|---|---|---|
| Inline runtime enforcement | Runtime-verified gateway core, MCP stdio, broker, VS Code/Windsurf | Network/API intercept at fleet scale | **P** routed / **W** operational | Direct paths bypass; no fleet |
| AI gateway | 12/12 real-HTTP smoke; per-frame mid-stream block; tenant isolation; 2 provider families | Managed multi-provider gateways, global routing, failover, SLOs | **W** | Prod server/Postgres variant externally blocked (Docker); 2 providers only |
| MCP / A2A | Child-process non-execution + result redaction proof; HTTP/SSE; passport/A2A policy | Discovery, risk scoring, network/endpoint enforcement | **P** inline / **W** discovery | WebSocket bypass; no fleet evidence |
| Agent identity & action safety | Passport, intent, capability checks, approvals, escrow, dry-run, action ledger; pre-exec wrappers | Enterprise identity inventory, least-privilege, behavioral chains | **P** model / **W** deployment | Unwrapped tools bypass |
| Model supply chain | Static-only formats, signed-manifest gated ONNX loader, AI-BOM | Registry discovery, 35+ formats, threat intel, CI/MLOps | **W** breadth | Supported loader only; external loaders bypass |
| Browser / IDE | 145/145 browser; packaged VS Code + Windsurf; Cursor package-only | Endpoint/browser/IDE fleet sensors + discovery | **P** local / **W** fleet | Cursor host runtime unproven |
| RAG / document | Bounded OpenXML/HTML static inspection + quarantine | Managed document/RAG screening at scale | **P** pattern | Parser isolation + adversarial corpus incomplete |
| Multilingual detection | Hybrid pipeline, provisional Hinglish, external-run package | Vendor-claimed 100+ languages, calibration, intel | **W/U** | No same-corpus/accelerator run |
| Policy architecture | Canonical 8-verb envelope, 12 adapters, fail-safe ABSTAIN | Central control planes w/ posture/compliance context | **P** conceptual | Legacy/external callers may skip the PEP |
| Privacy / data protection | Local scanning, redaction, credential non-forwarding, bounded evidence | Enterprise lineage/DSPM/DLP, regional/compliance controls | **S**-local minimization / **W** enterprise | No independent privacy certification |
| Reliability | Retry/DLQ/stale-lease/drain, bounded resources, clean build | Multi-region SLOs, failover, fleet telemetry, support | **W** | No multi-instance/DR/outage proof |
| Performance | Gateway p50/p95/p99 ≈ 13.1/19.3/22.5 ms overhead; 77.4 rps @ c=20; MCP 5×300-iteration controlled protocol: 5 of 6 budgets pass, cold simple-allow p95 **miss** (8.106 ms vs 8 ms) | Managed-service latency/SLO claims; optimized OSS gateways | **W/U** | Not boundary-normalized; one MCP budget still missed |
| Extensibility | SDKs (JS/Python/Go), n8n/workflows, adapters, browser/IDE, JSON/SARIF/CycloneDX | OSS gateway plugin/provider ecosystems, enterprise catalogs | **P** surface / **W** ecosystem | Smaller install/plugin base |

---

## 5. Where SoterAI can claim genuine technical distinction

1. **Breadth-in-one-repo with reproducible proof.** A single checkout contains gateway + MCP + tool
   wrappers + browser + IDE + broker + model scanner + doc sandbox + policy plane, all with a green
   suite (966 tests). Competitors typically ship these as separate products/SKUs.
2. **Honest capability registry.** Every enforcement claim is graded, with registered bypasses and
   explicit DETECTION_ONLY / UNSUPPORTED labels — a transparency posture competitors do not publish.
3. **Non-executing model scanning.** Static, bounded inspection that never deserializes/executes
   artifacts, with signed-manifest fail-closed loading and CycloneDX AI-BOM evidence.
4. **Privacy-minimal evidence.** Credential non-forwarding, redaction runtime proof, raw model bytes
   excluded from AI-BOM.
5. **Canonical decision envelope.** One 8-verb contract + evidence fingerprint across all PEPs with
   fail-safe `ABSTAIN` on unknown mappings — an internal-consistency property rarely documented
   elsewhere in one codebase.

**No categorical “superior to all competitors” claim is defensible.** Strengths are local and
architectural; they are not independently validated against any named competitor under a shared
workload.

---

## 6. Where SoterAI is verifiably behind (priority gaps)

1. **Production/fleet proof** — multi-instance failover, sustained load, DR, provider-outage handling.
2. **Discovery & intelligence** — shadow-MCP/agent discovery, server risk scoring, threat-intel feed.
3. **Network/endpoint interception** — SoterAI is routed/proxy-based; no estate-wide interception.
4. **Scanner ecosystem breadth** — formats, CI/registry integrations, MLOps lifecycle.
5. **Multilingual detection at scale** — vendor claims (100+ languages) unmet/unverified here.
6. **Managed enterprise rollout** — SSO/SCIM at org scale, central control plane, support SLAs.
7. **Stable MCP cold simple-allow p95** — 8.106 ms vs 8 ms budget on the median of five controlled
   300-iteration trials (range 5.61–10.51 ms). Cost is attributed to the detection tier, not plumbing;
   the warm path passes at 4.222 ms.

---

## 7. The only comparison that would settle it

A **same-corpus, boundary-normalized, independently witnessed** evaluation is required to make any
head-to-head claim on detection quality, false positives, latency, resilience, or TCO. Until then:

- SoterAI = **architecturally competitive, locally reproducible, honestly graded.**
- Market leaders = **operationally proven at enterprise scale, publicly benchmarked (vendor-side).**

---

## 8. Verification record (this session)

- Full root suite re-executed: **966 pass, 6 skipped, 0 fail** (~63 s).
- Capability registry: 22 entries, `honest: true` (10/8/1/1/2 split).
- MCP gateway present as standalone publishable package `@soterai/mcp-gateway@0.1.0`.
- Historical/context baselines: `docs/SOTERAI-FINAL-TECHNICAL-COMPETITOR-COMPARISON.md`,
  `docs/SOTERAI-TECHNICAL-SUPREMACY-REPORT.md`.

## 9. Public competitor sources (vendor-documented claims, not independently reproduced)

- Palo Alto Networks Prisma AIRS (runtime, AI Model Security)
- Cisco AI Defense (data sheet, model/app validation)
- Check Point AI Agent Security; Check Point/Lakera acquisition metrics
- Prompt Security (agentic AI / MCP gateway; browser & endpoint sensors)
- HiddenLayer model scanner; Google Cloud Model Armor; Amazon Bedrock Guardrails (+ AgentCore)
- Noma (agentic access control); Zenity; Cyberhaven
- Portkey gateway, Kong, LiteLLM, OpenGuardrails (OSS gateways)

*Public pages describe what vendors document — not proof under SoterAI’s workloads, and vice-versa.*
