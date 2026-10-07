# v18 post-training review — 2026-09-20

**Decision: hold this candidate; it is not a replacement for v14.** The downloaded Colab training run is complete, its local files are intact, and its smaller architecture improves measured CPU speed. Detection quality regresses against both v14 and the v17 multilingual teacher. The goal of a stronger, faster replacement has not yet been achieved.

## Completed work and evidence

- Recovered the previous session and continued from its completed import and four-model comparison; another upload or repeat of the same training run is unnecessary.
- Rehashed the 920,196,917-byte downloaded ZIP and all 14 imported files. Every hash and file size matches the September 19 import receipt. See [integrity verification](../artifacts/ml/v18-integrity-2026-09-20.json) and [original import](../artifacts/ml/v18-import-2026-09-19.json).
- Preserved the trained candidate in `models/ml-classifier-v18-student`. Its ONNX SHA-256 is `ecf9e1d2e957da6ba72b714a0fc0c8f8d566b48588c0257dfd8a309e4020fba5`.
- The prior [local PyTorch/ONNX check](../artifacts/ml/v18-local-parity-2026-09-19.json) passed with maximum absolute logit difference `2.15e-6` against tolerance `0.001`. This export check was already completed; this session verified that those files are unchanged.
- Extended `summarize-v18-comparison.py` to include the trained fourth model, require complete paired results, validate the artifact truncation mode, and save hash-bound error row indices. All four cached score sets and all six paired comparisons reproduce their recorded counts. See [paired analysis](../artifacts/ml/v18-candidate-comparison/analysis.json).
- Ran new native Node CPU compatibility, tokenizer, padding and long-input diagnostics. See [runtime verification](../artifacts/ml/v18-runtime-verification-2026-09-20.json).
- Audited teacher/student data lineage and recorded the exact overlap, source hashes, reproduction method and category/language weaknesses in [lineage audit](../artifacts/ml/v18-lineage-audit-2026-09-20.json).

## Detection quality

The same diagnostic set contains **2,000 attacks and 2,000 benign texts**, with a shared maximum length of 256, binary entropy budget 0.4, confidence floor 0.5, attack-probability floor 0.85 and input-label allowlist. These are **ML-only development diagnostics**. They exclude product rules, semantic veto and stateful authorization; they are not end-to-end product recall or independent release evidence.

| Model | Attacks detected | Attack recall | Benign falsely flagged | False-positive rate |
|---|---:|---:|---:|---:|
| v14 MiniLM | 1,795 / 2,000 | 89.75% | 327 / 2,000 | 16.35% |
| v17 MiniLM | 1,697 / 2,000 | 84.85% | 285 / 2,000 | 14.25% |
| v17 multilingual teacher | 1,763 / 2,000 | 88.15% | 272 / 2,000 | 13.60% |
| v18 compact student | 1,564 / 2,000 | **78.20%** | 366 / 2,000 | **18.30%** |

Against the teacher, v18 misses 199 additional attacks and flags 94 additional benign texts. Its largest category losses are prompt injection (361/514 versus 444/514), system-prompt leakage (170/294 versus 252/294), and jailbreak (226/295 versus 257/295).

On English examples, v18 detects 830/1,000 attacks and flags 341/1,762 benign texts; the teacher detects 939 and flags 243. On non-English examples, v18 detects 734/1,000 and flags 25/238; the teacher detects 824 and flags 29. Thus the student's small non-English false-positive improvement accompanies lower recall. The benign set could supply only 238 non-English examples, so aggregate results are not language balanced.

Hindi is 11/16 attacks detected, Hinglish 15/24, and Bengali/Tamil/Telugu 0/4 each. These small denominators expose gaps but cannot certify a language's general performance. The set also contains 686 PII attack rows; aggregate recall is not a uniform average across attack categories.

The regression persists beyond the chosen gate: attack-probability ROC AUC is 0.9139 for v18 versus 0.9613 for the teacher. At an **evaluation-selected** 5% false-positive ceiling, diagnostic recall is 64.6% versus 75.1%. These thresholds were selected on the same evaluation data and must not be deployed or presented as prospective calibration results. Simply lowering the deployment threshold has no supporting evidence as a fix.

## Why the training result looked stronger

