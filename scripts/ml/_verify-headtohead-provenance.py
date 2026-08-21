#!/usr/bin/env python3
"""Prove which model dir produced a head-to-head number, and that rows matched.

headtohead-v12-vs-market.py writes its result under the hardcoded JSON key
"soterllm-v12" no matter what --model-dir was passed, so a v14 report is
indistinguishable from a v12 one by inspection. It also derives the scored row
set from `<model-dir>/dataset_manifest.json` (contamination removal), and v14
trained on 8 files where v12 trained on 6 -- so "same rows" is an assumption
until measured, not a given.

This re-runs ONLY the SoterLLM arm for both dirs, in one process, sequentially,
and prints a hash of the scored texts for each. No baselines, no network.
"""
from __future__ import annotations

import hashlib
import importlib.util
import sys
from collections import Counter
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
HARNESS = REPO / "scripts" / "ml" / "headtohead-v12-vs-market.py"


def load_harness():
    spec = importlib.util.spec_from_file_location("hh", HARNESS)
    mod = importlib.util.module_from_spec(spec)
    sys.modules["hh"] = mod
    spec.loader.exec_module(mod)
    return mod


def scope_for(hh, model_dir: Path, rows: list) -> list:
    skel, missing = hh.training_skeletons(model_dir / "dataset_manifest.json")
    if missing:
        print(f"  !! incomplete contamination check for {model_dir.name}: {missing}")
    print(f"  {model_dir.name}: {len(skel):,} training group keys")
    return [r for r in rows
            if r["label"] in hh.OVERRIDE_SCOPE and hh.group_key_for(r["text"]) not in skel]


def main() -> int:
    hh = load_harness()
    rows = hh.read_jsonl(REPO / "datasets" / "crossdist-eval-v3.jsonl")
    rows = [r for r in rows
            if isinstance(r.get("text"), str) and r.get("label") in hh.ALL_LABELS]
    print(f"eval rows: {len(rows):,}\n")

    dirs = [REPO / "models" / "ml-classifier-v14", REPO / "models" / "ml-classifier-v12"]
    scopes, digests = {}, {}
    for d in dirs:
        s = scope_for(hh, d, rows)
        scopes[d.name] = s
        digests[d.name] = hashlib.sha256(
            "\n".join(r["text"] for r in s).encode("utf-8")).hexdigest()[:16]
        print(f"    scope {len(s):,} rows  texts-sha256 {digests[d.name]}  "
              f"mix {dict(Counter(r['label'] for r in s))}")

    same = len(set(digests.values())) == 1
    print(f"\nrow sets identical across dirs: {'YES' if same else 'NO — comparison invalid'}")
    if not same:
        return 3

    scope = scopes[dirs[0].name]
    texts = [r["text"] for r in scope]
    out = {}
    for d in dirs:  # strictly sequential: concurrent runs contaminate the latency figure
        print(f"\n[arm] {d.name} ...", flush=True)
        flags, ms = hh.run_v12(d, texts, 32)
        m = hh.metrics(scope, flags)
        m["ms_per_row_inference_only"] = round(ms, 2)
        out[d.name] = m
        print(f"    recall {m['recall_pct']}%  FPR {m['fpr_pct']}%  "
              f"precision {m['precision_pct']}%  F1 {m['f1_pct']}%  ({ms:.1f} ms/row)")

    print("\n" + "=" * 72)
    a, b = out[dirs[0].name], out[dirs[1].name]
    print(f"{'':<12}{'recall':>10}{'FPR':>9}{'precision':>12}{'F1':>9}{'ms/row':>10}")
    for name, m in out.items():
        print(f"{name.replace('ml-classifier-', ''):<12}{m['recall_pct']:>9}%"
              f"{m['fpr_pct']:>8}%{m['precision_pct']:>11}%{m['f1_pct']:>8}%"
              f"{m['ms_per_row_inference_only']:>10}")
    print(f"\ndistinct results: {'YES' if a != b else 'NO — both arms scored the same weights'}")
    print(f"attacks {a['tp'] + a['fn']}, benign {a['fp'] + a['tn']}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
