# SOTERAI ML Guard — Lakera-Comparison Transformation Report

**Status:** P0 forensic transformation complete; training and promotion blocked by missing independent data and full benchmark inputs  
**Report version:** `v1.0`  
**Date:** 2026-07-27  
**Repository commit at baseline:** `59714827c32c43317ac1f2ae0e72579880e3aed6`  
**Evidence policy:** local artifacts and reruns are distinguished from external or unverified claims

## Executive decision

SoterAI has **not** been demonstrated stronger than Lakera. The strongest comparable local artifact is `lakera_guard` at **95.22%** on a PINT-style benchmark, but the full 4,314-row PINT dataset is not present in this repository. SoterAI has only an eight-row bundled example smoke result, explicitly marked non-comparable by the v2 evaluator. No promotion, deployment, push, model replacement, or overwrite of existing artifacts was performed.

## 1. Repository protection and baseline

The working tree was already heavily modified (1,000+ status entries) and `main` was ahead/behind its remote. Existing modified and untracked files, datasets, checkpoints, and model artifacts were preserved. Baseline state was recorded in `tmp/soterai-ml-git-state.txt`.

No full local CPU training occurred. The Colab pipeline fails fast without CUDA and reports TPU as not implemented. Exact statement: **Current training implementation supports Colab CUDA GPU only; TPU support is not yet implemented.**

## 2. Architecture inventory

| Surface | Implementation | Finding |
| --- | --- | --- |
| Deterministic guard | `lib/guard/analyze.ts`, detector modules | Current default production path; strong local internal metrics |
| Guard-core | `packages/guard-core/src/` | Rules, evidence minimization, redaction, policy, cache |
| ML workflow | `lib/ml/training.ts`, `evaluation.ts`, `registry.ts`, `rollout.ts` | Heuristic/external API backend; registry/rollout/fallback scaffolding |
| Neural artifacts | `models/`, `tmp/*` | Existing artifacts observed, not promoted or runtime-verified |
| Training | `scripts/ml/soterai_training_pipeline.py` | CUDA Colab-only; checkpoints, calibration, manifests, hashes |
| Notebook | `notebooks/SOTERAI_ML_TRAINING_COLAB.ipynb` | Existing accelerator and durable-storage launcher |

The former nine-class model schema is retained only as a migration schema. The frozen v1 taxonomy separates prompt manipulation, harmful intent, sensitive data, indirect instructions, tool action risk, and output risk.

## 3. Frozen taxonomy

Canonical specification: `docs/ml/SOTERAI-ML-TAXONOMY-v1.md`. It defines label meaning, boundaries, severity, minimum gates, hard negatives, benchmark mappings, annotation rules, validation-only thresholding, and abstention semantics. `SAFE` must not absorb uncertainty or failures.

## 4. Dataset forensic audit

Canonical artifacts:

- `scripts/ml/soterai_data_freeze.py`
- `reports/ml-v1-freeze/dataset-forensic-audit.json`
- `reports/ml-v1-freeze/split-freeze.json`
- `docs/ml/SOTERAI-ML-DATASET-CARD.md`

Primary v6 file: 79,580 rows; SHA-256 `842bfc66bb32f4acf2c2f2f1eb8510c698c3919c1507c07299f2fd05ddcfd732`. The audit found 7,994 exact-duplicate-affected rows, 14,884 normalized-duplicate-affected rows, 64.1669% synthetic/augmented provenance, 7,980 missing language fields, 69,984 English rows, and single-digit coverage for several target languages.

No conflicting normalized-label groups were found inside v6, but combined-source conflict quarantine remains mandatory. The tool writes `conflicting-label-quarantine.jsonl` with text redacted from the manifest.

## 5. Holdout construction result

The required order was implemented: normalize/audit → exact/normalized deduplication → lexical near-duplicate clustering → source grouping → deterministic partition manifest → SHA-256 freeze artifact. The manifests are **provisional**, not locked:

