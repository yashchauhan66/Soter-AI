#!/usr/bin/env python3
"""
Refit v16's per-label thresholds on ITS OWN held-out calibration split.

WHY THIS EXISTS
  v16 is not losing to v14 because the network is worse. On the 73 attack rows
  v14 catches and v16 misses, v16 predicted an ATTACK label in 49 of them and a
  gate threw the prediction away (24 abstention, 23 label-family, 2 mixed).
  Only 24 are true "model said SAFE" misses.

  The abstention half is an OPERATING-POINT defect, not a learning defect.
  `fit_per_label_thresholds` sets each label's threshold at the (target_fpr)
  quantile of that label's NEGATIVE scores on the calibration split. v16 puts
  much more probability mass on the override labels than v14 did, so the same
  1% target produced far stricter thresholds:

      label                        v14 fitted   v16 fitted   v16 shipped
      SYSTEM_PROMPT_LEAK_ATTEMPT      0.1567       0.7496     0.5 (clamped)
      PROMPT_INJECTION                0.1467       0.2376     0.2376
      JAILBREAK                       0.0180       0.1319     0.1319
      MULTI_TURN_ESCALATION           0.0006       0.0807     0.0807

  A threshold of 0.5 on SYSTEM_PROMPT_LEAK means the model must be >=50%
  certain on a 14-way softmax before the tier is allowed to speak. That is not
  the deployed risk budget: the acceptance gate allows 5.6% ordinary-traffic
  FPR end-to-end, and v16 currently spends only 5.34% (49/918).

  So this script re-runs the SAME fitter on the SAME split at a range of target
  FPRs and emits one candidate calibration per target. It does not invent
  numbers and it never looks at the crossdist evaluation set.

WHAT IT DELIBERATELY DOES NOT DO
  It does not touch temperature (already baked into the exported ONNX logits),
  the OOD entropy percentiles, or the label map. Only per_label_thresholds and
  threshold_audit change, so any delta measured downstream is attributable to
  the operating point alone.

USAGE
  python scripts/ml/refit-v16-thresholds.py \
      --model-dir models/ml-classifier-v16 \
      --targets 0.01,0.02,0.03,0.05 \
      --out-dir artifacts/ml/v16-calib
"""

from __future__ import annotations

import argparse
import copy
import hashlib
import json
import sys
import time
from pathlib import Path

import numpy as np


