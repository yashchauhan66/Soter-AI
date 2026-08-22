#!/usr/bin/env python3
"""
Score a SoterLLM ONNX artifact over an eval corpus ONCE and persist the raw
per-row probability matrix.

WHY
  Blocker 1 (which labels may be trusted on INPUT) and Blocker 2 (threshold /
  margin sweep) both need the same probabilities. Re-running inference per sweep
  costs ~35 min a pass on this box; dumping once turns every subsequent sweep
  into milliseconds of numpy. It also guarantees every sweep is computed on
  IDENTICAL model outputs, so a difference between two candidate policies cannot
  be inference nondeterminism.

  Nothing here applies thresholds or picks a policy — that belongs downstream.
  This step is deliberately dumb: text in, calibrated probabilities out.

NOTE ON v7
  v7's ONNX was exported with a hardcoded output shape [1, 9], so it CANNOT be
  batched (onnxruntime raises "Shape mismatch attempting to re-use buffer" the
  moment batch > 1). Pass --batch 1 for v7. That is a real defect in the v7
  export, not a limitation of this script.

USAGE
  python scripts/ml/dump-model-probs.py --model-dir models/ml-classifier-v12 \
      --out artifacts/ml/probs-v12-crossdist-v3.npz
"""

from __future__ import annotations

import argparse
import json
import re
import time
import unicodedata
from pathlib import Path

import numpy as np


def group_key_for(text: str) -> str:
    t = unicodedata.normalize("NFKD", text)
    t = "".join(ch for ch in t if not unicodedata.combining(ch)).lower()
    leet = {"0": "o", "1": "i", "3": "e", "4": "a", "5": "s", "7": "t", "@": "a", "$": "s", "!": "i"}
    t = "".join(leet.get(ch, ch) for ch in t)
    letters = re.findall(r"[a-z]+", t)
    letters.sort()
    return " ".join(letters)


def read_jsonl(path: Path):
    rows = []
    with path.open(encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line:
                try:
                    rows.append(json.loads(line))
                except json.JSONDecodeError:
                    pass
    return rows


def training_skeletons(manifest_path: Path):
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    skel, missing = set(), []
    for rel in manifest.get("datasets", []):
        p = Path(rel)
        if not p.exists():
            missing.append(rel)
            continue
        with p.open(encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue
                try:
                    row = json.loads(line)
                except json.JSONDecodeError:
                    continue
                t = row.get("text")
                if isinstance(t, str) and t.strip():
                    skel.add(group_key_for(t))
    return skel, missing


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--model-dir", required=True)
    ap.add_argument("--eval", default="datasets/crossdist-eval-v3.jsonl")
    ap.add_argument("--batch", type=int, default=64)
    ap.add_argument("--limit", type=int, default=0)
    ap.add_argument("--out", required=True)
    args = ap.parse_args()

    import onnxruntime as ort
    from transformers import AutoTokenizer

    model_dir = Path(args.model_dir)
    labels_map = json.loads((model_dir / "labels.json").read_text(encoding="utf-8"))
    if isinstance(labels_map, dict):
        labels = [labels_map[k] for k in sorted(labels_map, key=lambda x: int(x))]
    else:
        labels = list(labels_map)

    rows = read_jsonl(Path(args.eval))
    rows = [r for r in rows if isinstance(r.get("text"), str) and r["text"].strip()
            and isinstance(r.get("label"), str)]
    if args.limit and len(rows) > args.limit:
        rng = np.random.RandomState(42)
        keep = sorted(rng.permutation(len(rows))[: args.limit].tolist())
        rows = [rows[i] for i in keep]

    skel, missing = training_skeletons(model_dir / "dataset_manifest.json")
    if missing:
        print(f"  !! missing training files; contamination flags incomplete: {missing}")
    seen = np.array([group_key_for(r["text"]) in skel for r in rows], dtype=bool)
    print(f"{len(rows)} rows, {int(seen.sum())} contaminated, {len(labels)} labels")

    sess = ort.InferenceSession(str(model_dir / "model.onnx"),
                               providers=["CPUExecutionProvider"])
    out_width = sess.get_outputs()[0].shape[-1]
    if isinstance(out_width, int) and out_width != len(labels):
        raise ValueError(f"ONNX emits {out_width} logits, labels.json lists {len(labels)}")
    tok = AutoTokenizer.from_pretrained(str(model_dir / "tokenizer_config"))

    probs = np.zeros((len(rows), len(labels)), dtype=np.float32)
    t0 = time.perf_counter()
    for i in range(0, len(rows), args.batch):
        chunk = [r["text"] for r in rows[i : i + args.batch]]
        enc = tok(chunk, padding=True, truncation=True, max_length=256, return_tensors="np")
        logits = sess.run(None, {
            "input_ids": enc["input_ids"].astype(np.int64),
            "attention_mask": enc["attention_mask"].astype(np.int64),
        })[0]
        sh = logits - logits.max(axis=1, keepdims=True)
        e = np.exp(sh)
        probs[i : i + len(chunk)] = e / e.sum(axis=1, keepdims=True)
        if i and i % (args.batch * 40) == 0:
            rate = i / (time.perf_counter() - t0)
            print(f"    {i}/{len(rows)}  {rate:.1f} rows/s  "
                  f"eta {(len(rows)-i)/max(rate,1e-9)/60:.1f} min")
    elapsed = time.perf_counter() - t0

    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    np.savez_compressed(
        out,
        probs=probs,
        labels=np.array(labels, dtype=object),
        gold=np.array([r["label"] for r in rows], dtype=object),
        source=np.array([r.get("source", "?") for r in rows], dtype=object),
        contaminated=seen,
        model_dir=str(model_dir),
        eval_set=str(args.eval),
        ms_per_row=np.float64(elapsed / max(1, len(rows)) * 1000),
        batch=np.int64(args.batch),
        allow_pickle=True,
    )
    print(f"wrote {out}  ({elapsed:.0f}s, {elapsed/len(rows)*1000:.2f} ms/row)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