| Partition | Rows | Coverage result |
| --- | ---: | --- |
| Train | 48,438 | Highly imbalanced; safe-only examples moved by source grouping |
| Development validation | 6,961 | `SAFE` only — fails label coverage |
| Locked internal test candidate | 6,983 | Missing labels and mixed missing provenance |
| Final untouched holdout candidate | 6,943 | `SAFE` + `JAILBREAK` only; three source groups — fails independence/coverage |

The result is a **P0 data blocker**, not a success. Splitting the current generated corpus cannot provide an independent, taxonomy-covered holdout. New independent native/non-template sources and accelerator-based semantic clustering are required.

## 6. Competitor provenance and methodology

The local comparator is a checkout of `https://github.com/lakeraai/pint-benchmark` at commit `0efab3f463eae9c823130d8faffb71b2e7c06e63`. The local `lakera_guard.md` SHA-256 is `346de653987902d790ebdad6a03bdb0e2778919b89302ecb0f85072fadaeb86b`. Its report says:

- Lakera API version `2.0.106`, revision `03afc859`, timestamp 2025-05-02, policy L3;
- only prompt attack category considered for Lakera;
- score `95.2200%`, dated 2025-12-16 in the result artifact;
- PINT dataset composition is 4,314 rows and includes proprietary/public data not present locally.

The artifact is reproducible as a local historical report, but not independently rerun here. It is not an official current vendor score.

## 7. Same-harness evaluator

`scripts/ml/soterai-pint-eval-v2.ts` emits:

- exact balanced-score formula;
- task/comparability status;
- confusion matrix and prompt-manipulation recall;
- document recall and hard-negative accuracy when slices exist;
- stratified deterministic bootstrap 95% interval;
- p50/p95/p99/max latency;
- benchmark, evaluator-source, and configuration SHA-256 hashes;
- prediction metadata and hashed misses.

`scripts/ml/soterai_paired_compare.py` supplies the required paired, stratified bootstrap comparison and refuses benchmark-hash, row-ID, task, or ground-truth mismatches. It cannot be run against the summary-only Lakera artifact because that artifact does not contain paired per-row predictions.

The bundled eight-row example was run with 2,000 bootstrap iterations: score 1.0, interval [1.0, 1.0], but `comparability=NOT_DIRECTLY_COMPARABLE_TO_PINT` because it includes categories outside the PINT schema. This is a smoke test only.

## 8. Existing baseline evidence

| Evaluation | Evidence | Honest interpretation |
| --- | --- | --- |
| Internal guard benchmark | ROC-AUC 0.9974; 100% mitigation recall; 92.31% precision; 0.81% FPR; p95 6.51 ms | Strong deterministic internal result; source/template independence limited |
| Local 200-row harmful-intent adapter | 51% balanced score | Harmful-intent taxonomy mismatch; not a prompt-injection score |
| Existing neural validation artifacts | Macro F1 about 0.9915 | Random/template-heavy validation; no independent final holdout |

## 9. Experiment ledger

| Experiment | Change | Balanced score | Macro F1 | Critical recall | Benign FPR | ECE | p95 | Decision |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| `baseline-guard-20260726` | Existing deterministic production guard | N/A | N/A | 1.000 | 0.0081 | N/A | 6.51 ms | Retain as baseline |
| `artifact-v3-observed` | Existing MiniLM artifact, v4 validation split | N/A | 0.9915 | Not independent | Not reported | Not reported | Not reported | Do not promote |
| `pint-example-v2-smoke` | v2 evaluator, bundled 8 rows | 1.000 | N/A | 1.000 | 0.000 | N/A | 546.11 ms p95 | Smoke only; non-comparable |

No full training was run in this environment. No fabricated experiment is entered into this ledger.

## 10. Calibration, multilingual, robustness, runtime

