# SoterAI — Chart-Form Technical Comparison + World-Best Strategy
**Date:** 2026-07-31 · **Evidence:** 966/966 tests green · Registry 22 caps (`honest:true`) · Purely technical, no marketing

Legends used everywhere:
- Verdict: **S**=SoterAI stronger · **P**=architectural parity · **W**=competitor stronger · **U**=unverified/no data
- SoterAI evidence ladder: `Absent → Shell → Partial → Implemented → Unit-tested → Integration-tested → Runtime-verified → Packaged-verified → Production-proven → Independently validated`

---

## 1) ONE MASTER CHART — capability vs 11 competitors

Each cell = SoterAI verdict vs that competitor on that capability (S/P/W/U).

| Capability | PANW AIRS | Cisco AI Def | CP/Lakera | PromptSec | HiddenLayer | Google MA | Bedrock Gr | Noma | Zenity | Cyberhaven | Portkey/Kong |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Hosted LLM gateway (inline) | P | P | P | P | — | W | W | P | — | — | **W** |
| MCP pre-execution enforce | P | P | P | P | — | P | — | P | P | — | **S**(local proof) |
| Tool-call wrappers (LC/Vercel) | P | — | P | P | — | — | — | P | — | — | **S** |
| IDE extension enforcement | W | — | P | **W** | — | — | — | — | W | W | **S**(local) |
| Browser extension enforcement | W | — | P | **W** | — | — | — | — | W | W | **S**(local) |
| Static model-file scanning | P | P | — | — | **W** | — | — | — | — | — | — |
| Non-executing model scan | P | P | — | — | **S** | — | — | — | — | — | — |
| RAG / document sandbox | P | P | P | — | — | **W** | P | — | — | — | — |
| Detection breadth (local) | P | P | **W** | P | P | W | W | — | — | — | P |
| Multilingual scale | **W** | **W** | **W**(100+) | U | — | W | W | — | — | — | U |
| Policy plane (canonical verbs) | P | P | P | P | P | P | P | P | — | P | **S** |
| Decision evidence envelope | P | P | P | P | P | P | P | — | P | P | **S** |
| Agent identity / passport | P | P | P | P | — | — | P | **W** | P | — | **S** |
| Approval / escrow / dry-run | P | P | P | P | — | — | P | **W** | P | — | **S** |
| Audit / AI-BOM evidence | P | P | — | P | P(ML-BOM) | P | P | — | P | P | **S** |
| Performance overhead | U | U | **W**(claimed 50ms) | U | — | W | W | U | — | — | U |
| Production / multi-tenant / HA | **W** | **W** | **W** | **W** | **W** | **W** | **W** | **W** | **W** | **W** | **W** |
| Discovery (shadow AI/MCP) | **W** | **W** | **W** | **W** | — | P | P | **W** | **W** | **W** | — |
| Threat-intel-driven detection | **W** | **W** | **W** | P | P | W | — | — | — | — | — |
| Compliance packs (SOC2/EU AI) | W | W | P | W | P | W | W | W | W | W | — |
| Zero-config onboarding | P | P | P | P | P | P | **S** | P | P | P | P |
| Local / self-hostable | **S** | **S** | **S** | **S** | **S** | P | P | **S** | **S** | **S** | P |
| Reproducible test evidence | **S** | **S** | **S** | **S** | **S** | **S** | **S** | **S** | **S** | **S** | P |
| Honest capability registry | **S** | **S** | **S** | **S** | **S** | **S** | **S** | **S** | **S** | **S** | **S** |
| Radical transparency posture | **S** | **S** | **S** | **S** | **S** | **S** | **S** | **S** | **S** | **S** | P |

`—` = capability not a focus of that competitor (treated as absent, not as their weakness).

---

## 2) WHERE I AM BEST (SoterAI wins — S)

| Area | Why SoterAI leads | Verified proof |
|---|---|---|
| Local / self-hostable enforcement | Runs fully on-prem; data never leaves host | runtime-verified broker + gateway core |
| Reproducible test evidence | Anyone can re-run the entire gate locally | 966/966 green this session |
| Honest capability registry | Claims graded; bypasses registered; detection-only/unsupported labeled | `capabilities.json honest:true` |
| Non-executing model scanning | Static bounded scan; never deserializes model bytes | source-verified; 31/31 |
| Tool-call wrappers (LC/Vercel) | Pre-execution suppression inline in frameworks | integration-tested |
| Canonical 8-verb decision plane | One contract + fail-safe ABSTAIN across PEPs | source + contract tests |
| Approval/escrow/dry-run depth | Exactly-once approval, escrow, dry-run before action | integration-tested |
| Privacy-minimal evidence | No credential forwarding, redaction proven, raw bytes excluded | runtime-verified |

