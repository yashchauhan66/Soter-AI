# Reproduce Phase 1 without changing production assets

Run from the Soter repository root. The tested Windows interpreter is `py -3.12` (Python 3.12.10). The shell is Bash; paths for native programs use `C:/...` or repository-relative paths. Do not run the current trainer's `--verify-only` as a read-only audit: it can fetch a base model and rewrite source metadata.

## 1. Recovery tests — expected green

```bash
export TMPDIR='C:/Users/USER/AppData/Local/hermes/cache/scratch' TMP='C:/Users/USER/AppData/Local/hermes/cache/scratch' TEMP='C:/Users/USER/AppData/Local/hermes/cache/scratch'
export PYTHONDONTWRITEBYTECODE=1 HF_HUB_OFFLINE=1 TRANSFORMERS_OFFLINE=1 HF_HUB_DISABLE_TELEMETRY=1
OMP_NUM_THREADS=2 MKL_NUM_THREADS=2 TOKENIZERS_PARALLELISM=false py -3.12 -B tools/v-final/tests/test_recover_export.py
```

The first input-integrity cycle passed **13 tests**. After the resumed source-snapshot cycle, the parent fresh genuine suite passed **20/20 tests** (exit 0, 234.155 seconds), including the actual approved v18 load, isolated CLI export and four-shape PyTorch/CPU ORT parity. Exact source hashes and all expected/observed test methods match. Temporary fixtures use the explicit Hermes scratch settings above. Evidence: `artifacts/ml/v-final/phase1/v18-recovered/evidence/cycle2-parent-full-suite.json` and its fingerprinted full log. Upstream warnings remain visible and may print after `OK`. The existing recovered bundle remains `release_ready:false`. Final hash-bound independent review **FAILED** on possible retained-consumer cleanup and verified-manifest/final-cleanup status consistency (`independent-review-3.json`); those are static findings, not proof of a newly reproduced failure. The existing strict-assignment cleanup test passed before its test-only traceback teardown. Additional deterministic failure-path probes and an explicit user decision are required before another source-fix cycle; two automatic cycles are already used. Ruff reports 17 retained findings judged nonblocking suggestions by that reviewer. This is not a lint-clean or phase-complete claim.

## 2. A new isolated recovery directory

Do not reuse an existing directory or write into either original model directory.

```bash
OMP_NUM_THREADS=2 MKL_NUM_THREADS=2 TOKENIZERS_PARALLELISM=false py -3.12 -B tools/v-final/recover_export.py --source-dir models/ml-classifier-v18-candidate --output-dir artifacts/ml/v-final/phase1/v18-recovered/replay-cpu-fp32-001
```

The CLI pins this checkpoint and raw metadata. A reserialized or altered source is rejected; preserve identifiers and diagnose differences instead of silently accepting another source. Inspect `recovery_manifest.json`, all referenced `model.onnx.data` bytes, and actual ORT outputs before using a recovered bundle.

## 3. Existing whitelist regression — expected red until policy work

```bash
TSX_DISABLE_CACHE=1 NODE_OPTIONS='--max-old-space-size=128 --max-semi-space-size=1' node --import tsx tools/v-final/tests/pii-ignore-boundary.test.mts
```

This uses real n8n request/postprocessing with the repo's mocked HTTP transport. It is not a live API or model benchmark. It asserts effective risk/action reconciliation, not only restored text.

## 4. Repeated PII in the actual synchronous rules core — expected red

```bash
TSX_DISABLE_CACHE=1 SOTERAI_DETECTION_TIER=rules NODE_OPTIONS='--max-old-space-size=256' node --import tsx -e 'const assert=require("node:assert/strict");const {runInputGuard}=require("./lib/guard/inputGuard.ts");const email="jane@example.com";const result=runInputGuard(`Contact ${email}, then ${email}.`);console.log(result.safeText);assert.equal(result.safeText.includes(email),false,"Every repeated unapproved email must be redacted");'
```

