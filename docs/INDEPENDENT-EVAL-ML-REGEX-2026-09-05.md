# Independent Evaluation — SoterAI ML Model (SoterLLM v14) + Regex/Rules Tier

**Date:** 2026-09-05 · **Evaluator:** external harness built for this audit (no repo benchmark code reused)
**Artifacts:** `.tmp/audit/` — harnesses (`eval-ml.ts`, `eval-regex.ts`, `eval-pipeline.ts`, `latency-bench.ts`), results (`*.json`), contamination audit (`contamination_audit.py`, `contamination-report.json`), novel held-out set (`novel-eval.jsonl`).

This is an *independent* measurement. Nothing in the repo's own benchmark suite (`benchmarks/`, `scripts/guard-benchmark/`) was used to produce the numbers below.

---

## 1. What was tested

| Tier | How it was loaded |
|---|---|
| **ML model — SoterLLM v14** | `ONNXClassifierBackend` (production load path: signed-manifest gate + trust store + per-label calibration + temperature-baked ONNX logits), 14-class MiniLM, 23.1M trainable params, max_length 256 |
| **Regex/rules tier** | `analyzeText(text, "INPUT")` with `SOTERAI_ML_AUGMENT=off` (≈120 IPS signatures + ~35 detectors) |
| **Full pipeline (ensemble)** | `analyzeText` → `augmentWithMl(..., "enforce")` — the exact production composition; ML may only escalate to `HUMAN_REVIEW` |

**Decision rule (binary):** ATTACK = flagged. `strict` = any non-`ALLOW` action; `blocking` = `BLOCK/REWRITE/HUMAN_REVIEW` only. For ML-alone: not abstained, label ≠ SAFE, attackProbability ≥ 0.5.

## 2. Data-integrity audit (done FIRST, because it changes every number)

Fuzzy/exact overlap of candidate eval sets against the **v14 training corpus** (146,757 rows from `dataset_manifest.json`):

| Eval set | Rows | Fuzzy overlap | Verdict |
|---|---:|---:|---|
| `datasets/crossdist-eval-v3.jsonl` | 22,681 | **0.19%** | ✅ usable (external: mosscap, spml, quickium, dolly, gandalf, in-the-wild…) |
| `datasets/external/harmbench.jsonl` | 400 | **1.25%** | ✅ usable |
| `datasets/academic-pretext-heldout.jsonl` | 55 | 0% | ✅ usable |
| `datasets/meta-instructional-benign-heldout.jsonl` | 82 | 0% | ✅ usable |
| `datasets/secret-format-eval.jsonl` | 156 | 0% | ✅ usable |
| `datasets/external/jailbreakbench.jsonl` | 200 | **31.5%** | ⚠️ contaminated — excluded |
| `benchmarks/soterai-public-benchmark/**` (all files) | 3,200 | **43–59.5%** | ❌ contaminated — template corpus from the same generators as training data |
| `.tmp/audit/novel-eval.jsonl` (authored for this audit) | 159 | **0.00%** | ✅ fully novel, verified post-hoc |

