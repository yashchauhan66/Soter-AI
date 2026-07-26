# SoterAI ML Competitor Gap Matrix

This matrix is generated from local PINT-style competitor artifacts when available.
SoterAI is not assigned a PINT score here until it is run through the exact same harness.

## Local PINT-Style Competitor Results

| Competitor / Model | Balanced score | Prompt-injection recall | Jailbreak recall | Document attack recall | Hard-negative accuracy |
| --- | ---: | ---: | ---: | ---: | ---: |
| `lakera_guard` | 95.22% | 89.69% | 100.00% | 84.00% | 98.33% |
| `bedrock_guardrails` | 89.24% | 70.85% | 97.30% | 68.00% | 99.44% |
| `azure_content_safety` | 89.12% | 64.57% | 94.59% | 78.00% | 98.44% |
| `protect_ai` | 79.14% | 86.55% | 86.49% | 56.00% | 90.11% |
| `llama_prompt_guard_2` | 78.76% | 57.40% | 91.89% | 62.00% | 98.67% |
| `model_armor` | 70.07% | 33.63% | 67.57% | 22.00% | 98.22% |
| `aporia_guardrails` | 66.44% | 41.70% | 51.35% | 6.00% | 99.56% |
| `llama_prompt_guard` | 61.82% | 89.69% | 94.59% | 84.00% | 64.22% |

## Immediate SoterAI Gaps

| Gap | Strongest observed competitor evidence | SoterAI status | Required fix |
| --- | --- | --- | --- |
| Same-harness PINT score | `lakera_guard` at 95.22% balanced score | Adapter implemented and smoke-tested on PINT example data; full PINT score still not available | Run `scripts/ml/soterai-pint-eval.ts` on the full PINT benchmark dataset once available; record balanced score and slices. |
| Prompt-injection benchmark parity | Lakera/Prompt Guard/Protect AI-style tools are directly benchmarked in PINT artifacts | SoterAI has strong internal guard metrics and a working PINT-format evaluator, but no full PINT number in this matrix | Run full PINT dataset; compare SoterAI directly against Lakera 95.22% artifact. |
| Multilingual ML generalization | Commercial cloud/API guards claim broad multilingual moderation; Lakera/Check Point docs describe continuously updated prompt defenses | SoterAI has strong Hinglish/Hindi rules but sparse real multilingual dataset coverage | Add real multilingual holdout, train only in Colab GPU/TPU, report per-language F1. |
| Calibration | OpenAI moderation exposes category scores; cloud guardrails expose severities/thresholds | Heuristic backend calibration error improved but remains high | Add validation-based calibration and per-label thresholds. |
| Runtime neural artifact integration | Prompt Guard 2 / Protect AI are deployable model artifacts | SoterAI PyTorch/ONNX artifacts exist, but default runtime remains heuristic/external API | Add versioned ONNX backend with checksum, timeout, parity tests, and fallback. |
| Independent holdout | Strong external comparisons use benchmark-separated test cases | SoterAI augmented data has duplicates and template-heavy provenance | Build locked holdout with exact/near duplicate and source separation. |
| Model supply-chain inspection | Google/AWS/HiddenLayer-like offerings cover broader platform controls | SoterAI has app/agent security depth, not full model file malware/backdoor scanning | Keep as platform gap or add model-artifact scanning separately. |

## Verified July 26, 2026 Audit

### Honest conclusion

SoterAI cannot currently be described as the strongest ML guard in the market.
The strongest local competitor artifact is `lakera_guard` at **95.22%** on the
repository's PINT-style matrix, while SoterAI has not been run on that exact full
dataset. On the available `datasets/external/jailbreakbench.jsonl` adapter run,
the deterministic production guard scored **51.00% balanced accuracy** (200
examples). This dataset mostly measures harmful-request classification rather
than explicit prompt-injection wording, exposing a major taxonomy and coverage
gap in the current prompt-attack adapter.

Evidence: `reports/soterai-jailbreakbench-current.json`.