The Colab run completed five epochs and selected epoch 5. Its internal test reported 7,203/7,242 attacks detected (99.46%) and 31/2,996 benign false positives (1.03%). However, **8,152 of its 10,238 internal test texts exactly match the teacher's training partition**; the remaining texts match teacher validation/calibration partitions. The teacher had already seen this corpus before distillation. Student split separation therefore does not make this test independent of the teacher's learned knowledge.

No concrete error was found in the detached-teacher, temperature-squared KL distillation calculation. Potential contributors requiring controlled experiments include simultaneous depth/width reduction from 6×768 to 3×384, heuristic channel slicing that recomposes attention heads, sparse multilingual coverage and selection using an internal validation set. These are hypotheses, not established causes. The optional language/group sampling file was not consumed by this training run.

The exported split manifest also retains misleading legacy descriptive fields (`group_aware_three_way_sorted_groups` and an old group count). Its actual four-way prepared indices were verified; the artifact was preserved as downloaded. Correct that metadata in a future export instead of rewriting historical provenance.

## CPU runtime results

The student has 51,810,575 parameters versus the teacher's 135,364,367: 61.7% fewer. The ONNX files are approximately 207.1 MB and 541.2 MB respectively; v14 is about 91.8 MB.

The new offline Node diagnostic uses 60 identical, deterministically selected texts per model, one CPU thread, warm sessions and alternating padding order. Timings include production tokenization, tensors, native inference and decision math. They exclude HTTP, rules, semantic processing, trust verification and model loading.

| Model | Dynamic p50 | Dynamic p95 |
|---|---:|---:|
| v14 | 34.53 ms | 66.97 ms |
| v17 multilingual | 91.88 ms | 173.47 ms |
| v18 | **15.54 ms** | **31.54 ms** |

There were zero fixed/dynamic decision changes and exact exported-tokenizer agreement on all 60 sampled texts per model. The literal-special-token fixture differs between the custom tokenizer and the Hugging Face export for all three models (1 of 8 additional edge probes). This remains a compatibility limitation. Long-input fixtures verified both complete coverage and accurately reported capped coverage, including the final window. They test coverage accounting, not long-input attack recall.

This diverse small sample and sequential model order do not establish production latency guarantees. The offline runner directly evaluates local unsigned models while leaving the production trust gate intact; it does not establish signed-model acceptance or exercise the full production guard. No model was signed, promoted or deployed.

## Reproduce and continue

Rebuild the four-model diagnostic analysis without loading model weights:

```powershell
python scripts/ml/summarize-v18-comparison.py --comparison-dir artifacts/ml/v18-candidate-comparison --rows artifacts/ml/v18-balanced-comparison-rows.jsonl --require-candidate --output artifacts/ml/v18-candidate-comparison/analysis.json
```

Run a new native runtime measurement into a separate output file:

```powershell
node --import tsx scripts/ml/verify-v18-runtime.ts --out artifacts/ml/v18-runtime-verification-new.json
```

Next model-development steps, in order:

1. Keep this candidate and all evaluation rows frozen. Obtain new native-reviewed benign/attack families for training and a separate source/family-held-out selection set; reserve another untouched release set. Exclude all prior evaluation examples and teacher-training overlap from independent evaluation.
2. Predeclare recall/FPR and CPU p50/p95 tolerances for the next experiment. Compare architecture and loss changes one at a time: a less aggressive depth/width reduction, the current student with and without KD, and independently reviewed multilingual coverage. Retain all checkpoints and compare on the new selection set. More epochs alone are not an evidence-based remedy.
3. Correct future export metadata and wire any optional sampling policy explicitly with a verified applied-sampling report. Do not count translations as independent families or claim the existing sampling file affected this run.
4. Train the selected next recipe on Colab, rerun this post-training evaluation, then use calibration-only thresholds and the complete guard on the untouched release set. Include contextual tool authorization, indirect/RAG injection and multi-turn checks.
5. Only after quality, runtime compatibility and release checks pass, prepare a signed deployment artifact with v14 available for rollback.

The post-training review of this ZIP is complete. A stronger replacement requires a new controlled training/evaluation cycle; the current evidence does not justify a market-leading or all-attacks claim.
