# Competitor Comparison

**Date:** 2026-07-10
**Governed by:** [`../marketing-claims-policy.md`](../marketing-claims-policy.md) — evidence-based only.
**Rules applied here:**
- Feature *breadth* is separated from *efficacy*, latency, scale, support, and price.
- Competitor cells state **"public docs did not identify … (as of 2026-07-10)"** rather than asserting absence. Vendor capabilities change; verify against primary sources and give any named vendor a correction path before external publication.
- SoterAI never claims "best detection." Our honest efficacy numbers are in the [Honest Efficacy](#honest-efficacy-soterai) section and in [`../detection-honest-generalization.md`](../detection-honest-generalization.md).

> **How to read the competitor columns.** ✅ = capability documented in the vendor's public materials as of the date above. "—" = **not identified in public documentation**, which is *not* proof of absence. This matrix compares **feature breadth**, not detection efficacy — no cross-vendor efficacy benchmark exists, so none is claimed.

## AI security platforms (feature breadth)

| Capability | SoterAI | Lakera | HiddenLayer | Protect AI | Prompt Security | Lasso |
|---|---|---|---|---|---|---|
| Prompt-injection detection | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Data-exfiltration / output guard | ✅ | ✅ | — | — | ✅ | ✅ |
| RAG document / grounding guard | ✅ | — | — | ✅ | — | — |
| Agent action / tool firewall | ✅ | — | — | — | — | — |
| Browser extension | ✅ | — | — | — | ✅ | ✅ |
| IDE / VS Code extension | ✅ | — | — | — | — | — |
| Self-hosted deployment | ✅ | ✅ | ✅ | ✅ | — | — |
| India / Hinglish detection | ✅ | — | — | — | — | — |
| Public self-serve pricing | ✅ (free + INR paid) | — | — | — | — | — |

## Open-source tools (managed-platform breadth)

| Capability | SoterAI | LLM Guard | Promptfoo | Garak | PyRIT |
|---|---|---|---|---|---|
| Managed platform / hosted API | ✅ | — | — | — | — |
| Dashboard UI | ✅ | — | ✅ | — | — |
| Inline real-time protection | ✅ | ✅ | — (test-time) | — (red-team) | — (red-team) |
| Browser / IDE surfaces | ✅ | — | — | — | — |
| SSO / SCIM governance | ✅ | — | — | — | — |
| India / Hinglish detection | ✅ | — | — | — | — |

> Promptfoo, Garak, and PyRIT are **evaluation / red-teaming** tools, not inline runtime guards — a different category. They are complementary to, not substitutes for, a runtime control plane. We use red-team corpora of this kind ourselves.

## Cloud-provider guardrails (portability breadth)

| Capability | SoterAI | Bedrock Guardrails | Azure Content Safety | Google Model Armor | NVIDIA NeMo Guardrails |
|---|---|---|---|---|---|
| Cloud-portable (not tied to one provider) | ✅ | AWS-oriented | Azure-oriented | Google-oriented | Framework/self-host |
| Self-hosted option | ✅ | — | — | — | ✅ |
| Browser / IDE surfaces | ✅ | — | — | — | — |
| Agent action / tool firewall | ✅ | partial | — | — | ✅ (programmable rails) |

## Where SoterAI is differentiated (verifiable)

These are breadth/architecture claims backed by shipped code in this repo, not efficacy claims:

1. **Surface breadth** — browser extension, IDE/VS Code extension, REST API, RAG pipeline, and an agent/tool firewall in one platform. (Public docs of the vendors above did not identify a single vendor covering all five as of 2026-07-10.)
2. **India / Hinglish** — native romanized-Hindi and multilingual detectors (`lib/guard/detectors/multilingualAttackDetector.ts`), uncommon in the compared set.
3. **Self-hosted + no provider lock-in** — runs on your own infrastructure.
4. **Free tier + transparent INR pricing** — accessible to individual developers.
5. **Published honesty** — we disclose the tuned-vs-held-out detection gap publicly (below).

## Honest efficacy (SoterAI) {#honest-efficacy-soterai}

Stated to the claims-policy template. **We do not publish a cross-vendor efficacy comparison** because no independent, like-for-like study exists.

| Metric | Measured value | Boundary / limitation |
|---|---|---|
| Recall on **tuned** corpus | 100% (108 attacks / 1,110 benign, 1,218 total) at 0.81% FPR, ROC-AUC 0.997 | Internal corpus the detectors were iterated against — proves coverage of *known* wordings, **not** generalization. Artifact: `scripts/guard-benchmark/honest-results.json`. |
| Recall on **untuned held-out** attacks | **~64%** (measured 50% → 62.5% → 64.3% across three independent held-out sets) | The regex/structural engine has a ~64% recall ceiling on novel phrasings. Closing to 95% needs the ML/semantic tier, not more regex. Gate: `tests/guard/heldout-generalization.test.ts`. |
| Benign false-positive rate | 0–0.81% (0.33% on the expanded corpus, 0% on held-out sets) | Precision generalizes well; recall does not yet. |
| Analyzer CPU latency | ~4.6 ms p50 / ~7 ms p95 (in-process) | Excludes HTTP, auth, Redis, DB, network. See [`../performance-production-benchmark.md`](../performance-production-benchmark.md). |
| Guard HTTP latency (local, single process) | p95 225 ms @ c=1, 845 ms @ c=10 | Local `next start`, single process; deployed multi-replica numbers are EVIDENCE REQUIRED. |
| External validation | **Not yet** | No third-party pentest or independent benchmark completed. Do not present internal results as independent. |

## Honest status summary

| Area | Status |
|---|---|
| Detection recall (tuned corpus) | 100% / 0.81% FPR — measured, internal, known wordings only |
| Detection recall (novel attacks) | ~64% — regex ceiling; ML/semantic tier is the roadmap path |
| External validation | Not yet (pentest + independent benchmark pending) |
| Scale testing | Local single-process measured; deployed 100/500-concurrency EVIDENCE REQUIRED |
| Enterprise features (SSO/SCIM) | Code complete; live IdP runtime testing pending |
