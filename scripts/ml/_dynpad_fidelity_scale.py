#!/usr/bin/env python3
"""Is dynamic padding numerically identical to pad-to-256? Measured, at scale.

The latency anatomy says dropping [PAD] columns is a 5.7-7.0x p50 win. That is
only usable if it changes NO decision. A BERT forward pass is mask-invariant in
theory; in practice it is not if the pooling layer averages over padded
positions, or if an op in the exported graph ignores attention_mask. So this
does not reason about it -- it runs both and diffs.

Fails loudly (exit 1) if ANY arm shows a single decision flip.

Run:  python scripts/ml/_dynpad_fidelity_scale.py
"""
from __future__ import annotations

import json
import random
import sys
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(Path(__file__).resolve().parent))
import v14_vs_v17_10k_honest as H  # noqa: E402

ARMS = [
    ("v14", "models/ml-classifier-v14"),
    ("v17-minilm", "models/ml-classifier-v17-minilm"),
    ("v17-mdistilbert", "models/ml-classifier-v17"),
]
FILES = [
    "datasets/crossdist-eval-v3.jsonl",
    "datasets/v17-multilingual-battery.jsonl",
]
N = 500
SEED = 20260916


def main() -> int:
    rows = []
    for f in FILES:
        p = ROOT / f
        if p.is_file():
            rows += H.load_jsonl(str(p))
    rnd = random.Random(SEED)
    rnd.shuffle(rows)
    rows = rows[:N]
    # Deliberately include the long tail: truncation at 256 is where fixed and
    # dynamic could legitimately diverge, so those rows must not be sampled out.
    print(f"fidelity sample: {len(rows)} rows\n")

    report, failed = {}, False
    for name, d in ARMS:
        labels, thr, ood, safe_idx, tok, sess = H.load_arm(str(ROOT / d))
        flips, max_delta, n_trunc = 0, 0.0, 0
        deltas = []
        for r in rows:
            content = tok.encode_content(r["text"])
            if len(content) > 254:
                n_trunc += 1
            # Both arms MUST see the same tokens. BertTok.encode() truncates on a
            # whole-word boundary (it appends a word's pieces then breaks once the
            # buffer reaches max_len-1), which is NOT the same cut as content[:254].
            # Comparing those two encoders measures the truncation rule, not the
            # padding -- an earlier version of this script did exactly that and
            # reported a decision flip that had nothing to do with [PAD].
            ids_d, mask_d = tok.encode(r["text"])
            keep = sum(mask_d)
            ids_d, mask_d = ids_d[:keep], mask_d[:keep]
            ids_f = ids_d + [tok.v.get("[PAD]", 0)] * (tok.max_len - keep)
            mask_f = mask_d + [0] * (tok.max_len - keep)

            lo_f = sess.run(["logits"], {"input_ids": [ids_f], "attention_mask": [mask_f]})[0][0]
            lo_d = sess.run(["logits"], {"input_ids": [ids_d], "attention_mask": [mask_d]})[0][0]

            trunc = len(content) > 254
            p_f = H.decide(lo_f, labels, thr, ood, safe_idx, truncated=trunc)
            p_d = H.decide(lo_d, labels, thr, ood, safe_idx, truncated=trunc)
            if p_f != p_d:
                flips += 1
            delta = float(np.max(np.abs(H.softmax(lo_f) - H.softmax(lo_d))))
            deltas.append(delta)
            max_delta = max(max_delta, delta)

        deltas.sort()
        ok = flips == 0
        failed |= not ok
        print(f"{name:<18} decision flips {flips}/{len(rows)}   "
              f"max|dProb| {max_delta:.2e}   p95|dProb| {deltas[int(len(deltas)*0.95)]:.2e}   "
              f"(rows >254 tok: {n_trunc})   {'PASS' if ok else 'FAIL'}")
        report[name] = {
            "rows": len(rows), "decision_flips": flips, "max_prob_delta": max_delta,
            "p95_prob_delta": deltas[int(len(deltas) * 0.95)], "truncated_rows": n_trunc,
            "verdict": "PASS" if ok else "FAIL",
        }

    out = ROOT / "artifacts" / "ml" / "v17-dynpad-fidelity.json"
    out.write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(f"\nWrote {out}")
    if failed:
        print("\nFAIL: dynamic padding changes decisions. Do NOT adopt it.")
        return 1
    print("\nPASS: dynamic padding is decision-identical on every arm.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
