# Testing and Red-Team Benchmark Plan

## Test pyramid

| Layer | Purpose | CI cadence |
|---|---|---|
| Unit/property | normalization, detectors, redaction, policy, crypto, parsers | every PR |
| Contract | API schemas, SDK compatibility, event/webhook versions | every PR |
| Integration | Postgres, Redis, DynamoDB, Qdrant, queues, workers | every PR/nightly by cost |
| Tenant security | two-org/user/project/key negative matrix | every PR for critical routes |
| Browser | packaged Chrome/Edge extension and managed policy | PR smoke/nightly full |
| Automation | n8n/Flowise/Botpress deployed API workflows | nightly/release |
| Load/chaos | latency, saturation, dependency degradation, event loss | nightly/release |
| Adversarial | fixed holdout, adaptive, multi-turn, RAG, MCP, multimodal | PR smoke/nightly full |
| External | independent pentest/red team | pre-GA and material architecture change |

## Required datasets

| Dataset | Positive families | Critical negatives |
|---|---|---|
| Prompt injection | direct, indirect, hierarchy, HTML/Markdown, source relocation | legitimate instructions, security discussion, quoted attacks |
| Jailbreak | DAN/role-play/persona, refusal suppression, hypothetical, multilingual | fiction, policy analysis, benign role-play |
| Secrets | cloud/model/payment/source-control/JWT/private key/DB/webhook | docs placeholders, hashes, public IDs, high-entropy benign strings |
| PII | global and India-specific formats, contextual variants | invalid checksum, order numbers, dates, email/UPI ambiguity |
| Hindi/Hinglish | injection, jailbreak, PII, obfuscation and code-switching | benign support and translation |
| RAG poisoning | hidden instruction, ranking manipulation, cross-document chain, media | clean technical/legal/financial documents |
| Tool-call injection | tool description/schema/output, cross-tool exfiltration | safe read-only and approved writes |
| Indirect injection | web/email/PDF/RAG/browser/tool response | quoted/untrusted content that should be summarized safely |
| Output leakage | system prompt, secrets, private facts, paraphrases | public facts and allowed summaries |
| Multimodal | invisible text, layout, QR, adversarial image/audio | normal scans, screenshots, diagrams |

Use synthetic or authorized data only. Record source, license, labeler, version, hash and split. Keep a never-tuned holdout.

## Scorecard

| Metric | Definition | Gate |
|---|---|---|
| Detection rate/recall | TP/(TP+FN), per family and severity | No critical family below approved floor |
| False-positive rate | FP/(FP+TN), per use case/language | ≤ agreed policy budget |
| Precision/F1 | supporting quality metrics | trend, not sole release gate |
| Bypass rate | successful adversarial objectives / attempts | decreasing; zero known critical unmitigated in release suite |
| Redaction precision/recall | entity/character span correctness | no raw critical secret in safe output |
| Multi-turn time-to-detect | turn index for attack escalation | within pre-action boundary |
| p95/p99 latency | by boundary/payload/concurrency | within published SLO |
| Cost/1,000 | compute/provider/storage at named mix | within plan margin/budget |
| Dashboard query speed | p95 by time range/event count | within SLO |
| Tenant isolation | cross-tenant attempts denied | 100% tested negative cases denied |
| Secret leakage | canary in response/log/event/export/telemetry | 0 leakage in test |
| Policy enforcement | golden cases consistent across surfaces | 100% consistency |

## CI gates

- Fast PR suite: unit, typecheck, contract, critical tenant cases, benchmark smoke, SAST/SCA/secrets.
- Nightly: full corpora, provider-backed integration, browser E2E, load, container/IaC scan.
- Release: reproducible build, SBOM, signed image/package, full scorecard, migration rehearsal, rollback drill evidence.
- Benchmark regression requires review when recall drops, FPR rises, latency/cost breaches, or a category sample count changes materially.

## Red-team operating procedure

1. Define authorized target, data, time, methods and stop conditions.
2. Test objective completion, not keyword matching: exfiltrate canary, invoke forbidden tool, cross tenant, persist poisoned memory, exhaust budget.
3. Preserve minimal redacted evidence and trace IDs.
4. Classify root cause across identity, prompt, data, tool, memory, policy, storage and operations.
5. Add a failing regression, fix, rerun fixed holdout, and document residual risk.
6. Separate internal results from independent assessments in all public claims.

## Current baseline

On 2026-07-05 the repository main suite passed 665 tests. This is strong regression evidence, but many tests are source-structure or in-process tests. The current disclosed classifier benchmark is 1,218 cases with 84.26% recall, 0.54% FPR and 0.9189 ROC-AUC; multi-turn recall is 60% on five attack sequences. Sample size and internal provenance limit external conclusions.
