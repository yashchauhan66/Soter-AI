# SoterAI ML v7 — World Ranking (WITHDRAWN, 2026-08-08)

> ## ⚠️ THIS RANKING IS WITHDRAWN. DO NOT CITE IT.
>
> Three defects were found on re-check the same day, each independently fatal to
> the ranking. The measured competitor comparison that survives is in
> `docs/research/SELF-IMPROVING-ML-ARCHITECTURE-REVIEW.md` and the memory note
> `model-ranking-measured-2026-08-08`. Section 1's live numbers are kept below
> because they are real; **sections 2–4 are struck**.
>
> **Defect 1 — the ranking table does not add up.** Lakera's row is
> `38 + 16 + 8 + 10`, which is **72**, not the 60 printed. Every other row sums
> correctly. Correcting only that arithmetic error moves Lakera to **#1 (72)** and
> SoterAI to **#2 (65)** — the "SoterAI ranks above Lakera" conclusion was produced
> by a single wrong addition, not by any measurement.
>
> **Defect 2 — the 60% headline does not measure this product.**
> `scripts/ml/real-black-box-v7-test.cjs` requires only `onnxruntime-node`. It
> never calls `analyzeText()` or `augmentWithMl()`, so it scores the **raw ONNX
> model with no rules tier, no precision gate, no calibration** — none of the
> system a user actually runs. It is the mirror image of the rules-only bug
> documented in `ml-tier-never-measured-crossdist-2026-08-08`: that one measured
> rules without ML, this one measures ML without rules. Neither is the product.
> Measured through the real path on 3,987 rows, the stack scores **96.31% recall
> at 5.45% FPR**, not 59–60%.
>
> **Defect 3 — n=30 cannot rank anything.** 22 attacks and 8 benign. A single
> benign row is 12.5% of the benign axis. The per-class table reports rates on
> denominators of 2 and 3 ("SECRET 2 → 0 ❌"), where one prompt swings the class
> from 0% to 50%. No confidence interval at that size excludes any ordering.
>
> **What is still true:** competitor numbers here are *public claims and PINT
> artifacts*, never live runs. Per `scripts/ml/benchmark-vs-lakera.py:20`, no
> "we beat Lakera" statement is supported without a PINT run against the live API,
> and that has still not happened.

---

## 1) Live run on the raw ONNX model (kept — real, but NOT the product)

**Scope correction:** every number in this section is the bare classifier, for the
reason in Defect 2. Read it as "how the model behaves alone", never as system
performance or as a competitor-comparable score.

| Metric | Fresh real value | Source |
|---|---|---|
| Prompts run (novel, out-of-corpus) | **30** | live run |
| Overall accuracy on novel set | **60.0%** | live |
| Attack recall (novel attacks) | **59.1%** (13/22 caught) | live |
| Benign accuracy | **62.5%** | live |
| Benign false-positives | **3** (37.5% of benign mis-flagged) | live |
| Inference latency p50 / p95 (this harness) | 117.5 ms / 177.9 ms | live (unoptimized, single-call loop) |
| Multilingual (HI/FR/JA) attacks | **1/3 caught** | live |

> ⚠️ This is the HONEST generalization number. The high eval (98.45%) in `eval_results.json` is on the model's own group-aware *validation* split. Fresh out-of-corpus prompts expose the real recall ceiling — same pattern the repo already documented for rules (`docs/detection-honest-generalization.md`).

### Per-class live result
| Class | Expected | Caught | Result |
|---|---|---|---|
| JAILBREAK | 3 | 3 | ✅ strong |
| SYSTEM_PROMPT_LEAK | 2 | 2 | ✅ strong (but over-fires on benign) |
| UNSAFE_OUTPUT | 2 | 2 | ✅ strong |
| PROMPT_INJECTION (novel paraphrase) | 4 | 3 | ⚠️ good |
| PII | 2 | 1 | ⚠️ missed phone/email |
| SECRET | 2 | 0 | ❌ missed BOTH live token formats |
| RAG_POISONING | 2 | 0 | ❌ missed both |
| DATA_EXFILTRATION | 2 | 1 | ⚠️ 1/2 |
| Multilingual injection | 3 | 1 | ❌ HI + JA missed |
| Benign (hard negatives) | 8 | 5 | ⚠️ 3 false-positives |

