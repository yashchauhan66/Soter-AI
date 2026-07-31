# SoterAI multilingual accelerator handoff

This directory is the control file for the external accelerator run. It does not claim that
training or independent evaluation happened on this workstation.

## Current gate

`BLOCKED_EXTERNAL`: the checked-in freeze is
`PROVISIONAL_NOT_INDEPENDENT_NOT_SEMANTICALLY_LOCKED`. Do not promote a model from it.

Before an accelerator run, replace or amend the frozen corpus until all of these are true:

1. Every retained source has license, privacy basis, collection method, annotation method,
   annotator/confidence metadata, and a stable provenance identifier.
2. Embedding-based semantic deduplication and human review are complete, with clusters confined to
   one partition.
3. The untouched holdout is independently sourced, native-language data. It must not be generated
   from the same templates or source families as training.
4. Every release-critical label and language slice (English, Hindi, Hinglish, transliteration, and
   mixed-script) meets the declared minimum in development, locked internal test, and untouched
   holdout.
5. The freeze and partition manifests are regenerated and signed.

## Accelerator workflow

1. Run the forensic audit and provisional freeze:
   `python scripts/ml/soterai_data_freeze.py --help`.
2. Review `reports/ml-v1-freeze/dataset-forensic-audit.json` and `split-freeze.json`; do not
   continue while their promotion gates fail.
3. Open `notebooks/SOTERAI_ML_TRAINING_COLAB.ipynb` in an accelerator-backed Colab runtime.
4. Invoke `scripts/ml/soterai_colab_train_runner.py` with the approved dataset and signed
   `split-freeze.json`. The runner refuses a missing CUDA runtime.
5. Preserve the final untouched holdout for independent evaluation only. Training, early stopping,
   calibration, and threshold selection must not load it.
6. Run tokenizer parity, per-label calibration, language/slice metrics, and the independent
   holdout evaluation.
7. Validate artifact hashes with `scripts/ml/validate_artifact_manifest.py`.
8. Sign the artifact manifest with the operator release key, then promote through the supported
   loader. Roll back by restoring the previous signed manifest and digest-pinned artifact.

The machine-readable handoff and exact blockers are in `package-manifest.json`.