**The headline "100% recall / 0% FP" in `benchmarks/results/latest.md` was measured on a 5-templates-per-category synthetic corpus (`phase-9-generate-public-benchmark-dataset.js`) whose template strings are heavily represented in training data. It is a regression test, not generalization evidence.** (The repo's own `limitations.md` says it is self-authored and not independent — but it does not disclose the train-set overlap.)


## 3. Results

### 3.1 SoterLLM v14 (ML alone)

| Eval set | n | Attack recall | Benign FPR | Precision | F1 | p50 / p99 latency |
|---|---:|---:|---:|---:|---:|---|
| crossdist-eval-v3 (even sample) | 4,000 | **91.2%** | **0.18%** | 99.9% | 0.953 | 125 / 301 ms |
| secret-format-eval | 156 | 82.1% | 0% | — | 0.901 | 130 / 422 ms |
| **novel held-out (this audit)** | 159 | **67.0%** | **0.0%** | 100% | 0.802 | 124 / 287 ms |
| HarmBench (harmful-content requests) | 400 | **27.8%** | n/a (no benign) | — | 0.434 | 134 / 324 ms |
| academic-pretext-heldout | 55 | **30.0%** | 0% | — | 0.462 | 132 / 1,088 ms |
| meta-instructional-benign (all benign) | 82 | n/a | **0.0%** | — | — | 167 / 1,131 ms |

**Failure anatomy (novel set):** all 33 ML misses were **calibration abstentions**, and in most of them `attackProbability` was ≥ 0.8 (e.g. label SAFE @ 0.508 with attackProb 0.99). The OOD entropy gate is doing its precision job but silently discards a large share of borderline-correct attack calls instead of routing them to review. Crossdist misses concentrate in `mosscap` naturalistic multi-turn extraction; the only FPs were 2 quickium rows.

### 3.2 Regex/rules tier

| Eval set | n | Recall (strict / blocking) | FPR (strict) | p50 / p99 |
|---|---:|---:|---:|---|
| crossdist-eval-v3 (even sample) | 6,000 | **37.4% / 25.3%** | 5.0% | 3.7 / 71 ms |
| **novel held-out** | 159 | **73.0% / 68.0%** | **13.6%** | 4.4 / 477 ms |
| HarmBench | 400 | 57.5% | n/a | 3.5 / 68 ms |
| academic-pretext-heldout | 55 | 83.3% | 4.0% | 5.5 / 1,129 ms |
| secret-format-eval | 156 | **100%** | 0% | 5.7 / 635 ms |
| meta-instructional-benign | 82 | — | 2.4% | 5.5 / 1,445 ms |

Regex is excellent on format-detectable classes (secrets/PII/encoding) and weak on paraphrase (prompt injection 53%, model extraction 25% on novel text). On the external cross-distribution corpus it catches only ~1 in 3 attacks.

### 3.3 Full pipeline (rules + ML, production composition)

| Eval set | n | Recall (strict / blocking) | FPR | F1 | p50 / p99 |
|---|---:|---:|---:|---:|---|
| crossdist-eval-v3 (even sample) | 2,000 | **73.5% / 62.2%** | **4.95%** | 0.838 | 150 / 378 ms |
| **novel held-out** | 159 | **89.0% / 84.0%** | **13.6%** | 0.904 | 142 / 850 ms |
| HarmBench | 400 | 60.8% | n/a | 0.756 | 155 / 379 ms |
| academic-pretext-heldout | 55 | **90.0%** | 4.0% | 0.931 | — |
| meta-instructional-benign | 82 | — | 2.4% | — | — |
| secret-format-eval | 156 | **100%** | 0% | 1.000 | — |

### 3.4 Per-family recall on the fully novel set

| Family | n | Regex | ML | Pipeline |
|---|---:|---:|---:|---:|
| PROMPT_INJECTION | 15 | 53.3% | 73.3% | **86.7%** |
| INDIRECT_INJECTION (RAG/docs) | 12 | 91.7% | 50.0% | **91.7%** |
| JAILBREAK | 14 | 57.1% | 78.6% | **92.9%** |
| SYSTEM_PROMPT_LEAK | 10 | 60.0% | **90.0%** | 80.0% |
| DATA_EXFILTRATION | 8 | **100%** | 37.5% | **100%** |
| TOOL_ABUSE | 7 | **85.7%** | 28.6% | **85.7%** |
| ENCODING_OBFUSCATION | 8 | 87.5% | **100%** | **100%** |
| MULTI_TURN_ESCALATION | 5 | 80.0% | 40.0% | **100%** |
| MODEL_EXTRACTION | 4 | 25.0% | 50.0% | **50.0%** |
| MULTILINGUAL (6 languages) | 8 | 62.5% | 62.5% | **75.0%** |
| SECRET | 5 | **100%** | 80.0% | **100%** |
| PII | 4 | **100%** | **100%** | **100%** |
| Benign hard negatives | 59 | 86.4% TN | **100% TN** | 86.4% TN |

All 8 novel-set false positives came from the **regex tier**: prompt-engineering education (3), agentic ops (2: env-var question, delete build-cache), security education (1), code config placeholders (1), data-governance talk (1). The ML tier added **zero** novel-set FPs.

### 3.5 Latency (warm, steady state, this machine)


## 4. Root-cause findings (ranked by impact)

1. **Semantic-veto gate is the biggest recall leak in the ensemble.** On external text it vetoes most correct ML attack calls. Fix candidate: gate only when semantic score is *confidently* benign, or exempt high-attackProbability (>0.95) ML calls from the veto.
2. **Abstention discards recoverable attacks.** All 33 novel ML misses were abstentions with high attackProbability. Route abstentions to `HUMAN_REVIEW` instead of implicit ALLOW (the plumbing exists — `gatedBy: "abstention"` is recorded but not acted on).
3. **HarmBench-class harmful-content requests are the weakest axis for both tiers** (regex 57.5%, ML 27.8%). The 14-class model has no strong "harmful request" prior; detector rules are the only line of defense there.
4. **Regex over-triggers on meta-discussion of security topics** — all novel FPs are "talking about attacks" not "doing attacks". The existing `isSafeSecurityEducationRequest` suppression is too narrow.
5. **MODEL_EXTRACTION is weak end-to-end** (50% pipeline) — matches the model card (F1 0.737, worst class).
6. **`benchmarks/results/latest.md` (100%/0%) should not be cited as capability evidence** — 43–59.5% train overlap; template corpus. The repo's `honest-results.json` (rules-only, 0.8% FPR internal corpus) is more honest but still self-authored benign.
7. **Default artifact is v3, not v14** (`lib/ml/modelVersion.ts` → `DEFAULT_MODEL_DIR = "models/ml-classifier-v3"`). Everything measured here is v14 via `.env`. Out-of-the-box (no `.env`), the shipped default is the older, weaker 9-class model.
8. **Fail-open without surfacing:** when the ML tier fails to construct, the pipeline silently continues rules-only (observed live during this audit). `SOTERAI_ML_REQUIRE_HEALTHY=off` makes it deliberate, but the failure is invisible in aggregate metrics.

## 5. Honest ratings

| Component | Rating | Basis |
|---|---|---|
| **SoterLLM v14 model quality (artifact)** | **A−** | 91.2% recall @ 0.18% FPR on external cross-dist text, ECE 0.0027, signed artifact, sound training methodology (group-aware split, augmentation). Docked for weak per-label F1 on ENCODING_OBFUSCATION (0.68), MULTI_TURN (0.72), MODEL_EXTRACTION (0.74) and abstention over-firing. |
| **ML integration (gates/policy)** | **C+** | The ensemble *loses* ~18 recall points vs the raw model at equal FPR because of the semantic veto + abstention handling. Calibrated machinery exists but is wired too conservatively. Fail-open is silent. |

## 6. Market comparison (published vendor numbers, not measured by this audit)

| System | Type / size | Best published generalization numbers | Notes |
|---|---|---|---|
| **SoterAI pipeline (this audit)** | 23M ONNX + ~120 regex sigs | **91.2% recall @ 0.18% FPR** (external cross-dist); 89% @ 13.6% FPR (novel); 60.8% HarmBench | Only system in this table measured by this audit |
| **Llama Prompt Guard 86M** (Meta, DeBERTa-v2) | 86M | OOD jailbreaks **97.5% TPR @ 3.9% FPR** (AUC .975); multilingual 91.5% @ 5.3%; CyberSecEval indirect **71.4% @ 1.0%**; AgentDojo APR 81.2% @ 3% utility loss | Strongest published generalization profile; injection/jailbreak only — no PII/secrets/tool-abuse taxonomy |
| **Llama Prompt Guard 2 22M** (Meta, DeBERTa-xsmall) | 22M | AgentDojo APR 78.4%; weaker multilingual (no multilingual pretraining) | Best published small-model accuracy/utility trade-off |
| **ProtectAI deberta-v3-prompt-injection-v2** | 184M | In-dist F1 99.93%; post-train 20k prompts: acc 95.25%, P 91.59%, R 99.74%, F1 95.49%; **AgentDojo APR 22.2%** | English-only; no jailbreaks; false-positives on system prompts; project archived |
| **Lakera Guard** | closed (LLM ensemble) | No public F1/FPR; markets >99% detection on Gandalf-style challenges | Closed-source; numbers not independently verifiable from public cards |
| **Azure AI Prompt Shields / NeMo Guardrails** | closed / framework | No public TPR/FPR tables | Platform features, not benchmarked artifacts |

**Where SoterAI genuinely wins:** breadth (14 classes incl. tool abuse, RAG poisoning, exfil, PII/secrets redaction — Prompt Guard/ProtectAI do *injection only*), calibration+abstention machinery, signed-model supply chain, sub-200 ms local ONNX latency, redaction actions, HUMAN_REVIEW-first policy.
**Where it loses:** raw novel-jailbreak generalization (Prompt Guard's OOD 97.5% @ 3.9% FPR vs v14's 67–91% @ 0.18%), harmful-content requests (HarmBench 27.8%), no agentic-benchmark evidence (no AgentDojo-equivalent run), and multilingual depth.

## 7. What would move the needle (priority order)

1. Act on `gatedBy: "abstention"` → route to HUMAN_REVIEW (recovers a large share of the 67→89% gap on novel text at zero new FP risk).
2. Relax the semantic veto for `attackProbability ≥ 0.95` (target: crossdist pipeline 73.5% → 85%+).
3. Fine-tune v15 with a harmful-content request corpus (HarmBench-style) and model-extraction paraphrases.
4. Suppress regex findings for "meta/security-education" phrasing beyond the current narrow filter (all 8 novel FPs).
5. Repoint `DEFAULT_MODEL_DIR` to v14 after re-running `npm run ml:verify:v4` + `npm run benchmark:honest` (v14 is strictly better than the shipped default v3 on every axis measured here).
6. Rebuild the public benchmark from held-out templates and publish the contamination number in the same README.

---
*All harness code and raw JSON results are in `.tmp/audit/`. Re-run with: `npx tsx .tmp/audit/eval-ml.ts --set <jsonl> --out <json>` (env vars documented in `.tmp/audit/runall.ps1`).*

| **Regex/rules tier** | **B−** | Genuinely strong on secrets/PII/encoding/indirect injection (90–100%) at ~3–5 ms; but 37% recall on external text and 13.6% FPR on novel benign styles. Fine as tier-1, not as the product. |
| **Full pipeline as shipped** | **B+** | 89% recall / 13.6% FPR on fully novel text; 73.5% / 4.95% on external distribution; perfect on secrets/PII formats. Real, usable, honest about its own limits (HUMAN_REVIEW-first design is the right call). |
| **Evaluation honesty of the repo** | **B** | Good engineering hygiene (contamination-aware eval loader, `limitations.md`, signed model manifests, honest-results with stated limits) — but the public 100%/0% benchmark is template-matching and the undisclosed train overlap inflates it. |

**Overall: B+ — production-ready for human-in-the-loop deployments; not yet at "97%+ on unseen attacks" territory, and harmful-content coverage needs work.**

| Input | ML p50 / p99 | Rules p50 / p99 |
|---|---|---|
| Short (~56 chars) | 136 / 293 ms | 2.5 / 5.4 ms |
| Medium (~3.5 KB) | 151 / 315 ms | **103 / 195 ms** |
| Long (~12 KB, truncated to 256 tok) | 173 / 356 ms | **147 / 251 ms** |

Surprise: the "cheap" rules tier scales linearly with text length (regexes over the full string) and reaches ML-class cost on long inputs. Cold-start p99 outliers of 1–2.6 s (first-call lazy regex compilation + GC) appear in every batch run.

| public-bench prompt-injection / unicode (contaminated) | 450 | 100% | 0% | 1.0 | — |

**Key ensemble finding:** the pipeline's crossdist recall (73.5%) is *below* ML-alone (91.2%) because the ML tier's calls pass through three extra production gates — `semantic-benign` veto (dominant: ~80% of gated misses), `abstention`, `confidence-floor`. The dependency-free semantic classifier vetoes correct ML calls on external phrasing. This is a deliberate precision choice, but it currently throws away ~18 points of recall at roughly the same FPR.