- Calibration scaffolding exists in the Colab pipeline (validation-only temperature scaling and per-label thresholds), but final calibrated values on a valid independent split are unavailable.
- Claimed language support is blocked: English 69,984; Hinglish 1,583; Hindi 4; Spanish 8; French 8; German 6; Portuguese 4; Japanese 3. No broad multilingual claim passes.
- Robustness suites for Unicode, spacing, paraphrase, transliteration, long context, multi-turn, code, tool, and source shift are not yet frozen as untouched external suites.
- Rollout registry supports shadow/partial/full, fallback, and rollback scaffolding. A checksum-verified neural backend, ONNX parity test, timeout/resource gate, canary evidence, and monitoring proof are not complete.
- The exact requested notebook path now exists at `notebooks/SOTERAI_ML_LAKERA_BEATING_TRAINING_COLAB.ipynb`; it is a versioned copy of the existing CUDA-only training notebook with taxonomy/report metadata.
- `scripts/ml/validate_artifact_manifest.py` and `manifests/ml/artifacts/README.md` provide a non-loading checksum/label/taxonomy integrity gate for future artifacts. This does not constitute runtime integration or promotion.

## 11. Promotion gates

| Gate | Status | Reason |
| --- | --- | --- |
| Same-harness superiority | **FAIL/BLOCKED** | Full PINT dataset unavailable; no paired comparator predictions |
| Critical slice floors | **BLOCKED** | Valid independent slices unavailable |
| Benign FPR ceiling | Partial | Internal benchmark 0.81%; independent hard-negative proof unavailable |
| Independent holdout | **FAIL/BLOCKED** | Current provisional partitions fail label coverage and source independence |
| Multilingual | **FAIL/BLOCKED** | Sparse data and no native holdouts |
| Calibration | Partial | Pipeline exists; valid final evaluation unavailable |
| Robustness | **BLOCKED** | Untouched external suites not frozen |
| Runtime | Partial | Deterministic fallback/rollout exists; neural parity/integrity incomplete |
| Efficiency | Partial | Deterministic path measured; neural runtime not measured |
| Reproducibility | Partial | Colab notebook/module and hashes exist; fresh accelerator run unavailable |
| Evidence integrity | **PASS** | Claims are marked observed, smoke, provisional, or blocked |

## 12. Exact external continuation commands

### Full PINT when the licensed dataset is available

```bash
npx tsx scripts/ml/soterai-pint-eval-v2.ts \
  --input /secure/path/pint-full-4314.yaml \
  --out reports/soterai-pint-full-v2.json \
  --bootstrap-iterations 10000 \
  --bootstrap-seed 42
```

Acceptance: schema is exactly PINT; source/licence are documented; benchmark hash is frozen; paired comparator predictions are available; improvement ≥ 1.0 percentage point and paired 95% CI excludes zero; critical slices and FPR gates pass.

### Colab GPU training

```bash
python scripts/ml/soterai_data_freeze.py \
  --dataset datasets/ml-augmented-v6.jsonl \
  --output-dir /content/drive/MyDrive/soterai-ml-freezes/v1
python scripts/ml/soterai_colab_train_runner.py \
  --dataset datasets/ml-augmented-v6.jsonl \
  --split-freeze /content/drive/MyDrive/soterai-ml-freezes/v1/split-freeze.json \
  --output-root /content/drive/MyDrive/soterai-ml-runs
```

Acceptance: accelerator manifest present; semantic clustering completed; every partition has taxonomy coverage; zero cross-split source/parent/exact/normalized/semantic overlap; calibration uses validation only; final holdout is inspected once.

The reusable runner now requires `--split-freeze`; non-smoke training rejects any status other than `FINAL_LOCKED`, verifies dataset/audit/partition hashes and coverage, and never loads the final untouched holdout. Candidate production weights are emitted as SafeTensors with a `soterai-artifact-manifest/v1` checksum manifest.

## 13. Required next work

P0: acquire/review independent multilingual and non-template data; reannotate to v1; complete semantic clustering; build valid holdout; run full same-harness benchmark.  
P1: train serious candidates in Colab CUDA; calibrate; export and parity-test neural artifact; integrate shadow/canary/rollback monitoring; run robustness and runtime gates.  
P2: independent evaluator/third-party review and privacy-preserving production pilot evidence.

## Final promotion decision

**NOT PROMOTED. NOT MARKET-LEADING. NOT DEMONSTRABLY STRONGER THAN LAKERA.** The repository now has a reproducible audit, frozen taxonomy, provisional split hashes, benchmark provenance, same-harness evaluator scaffolding, Colab-only training path, and honest blockers. The competitive claim remains unverified until the external benchmark and independent holdout prerequisites are satisfied.