# Phase 2 — offline native adapter/status verification

**Status:** pre-fix parent tiny-fixture tests and evidence audit passed, but the exact-hash independent code review (`deleg_cabb96e0`) **FAILED** on unknown-token coverage, calibration-note provenance, stale declared-signature binding and non-atomic JSON no-overwrite. These are static findings; a new third context is diagnosing/reproducing them in automated native/status fix cycle **1 of at most 2**. Installed Ruff is **not clean**. Existing smoke/status evidence is bound to the archived pre-fix source below, not automatically to changed code. Phase 2 evaluation and release readiness remain incomplete. This is not the nine-phase final report.

## Verified scope

- Parent collected and ran the exact **133/133 cases**, exit 0, with matching collected/passed testcase IDs and unchanged four-file source hashes. No genuine model was loaded by that parent test run.
- The original 254-line test prefix matches the earlier parent baseline byte-for-byte. The archived original-only run passed 70 tests.
- All **48 command records** and their actual log hashes/exit headers were checked. **18 recorded RED→GREEN pairs** preserve test hashes within each pair. This verifies the recorded execution sequence, not a replay of every implementation edit.
- The exact inventory CSV, JSONL, JSON and report CSV agree on **24 unique locations**, with **17 structurally usable, 5 missing native components, 2 errors, 0 unsupported**. The parent checked 215 component records and 17 composite native identities; it did not freshly hash every model weight in the inventory.
- Genuine v14 smoke evidence contains **5 raw samples, 3 native calls and 14 exact labels**. The executed source hashes match the archived reviewed pre-fix scope; the parent independently rehashed all 8 v14 bundle components, verified named probabilities and recomputed softmax from recorded native logits (maximum absolute difference `2.220446049250313e-16`). The parent did not rerun genuine inference. Latest changed source requires fresh model/status verification after the fix.

Structural availability is not a scored benchmark. Smoke, backup and duplicate worktree locations are not independently trained baselines.

## Diagnostic findings and limits

The long-prefix sample processed **254 of 712 content tokens**, leaving **458 unprocessed**. The Hindi sample had **2 unknown content tokens** and predicted `SYSTEM_PROMPT_LEAK_ATTEMPT`; this is a diagnostic output on hand-authored benign text, not an accuracy or FPR estimate. English/Hindi/Hinglish/long/empty smoke coverage does not establish all requested language or long-context slices.

The original v18-candidate ONNX fails protobuf parsing. The original v18-student ONNX is zero bytes and its tokenizer JSON is invalid. No fabricated prediction was substituted for either.

Installed Ruff returned exit 1 with **11 findings** (`I001`, `FURB167`, `F401`, `BLE001`, `C401`). A complete original-code lint baseline is unavailable; classification/regression adjudication and any narrowly scoped fix remain pending. Broad catches at status-inspection boundaries retain explicit error reasons; they must be reviewed in context rather than blindly narrowed. No lint-clean claim is made, and source was not edited while hash-bound reviews run.

Windows session/private-snapshot cleanup assertions are present in the successful genuine probe; the parent freshly exercised the tiny-fixture cleanup tests, but did not replay historical genuine cleanup. No datasets/public benchmarks were scored, learned weights or thresholds changed, production/tenant policy exercised, or models deployed by this verification.

The latest parent test resource observation was **708,792,320 free disk bytes** and **3,877,900,288 available RAM bytes**. Genuine full-checkpoint/export verification for the separate Phase 1 lifecycle scope is still gated by disk headroom. No cache deletion or process termination was performed.

## Evidence

- Parent scope, exact collection/run logs and audit: `artifacts/ml/v-final/phase2/inference-resume/parent-verification-20261103T084335Z-690c5a/`
- Inventory: `docs/v-final/MODEL_ARTIFACT_LOCATIONS.csv`
- All-location reports: `artifacts/ml/v-final/phase2/inference-resume/all-24-status.{jsonl,json,csv}`
- Genuine probe/output: `artifacts/ml/v-final/phase2/inference-resume/genuine_v14_smoke_probe.py`, `genuine-v14-smoke.{log,json}`
- Recorded TDD and command evidence: `artifacts/ml/v-final/phase2/inference-resume/sequential-tdd-evidence.json`, `commands.jsonl`

## Exact reviewed source identity — pre-fix, failed review

| File | SHA256 |
|---|---|
| `eval_harness/inference.py` | `e0bf4b99248671619ec45bbea7cb26d7e7dd450440b78d4849955e5edb62b6fa` |
| `eval_harness/tests/test_inference.py` | `4ec7f9ce1638a3112f0ad49d07f3d6e0ee5662f86be683a509aceda99c1019d1` |
| `eval_harness/model_status.py` | `ff26aeca2ef2ec81c7f2e8515a692943bc7b9f39959808f065ba578dbf801691` |
| `eval_harness/tests/test_model_status.py` | `ce024050e1f4498ea804d9e96fc8f1f8fe9cde5db80b31255698bb62843e871c` |

## Still required

Confirmed-only fixes for the four review blockers, fresh exact-hash independent review, baseline-aware lint disposition, latest-source genuine smoke/status and combined core/data/inference re-verification, common-corpus results for usable arms, all requested metric/policy/robustness slices, valid source/licence/leakage provenance, and later genuine GPU/serving/release evidence. Both reviewed source scopes matched their live hashes at `2026-11-03T08:56:51.085507+00:00`; review evidence is `parent-verification-20261103T084335Z-690c5a/independent-review-batch1.json`. `phase2_complete=false`; `release_ready=false`.
