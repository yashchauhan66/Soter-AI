#!/usr/bin/env python3
r"""Inspect a downloaded model-artifact zip BEFORE unpacking it into models/.

    python scripts/ml/_inspect_artifact_zip.py <path-to.zip>

Written as a file rather than an inline -c one-liner because the backslash check
needs a literal backslash, and a backslash inside a `python -c "..."` string on
this Windows/bash setup is eaten by two layers of quoting before Python ever sees
it -- the check then silently tests for nothing, or fails to parse.

What it refuses to pass:
  * backslash member names (see the repo's zip-for-Linux note)
  * a missing file from the production loader's REQUIRED set -- v12 shipped
    without tokenizer_config/vocab.txt and the ML tier failed OPEN in prod, which
    does not error, it goes dark
  * a dataset_manifest.json that does not list 11 datasets: 8 means
    --train-datasets was dropped and this is v14 retrained under a new name, and
    that artifact prints perfectly healthy in-distribution metrics
"""
from __future__ import annotations

import hashlib
import json
import sys
import zipfile

REQUIRED = [
    "model.onnx",
    "labels.json",
    "calibration.json",
    "tokenizer_config/vocab.txt",
    "tokenizer_config/tokenizer_config.json",
    "training_stats.json",
    "eval_results.json",
    "dataset_manifest.json",
    "split_indices.json",
    "pytorch_model.bin",
]

EXPECTED_DATASETS = 11


def main() -> int:
    if len(sys.argv) < 2:
        raise SystemExit("usage: _inspect_artifact_zip.py <artifact.zip>")
    path = sys.argv[1]

    blob = open(path, "rb").read()
    print(f"file   : {path}")
    print(f"size   : {len(blob) / 1048576:.1f} MB")
    print(f"sha256 : {hashlib.sha256(blob).hexdigest()}")

    with zipfile.ZipFile(path) as z:
        names = z.namelist()
        bad = [n for n in names if "\\" in n]
        if bad:
            raise SystemExit(f"[FATAL] backslash member names: {bad[:3]}")
        print(f"members: {len(names)}, no backslash paths -> unpacks correctly\n")

        for info in sorted(z.infolist(), key=lambda i: -i.file_size):
            if not info.is_dir():
                print(f"  {info.file_size:>13,}  {info.filename}")

        missing = [r for r in REQUIRED if r not in names]
        print()
        if missing:
            raise SystemExit(f"[FATAL] INCOMPLETE artifact, do not unpack or sign: {missing}")
        print(f"[ok] all {len(REQUIRED)} loader-required files present")

        stats = json.loads(z.read("training_stats.json"))
        man = json.loads(z.read("dataset_manifest.json"))
        labels = json.loads(z.read("labels.json"))

    m = stats.get("final_metrics", {})
    sel = stats.get("epoch_selection", {})
    tok = stats.get("tokenizer", {})
    arch = stats.get("architecture", {})
    opt = stats.get("optimization", {})

    def hp(key):
        """Hyperparameters live under optimization./architecture., NOT at top level.

        Reading them from the top level returns None for every one of them, and
        None prints without raising -- so the report looks complete while silently
        omitting the exact numbers (effective batch, encoder LR) that decide
        whether two arms are comparable at all. Search the real homes first.
        """
        for src in (opt, arch, stats):
            if key in src:
                return src[key]
        return None

    print(f"\nencoder        : {stats.get('base_model')}  ({arch.get('hidden_size')}d)")
    print(f"method         : {stats.get('method')}")
    print(f"epochs run     : {hp('epochs')}")
    print(f"selected epoch : {sel.get('selected_epoch')}   rule: {sel.get('rule')}")
    # effective_batch_size is NOT recorded by the trainer under any key -- it is
    # derived. Printing hp('effective_batch_size') shows None, which reads as
    # "unknown" for the single number that decides whether two arms are
    # comparable. Compute it, and say so when the inputs are missing.
    _b, _a = hp("batch_size"), hp("grad_accum")
    eff = _b * _a if isinstance(_b, int) and isinstance(_a, int) else None
    print(f"batch / accum  : {_b} x {_a} = effective "
          f"{eff if eff is not None else 'UNKNOWN (batch or accum absent)'}  [derived]")
    print(f"encoder-lr     : {hp('encoder_lr')}   head-lr {hp('head_lr')}")
    print(f"amp            : {hp('amp')}")
    print(f"max_length     : {hp('max_length')}")
    print(f"labels         : {len(labels)}")
    print(f"vocab.txt      : {tok.get('vocab_txt_tokens')} tokens  "
          f"(do_lower_case={tok.get('do_lower_case')})")
    print("\nIN-DISTRIBUTION validation metrics -- a training signal, NOT a deploy gate:")
    print(f"  macro F1      {m.get('f1_macro')}")
    print(f"  attack recall {m.get('attack_recall')}")
    print(f"  benign FPR    {m.get('benign_fpr')}   (ceiling {sel.get('fpr_ceiling')})")

    parity = stats.get("onnx_parity", {})
    if parity.get("verified"):
        print(f"\nONNX parity    : OK, worst max|diff| = {parity.get('worst_max_abs_logit_diff')}")
    else:
        print(f"\nONNX parity    : UNVERIFIED ({parity.get('reason')})")

    datasets = man.get("datasets", [])
    rpf = man.get("rows_per_file", {})
    print(f"\ndatasets in manifest: {len(datasets)}")
    total = 0
    for d in datasets:
        n = int(rpf.get(d, 0)) if isinstance(rpf, dict) else 0
        total += n
        print(f"  {n:>7,}  {d}")
    print(f"  {total:>7,}  TOTAL")
    if len(datasets) != EXPECTED_DATASETS:
        raise SystemExit(
            f"[FATAL] expected {EXPECTED_DATASETS} datasets, got {len(datasets)}.\n"
            "        This artifact is NOT v17 -- --train-datasets was dropped and the run\n"
            "        silently retrained an older corpus under a new name.")
    if "datasets/ml-v17-threat-corpus.jsonl" not in datasets:
        raise SystemExit("[FATAL] the v17 increment is not in the manifest; this is not v17.")
    if any(int(rpf.get(d, 0)) <= 0 for d in datasets):
        raise SystemExit("[FATAL] a manifest dataset loaded zero rows.")
    print(f"\n[ok] manifest lists {EXPECTED_DATASETS} datasets including the v17 increment")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
