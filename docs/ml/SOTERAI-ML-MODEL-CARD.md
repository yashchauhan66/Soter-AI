# SoterAI ML Model Card

## Model identity

- **Model family:** SoterAI hybrid guard
- **Taxonomy:** `SOTERAI-ML-TAXONOMY-v1`
- **Current default backend:** deterministic heuristic/rule guard (`lib/ml/training.ts`)
- **Neural artifacts observed:** local PyTorch/ONNX bundles under `tmp/` and PyTorch files under `models/`; none is promoted as the production neural backend
- **Artifact status:** not promoted; no checksum-verified runtime loader is currently connected to the default path

## Intended use

Inline detection and policy routing for prompt manipulation, harmful intent, sensitive-data exposure, indirect document instructions, agent/tool actions, and AI-generated output risk. The system supports allow, warn, transform, approval, block, review, and fallback behaviors.

## Out-of-scope or unsupported claims

- This card does not claim that SoterAI is stronger than Lakera.
- The 95.22% `lakera_guard` value is a local PINT comparator artifact, not an official vendor claim.
- The local 200-row JailbreakBench-style result is harmful-intent evidence and is not a prompt-manipulation score.
- Broad multilingual support is not supported by the current corpus: English dominates and several claimed languages have single-digit counts.
- No local CPU full training was performed. Meaningful training is CUDA Colab-only; TPU support is not implemented.

## Architecture and limitations

The current production path uses deterministic detectors, semantic feature hashing, policy scoring, redaction, and optional heuristic/external-API ML backends. The existing flat nine-class neural artifact schema conflates task mechanism, intent, context, data type, and output direction. Taxonomy v1 therefore defines specialist multi-label heads, but reannotation and Colab retraining remain pending.

Known limitations include template/generator dependence, missing provenance, sparse native multilingual data, no independent semantically reviewed holdout, lack of neural runtime parity evidence, and no same-full-dataset PINT run.

## Evaluation evidence

| Evidence | Result | Interpretation |
| --- | --- | --- |
| Local honest guard benchmark | ROC-AUC 0.9974; production recall 100%; precision 92.31%; FPR 0.81% | Strong internal deterministic benchmark; source/template independence remains limited |
| Local JailbreakBench-style adapter | Balanced score 51% on 200 rows | Harmful-intent taxonomy mismatch; not prompt-manipulation evidence |
| Bundled PINT example | 8-row smoke result 100% with v2 evaluator | Not a full PINT score; v2 marks it non-comparable due to category schema |
| Existing neural artifact validation | Macro F1 around 0.9915 on validation | Random/template-heavy validation; no independent holdout proof |

## Promotion requirements

1. Reannotate into taxonomy v1 specialist heads.
2. Acquire independently sourced, native multilingual, non-template holdouts.
3. Run Colab CUDA training and validation-only calibration.
4. Export safe, checksum-verified artifact and prove framework/runtime parity.
5. Pass critical recall, benign FPR, calibration, robustness, latency, rollback, and reproducibility gates.
6. Run full PINT on the same frozen dataset and only claim superiority if the paired CI and margin gates pass.