Observed: `Contact [REDACTED_EMAIL], then jane@example.com.` The exact symptom assertion fails; no production fix has been made during recon.

## 5. Native Node ORT compatibility

The actual installed `onnxruntime-node` is 1.21.1. Direct loading of the recovered opset-20 bundle succeeded and returned finite `[1,14]` logits for a `[1,3]` int64 probe. This does not prove the production signed-artifact gate or final server decision path. Evidence: `artifacts/ml/v-final/phase1/v18-recovered/evidence/native-ort-contract.json`.

## 6. Full validation reconstruction and scoring — executed code

Save the following code to the configured scratch directory. Choose a NEW `OUT` name before rerunning: this code intentionally rejects prior output to preserve evidence. It never trains or changes original data, splits, model weights, calibration or model metadata.

The v14 normalizer comes from an explicitly fingerprinted Git revision, and every saved index is checked. Current Unicode-aware grouping is used for v17. Model scoring and metric definitions reuse the repository's functions. `log(P)` preserves argmax, which is what those metric functions score.

```python
"""Read-only reconstruction of recorded validation partitions and native inference."""
from __future__ import annotations
import ast
import hashlib
import importlib.util
import json
import re
import subprocess
import unicodedata
import sys
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
from sklearn.metrics import classification_report, f1_score

ROOT = Path("C:/Users/USER/OneDrive/Desktop/Ai-Agent-Security-Guard")
OUT = ROOT / "artifacts/ml/v-final/phase1/full-validation-replay"
if OUT.exists():
    raise RuntimeError("Refusing to overwrite an earlier validation cohort")
OUT.mkdir(parents=True)
sys.path.insert(0, str(ROOT / "scripts/ml"))
from soter_augment import group_key_for

legacy_reference = "24fd1097c48f84ce4498258ef9156bc3340d864e:scripts/ml/soter_augment.py"
legacy_payload = subprocess.check_output(["git", "show", legacy_reference], cwd=ROOT)
legacy_sha256 = hashlib.sha256(legacy_payload).hexdigest()
assert legacy_sha256 == "198c65544cd89ad72adb949645006b3d93ffd5d434d99ec5f0184d503b3872a7"
legacy_tree = ast.parse(legacy_payload.decode("utf-8"))
legacy_node = next(node for node in legacy_tree.body if isinstance(node, ast.FunctionDef)
                   and node.name == "group_key_for")
legacy_namespace = {"unicodedata": unicodedata, "re": re}
exec(compile(ast.Module(body=[legacy_node], type_ignores=[]), legacy_reference, "exec"), legacy_namespace)

trainer_path = ROOT / "scripts/ml/train-soterllm-v14-fullft.py"
trainer_source = trainer_path.read_text(encoding="utf-8")
tree = ast.parse(trainer_source)
selected = [node for node in tree.body if isinstance(node, ast.FunctionDef)
            and node.name in {"load_jsonl", "score_from_logits", "group_aware_split"}]
assert len(selected) == 3
namespace = {"Path": Path, "json": json, "np": np, "group_key_for": group_key_for,
             "SAFE_INDEX": 0, "classification_report": classification_report,
             "f1_score": f1_score}
exec(compile(ast.Module(body=selected, type_ignores=[]), str(trainer_path), "exec"), namespace)
spec = importlib.util.spec_from_file_location("validation_comparison", ROOT / "scripts/ml/compare-v18-bases.py")
comparison = importlib.util.module_from_spec(spec)
spec.loader.exec_module(comparison)

result = {
    "scope": "Fresh CPU FP32 ONNX raw-argmax validation reconstruction; no training, tuning, downloads or source metadata edits.",
    "generated_utc": datetime.now(timezone.utc).isoformat(),
    "trainer_functions": [node.name for node in selected],
    "trainer_raw_sha256": comparison.sha(trainer_path),
    "legacy_normalizer_reference": legacy_reference,
    "legacy_normalizer_source_raw_sha256": legacy_sha256,
    "arms": {},
    "limitations": ["Recorded validation inference used the stored training precision; current inference is CPU FP32 ONNX.",
                    "Validation partitions differ across model versions; this is reproduction, not apples-to-apples generalization.",
                    "Calibration ECE and training history are not recomputed here."],
}
fields = ("accuracy", "f1_macro", "f1_weighted", "attack_recall", "attack_precision", "benign_fpr", "exact_label_accuracy")
for name, relative in (("v14", "models/ml-classifier-v14"), ("v17-multilingual", "models/ml-classifier-v17")):
    directory = ROOT / relative
    manifest = json.loads((directory / "dataset_manifest.json").read_text(encoding="utf-8"))
    split = json.loads((directory / "split_indices.json").read_text(encoding="utf-8"))
    mapping = json.loads((directory / "labels.json").read_text(encoding="utf-8"))
    labels = [mapping[str(i)] for i in range(len(mapping))]
    assert len(labels) == 14 and labels[0] == "SAFE"
    paths = [str(ROOT / relative_path) for relative_path in manifest["datasets"]]
    assert all(Path(path).is_file() for path in paths)
    namespace["group_key_for"] = legacy_namespace["group_key_for"] if name == "v14" else group_key_for
    texts, targets, groups, per_file = namespace["load_jsonl"](
        paths, {label: i for i, label in enumerate(labels)},
    )
    assert len(texts) == len(targets) == len(groups) == manifest["rows_total"]
    assert len(set(groups)) == manifest["groups_total"]
    for relative_path, expected in manifest["rows_per_file"].items():
        assert per_file[str(ROOT / relative_path)] == expected
    train, calibration, validation, _ = namespace["group_aware_split"](groups, seed=split["seed"])
    indices = split["indices"]
    assert train == [i for i in indices["train"] if i < len(texts)]
    assert calibration == indices["calibration"] and validation == indices["validation"]
    rows = [{"text": texts[i], "label": labels[targets[i]]} for i in validation]
    truth = np.array([targets[i] for i in validation], dtype=np.int64)
    recorded = json.loads((directory / "eval_results.json").read_text(encoding="utf-8"))
    supports = Counter(row["label"] for row in rows)
    assert supports == {label: int(recorded["per_label"][label]["support"]) for label in labels}
    del texts, targets, groups
    print(f"RECONSTRUCTED {name}: {len(rows)} validation rows; split indices and per-label supports match", flush=True)
    cache = comparison.run_arm(name, relative, rows, OUT, batch_size=32, threads=2, latency_samples=1)
    probabilities = np.asarray(cache["probabilities"], dtype=np.float64)
    # log(P) is a normalized, argmax-equivalent logit representation. The exact
    # repository scoring function uses only argmax for every reported metric.
    metrics = namespace["score_from_logits"](np.log(np.maximum(probabilities, 1e-300)), truth, len(labels), labels)
    stats = json.loads((directory / "training_stats.json").read_text(encoding="utf-8"))
    differences = {field: float(metrics[field] - recorded[field]) for field in fields if field in recorded}
    arm = {
        "validation_rows": len(rows), "per_label_supports": dict(supports),
        "persisted_indices_reproduced": True,
        "normalizer": "git-archived-pre-Unicode-fix" if name == "v14" else "current-Unicode-aware",
        "identity": cache["identity"], "scoring": cache["scoring"],
        "recorded_device": stats.get("device"), "recorded_amp": stats.get("optimization", {}).get("amp"),
        "measured": {field: metrics[field] for field in fields},
        "recorded": {field: recorded[field] for field in fields if field in recorded},
        "differences_measured_minus_recorded": differences,
        "matching_metrics_abs_tolerance_1e_12": all(abs(delta) <= 1e-12 for delta in differences.values()),
        "measured_per_label": metrics["report"],
        "dataset_raw_sha256": {relative_path: comparison.sha(ROOT / relative_path) for relative_path in manifest["datasets"]},
    }
    result["arms"][name] = arm
    (OUT / f"{name}-reproduction.json").write_text(json.dumps(arm, indent=2, allow_nan=False), encoding="utf-8")
    (OUT / "report.json").write_text(json.dumps(result, indent=2, allow_nan=False), encoding="utf-8")
    print("VALIDATION_RESULT " + json.dumps({"arm": name, "measured": arm["measured"], "differences": differences}), flush=True)
assert set(result["arms"]) == {"v14", "v17-multilingual"}
result["complete"] = True
(OUT / "report.json").write_text(json.dumps(result, indent=2, allow_nan=False), encoding="utf-8")
print("FULL_VALIDATION_COMPLETE " + str(OUT / "report.json"), flush=True)
```