---

## 3) REAL MARKET GAPS NO ONE IS FILLING WELL (your opportunity zone)

These are true, defensible gaps in the *current* market — not yet occupied at scale.

| # | Real market gap | Why it exists | Can SoterAI fill it? | Effort |
|---|---|---|---|---|
| G1 | **Local-first, zero-telemetry MCP guard** | Everyone pushes SaaS; devs want offline enforcement | **Yes — already 80% there** | Low |
| G2 | **Unified enforcement across IDE+browser+MCP+gateway in ONE policy plane** | Vendors own 1–2 surfaces each | **Yes — closest today** | Medium |
| G3 | **Verifiable, inspectable decision evidence (not opaque scores)** | Competitors emit black-box verdicts | **Yes — core differentiator** | Low |
| G4 | **Non-executing, offline static model scanner** | scanners run untrusted bytes in CI | **Yes — already built** | Low |
| G5 | **Deployable reference benchmark harness** (same-corpus, boundary-normalized) | No neutral, reproducible harness exists | **Yes — you have the tooling** | Medium |
| G6 | **Pre-execution tool suppression in frameworks** (not after-the-fact log) | Most monitor post-hoc via proxy | **Yes — built, needs hardening** | Low |
| G7 | **Signed real-time enforcement receipts** (tamper-evident per-decision) | Audit trails exist; cryptographic receipts rare | **Yes — extend evidence envelope** | Medium |
| G8 | **Deterministic low-latency guard for on-device/edge agents** | Detections built for cloud GPUs | **Yes — bias to deterministic tier** | Medium |

---

## 4) WHERE COMPETITORS ARE AHEAD (their lead)

| Area | Leader(s) | Their verifiable/claimed edge |
|---|---|---|
| Production multi-tenant/HA/fleet | ALL enterprise vendors | Mature managed ops, SLOs, failover |
| Discovery (shadow AI / shadow MCP) | PromptSec, Noma, Zenity, Cyberhaven | Endpoint/SaaS discovery you lack |
| Threat-intel-driven detection | Cisco, CP/Lakera, PANW | Continuously updated intel feeds |
| Multilingual scale | CP/Lakera (100+ langs claimed), PANW, Google | Calibrated multilingual pipelines |
| Detection tuned performance (latency/FP) | CP/Lakera (vendor numbers) | Optimized managed inference |
| Managed egress/proxy at scale | Bedrock Guardrails, Model Armor | Org/account-level enforcements |
| MLOps lifecycle + registry integration | HiddenLayer, PANW | CI/CD + registry + lifecycle hooks |
| FinOps / cost governance / routing QoS | Portkey, Kong, LiteLLM | Provider routing, budgets, quotas |
| Assurance / red-teaming services | PANW, Cisco | Continuous validation programs |
| Compliance certifications | Cisco, PANW, Bedrock | SOC2/ISO/production attestations |

---

## 5) MY COMPLETE TECHNICAL STRENGTHS

| Strength | Tier | Notes |
|---|---|---|
| Single-policy-plane coverage of gateway/MCP/IDE/browser/tools | Rare | No published equivalent combo |
| Honesty/auditability of claims | Unique | Self-graded, bypasses registered |
| Reproducible verification | Rare | Full suite re-runnable locally |
| Offline non-executing model scan | Unique-ish | Safety + portability |
| Deterministic-first detection (bounded, local) | Rare | Predictable latency; no GPU dependency |
| Privacy-minimal data handling | Rare | Credential non-forward, redaction, byte exclusion |
| Pre-execution suppression in frameworks | Emerging lead | Few vendors do true inline tool suppression |
| Canonical evidence envelope | Rare | Cross-surface forensic consistency |

## 6) MY COMPLETE TECHNICAL WEAKNESSES

| Weakness | Severity | Impact |
|---|---|---|
| No production/multi-tenant/HA runtime proof | Critical | Blocks enterprise credibility |
| No discovery (shadow AI/MCP/agent inventory) | High | Blind to unmanaged estate |
| No threat-intel feed; detection = static/local | High | Lower adaptive detection |
| Multilingual holdout unverified | High | Global enterprise blocker |
| MCP simple-allow p95 unstable (14.17ms vs 8ms) | Medium | Perf discipline gap |
| WebSocket MCP unsupported | Medium | Coverage hole |
| Only 2 hosted provider families (OpenAI/Anthropic) | Medium | Gateway breadth limited |
| No compliance certifications (SOC2/ISO) | Medium | Procurement friction |
| No enterprise control plane/SSO-at-scale | Medium | Central mgmt gap |
| No independent validation of any metric | Medium | Claims not third-party verified |

