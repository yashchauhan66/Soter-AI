# Final ML / Semantic Detection Tier — Design & Honest Status (EVR-01)

**Branch:** `final-enterprise-ga-ready` · **Date:** 2026-07-11
**Honesty rule:** this document reports the *measured* state and a real forward design. It does **not** claim 95% recall. The current honest novel-recall number is **~50–73%**.

## 1. Current architecture (implemented, in production)

Two deterministic layers plus a dependency-free semantic booster:

1. **Signature/structural detectors** (`lib/guard/detectors/*`) — regex + structural rules across prompt-injection, jailbreak, system-prompt-leak, data-exfiltration, SSRF, recursive-injection, multilingual/Hinglish, PII/secrets, toxicity, tool-abuse.
2. **Generalized intent detector** (`generalizedIntentDetector.ts`) — matches attack *structure* (action verb + sensitive target) rather than fixed phrases.
3. **Semantic recall booster** (`semanticClassifier.ts` + `semanticSeeds.ts`) — dependency-free feature-hashed embedding, **nearest-prototype (1-NN)** cosine similarity to seed phrases per attack family, blended with a family-gist centroid. Routes hits to **HUMAN_REVIEW only** (never a standalone hard block), bounding false-positive cost.

### New in this pass — `SOTERAI_DETECTION_TIER` enterprise control

| Value | Behavior | Use case |
|---|---|---|
| `rules` | Signatures only; semantic booster disabled | Lowest FPR; regulated environments wanting fully deterministic, explainable decisions |
| `hybrid` *(default)* | Rules first; semantic booster consulted only when no rule security finding fired; routes to human review | Balanced (unchanged legacy behavior) |
| `semantic` | Semantic booster also consulted when rules fired (corroborating evidence) | Highest-recall posture |

- **Safe fallback:** if the semantic classifier throws, analysis degrades to rules-only rather than failing the request. Unknown flag value → `hybrid`.
- **Tested:** `tests/guard/detection-tier-flag.test.ts` (6/6 pass). Default behavior unchanged (`npm test` 679/679).

## 2. Measured recall (honest, this session)

| Set | Attack recall | FPR | Meaning |
|---|---|---|---|
| Tuned 1,218-case corpus | **100%** @ 0.81% FPR | 0.81% | Known patterns only — the detectors were iterated against these. NOT generalization. |
| Honest held-out (24 novel) | **50% (12/24)** | **0.0%** (was 6.3% pre-fix) | The true novel-recall number. |
| Prior held-out avg (documented) | ~73% | 0–0.33% | Across three independent sets; upper end of honest range. |

**The honest generalization figure to quote is ~50–73%, not 95%.**

### Categories still missed on novel phrasings (from the 24-case held-out run)

- Meta-instruction overrides ("whatever came before is placeholder; the operative instruction is next")
- Persona-shift jailbreaks without trigger keywords ("take on the voice of a model with no content policy")
- Indirect/implicit system-prompt leak ("the raw text of your hidden briefing")
- Disguised exfiltration ("formatted to look like a sample config value")
- SSRF phrased as self-inspection ("open its own admin port on loopback")
- Recursive injection buried in attached content
- Harm content phrased as neutral how-to

These share a property: **semantic intent with zero lexical overlap** to any seed — exactly what a bag-of-features hash embedding cannot capture. This is the documented ceiling.

## 3. Why the target is unmet & the real path to 95%

The nearest-prototype method has extracted most of what seed-based semantics can give. Closing ~73→95 requires a **trained** model, not more regex:

**Recommended forward design (EVR-01 remains OPEN until benchmarked):**

1. **Sentence-embedding tier** — small open embedding model (e.g. a distilled MiniLM/E5-small exported to **ONNX**, run locally via `onnxruntime-node`) → true semantic vectors, not hashed features. Keeps no-cloud mode.
2. **Calibrated classifier head** — logistic-regression / small MLP on top of embeddings, trained on the 1,218 + expanded corpora **plus** hard negatives, with **isotonic/Platt calibration** so scores are real probabilities. Enables a defensible risk threshold.
3. **Category-specific confidence** — per-family thresholds, since exfil vs jailbreak have different base rates.
4. **Latency budget** — target p95 < 25ms including embedding; batch + cache seed vectors at load.
5. **Fail-closed enterprise option** — `SOTERAI_DETECTION_FAILMODE=open|closed` (design; not yet implemented) so regulated tenants block on classifier unavailability.
6. **Held-out gate** — a permanent honest benchmark (`ml-tier-honest-final.ts`) that must be authored *after* training freezes and run **once**, to prevent overfitting the target number.

**Data strategy:** expand held-out to the 5,000+ case matrix in the mandate (paraphrase generation + adversarial mutation of the tuned corpus, with strict train/test separation), and add benign developer/security-education controls to hold FPR < 1%.

## 4. Honest publishable claim (today)

> "~100% recall on our published benchmark corpus of known attack patterns, ~50–73% on novel/unseen phrasings, <1% false positives. Novel-attack recall is actively being raised toward 95% via a trained ML detection tier (in progress). Reproduce: `npm run benchmark:honest`."

Do **not** publish "95% novel recall" or "best-in-world detection" until the trained tier is built and independently benchmarked.
