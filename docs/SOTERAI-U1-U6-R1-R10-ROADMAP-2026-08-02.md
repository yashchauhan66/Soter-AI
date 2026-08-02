# SoterAI vs U1–U6 unsolved problems + R1–R10 predictions — repo-truth map & build plan
Date: 2026-08-02 · Basis: `artifacts/security/capabilities.json` v0.2.1 + repo files, nothing claimed without a path.
Honesty: "HAVE" = code + tests in repo today. "PARTIAL" = scaffold exists, not wired/verified. "MISSING" = no artifact.

## A. U1–U6 unsolved battlegrounds — have / partial / missing / next action

| # | Unsolved problem | SoterAI status | Repo evidence | Next action (priority) |
|---|---|---|---|---|
| U1 | **Memory-integrity for agents** (persistent-memory poisoning across sessions) | **PARTIAL→strong base** | `lib/guard` memoryPoisoning detector + docs/ai-memory-inspector.md + `app/ai-memory-inspector/` page | **P0** — wire memory-write gate into agent runtime: every memory upsert goes through `analyzeText`+blastRadius before persist; add rollback tag per write. Test: poison-then-recall eval. |
| U2 | **Multi-turn / session-trajectory attacks** (crescendo, slow-build across turns) | **HAVE (verified)** | `tests/guard/multi-turn-safety.test.ts`, `tests/guard/echoleak-killchain.test.ts`, session window in `lib/guard/analyze.ts` | **P2** — extend window >10 turns + cross-session carry. Already strongest-in-class; harden, don't rebuild. |
| U3 | **Agentic-browser hijacking** (indirect injection via page/DOM into agent) | **PARTIAL** | `apps/extension/` + `tests/extension-csrf-origin.test.ts`, `docs/browser-extension-*` — CSRF/origin guard yes; full DOM-injection-to-tool-call chain not end-to-end | **P0** — content-script → canonical-decision adapter for tool-call intents originating from page text; test vs injected DOM payload. |
| U4 | **Agent payment-security (AP2 / x402)** | **MISSING** (closest analog exists) | Ed25519 `tests/agent-passport.test.ts` + `tests/escrow.test.ts` give signing + funds-hold primitives, but no AP2/x402 mandate format | **P1** — build `lib/payments/`: mandate verify (agent-passport signature on amount+payee+expiry), escrow hold → release on verified action receipt. None of PANW/Cisco/Lakera ship this → category-defining. |
| U5 | **Continuous MCP/tool-catalog integrity + shadow-MCP discovery** | **HAVE (verified)** | `tests/mcp-gateway.test.ts`, `tests/mcp-poisoning-obfuscation.test.ts`, tool-chain drift in `tests/tool-chain.test.ts`, `packages/mcp-gateway/src/MCPResultInspector.ts` | **P1** — add *discovery*: enumerate registered servers vs config allowlist, flag unregistered (shadow-MCP). Mostly present; discovery delta is small. |
| U6 | **A2A multi-agent cascade security** | **PARTIAL** | `tests/a2a-security.test.ts`, blastRadius in capabilities, `tests/agent-intent.test.ts` (intent guard) | **P1** — provenance chain through A2A hand-offs: carry signed intent token hop-to-hop, stop cascade at depth/blastRadius cap. |

## B. "Boring but paid" pains → already-addressed vs gap