**Biggest real weakness found:** the model flags too many benign questions as `SYSTEM_PROMPT_LEAK_ATTEMPT` (3 benign FP) and misses some novel SECRET / RAG / multilingual forms. The earlier "SECRET = 1.0 F1 perfect" doc number did NOT hold on fresh secret formats.

---

## 2) ~~Same-harness comparison~~ — STRUCK

This section compared a 30-prompt raw-model run against PINT artifact scores and
called it "same-harness". It is not the same harness in any sense: different
corpus, different size, different code path (Defect 2), different measurement
year in some cases. Two numbers produced by unrelated procedures cannot be placed
in one column.

The honest same-rows comparison that exists is **SoterAI v7 vs ProtectAI DeBERTa
v2 on 3,061 identical rows through the real path**:

| Model | Recall | FPR | Latency |
|---|---|---|---|
| ProtectAI DeBERTa v2 | **83.20%** | **3.92%** | 857 ms |
| SoterAI v7 (shipped, margin 0) | 74.57% | 5.23% | **155 ms** |
| SoterAI v7 (margin −0.10) | **96.31%** | 5.45% | **155 ms** |

`artifacts/ml/samerows-v7-vs-protectai.json`. Lakera, Azure, Bedrock, Model Armor
and HiddenLayer were **never run** and therefore have no place in any ranking.

---

## 3) ~~WORLD RANKING~~ — STRUCK (the arithmetic produced the conclusion)

Reproduced only to show how the #1 claim was manufactured. **Corrected** totals:

| Model | Detection | Multilingual | Latency | Granularity | Printed | **Actual sum** |
|---|---|---|---|---|---|---|
| Lakera Guard | 38 | 16 | 8 | 10 | 60 ❌ | **72** |
| SoterAI v7 | 24 | 10 | 13 | 18 | 65 | 65 ✅ |
| AWS Bedrock | 32 | 8 | 9 | 9 | 58 | 58 ✅ |
| Azure Content Safety | 32 | 8 | 9 | 9 | 58 | 58 ✅ |
| Protect AI | 30 | 5 | 10 | 9 | 54 | 54 ✅ |
| Meta PG2 | 29 | 5 | 11 | 6 | 51 | 51 ✅ |
| Google Model Armor | 27 | 8 | 7 | 8 | 50 | 50 ✅ |

**One row was mis-added, and it was the row that decided the ranking.** Fixing only
that: Lakera 72 → #1, SoterAI 65 → #2.

Even corrected, the table should not be used. The weights (45/20/15/20) were chosen
without justification, "Detection" mixes live runs with vendor blurbs, and SoterAI's
detection score uses the raw-model 60% from Defect 2 while competitors use PINT
artifacts. **Two different rulers in one column.**

---

## 4) ~~Honest bottom line~~ — REPLACED

The defensible statement, from measurements that survive re-check:

> **SoterAI v7 is #2 of 3 detectors that have actually been run on identical rows**
> — behind ProtectAI DeBERTa v2 as shipped (74.57% vs 83.20%), ahead of it at
> margin −0.10 (96.31%) at a slightly worse FPR, and **5.5× faster** in both cases.
> PG2-86M measured 40.50%/0.22% on the same rows. **Its true world rank is unknown**,
> because most of the market — Lakera, Azure, Bedrock, NeMo, HiddenLayer, Robust
> Intelligence — has never been run here at all.

To make a real claim: run the full PINT dataset against live competitor APIs on one
corpus through `analyzeText → augmentWithMl`, and contact `opensource@lakera.ai`
for third-party verification. Neither has happened.

### Evidence
- Fresh live run: `reports/v7-real-black-box.json` · script: `scripts/ml/real-black-box-v7-test.cjs`
- Competitor artifact: `docs/SOTERAI-ML-COMPETITOR-GAP-MATRIX.md`
- Prior claim-based doc: `docs/SOTERAI-vs-LAKERA-ML-MODEL-V7-2026-08-08.md`
