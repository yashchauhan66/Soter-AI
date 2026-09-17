#!/usr/bin/env python3
"""Can INT8 give v17-mdistilbert v14's footprint without losing v17's accuracy?

Two separate problems, one candidate fix:

  SIZE  -- v17's model.onnx is 541,224,554 bytes. lib/ml/onnxBackend.ts:329 gates
           on SOTERAI_MODEL_MAX_BYTES, default 512*1024*1024 = 536,870,912. v17 is
           4,353,642 bytes OVER, so the supply-chain gate throws before the session
           is ever created. v17 is undeployable at stock config today.
  SPEED -- 68.2% of v17's params are embedding lookups (zero FLOPs); the 43M
           compute params are what cost time.

INT8 dynamic quantization attacks both, but only if it is free on accuracy. This
measures all three axes on the same rows rather than quoting a vendor speedup.

Agreement is reported as DECISION agreement through the production decide()
path, not logit MSE: a 1e-3 logit shift that never crosses a threshold costs
nothing, and a 1e-4 shift that crosses one costs a miss.

Run:  python scripts/ml/_int8_quant_probe.py
"""
from __future__ import annotations

import json
import random
import shutil
import sys
import time
from pathlib import Path

import numpy as np
import onnxruntime as ort
from onnxruntime.quantization import QuantType, quantize_dynamic

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(Path(__file__).resolve().parent))
import v14_vs_v17_10k_honest as H  # noqa: E402

OUT = ROOT / ".tmp" / "quant"
ARMS = [("v17-mdistilbert", "models/ml-classifier-v17"), ("v14", "models/ml-classifier-v14")]
FILES = ["datasets/crossdist-eval-v3.jsonl", "datasets/v17-multilingual-battery.jsonl"]
N = 400
SEED = 20260916
GATE_LIMIT = 512 * 1024 * 1024


def enc_dyn(tok, text):
    """Production tokens, padding removed. Truncation stays BertTok's own rule."""
    ids, mask = tok.encode(text)
    keep = sum(mask)
    return ids[:keep], mask[:keep]


def bench(sess, tok, texts):
    lat = []
    for t in texts:
        ids, mask = enc_dyn(tok, t)
        s = time.perf_counter()
        sess.run(["logits"], {"input_ids": [ids], "attention_mask": [mask]})
        lat.append((time.perf_counter() - s) * 1000)
    lat.sort()
    return {"p50_ms": round(lat[len(lat) // 2], 2), "p95_ms": round(lat[int(len(lat) * .95)], 2),
            "mean_ms": round(sum(lat) / len(lat), 2)}


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
    texts = [r["text"] for r in rows]
    print(f"sample: {len(rows)} rows\n")

    report = {}
    for name, d in ARMS:
        src = ROOT / d / "model.onnx"
        dst = OUT / f"{name}-int8.onnx"
        print(f"===== {name} =====")
        print(f"  fp32 {src.stat().st_size:>13,} bytes   over 512MiB gate: {src.stat().st_size > GATE_LIMIT}")
        if not dst.is_file():
            t0 = time.perf_counter()
            quantize_dynamic(str(src), str(dst), weight_type=QuantType.QInt8)
            print(f"  quantized in {time.perf_counter()-t0:.0f}s")
        q = dst.stat().st_size
        print(f"  int8 {q:>13,} bytes   over 512MiB gate: {q > GATE_LIMIT}   "
              f"({src.stat().st_size / q:.2f}x smaller)")

        labels, thr, ood, safe_idx, tok, s32 = H.load_arm(str(ROOT / d))
        s8 = ort.InferenceSession(str(dst), providers=["CPUExecutionProvider"])

        agree, flips, flip_dir = 0, [], {"toSAFE": 0, "toATTACK": 0, "labelOnly": 0}
        for r in rows:
            ids, mask = enc_dyn(tok, r["text"])
            trunc = len(tok.encode_content(r["text"])) > 254
            l32 = s32.run(["logits"], {"input_ids": [ids], "attention_mask": [mask]})[0][0]
            l8 = s8.run(["logits"], {"input_ids": [ids], "attention_mask": [mask]})[0][0]
            p32 = H.decide(l32, labels, thr, ood, safe_idx, truncated=trunc)
            p8 = H.decide(l8, labels, thr, ood, safe_idx, truncated=trunc)
            if p32 == p8:
                agree += 1
            else:
                if p8 == "SAFE":
                    flip_dir["toSAFE"] += 1
                elif p32 == "SAFE":
                    flip_dir["toATTACK"] += 1
                else:
                    flip_dir["labelOnly"] += 1
                flips.append({"label": r.get("label"), "fp32": p32, "int8": p8,
                              "text": r["text"][:90]})

        b32, b8 = bench(s32, tok, texts[:150]), bench(s8, tok, texts[:150])
        print(f"  decision agreement  {agree}/{len(rows)} = {agree/len(rows)*100:.2f}%")
        print(f"    flips: {flip_dir}  (toSAFE = new MISS, toATTACK = new FP risk)")
        print(f"  latency fp32  p50={b32['p50_ms']}ms p95={b32['p95_ms']}ms mean={b32['mean_ms']}ms")
        print(f"  latency int8  p50={b8['p50_ms']}ms p95={b8['p95_ms']}ms mean={b8['mean_ms']}ms")
        print(f"  int8 speedup  {b32['p50_ms']/b8['p50_ms']:.2f}x p50, "
              f"{b32['mean_ms']/b8['mean_ms']:.2f}x mean\n")

        report[name] = {
            "fp32_bytes": src.stat().st_size, "int8_bytes": q,
            "fp32_over_gate": src.stat().st_size > GATE_LIMIT, "int8_over_gate": q > GATE_LIMIT,
            "size_ratio": round(src.stat().st_size / q, 3),
            "agreement_pct": round(agree / len(rows) * 100, 3), "flip_direction": flip_dir,
            "flips_sample": flips[:10],
            "latency_fp32_dyn": b32, "latency_int8_dyn": b8,
            "speedup_p50": round(b32["p50_ms"] / b8["p50_ms"], 3),
        }

    p = ROOT / "artifacts" / "ml" / "v17-int8-quant-probe.json"
    p.write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(f"Wrote {p}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
