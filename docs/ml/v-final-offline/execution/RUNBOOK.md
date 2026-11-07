# v-final execution runbook

## Delivered / not delivered

Runnable CLI, data builder, checkpointed CE/KL training, train-only mining, teacher selection, validation calibration, ONNX/INT8 parity, identical-context comparison and quarantine packaging are implemented in `vfinal_pipeline/`. Open **`notebooks/v-final/01_t4_execution.ipynb`** in Colab, select GPU, upload the source package/accepted inputs, and explicitly enable the action flags.

**Genuine training, pretrained export, public benchmarks, real production comparison, three-seed result table and deployment: NOT RUN.** No external model/corpus/install/training/deployment occurred locally. Tiny randomly initialized UNIT-ONLY optimization and ONNX fixtures were executed. Existing data/model/test source bytes and historical receipts are preserved. Production whitelist bugs are not fixed by this package.

## Local commands

Run from the repository root with Python 3.12. CLI help imports no models.

```sh
py -3.12 -B -m vfinal_pipeline --help
py -3.12 -B -m vfinal_pipeline build accepted-input.json NEW_DATA_DIR
py -3.12 -B -m vfinal_pipeline train experiment.json NEW_OR_SAME_RUN_DIR
py -3.12 -B -m vfinal_pipeline teacher-select teacher-candidates.json NEW_CHOICE.json
py -3.12 -B -m vfinal_pipeline mine experiment.json RUN/best-model NEW_MINING.json
py -3.12 -B -m vfinal_pipeline export export-input.json NEW_EXPORT_DIR
py -3.12 -B -m vfinal_pipeline gate comparison-input.json NEW_GATE.json
py -3.12 -B -m vfinal_pipeline package package-input.json NEW_QUARANTINE_DIR
py -3.12 -B -m vfinal_pipeline verify NEW_QUARANTINE_DIR
```

**Do not run genuine train/export locally until resource gates and approved scope permit it.** Native verification uses `vfinal_pipeline.resume_checks` and the shared `Local\\SoterVFinalNativeUnitChecks` mutex. Set TMPDIR/TMP/TEMP to `C:/Users/USER/AppData/Local/hermes/cache/scratch`, all HF offline flags/PIP_NO_INDEX/PYTEST_DISABLE_PLUGIN_AUTOLOAD/PYTHONDONTWRITEBYTECODE to 1, WANDB_MODE=offline, USE_TF=0, USE_FLAX=0. The runner preserves stdout/stderr, exact native command, return code and source/resource pins.

## Colab sequence

