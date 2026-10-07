# v18 compact multilingual training handoff

**Status updated 2026-09-20:** the Colab run completed, its downloaded ZIP was imported and verified, and the four-model comparison is complete. The current v18 student is faster but regresses on detection quality and is not approved for promotion. Read the [post-training review](ml-v18-post-training-review-2026-09-20.md) before starting another run. The local machine has CPU-only PyTorch; GPU training ran in the user's Colab. The production model is unchanged.

## Why this architecture

Use the existing v17 multilingual DistilBERT checkpoint as the teacher. The student retains all 119,547 WordPiece vocabulary entries and reduces transformer depth from six to three layers and hidden width from 768 to 384. Deterministic channel/layer selection initializes its embeddings, attention, feed-forward layers and classifier from the teacher. This initialization is a heuristic: it does not preserve the teacher's decisions by itself.

Actual local architecture validation measured 51,810,575 student parameters versus 135,364,367 teacher parameters (61.7% fewer). This is a parameter-count reduction, not a measured latency or attack-detection improvement. The prepared corpus has 110,516 rows: 77,823 train, 8,316 calibration, 14,139 validation, and 10,238 internal test.

Train with the existing supervised classification/attack losses plus temperature-scaled KL distillation (temperature 2, weight 0.5, with the temperature-squared correction). The teacher is frozen and only runs on training batches. The multilingual vocabulary avoids forcing unsupported scripts through an English tokenizer. Vocabulary coverage alone does not prove attack detection in those languages.

## Files and execution

1. Open `scripts/ml/colab/soterllm-v18-student-colab.ipynb` in Colab. Select a GPU runtime.
2. Upload `artifacts/ml/soterai-v18-colab-bundle.zip` to your Google Drive root. The notebook expects `/content/drive/MyDrive/soterai-v18-colab-bundle.zip`.
3. Run all cells in order. The first verifies every bundled file hash. The second installs the tested dependency versions. Training uses a 16-example microbatch, four accumulation steps, five epochs, and a maximum sequence length of 256.
4. Outputs and epoch checkpoints go to `/content/drive/MyDrive/soterai-v18-student-run`. For an interrupted run, keep the same settings and add `--resume` to the launcher command. If memory is insufficient before training, use microbatch 8. Changing the recipe while resuming is intentionally rejected.
5. ONNX parity verification runs after training. A passing numerical parity check means the exported candidate agrees with its PyTorch model; it is not an attack-detection quality gate.

Equivalent command inside the extracted bundle:

```bash
python scripts/ml/colab/run_v18_colab.py --preflight
python scripts/ml/colab/run_v18_colab.py --output-dir /content/drive/MyDrive/soterai-v18-student-run
```

The bundle contains the existing teacher weights and only explicitly allowed training files. It excludes environment files, signing keys and unrelated application data. The accompanying `.manifest.json` records the archive hash and constituent hashes.

## Data and measurement limits

Read `artifacts/ml/v18-data-report.json` before interpreting results. Preparation retains source/language annotations, quarantines label conflicts and training components that collide with external holdouts, and saves corpus-hash-bound train/calibration/validation/test indices. Declared template/translation/parent IDs are grouped when present. Missing lineage metadata cannot be recovered by hashing; normalized text groups are not semantic independence.

The teacher was already trained on the original corpus, which may include the student's new internal test partition. Therefore the internal test is useful for student diagnostics but is not independent teacher comparison evidence. The existing external batteries have also been inspected during development. Obtain a fresh, source/family-held-out release set before any superiority claim or deployment.

Many language/category pairs have sparse or missing data. This pipeline reports gaps; it does not manufacture broad language protection from repeated translations. Add native-reviewed attack/benign pairs with provenance, new family IDs, realistic authorized tool use, and genuine multi-turn context. Keep release examples permanently excluded from training and threshold tuning.

## Compare the trained candidate locally

The existing candidate is already in `models/ml-classifier-v18-student`, and its completed comparison is in `artifacts/ml/v18-candidate-comparison`. To verify those cached results without rerunning inference:

```bash
python scripts/ml/summarize-v18-comparison.py --comparison-dir artifacts/ml/v18-candidate-comparison --rows artifacts/ml/v18-balanced-comparison-rows.jsonl --require-candidate
```

For a **new** trained candidate, use the following procedure and a fresh output directory:

Download the candidate directory into `models/ml-classifier-v18-student`, retaining tokenizer, labels, calibration, encoder config, ONNX, training stats and hashes. The comparison helper accepts it as a fourth arm:

```bash
python scripts/ml/compare-v18-bases.py --rows artifacts/ml/v18-balanced-comparison-rows.jsonl --candidate-dir models/ml-classifier-v18-student --out artifacts/ml/v18-student-comparison
```

This command produces diagnostic ML-only results at common decision settings and inference-only latency. It excludes the product rules and semantic veto; do not call its numbers production recall/FPR. Use a new output directory if inputs, model, calibration or timing settings change. Check per-language/category misses and benign false alarms, not aggregate recall alone.

Before promotion, run the production decision path on an untouched external release set, freeze thresholds using calibration only, measure representative CPU batch-one p50/p95 including tokenization and long-input handling, and verify that security regressions stay within the predeclared release tolerance. Keep v14 as rollback. Naive INT8 and vocabulary pruning already showed harmful regressions on v17 and are not enabled here.
