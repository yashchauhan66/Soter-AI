#!/usr/bin/env python3
"""Which size lever clears the 512 MiB gate WITHOUT costing detection?

_int8_quant_probe.py killed the obvious answer: blanket INT8 dynamic
quantization shrinks v17 4.0x (541,224,554 -> 135,741,148 B) but only agrees
with fp32 on 79.5% of decisions, and every disagreement but two goes the wrong
way (80/400 attacks -> SAFE). Unusable.

The graph says why it might be fixable. v17's bytes are not evenly spread:

    word_embeddings.weight  [119547, 768] = 91,812,096 params ~ 367 MB  (Gather)
    48 encoder MatMuls                    ~ 43,000,000 params ~ 172 MB  (MatMul)

Blanket quantization hits both. So this splits them and prices each half
separately, because they are different bets:

  matmul-int8        quantize the 48 MatMuls, leave the embedding table exact.
                     541 -> ~412 MB. Clears the gate on compute weights alone.
  matmul-int8-pc     same, per-channel + reduce_range (finer scales, the
                     standard fix when per-tensor INT8 collapses).
  gather-int8        quantize ONLY the embedding table, MatMuls exact.
                     541 -> ~266 MB. Isolates whether the embeddings are the
                     thing that broke blanket INT8.

Agreement is DECISION agreement through the production decide() path, and the
flip direction is reported separately: toSAFE is a new MISS (security loss),
toATTACK is a new false-positive risk. A variant is only a candidate if toSAFE
is 0.

Run:  python scripts/ml/_size_lever_probe.py
"""
from __future__ import annotations

import gc
import json
import random
import sys
import time
from pathlib import Path

import numpy as np
import onnxruntime as ort
from onnxruntime.quantization import QuantType, quantize_dynamic

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(Path(__file__).resolve().parent))
import v14_vs_v17_10k_honest as H  # noqa: E402

SRC = ROOT / "models" / "ml-classifier-v17" / "model.onnx"
OUT = ROOT / ".tmp" / "quant"
FILES = ["datasets/crossdist-eval-v3.jsonl", "datasets/v17-multilingual-battery.jsonl"]
N = 300
SEED = 20260916
GATE = 512 * 1024 * 1024

VARIANTS = [
    ("matmul-int8", dict(op_types_to_quantize=["MatMul"])),
    ("matmul-int8-pc", dict(op_types_to_quantize=["MatMul"], per_channel=True, reduce_range=True)),
    ("gather-int8", dict(op_types_to_quantize=["Gather"])),
]


def enc_dyn(tok, text):
    ids, mask = tok.encode(text)
    keep = sum(mask)
    return ids[:keep], mask[:keep]