1. Copy `vfinal_pipeline/`, `eval_harness/`, configs and execution docs to `/content/drive/MyDrive/Soter-vfinal/repo`. Stage accepted source files outside original protected corpora. Use `input.template.json` to create the reviewed manifest; do not just flip acceptance flags. Match all 14 labels, include baseline/teacher exposure and separately frozen holdout. DATA_CARD defines row/source contracts.
2. Explicitly enable installation of pinned requirements if needed, restart, then disable installation. Release metadata is retained at `artifacts/ml/v-final/offline-preparation/execution-resume-1/{package-metadata,psutil-metadata}.json`. Top-level versions are pinned, not a complete hash-locked transitive environment. `pip check` and exact-version assertions must pass; native Windows tests are not proof of this Linux solve.
3. Stage a local approved MiniLM base. The optional download cell requires the model repository's exact approved 40-character revision, never a mutable `main`. Preserve source license/commit/file pins. No remote code is trusted. All later loaders use `local_files_only=True`.
4. Build once into a new data directory. Inspect generated distributions, quarantine and coverage. Audit semantic duplicates/exposure externally before proceeding. Never use holdout for troubleshooting thresholds or selecting teachers.
5. Train/select an accepted label-aligned teacher only on train/validation. `teacher-candidates.json` is `{config: experiment_config, candidates: [{path, identity}]}`; identities come from `experiment.bundle_identity`. Selection minimizes validation multiclass NLL. Teacher probabilities for distillation are computed only on train with the teacher's own tokenizer. Teacher output order must exactly equal the accepted native label order.
6. Run seeds 42, 1337, 2026. T4 recipe: fp16 autocast/scaler, dynamic padding, length bucketing, gradient checkpointing, accumulation, gradient clipping and train-only inverse-frequency weights. Optimizer/RNG/scaler/epoch/batch cursor persist in append-only periodic checkpoints. `best.json` and `last.json` are hash-verified atomic pointers; save history to file. Reopen the identical run to resume. Changed config/data/model/teacher or corrupt bytes reject. Single writer per run; Drive atomic-rename durability is not guaranteed, so retain periodic steps. Never silently resume another identity.
7. Mine only existing train cases, retain IDs rather than text, then continue from the initial best model in a **new** hard-negative run. The notebook executes no-distillation, no-class-balance and no-hard-negative ablations with the same three seeds. New data needs a separately versioned/adjudicated build. No model-soup/early-exit/cascade implementation is claimed; these are deliberately not adopted in this minimal experiment.
8. Calibrate only validation. Temperature uses bounded log-grid NLL minimization; risk threshold maximizes validation recall subject to max FPR, tie-breaking toward higher threshold. Undefined benign/positive support rejects. No-calibration ablation is executable with `calibrate(logits, labels, split='validation', model_identity=..., data_identity=..., max_fpr=0.02, fit_temperature=False)`, which fixes temperature one but still selects the validation-only threshold. Collect `logits` using `experiment.prepared(config,'validation',tokenizer)` and `training.predict`; write the resulting calibration to a new path and use it in a separate export specification. Never modify a release artifact in place.
9. Export specification: `{model_dir, calibration, max_length:512, unit_only:false, quantize:true}`. Export checks bound model/calibration identity, ONNX checker and actual ORT parity on three batch/length shapes; INT8 rejects logit error over 0.05 or top-class changes, FP32 over 0.0001. This is limited export parity, **not holdout INT8 quality acceptance**. Export embeds temperature once. It writes model/tokenizer/labels/calibration; all external weight files must accompany the bundle.
10. Select the seed with validation NLL before holdout access. Freeze comparison contract and identities. Collect actual identical-context scores and real-serving measurements externally, run the gate, inspect every failure. Exit 2 is an incomplete/failed gate, not permission to relax it. Quarantine packaging may retain failed reports, but cannot authorize deployment.

## Time, RAM and storage planning

No T4 time estimate was measured; do not promise a free-tier session fits. Measure a genuine pilot after resources permit: optimizer updates per epoch = `ceil(ceil(train_rows/batch_size)/accumulation)`, estimate walltime from measured updates/second plus measured validation, teacher inference and checkpoint time. Record cold/warm separately. CE/AdamW full fine-tuning has roughly 12 parameter-bytes per saved FP32 model+Adam moments before serialization overhead; training also needs gradients, activations and allocator space. This is an accounting formula, not observed peak RAM. Checkpoints are retained, not pruned automatically: sum actual `state.bin` sizes and ensure Drive headroom for every seed/stage. Default notebook saves every 1000 optimizer steps plus epoch/best. Lower intervals improve recovery but cost space. Model export/serialization snapshots also require headroom. Keep local fixed floors (disk 933930572/RAM5368709120) unchanged; no local genuine run is currently certified safe.

## Comparison input schema

`comparison-input.json` is `{cases: file_pin, arms: [file_pin,...], contract: gate_config}`. A `file_pin` is `{path: relative_path, sha256: exact_lowercase_sha256, bytes: exact_size}`. Cases are canonical Case JSONL. Each arm JSON is:

```json
{"name":"EXACT_ARM_NAME","model_identity":"EXACT_MODEL_IDENTITY","case_ids":[],"scores":[],"threshold":0.5,
 "context":{"dataset_sha256":"CASE_FINGERPRINT","hardware_id":"MEASURED_HOST_ID","preprocessing":"EXACT_COMMON_PREPROCESSING","batch_size":1,"runtime":"EXACT_COMMON_RUNTIME","sequence_policy":"EXACT_COMMON_POLICY","serving_path":"cpu_service_local"},
 "latencies_ms":[],"cold_load_ms":null,"memory_bytes":null,"size_bytes":null,"evidence_class":"NOT_RUN","evidence":{}}
```

This is an invalid/unrun schema example, **not results**. Scores must align with exact Case order/fingerprint and risk target; invalid/null/missing predictions must not disappear from the dataset. Obtain `cases_fingerprint` from eval_harness.core. The gate recomputes all required slices and languages, precision/recall/F1/FPR/FNR/AP/PR-AUC/ECE, latency quantiles and grouped paired bootstrap/McNemar diagnostics. It rejects missing models or context mismatches and fails coverage below 200 positives/200 benign. Missing evidence cannot pass. McNemar/CI results are per-comparison, not multiplicity-adjusted familywise superiority claims.

Start with `release_gate.default_contract()` and replace `other-a`/`other-b` with the exact two additional model identities (do not invent historical names). Predeclare language codes matching the corpus, all arms, latency sample counts and ablations before holdout. Provisional numeric values mirror parent-owned `artifacts/ml/v-final/offline-preparation/research-resume-1/provisional-design-gates.json`: recall point at least both v14/v17, lower95 delta >= -0.01; FPR point <= v14, upper95 delta <= 0.005; ECE <=0.05; global FPR<=0.02; service CPU batch1 p95<=100ms and <=v14, p99<=200ms; end-to-end p95<=150ms. These are proposed thresholds, not measurements or approved release policy.

Candidate `evidence` records must reference independently preserved real artifacts covering untouched_holdout, complete_exposure_audit, semantic_duplicate_review, privacy_review, production_policy_regressions_fixed, seed_runs (three distinct genuine seeds), ablations, paths and latency_contexts. Required paths: API, n8n, IDE, single/repeated whitelist and whitelist-plus-injection; timing contexts CPU/GPU batch1/concurrency. Boolean declarations are not cryptographic evidence; the offline gate **always leaves release_ready=false** even when numerical criteria pass. It is a diagnostic criteria checker; independent signed real-serving review, native multiclass/injection evaluation, seed/slice uncertainty and full ablation latency tables remain required before any genuine release claim.

## Packaging and deployment boundary

Copy/update MODEL_CARD into the new export directory from actual manifests and reports. `package-input.json` is `{source: export_directory, gate: gate_report_path}`. Packaging copies every file including external weights, pins exact bytes/full membership, rejects symlinks/path escapes, and verifies readback. It is quarantine-only and intentionally does not implement or bypass production signing.

For later integration: keep the existing v14 fallback; use the actual model adapter's input dtypes/tokenizer/output label contract; verify Node runtime as well as Python; ensure each API/n8n/IDE route executes intended ML and policy. Test effective findings/action/text and occurrence-complete redaction. Production whitelist issues documented in `docs/v-final/PHASE1_REPORT.md` remain unresolved. Shadow mode requires consent, no raw sensitive prompt logging and no user-visible policy change. Canary promotion and rollback require separate authorization. Monitor privacy-preserving score/label/language distributions, reviewed FPR/FNR proxies, drift, p95/p99/queueing/errors, policy regressions and calibration; triage weekly and retrain only after reviewed new data and a fresh holdout policy.

## Evidence interpretation

Original receipts remain under `.../offline-preparation/execution/`. This continuation uses only `.../offline-preparation/execution-resume-1/`. RED receipts, corrected fixture failures and warnings are retained. A scoped GREEN is not a production benchmark or independent code review. Final verification summary records the actual outcome and preserved source pins; the parent owns inference/recovery and analysis/design scopes. Research: 25 indexed citations, only 8 primary bodies evidenced, 17 body gaps; this package does not claim research acceptance.
