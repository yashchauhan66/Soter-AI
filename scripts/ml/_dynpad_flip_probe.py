#!/usr/bin/env python3
"""Why does dynamic padding flip a decision, and does bucketing fix it?

_dynpad_fidelity_scale.py found 1 flip / 500 on v17-mdistilbert with max
|dProb| 7.4e-2 while p95 was 8.4e-5. That shape -- tiny for almost every row,
large for a couple -- is the signature of float non-associativity (different
sequence length => different MatMul tiling => different accumulation order),
not of a masking bug. A masking bug would shift every row with padding.

This separates the two explanations and prices the alternatives:
  A. single-threaded, to remove thread-reduction order as a variable
  B. pad-to-bucket {32,64,128,256} -- keeps most of the win, fewer distinct shapes
  C. the flipped row itself: which gate moved, and how close was it to the line

Run:  python scripts/ml/_dynpad_flip_probe.py
"""
from __future__ import annotations

import json
import random
import sys
import time
from pathlib import Path

import numpy as np
import onnxruntime as ort

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(Path(__file__).resolve().parent))
import v14_vs_v17_10k_honest as H  # noqa: E402

D = "models/ml-classifier-v17"
FILES = ["datasets/crossdist-eval-v3.jsonl", "datasets/v17-multilingual-battery.jsonl"]
N = 500
SEED = 20260916
BUCKETS = [32, 64, 128, 256]


def bucket_len(n: int) -> int:
    for b in BUCKETS:
        if n <= b:
            return b
    return BUCKETS[-1]


def encode(tok, text, mode):
    content = tok.encode_content(text)
    body = content[:254]
    ids = [tok.v.get("[CLS]", 101)] + body + [tok.v.get("[SEP]", 102)]
    mask = [1] * len(ids)
    if mode == "dynamic":
        return ids, mask, len(content) > 254
    target = 256 if mode == "fixed" else bucket_len(len(ids))
    ids = ids + [0] * (target - len(ids))
    mask = mask + [0] * (target - len(mask))
    return ids, mask, len(content) > 254


def run(sess, tok, rows, mode):
    out = []
    for r in rows:
        ids, mask, trunc = encode(tok, r["text"], mode)
        lo = sess.run(["logits"], {"input_ids": [ids], "attention_mask": [mask]})[0][0]
        out.append((lo, trunc))
    return out


def main() -> int:
    rows = []
    for f in FILES:
        p = ROOT / f
        if p.is_file():
            rows += H.load_jsonl(str(p))
    rnd = random.Random(SEED)
    rnd.shuffle(rows)
    rows = rows[:N]

    labels, thr, ood, safe_idx, tok, _ = H.load_arm(str(ROOT / D))

    results = {}
    for tag, threads in (("default-threads", 0), ("single-thread", 1)):
        so = ort.SessionOptions()
        if threads:
            so.intra_op_num_threads = 1
            so.inter_op_num_threads = 1
        sess = ort.InferenceSession(str(ROOT / D / "model.onnx"), so,
                                    providers=["CPUExecutionProvider"])
        base = run(sess, tok, rows, "fixed")
        for mode in ("dynamic", "bucket"):
            t0 = time.perf_counter()
            got = run(sess, tok, rows, mode)
            wall = time.perf_counter() - t0
            flips, deltas, flip_rows = 0, [], []
            for i, ((lf, tf), (lg, _)) in enumerate(zip(base, got)):
                pf = H.decide(lf, labels, thr, ood, safe_idx, truncated=tf)
                pg = H.decide(lg, labels, thr, ood, safe_idx, truncated=tf)
                d = float(np.max(np.abs(H.softmax(lf) - H.softmax(lg))))
                deltas.append(d)
                if pf != pg:
                    flips += 1
                    flip_rows.append({
                        "i": i, "label": rows[i].get("label"),
                        "lang": rows[i].get("language"), "fixed": pf, "other": pg,
                        "maxdelta": d, "tokens": len(tok.encode_content(rows[i]["text"])),
                        "text": rows[i]["text"][:110],
                        "p_attack_fixed": 1 - float(H.softmax(lf)[safe_idx]),
                        "p_attack_other": 1 - float(H.softmax(lg)[safe_idx]),
                    })
            deltas.sort()
            key = f"{tag}/{mode}"
            results[key] = {
                "flips": flips, "max_delta": deltas[-1],
                "p95_delta": deltas[int(len(deltas) * 0.95)],
                "wall_s": round(wall, 1), "flip_rows": flip_rows,
            }
            print(f"{key:<30} flips={flips}/{len(rows)}  max|d|={deltas[-1]:.2e}  "
                  f"p95|d|={deltas[int(len(deltas)*0.95)]:.2e}  wall={wall:.1f}s")

    print("\n-- flipped rows --")
    for k, v in results.items():
        for fr in v["flip_rows"]:
            print(f"  [{k}] label={fr['label']} lang={fr['lang']} tok={fr['tokens']}")
            print(f"       fixed={fr['fixed']}  other={fr['other']}  max|dProb|={fr['maxdelta']:.3e}")
            print(f"       p_attack fixed={fr['p_attack_fixed']:.6f} other={fr['p_attack_other']:.6f}")
            print(f"       abstain_floor={ood.get('suggested_abstain_max_prob')} "
                  f"binent_p95={ood.get('binary_entropy_p95')}")
            print(f"       text: {fr['text']!r}")

    out = ROOT / "artifacts" / "ml" / "v17-dynpad-flip-probe.json"
    out.write_text(json.dumps(results, indent=2), encoding="utf-8")
    print(f"\nWrote {out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