def sha256_of(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as fh:
        for chunk in iter(lambda: fh.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def load_corpus(manifest_path: Path) -> list[dict]:
    """Load the corpus exactly as the trainer did: every file in `datasets`, in
    manifest order, appended in file order. split_indices.json addresses THIS
    sequence; any reordering silently scores the wrong rows."""
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    rows: list[dict] = []
    for rel in manifest.get("datasets", []):
        p = Path(rel)
        if not p.exists():
            raise SystemExit(
                f"missing training file {rel!r}. The calibration split cannot be "
                f"reproduced without the exact corpus; refusing to fit on a subset."
            )
        with p.open(encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue
                try:
                    rows.append(json.loads(line))
                except json.JSONDecodeError:
                    continue
    return rows


def fit_per_label_thresholds(probs: np.ndarray, labels: np.ndarray, all_labels: list[str],
                             safe_index: int, target_fpr: float,
                             policy: str = "legacy") -> tuple[dict[str, float], dict]:
    """Verbatim port of scripts/ml/train-soterllm-v14-fullft.py::fit_per_label_thresholds.

    Kept byte-compatible on purpose: if this function drifted from the trainer's,
    the candidate thresholds would not be comparable to the shipped ones and the
    whole comparison would be measuring the port, not the operating point.
    """
    num_labels = len(all_labels)
    argmax_floor = 1.0 / num_labels
    thresholds: dict[str, float] = {}
    fitted_raw: dict[str, float] = {}
    inert: list[str] = []

    for i in range(num_labels):
        name = all_labels[i]
        if i == safe_index:
            thresholds[name] = 0.0
            fitted_raw[name] = 0.0
            continue
        other = probs[labels != i, i]
        if len(other) == 0:
            thresholds[name] = 0.15
            fitted_raw[name] = 0.15
            continue
        sorted_scores = np.sort(other)[::-1]
        idx = int(len(sorted_scores) * target_fpr)
        raw = float(sorted_scores[min(idx, len(sorted_scores) - 1)])
        fitted_raw[name] = raw
        clamped = float(max(0.05, min(0.5, raw)))
        if clamped <= argmax_floor:
            inert.append(name)
            if policy == "omit-inert":
                continue
        thresholds[name] = clamped

    no_negatives = [all_labels[i] for i in range(num_labels)
                    if i != safe_index and (labels != i).sum() and len(probs[labels != i, i]) == 0]

    audit = {
        "policy": policy,
        "target_fpr": target_fpr,
        "argmax_floor": argmax_floor,
        "argmax_floor_derivation": f"argmax of a {num_labels}-class softmax is >= 1/{num_labels}",
        "fitted_before_clamp": fitted_raw,
        "inert_thresholds": inert,
        "labels_without_negatives": no_negatives,
        "consequence": (
            "A label listed in inert_thresholds can never fail its threshold. Because "
            "lib/ml/calibration.ts clearsLabelThreshold() prefers any finite per-label "
            "threshold over the global ML_ONNX_CONFIDENCE_FLOOR, emitting an inert value "
            "also disables that global floor for the label."
        ),
    }
    return thresholds, audit


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--model-dir", default="models/ml-classifier-v16")
    ap.add_argument("--targets", default="0.01,0.02,0.03,0.05")
    ap.add_argument("--out-dir", default="artifacts/ml/v16-calib")
    ap.add_argument("--batch", type=int, default=64)
    ap.add_argument("--max-length", type=int, default=256)
    args = ap.parse_args()

    model_dir = Path(args.model_dir)
    out_dir = Path(args.out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    labels_raw = json.loads((model_dir / "labels.json").read_text(encoding="utf-8"))
    if isinstance(labels_raw, dict):
        all_labels = [labels_raw[k] for k in sorted(labels_raw, key=lambda x: int(x))]
    else:
        all_labels = list(labels_raw)
    safe_index = all_labels.index("SAFE")
    label_to_idx = {name: i for i, name in enumerate(all_labels)}

    split = json.loads((model_dir / "split_indices.json").read_text(encoding="utf-8"))
    cal_idx = split["indices"]["calibration"]
    rows = load_corpus(model_dir / "dataset_manifest.json")
    if len(rows) != split.get("rows_total"):
        raise SystemExit(
            f"corpus is {len(rows)} rows but split_indices says {split.get('rows_total')}. "
            f"Indices would address the wrong rows; refusing to fit."
        )

    cal_rows = [rows[i] for i in cal_idx]
    cal_rows = [r for r in cal_rows if isinstance(r.get("text"), str) and r.get("label") in label_to_idx]
    texts = [r["text"] for r in cal_rows]
    y = np.array([label_to_idx[r["label"]] for r in cal_rows], dtype=np.int64)
    print(f"calibration split: {len(texts)} scoreable rows of {len(cal_idx)} indices")

    import onnxruntime as ort
    from transformers import AutoTokenizer

    onnx_path = model_dir / "model.onnx"
    sess = ort.InferenceSession(str(onnx_path), providers=["CPUExecutionProvider"])
    tok = AutoTokenizer.from_pretrained(str(model_dir / "tokenizer_config"))

    probs = np.zeros((len(texts), len(all_labels)), dtype=np.float32)
    t0 = time.perf_counter()
    for i in range(0, len(texts), args.batch):
        chunk = texts[i : i + args.batch]
        enc = tok(chunk, padding=True, truncation=True,
                  max_length=args.max_length, return_tensors="np")
        logits = sess.run(None, {
            "input_ids": enc["input_ids"].astype(np.int64),
            "attention_mask": enc["attention_mask"].astype(np.int64),
        })[0]
        # Temperature is ALREADY divided into the exported logits (see the model's
        # calibration.json `notes`). Dividing again here would double-soften them
        # and every threshold fitted below would be wrong in the same direction.
        sh = logits - logits.max(axis=1, keepdims=True)
        p = np.exp(sh)
        probs[i : i + len(chunk)] = p / p.sum(axis=1, keepdims=True)
        if (i // args.batch) % 25 == 0:
            done = i + len(chunk)
            rate = done / max(1e-9, time.perf_counter() - t0)
            print(f"  {done}/{len(texts)}  {rate:.0f} rows/s", flush=True)
    print(f"scored in {time.perf_counter() - t0:.1f}s")

    base = json.loads((model_dir / "calibration.json").read_text(encoding="utf-8"))
    onnx_sha = sha256_of(onnx_path)
    index = {"model_dir": str(model_dir), "model_onnx_sha256": onnx_sha,
             "calibration_rows": len(texts), "candidates": {}}

    for tgt in [float(t) for t in args.targets.split(",") if t.strip()]:
        thr, audit = fit_per_label_thresholds(probs, y, all_labels, safe_index, tgt)
        cand = copy.deepcopy(base)
        cand["per_label_thresholds"] = thr
        cand["threshold_audit"] = audit
        cand["target_fpr"] = tgt
        cand["refit_provenance"] = {
            "refit_by": "scripts/ml/refit-v16-thresholds.py",
            "reference": "v16 held-out calibration split from split_indices.json",
            "rows": len(texts),
            "model_onnx_sha256": onnx_sha,
            "changed_fields": ["per_label_thresholds", "threshold_audit", "target_fpr"],
            "bound": ("Fitted only on the training-time calibration split. The crossdist "
                      "acceptance set was not consulted, so this file is not tuned on the "
                      "gate it will later be judged by."),
        }
        name = f"calibration-fpr{tgt:g}.json"
        (out_dir / name).write_text(json.dumps(cand, indent=2), encoding="utf-8")
        index["candidates"][f"{tgt:g}"] = {
            "file": str(out_dir / name),
            "thresholds": thr,
            "inert": audit["inert_thresholds"],
        }
        show = {k: round(v, 4) for k, v in thr.items()
                if k in ("PROMPT_INJECTION", "JAILBREAK", "SYSTEM_PROMPT_LEAK_ATTEMPT",
                         "MULTI_TURN_ESCALATION", "MODEL_EXTRACTION", "DATA_EXFILTRATION_ATTEMPT")}
        print(f"target_fpr {tgt:<6} -> {show}")

    (out_dir / "index.json").write_text(json.dumps(index, indent=2), encoding="utf-8")
    print(f"\nwrote {len(index['candidates'])} candidates to {out_dir}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
