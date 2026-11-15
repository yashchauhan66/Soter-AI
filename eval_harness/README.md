# Soter reusable evaluation harness

Status: **partial implementation, not a completed Phase 2 or release benchmark**.
No model weights, thresholds, source datasets, production configuration or tenant policy are changed.

## Tested core

`core.py` preserves raw case text, immutable IDs, explicit target/truth, source identity,
licence status, language, grouping and required slice memberships. Invalid types and
unknown taxonomy/slice values are rejected instead of silently normalized.

`binary_metrics` reports confusion/support, precision, recall, F1, FPR, FNR,
average precision, separately named trapezoidal PR-AUC and binary ECE. It rejects
misaligned, nonnumeric, nonfinite or out-of-range scores. Empty/one-class coverage
and denominator-free metrics are explicit nulls with reasons. Comparable AP/PR-AUC/ECE
require both target classes. ECE uses disjoint integer bin assignments, including probability one.

```bash
OMP_NUM_THREADS=2 py -3.12 -B eval_harness/tests/test_core.py
```

Actual parent execution: **6 tests pass**. RED→GREEN logs and the independently
computed ECE boundary-debugging evidence are under `artifacts/ml/v-final/phase2/`.
`core-progress.json` stores the exact command, output, scope hashes and remaining work.

The tested runtime is the project's Python 3.12, with NumPy/scikit-learn installed there.
Pyright is not installed for that interpreter. Editor missing-import diagnostics are
not a runtime dependency failure: the actual test command resolves those packages.
No independent core review or complete type-check is claimed at this checkpoint.

## Completion still required

- Source-preserving import, ordered turns/trusted policy metadata, seal/cache identity,
  family-grouped leakage checks and paired uncertainty.
- Actual result/status for all **24 artifact locations** in
  `docs/v-final/MODEL_ARTIFACT_LOCATIONS.csv`, not 24 independent trained models.
- Genuine ONNX/native-policy adapters, full slice/language/context/robustness coverage.
- Public suite version/data-licence gates and explicitly named measured public results.
- Real-path CPU/GPU timings and release evidence in later phases.

The source catalog is a historical planning snapshot, not new model scores.
Classifier risk, instruction attack and effective policy outcome remain distinct.
A diagnostic fixture is not an accepted release holdout. `release_ready` remains false.