def main() -> int:
    OUT.mkdir(parents=True, exist_ok=True)
    rows = []
    for f in FILES:
        p = ROOT / f
        if p.is_file():
            rows += H.load_jsonl(str(p))
    rnd = random.Random(SEED)
    rnd.shuffle(rows)
    rows = rows[:N]

    labels, thr, ood, safe_idx, tok, sess32 = H.load_arm(str(SRC.parent))

    # fp32 reference first, then drop the 541 MB session so peak memory stays
    # at one big model at a time (a previous probe died with `bad allocation`).
    enc = [enc_dyn(tok, r["text"]) for r in rows]
    trunc = [len(tok.encode_content(r["text"])) > 254 for r in rows]
    ref, lat32 = [], []
    for (ids, mask) in enc:
        t0 = time.perf_counter()
        lo = sess32.run(["logits"], {"input_ids": [ids], "attention_mask": [mask]})[0][0]
        lat32.append((time.perf_counter() - t0) * 1000)
        ref.append(lo)
    dec32 = [H.decide(ref[i], labels, thr, ood, safe_idx, truncated=trunc[i]) for i in range(len(rows))]
    lat32.sort()
    p50_32 = lat32[len(lat32) // 2]
    print(f"fp32 reference: {len(rows)} rows, p50 {p50_32:.1f} ms, "
          f"{SRC.stat().st_size:,} B, over gate: {SRC.stat().st_size > GATE}\n")
    del sess32
    gc.collect()

    report = {"rows": len(rows), "fp32_bytes": SRC.stat().st_size,
              "fp32_over_gate": SRC.stat().st_size > GATE, "fp32_p50_ms": round(p50_32, 2),
              "variants": {}}

    for name, kw in VARIANTS:
        if len(sys.argv) > 1 and name not in sys.argv[1:]:
            continue
        dst = OUT / f"v17-{name}.onnx"
        if not dst.is_file():
            # quantize_dynamic writes `model-inferred.onnx` NEXT TO THE SOURCE and
            # unlinks it on the next call. On Windows the previous call's mmap can
            # still hold it -> PermissionError WinError 32, and a 541 MB scratch
            # file is left inside the signed model directory. Clear it first, and
            # run one variant per process.
            stale = SRC.parent / "model-inferred.onnx"
            if stale.is_file():
                stale.unlink()
            t0 = time.perf_counter()
            quantize_dynamic(str(SRC), str(dst), weight_type=QuantType.QInt8, **kw)
            print(f"[{name}] quantized in {time.perf_counter()-t0:.0f}s")
            stale = SRC.parent / "model-inferred.onnx"
            if stale.is_file():
                try:
                    stale.unlink()
                except OSError:
                    print(f"[{name}] WARN: could not remove {stale}")
        size = dst.stat().st_size
        sess = ort.InferenceSession(str(dst), providers=["CPUExecutionProvider"])

        agree, flip_dir, flips, lat = 0, {"toSAFE": 0, "toATTACK": 0, "labelOnly": 0}, [], []
        maxd = 0.0
        for i, (ids, mask) in enumerate(enc):
            t0 = time.perf_counter()
            lo = sess.run(["logits"], {"input_ids": [ids], "attention_mask": [mask]})[0][0]
            lat.append((time.perf_counter() - t0) * 1000)
            d = H.decide(lo, labels, thr, ood, safe_idx, truncated=trunc[i])
            maxd = max(maxd, float(np.max(np.abs(H.softmax(ref[i]) - H.softmax(lo)))))
            if d == dec32[i]:
                agree += 1
            else:
                if d == "SAFE":
                    flip_dir["toSAFE"] += 1
                elif dec32[i] == "SAFE":
                    flip_dir["toATTACK"] += 1
                else:
                    flip_dir["labelOnly"] += 1
                flips.append({"label": rows[i].get("label"), "fp32": dec32[i], "quant": d,
                              "text": rows[i]["text"][:80]})
        lat.sort()
        p50 = lat[len(lat) // 2]
        ok = flip_dir["toSAFE"] == 0 and size <= GATE
        print(f"[{name}] {size:>13,} B  over gate {size > GATE}  ({SRC.stat().st_size/size:.2f}x)")
        print(f"         agreement {agree}/{len(rows)} = {agree/len(rows)*100:.2f}%   {flip_dir}")
        print(f"         max|dProb| {maxd:.2e}   p50 {p50:.1f} ms ({p50_32/p50:.2f}x fp32)   "
              f"{'CANDIDATE' if ok else 'REJECT'}\n")
        report["variants"][name] = {
            "bytes": size, "over_gate": size > GATE,
            "size_ratio": round(SRC.stat().st_size / size, 3),
            "agreement_pct": round(agree / len(rows) * 100, 3), "flip_direction": flip_dir,
            "max_prob_delta": maxd, "p50_ms": round(p50, 2),
            "speedup_p50": round(p50_32 / p50, 3), "flips_sample": flips[:8],
            "verdict": "CANDIDATE" if ok else "REJECT",
        }
        del sess
        gc.collect()

    p = ROOT / "artifacts" / "ml" / "v17-size-lever-probe.json"
    # One variant per process (see the WinError 32 note above), so merge rather
    # than overwrite -- otherwise the last run erases the earlier arms.
    if p.is_file():
        prev = json.loads(p.read_text(encoding="utf-8"))
        prev.get("variants", {}).update(report["variants"])
        report["variants"] = prev.get("variants", report["variants"])
    p.write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(f"Wrote {p}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
