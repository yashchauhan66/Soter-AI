# Why SoterAI

**Date:** 2026-07-09

## The Problem

AI tools are transforming how developers work, but they introduce new risks:

1. **Prompt injection** — Attackers manipulate AI to bypass safety rules
2. **Data exfiltration** — Sensitive code, secrets, and PII leak into AI tools
3. **RAG poisoning** — Malicious documents compromise AI knowledge bases
4. **Agent abuse** — AI agents perform unauthorized actions
5. **Shadow AI** — Employees use unapproved AI tools without oversight

## The Gap

Existing solutions have limitations:

| Solution | Limitation |
|---|---|
| AI provider safety | Can be bypassed, no organization control |
| DLP tools | Don't understand AI-specific threats |
| Open source tools | Require expertise, no managed platform |
| Enterprise platforms | Expensive, vendor lock-in, no India focus |

## Why SoterAI

### 1. Broad Coverage
Browsers, IDEs, APIs, RAG pipelines, and agent workflows — all from one platform. Public docs of the vendors in our [comparison](competitor-comparison.md) did not identify a single vendor covering all five surfaces as of 2026-07-10.

### 2. India-First Design
Native Hinglish and multilingual detection uncommon in our comparison set. Priced in INR for the Indian market.

### 3. Data Sovereignty
Self-hosted option keeps your data under your control. No vendor lock-in.

### 4. Accessible
Free tier for individual developers. 5-minute setup. No expertise required.

### 5. Honest
Never claims "best detection" without proof. Transparent about capabilities and limitations.

## Proof points (measured, with boundaries)

Stated per [`../marketing-claims-policy.md`](../marketing-claims-policy.md). Every number carries its measurement boundary — no boundary-free claims.

| Metric | Measured value | Boundary / limitation |
|---|---|---|
| Detection recall (tuned corpus) | 100% — 108 attacks / 1,110 benign (1,218 total) at 0.81% FPR | Internal corpus the detectors were iterated against; proves coverage of *known* wordings only. |
| Detection recall (untuned attacks) | ~64% | Regex ceiling on novel phrasings; ML/semantic tier is the roadmap path. Detail: [`../detection-honest-generalization.md`](../detection-honest-generalization.md). |
| Benign false-positive rate | 0–0.81% (0.33% on the expanded corpus) | Precision generalizes well. |
| Test suite | 679 tests passing (2026-07-10) | Repository regression suite; not an independent audit. |
| Integrations | 15+ integration targets with shipped code | Feature availability, not efficacy. |
| Analyzer CPU latency | ~4.6 ms p50 / ~7 ms p95 (in-process) | Excludes HTTP/auth/Redis/DB/network. HTTP guard p95 was 225 ms @ c=1 locally. See [`../performance-production-benchmark.md`](../performance-production-benchmark.md). |
| External validation | Not yet | No third-party pentest or independent benchmark completed. |

## Testimonial policy

We do **not** publish invented or placeholder testimonials. Customer quotes will appear only after a named customer gives written permission, scoped to what they actually observed (evidence level E3+ in the claims policy).
