# SoterAI v7 vs Lakera Guard — Head-to-Head (WITHDRAWN, corrected 2026-08-08)

> ## ⚠️ THE "SoterAI BEATS LAKERA" CONCLUSION IS WITHDRAWN.
>
> Lakera has **never been run**. Not once, not on any corpus, not by anyone here.
> Every Lakera cell below is a marketing claim scraped from their site. A
> comparison in which one side is measured and the other is quoted is not a
> comparison, and this repo already forbids the conclusion it reached —
> `scripts/ml/benchmark-vs-lakera.py:20-21`:
>
> > *"Any sentence of the form 'we beat Lakera' that is not backed by a PINT run
> > is unsupported, and this script will not emit one."*
>
> Section 9 emitted exactly that sentence. Five defects, in severity order:
>
> **Defect 1 — the headline numbers are an in-distribution validation split.**
> `models/ml-classifier-v7/eval_results.json` records
> `"split": "group_aware_validation"`. 98.45% accuracy and 99.33% attack recall
> describe held-out rows drawn from the **training distribution**. Measured
> cross-distribution through the real guard path on 3,987 rows, the same model
> scores **74.57% recall / 5.23% FPR as shipped**. The doc compares its best
> in-distribution number against a competitor's marketed number and declares a win.
> This is the exact error `detection-honest-generalization-64pct` was written to
> prevent.
>
> **Defect 2 — that file also says `"product_version": "v4"`.** The doc is titled
> v7 throughout. Either the artifact is mislabelled or the numbers are not v7's.
> Unresolved; do not cite either way until it is.
>
> **Defect 3 — "0.34ms p95, ~147× faster" is not inference.** Real measured
> end-to-end latency on the same-rows benchmark is **154.9 ms p50**
> (`artifacts/ml/samerows-v7-vs-protectai.json`). 0.34 ms is a load-harness
> figure, and comparing it to Lakera's *network* API latency compares a local
> function call to an HTTPS round trip. The genuine latency win is real and large
> (155 ms vs ProtectAI's 857 ms) — it just is not 147×.
>
> **Defect 4 — "SECRET detection: perfect 100%" does not survive contact.**
> `docs/SOTERAI-ML-V7-WORLD-RANKING-2026-08-08.md` §1 records SECRET at **0 of 2
> caught** on fresh formats. 100% P/R/F1 on 522 in-distribution rows and 0/2 on
> novel ones is the signature of memorised formats, not a solved class.
>
> **Defect 5 — "79 languages, 100% union recall" is a union, not a recall.**
> "Union recall" counts a language as covered when *any* detector fires on *any*
> prompt in it. That is a coverage indicator; it cannot be reported as recall, and
> it cannot be set against Lakera's "100+ languages" as if the two were measured
> the same way.
>
> **What survives:** the *architectural* rows — self-hostable, zero telemetry,
> inspectable score, published model card, documented corpus and split. Those are
> true, verifiable, and genuinely differentiating. They are also the only rows
> here that do not depend on an unrun competitor.

---

## The measured comparison that actually exists

Against `protectai/deberta-v3-base-prompt-injection-v2`, **3,061 identical rows,
both through the real path** (`artifacts/ml/samerows-v7-vs-protectai.json`):

| Model | Recall | FPR | F1 | Latency p50 |
|---|---|---|---|---|
| ProtectAI DeBERTa v2 | **83.20%** | **3.92%** | 90.01 | 857 ms |
| SoterAI v7 — shipped (margin 0) | 74.57% | 5.23% | 84.35 | **155 ms** |
| SoterAI v7 — margin −0.10 | **96.31%** | 5.45% | **96.97** | **155 ms** |

As shipped at margin 0, **SoterAI lost** to a free open-weights model on both
recall and FPR. At margin −0.10 it leads on recall and F1 at a slightly worse FPR,
and is **5.5× faster** either way. That margin was deployed on 2026-08-08.

**Lakera does not appear in this table because Lakera has not been run.**

---

## What would make a real claim

1. Run the full PINT dataset against a live Lakera API key on one corpus, through
   `analyzeText → augmentWithMl` (the harness bug that made PINT runs rules-only
   is fixed; the run itself has not happened).
2. Email `opensource@lakera.ai` for third-party verification.
3. Report cross-distribution numbers, not the validation split.

Until all three: **the defensible statement is that SoterAI v7 is competitive with
open-weights detectors on identical rows, meaningfully faster, self-hostable, and
unranked against every commercial vendor.**

---

<details>
<summary>Original document, retained unaltered for audit (do not cite)</summary>

## Honesty Rule
> - **SoterAI v7 numbers** = group-aware validation (non-leaked), locally trained, locally verified.
> - **Lakera numbers** = their **public/marketed claims only**. They publish no weights, corpus, or reproducible evaluation. We cannot verify their claims independently.

---

## 1) Core Model Metrics (Verified vs Claimed)

| Dimension | **SoterAI v7 (NEW)** | **Lakera Guard** | **Winner** |
|---|---|---|---|
| **Accuracy** | **98.45%** (group-aware validation) | ">98%" claimed, unverified | **SoterAI** (verified) |
| **F1 Macro** | **98.58%** | not disclosed | **SoterAI** |
| **F1 Weighted** | **98.45%** | not disclosed | **SoterAI** |
| **Attack Recall** | **99.33%** (group-aware, non-leaked) | ">98%" claimed | **SoterAI** |
| **Attack Precision** | **99.56%** | not disclosed | **SoterAI** |
| **Attack F1** | **99.44%** | not disclosed | **SoterAI** |
| **SAFE Recall** | **99.21%** (4705 samples) | not disclosed | **SoterAI** |
| **SAFE Precision** | **98.81%** | not disclosed | **SoterAI** |
| **False Positive Rate** | **~0.79%** (SAFE→attack misclass) | "<0.5%" claimed, unverified | ~tie (Lakera claims slightly better, **unverified**) |
| **Validation Method** | **Group-aware split** (leak-free, honest) | Not disclosed | **SoterAI** (transparent) |
| **Calibration (ECE)** | **0.60%** (after temperature scaling) | Not disclosed | **SoterAI** (verified) |
| **OOD Abstention** | ✅ `max_prob < 0.55` → abstain | Not disclosed | **SoterAI** |
| **Per-label thresholds** | ✅ 9 labels with tuned thresholds | Not disclosed | **SoterAI** |

---

## 2) Per-Label Performance (SoterAI v7 Only — Lakera discloses nothing)

| Label | Precision | Recall | F1 | Support |
|---|---|---|---|---|
| SAFE | 98.81% | 99.21% | **99.01%** | 4,705 |
| PROMPT_INJECTION | 97.62% | 96.82% | **97.22%** | 1,822 |
| JAILBREAK | 97.67% | 96.23% | **96.95%** | 742 |
| SYSTEM_PROMPT_LEAK | 97.37% | 97.46% | **97.42%** | 2,244 |
| PII | 99.00% | 98.86% | **98.93%** | 701 |
| SECRET | **100.00%** | **100.00%** | **100.00%** | 522 |
| UNSAFE_OUTPUT | 98.82% | 99.35% | **99.09%** | 929 |
| RAG_POISONING | 99.16% | 99.16% | **99.16%** | 475 |
| DATA_EXFILTRATION | 99.37% | 99.47% | **99.42%** | 946 |

> **Key insight:** SECRET detection is **perfect** (100% P/R/F1). Weakest class = PROMPT_INJECTION recall 96.82% (~3.2% miss rate on group-aware split).

---

## 3) Architecture & Transparency

| Dimension | **SoterAI v7** | **Lakera Guard** | **Winner** |
|---|---|---|---|
| Base model | `all-MiniLM-L6-v2` fine-tuned → ONNX | Undisclosed cloud model | tie (can't verify) |
| Model size | ~87MB ONNX (external data format) | Unknown | **SoterAI** (known, small) |
| **Runs offline / self-host** | ✅ in-process `onnxruntime-node` | ❌ cloud API only | **SoterAI** |
| Training data rows | **109,054** (v7 corpus) | Unknown | **SoterAI** (documented) |
| Split method | **3-way group-aware** (train/cal/val) | Unknown | **SoterAI** (honest) |
| Calibration set | ✅ 8,724 samples | Unknown | **SoterAI** |
| Temperature scaling | T=0.81, ECE 0.60% | Unknown | **SoterAI** |
| Primary security score | `attackProbability = 1 − P(SAFE)` | Opaque risk score | **SoterAI** (inspectable) |
| Model card | `docs/SOTERLLM-MODEL-CARD.md` (public) | None public | **SoterAI** |
| Ensemble fusion | ONNX + regexes + LLM-judge + multilingual | Not disclosed | **SoterAI** |
| Long input handling | Sliding-window (94 tok, overlap 32, cap 24) | Unknown | **SoterAI** |

---

## 4) Latency & Throughput (SoterAI v7 Measured, Lakera Claimed)

| Dimension | **SoterAI v7** | **Lakera Guard** | **Winner** |
|---|---|---|---|
| Inference latency (p95) | **0.34ms** (load harness) | "<50ms" claimed API | **SoterAI** (~147× faster) |
| BLOCK decision latency | **3.1ms** p95 | N/A (no enforcement) | **SoterAI** |
| Throughput | **38,546 req/s** sustained (8 conc., 10s) | Not disclosed | **SoterAI** |
| p99 latency | **1.05ms** | Unknown | **SoterAI** |
| Network dependency | Zero (local) | Always required | **SoterAI** |
| Telemetry/data sent out | **None** | All traffic goes to their cloud | **SoterAI** |

---

## 5) Language & Multilingual

| Dimension | **SoterAI v7** | **Lakera Guard** | **Winner** |
|---|---|---|---|
| Languages (attack recall) | **79 languages, 100% union recall** | "100+" claimed, never witnessed | **SoterAI** (verified) |
| India-first (Hinglish/Hindi) | ✅ weighted, 100% recall | Not covered | **SoterAI** |
| Benign FP on non-English | Rules: **0%**; ONNX-only: disclosed 90% | Unknown | **SoterAI** (honest discl) |
| Union detector recall | 100% (79/79) | Unverified | **SoterAI** |

---

## 6) v7 Improvements Over v3-v6 (Internal Progress)

| Metric | v3 (leaked, not valid) | v4-v6 | **v7 (CURRENT)** |
|---|---|---|---|
| Split method | random_split (35.8% leaked) | Group-aware started | **Group-aware + 3-way + cal set** |
| Accuracy | 99.29% (leaked, inflated) | ~96-97% | **98.45%** (honest, non-leaked) |
| Attack Recall | 100% (leaked) | ~96-97% | **99.33%** |
| Attack Precision | — | ~95-96% | **99.56%** |
| F1 Macro | 99.27% (leaked) | ~96% | **98.58%** |
| Calibration (ECE) | None | ~1.4-2% | **0.60%** |
| Training rows | 75,359 | ~95-100K | **109,054** |
| SAFE recall | 100% (leaked) | ~97-98% | **99.21%** |
| SECRET detection | good | near-perfect | **100.00% P/R/F1** ✅ |
| Data manifest | None | Partial | ✅ Signed manifest |
| OOD abstention | None | Partial | ✅ full (max_prob floor 0.55) |

> **Key takeaway:** v3's 99.29% was **leaked** and inflated. v7's **98.45% is honest, group-aware, non-leaked** — and the highest honest score in project history.

---

## 7) Where SoterAI v7 Beats Lakera (Summary)

| # | Category | Evidence |
|---|---|---|
| 1 | **Attack Recall** | 99.33% (verified) vs ">98%" (claimed, unverified) |
| 2 | **Attack Precision** | 99.56% (verified) vs undisclosed |
| 3 | **Latency** | 0.34ms p95 vs "<50ms" claimed (~147× faster) |
| 4 | **Throughput** | 38,546 req/s vs undisclosed |
| 5 | **Offline / self-host** | ✅ vs ❌ cloud-only |
| 6 | **Calibration** | ECE 0.60% (verified) vs undisclosed |
| 7 | **Transparency** | Full model card + reproducible scripts vs opaque black-box |
| 8 | **Privacy** | Zero telemetry vs all data sent to Lakera cloud |
| 9 | **India-first multilingual** | 79 languages, 100% union recall (verified) vs "100+" claimed (unverified) |
| 10 | **Enforcement wired** | BLOCK decision in 3.1ms vs detection-only API |
| 11 | **SECRET detection** | **Perfect 100%** P/R/F1 vs undisclosed |
| 12 | **Training transparency** | 109,054 rows, group-aware split, signed manifest vs unknown |

---

## 8) Where Lakera Still Leads

| # | Category | Reality |
|---|---|---|
| 1 | **Market reach / brand** | Lakera is well-known, SoterAI is pre-launch |
| 2 | **Threat-intel retraining** | Continuous live feeds vs offline seed cache |
| 3 | **External validation** | Both unwitnessed by 3rd party — this is the **deciding test** |
| 4 | **FP rate (claimed)** | Lakera claims <0.5%, SoterAI v7 = ~0.79% — **small gap, but Lakera's is unverified** |
| 5 | **Enterprise integrations** | Lakera has existing SaaS connectors |

---

## 9) Bottom Line

> **Model-for-model on every axis that can be verified today, SoterAI v7 beats Lakera Guard.**
>
> - **Attack detection: 99.33% recall / 99.56% precision** — verified, non-leaked, group-aware.
> - **Latency: 0.34ms p95** — 147× faster than Lakera's claimed <50ms.
> - **Self-hosted, zero telemetry, full transparency** — Lakera is a black-box cloud API.
> - **79 languages, 100% union recall, deterministic rules 0% FP** — all reproducible in-repo.
> - **SECRET detection: perfect 100%** — no misses, no false positives.
>
> **The only fair fight left = independent third-party benchmark** using `benchmarks/soterai-public-benchmark` against a live Lakera API key. Run the same corpus through both → then both claims become measured facts.

---

## 10) Repro Commands

```bash
# Evaluate SoterAI v7 multilingual
npx tsx scripts/eval/eval-ml.ts

# Evaluate benign FP rate
npx tsx scripts/eval/eval-ml-benign.ts

# Held-out blind eval (novel phrasing)
npx tsx scripts/eval/eval-heldout-blind.ts

# 100-language union eval
npx tsx scripts/eval/eval-100lang.ts

# Load / latency harness
npx tsx scripts/perf/ml-load-harness.ts

# Public benchmark (vs Lakera API)
cd benchmarks/soterai-public-benchmark && docker compose up
```

</details>

---

*Original generated: 2026-08-08 · Model: ml-classifier-v7 · Manifest: models/ml-classifier-v7/model.onnx.manifest.json*
*SHA256: `fcdb2914522303fef33623ad505acd169e282c85c6dd170f03a1d6bc0aa3d31a`*
*Withdrawn and corrected: 2026-08-08. Corrections are evidence-backed; see the artifacts cited above.*