| Pain | SoterAI today | Gap → action |
|---|---|---|
| False-positives on business vocab | **0/300 benign FP** measured (`scripts/eval/eval-ml-benign.ts`) | ✅ best-in-class — market it loudly. |
| Guardrail latency tax | **3.1–3.2 ms p95 enforced** (`artifacts/perf/mcp-latency-bench.json`) + 38,546 req/s ML harness | ✅ none — beat everyone's claimed <50ms. |
| Agent observability blind-spot | `lib/evidence vault` + `tests/evidence-vault.test.ts` (signed receipts) + `tests/causal-siem.test.ts` | **P2** — open telemetry exporter so SOC tools ingest SoterAI receipts natively. |
| Audit / insurance evidence | `scripts/compliance/report.mjs` → 22-control hash-stamped report + SOC2 pack | ✅ strongest in class. |
| SMB affordability | ₹999–₹9,999 + self-host, vs all competitors $$$$ | ✅ none. |
| Rules-file / hooks injection (TrapDoor) | Model-scan supply-chain gate + `scripts/ml/sign-model-artifact.ts` runtime gate | **P1** — add `lib/agentConfig/` scanner for `.cursorrules`, hooks JSON, `mcp.json` before agent reads them. |
| Slopsquatting (fake-package agent pulls) | `tests/model-scan.test.ts` + HF fetch-scan in scanner roadmap | **P1** — package-name typosquat check vs allowlist on dependency-add action. |

## C. R1–R10 predictions → what to pre-build

| # | Prediction | SoterAI read | Pre-build now |
|---|---|---|---|
| R1 | Foundation labs absorb basic guardrails | Basic prompt-filter commoditises; enforcement+evidence don't | Double down on pre-execution + signed receipts (not replicable by a model filter). |
| R2 | **EU AI Act enforcement 2 Aug 2026** | Audit/evidence becomes mandatory | `scripts/compliance/report.mjs` already emits control evidence → add EU-AI-Act Annex-IV mapping template. **P0, cheapest win.** |
| R3 | Agent financial-crime wave | Payments become the attack surface | U4 payments module → positions SoterAI as the only answer. |
| R4 | Memory-poisoning mainstream | U1 becomes headline | Ship U1 P0 now, publish first CVE-style writeup. |
| R5 | A2A adoption accelerates | Cascade risk scales | U6 hop-signed intent tokens. |
| R6 | Cross-modal injection (image/audio/doc) | Beyond text | **P2** — extend `tests/rag-document-formats.test.ts` to image-embedded text (OCR) + audio transcript path. |
| R7 | Consolidation | Only platforms with enforcement+compliance survive acquisition | Keep 7-surface single policy plane — the moat. |
| R8 | Deterministic, auditable detection wins | Black-box guard APIs lose enterprise trust | Already core (rules + calibrated OOD abstention + model card). ✅ moat. |
| R9 | Solo-maintainer trust ceiling | Enterprises distrust 1-person vendor | Compliance-as-code + SOC2 pack + signed releases directly counter. Already shipping. |
| R10 | Benchmark credibility crisis | Self-claimed numbers get ignored | Witness-ready `benchmarks/soterai-public-benchmark` is the antidote. ✅ done — next: get 1 external witness to run it. |

## D. Ranked execution order (weeks, solo-feasible)

1. **U1 memory-write gate + rollback eval** — closes the scariest 2026 headline vector. (P0)
2. **U3 browser-DOM → tool-call adapter + injected-DOM test** — completes the agentic-browser story. (P0)
3. **R2 EU-AI-Act Annex-IV evidence template** off `scripts/compliance/report.mjs`. (P0, days)
4. **U4 payments mandate-verify + escrow release** on agent-passport. (P1)
5. **U5 shadow-MCP discovery** delta. (P1, small)
6. **U6 signed hop-token cascade cap**. (P1)
7. TrapDoor rules-file scanner + slopsquatting check. (P1)
8. R6 cross-modal extension. (P2)
9. Telemetry exporter for evidence-vault. (P2)

> Net effect: U1, U3, U4 are **unsolved by every tracked competitor** (PANW, Cisco, CP/Lakera, HiddenLayer, PromptSec, GMA, Portkey — none publish memory-integrity, agentic-browser-DOM, or agent-payment enforcement). Shipping the three P0/P1 items converts SoterAI from #2 overall to the **only vendor with answers to the three 2026 headline attack classes** — that is the durable #1 argument, and it is buildable, not aspirational.