Observed: 17,745 v14 and 18,384 v17 validation rows; exact saved index/support reproduction; small measured-versus-recorded differences retained. CUDA/BF16 versus CPU FP32 is a hypothesis for the discrepancy, not a completed precision ablation. Original GPU/calibration reproduction is not run.

## 7. Common six-arm cohort — executed code

Save the following in scratch, then invoke with the same three environment settings as above. Choose a NEW `OUT` directory before rerunning. p99 is computed from actual stored batch-one timings; 80 samples do not certify a production p99. The script's `model_bytes` is header-only for external-data ONNX: use `artifact_sizes_verified.json` and sum the external files when comparing size.

```python
import importlib.util,sys,json,numpy as np
from pathlib import Path
ROOT=Path("C:/Users/USER/OneDrive/Desktop/Ai-Agent-Security-Guard")
OUT=ROOT/"artifacts/ml/v-final/phase1/recheck-six"
if OUT.exists(): raise RuntimeError("Choose a new cohort directory; existing evidence is preserved")
spec=importlib.util.spec_from_file_location("comparison",ROOT/"scripts/ml/compare-v18-bases.py")
c=importlib.util.module_from_spec(spec); spec.loader.exec_module(c)
c.ARMS={"v14":"models/ml-classifier-v14","v15":"models/ml-classifier-v15","v16":"models/ml-classifier-v16","v17-minilm":"models/ml-classifier-v17-minilm","v17-multilingual":"models/ml-classifier-v17","v18-recovered":"artifacts/ml/v-final/phase1/v18-recovered/verified-cpu-fp32"}
original_percentile=c.percentile
c.percentile=lambda values:{**original_percentile(values),"p99_ms":float(np.percentile(values,99)),"raw_ms":[float(v) for v in values]}
sys.argv=["compare-v18-bases.py","--rows",str(ROOT/"datasets/v15-test-battery.jsonl"),"--out",str(OUT),"--batch-size","16","--threads","2","--latency-samples","80"]
c.main()
report=json.loads((OUT/"report.json").read_text(encoding="utf-8"))
assert len(report["arms"])==6 and set(report["arms"])==set(c.ARMS) and report["rows"]==274
print("COHORT_COMPLETE "+json.dumps({name:{"gate":arm["metrics"]["shared_input_gate"],"dynamic":{k:v for k,v in arm["latency"]["dynamic"].items() if k!="raw_ms"},"fixed256":{k:v for k,v in arm["latency"]["fixed256"].items() if k!="raw_ms"}} for name,arm in report["arms"].items()}),flush=True)
```

## 8. Reproduction rules

- Never pool recorded validation, historical cached scores, fresh ML-only inference and live policy outcomes into one unexplained metric.
- Preserve raw hashes; LF/canonical aliases are diagnostics, not permission to reuse a mismatched current cache.
- Use exact source-specific normalizers to reconstruct old partitions; do not replace the split just to match a row count.
- Decontaminate new training/selection data against release data AND all teacher train/calibration/validation exposure.
- Keep diagnostic/hard-negative mining data separate from the untouched release holdout. Do not calibrate on this 274-row cohort.
- Do not post probes/load to production or alter its trust roots, limits, configuration or active weights without the deployment step.