### Dataset audit

`datasets/ml-augmented-v6.jsonl` contains **79,580** records, but the audit found:

- **7,994 exact duplicate rows** (the audit's duplicate-row definition counts
  all rows belonging to duplicated texts).
- Language distribution is heavily English-dominant: **69,984 English**, **1,583
  Hinglish**, only single-digit examples for Spanish, French, German,
  Portuguese, Hindi, and Japanese, plus **7,980 records with missing language**.
- No pre-existing locked split annotations.
- Many generated/template sources, which makes random row splitting unsuitable.

Evidence: `reports/ml-dataset-audit-current.json`.

### Implemented in this pass

| Area | Implemented change | Verification |
| --- | --- | --- |
| CPU training prevention | Full training now requires CUDA and fails before retry attempts on CPU/TPU. Local `--smoke-only` remains metadata-only. | CPU smoke loaded 79,580 records without training; runner rejects non-CUDA execution. |
| Leakage resistance | Deterministic source/parent/text group keys keep related examples in one partition; split validation rejects overlaps and insufficient label coverage. | 59,677 train / 11,945 validation / 7,958 test; zero cross-partition group overlaps. |
| Calibration | Colab training now fits validation temperature scaling, tunes per-label validation F2 thresholds, and reports ECE, Brier score, and calibrated NLL. | Static/type validation passed; GPU execution remains required to produce final values. |
| Artifact integrity | Training emits model/dataset SHA-256 hashes, artifact size, code commit, base model, and label manifest. | Implemented in `artifact_manifest.json` output. |
| Runtime API hardening | External model responses now validate labels, clamp confidence, support timeout, and configurable fail-closed behavior. | Typecheck passed. |
| Evaluation correctness | Binary safety metrics and exact multiclass per-label precision/recall/F1 are separated; wrong-category risky predictions enter review. | Typecheck and scoped ML/guard tests passed. |

### Remaining release blockers, in priority order

1. **P0 — Full same-harness PINT evaluation:** obtain the exact benchmark used
   for competitor artifacts and run SoterAI with frozen code/config.
2. **P0 — Colab GPU retraining:** retrain using the updated split and calibration
   pipeline; CPU training is intentionally unavailable.
3. **P0 — Independent locked holdout:** exclude all training generators,
   templates, parents, and near-duplicates; publish hashes before training.
4. **P0 — Harmful-content/jailbreak taxonomy:** add or separately route harmful
   intent classification. Do not claim the 51% JailbreakBench result is a
   prompt-injection score; it demonstrates current scope mismatch.
5. **P1 — Real multilingual corpus:** add substantial native-speaker attack and
   benign samples per target language and report language-specific confidence
   intervals.
6. **P1 — Neural runtime integration:** package the trained artifact behind a
   versioned, checksum-verified serving endpoint with parity, timeout, fallback,
   canary, and rollback tests. The default runtime remains heuristic unless an
   external API is configured.
7. **P1 — Robustness suites:** evaluate encoding/Unicode, typoglycemia,
   paraphrase, indirect-document, multi-turn, long-context, and adaptive attacks
   on untouched external sets.
8. **P1 — Statistical reporting:** publish confusion matrices, bootstrap
   confidence intervals, slice minimums, latency percentiles, and calibration.
9. **P2 — Independent third-party evaluation:** use an external evaluator or
   public reproducible CI before making competitor-superiority claims.

### Promotion gate

A model must not be called market-leading or promoted to full enforcement until
all of the following are true:

- Same-harness balanced score exceeds the strongest recorded competitor with a
  predeclared statistical confidence margin.
- Every critical attack slice meets its predeclared recall floor and benign FPR
  stays below its predeclared ceiling.
- Independent, source-separated multilingual and adversarial holdouts pass.
- Calibration, latency, integrity, rollback, and serving parity gates pass.
- Results are reproducible from a Colab GPU run manifest and immutable dataset,
  code, and artifact hashes.