---

## 7) HOW TO MAKE IT WORLD-BEST — actionable high-leverage roadmap

### Phase 1 — Own the un-served niches (0–90 days)
1. **Ship "SoterAI Local-First Guard"** — offline MCP+IDE+browser enforcement, zero telemetry, deterministic-only tier. Market it as the only fully offline runtime AI guard. (Fills G1, G8)
2. **Publish a verifiable-benchmark kit** — a Dockerized, same-corpus harness comparing SoterAI vs OSS gateways (Portkey/OpenGuardrails) on identical payloads. *Let others reproduce it.* (Fills G5)
3. **Cryptographically signed decision receipts** — extend evidence envelope with hash-chained receipts per decision. Position as "court-admissible AI enforcement logs." (Fills G7)
4. **Fix MCP simple-allow p95** — profile, eliminate unstable path, lock a stable budget gate in CI. (Closes weakness)

### Phase 2 — Close credibility gaps (90–180 days)
5. **Production proof pack** — K8s Helm + multi-instance failover test + DR drill + provider-outage test (all scripted & reproducible).
6. **Shadow-MCP/agent discovery (local subnet + IDE telemetry)** — detection-first, then enforcement opt-in. (Turns a "W" into a differentiator)
7. **External loader gating** — extend beyond ONNX to SafeTensors/GGUF mandatory signed manifests; register known-bypass closure.
8. **WebSocket MCP transport** — remove the biggest registered bypass.

### Phase 3 — Claim category leadership (180–365 days)
9. **"Runtime AI-BOM + live provenance graph"** — model scan results feed a live, queryable AI bill-of-materials tied to runtime decisions. Nobody ships scan→runtime linkage.
10. **Independent validation** — commission a witnessed same-corpus eval (detection/FP/latency) vs 2 named competitors; publish raw results.
11. **On-device/edge SDK** — sub-10ms deterministic guard for mobile/embedded agents. (G8)
12. **Compliance-as-code** — map every control to SOC2/EU-AI-Act clauses auto-generated from the registry (your `honest:true` registry becomes a compliance artifact competitors can't produce).

### Phase 4 — Moat (365+)
13. **Federated threat-intel with local-only privacy** — share detection patterns, never raw data (differential-privacy-assisted).
14. **Regulated-industry kits** (health/finance/gov) — pre-hardened policies + signed receipts + local-first.

---

## 8) HOW TO FILL GAPS COMPETITORS AREN'T FILLING — practical tips

1. **Compete where they're structurally weak, not strong.** They are SaaS-heavy → you win local-first. They are detection score → you win verifiable receipts. They are post-hoc → you win pre-execution suppression.
2. **Turn your honesty ledger into the product.** No competitor can easily publish a self-graded capability registry without exposing gaps. Make "radical transparency" your wedge.
3. **Win developers before enterprises.** OSS gateway + local guard + IDE first; enterprises follow developer adoption (Portkey/Kong playbook, but with security-first posture).
4. **Standardize the benchmark before they do.** If you publish the neutral harness, you define the comparison axis — and competitors get measured on *your* terms.
5. **Integrate, don't rebuild.** Use HiddenLayer-class scanner APIs as one input into your non-executing + signed-receipt layer — you become the trust fabric, not just another scanner.
6. **Quantify one killer metric.** Pick "decision latency p95 with enforcement ON" and make it stable, externally visible, and hard to beat for SaaS proxies.
7. **Ledger everything.** Signed, hash-chained, replayable decision logs are sellable to compliance — a category SaaS dashboards don't serve.

---

## 9) THE ONE DEFINING DIFFERENTIATOR

> **SoterAI is the only AI-security platform whose every claim is verified by a re-runnable local test gate and emitted as a cryptographically inspectable decision receipt across gateway, MCP, IDE, browser, and model-sandbox — with no mandatory cloud and no opaque scores.**

Own that sentence. Build the receipts + local-first + benchmark trifecta, and the "weaker vs leaders" rows above stop mattering because you'll be competing in a category **you** defined.

---

*All verdicts reference verified local evidence or vendor-public claims; nothing here is an independently witnessed head-to-head result. Run Phase-1 #2 to change that.*
