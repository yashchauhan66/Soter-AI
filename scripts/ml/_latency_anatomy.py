#!/usr/bin/env python3
"""Where the v17 latency actually goes: params, token lengths, padding waste.

Not a model comparison -- a cost anatomy. Three questions the plan depends on:

  1. How much of each arm is EMBEDDING table (zero FLOPs, pure bytes) vs
     transformer weights (the thing that actually costs time)? This decides
     whether vocab pruning is a latency lever or only a size lever.
  2. What is the real token-length distribution of production-shaped inputs?
     lib/ml/bertTokenizer.ts pads every input to maxLength (256 in .env), so
     padding waste = 1 - mean(content)/256.
  3. What does that waste cost in wall-clock, per arm, measured rather than
     assumed: fixed-256 vs dynamic (exact-length) padding.

Run:  python scripts/ml/_latency_anatomy.py
"""
from __future__ import annotations

import json
import random
import sys
import time
from pathlib import Path

import numpy as np
import onnx
import onnxruntime as ort

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(Path(__file__).resolve().parent))
import v14_vs_v17_10k_honest as H  # noqa: E402  (BertTok + load_arm live there)

ARMS = [
    ("v14", "models/ml-classifier-v14"),
    ("v17-minilm", "models/ml-classifier-v17-minilm"),
    ("v17-mdistilbert", "models/ml-classifier-v17"),
]
SAMPLE_FILES = [
    "datasets/crossdist-eval-v3.jsonl",
    "datasets/v17-multilingual-battery.jsonl",
]
N_SAMPLE = 300
N_BENCH = 120
SEED = 20260916


def param_anatomy(model_path: Path) -> dict:
    """Split initializer parameters into embedding vs compute tensors."""
    m = onnx.load(str(model_path), load_external_data=False)
    emb, other, total_bytes = 0, 0, 0
    biggest = []
    for init in m.graph.initializer:
        n = 1
        for d in init.dims:
            n *= d
        total_bytes += len(init.raw_data) if init.raw_data else 0
        biggest.append((n, init.name))
        # Word/position/token-type embedding tables are lookups: no MatMul FLOPs.
        if "embeddings" in init.name and "LayerNorm" not in init.name:
            emb += n
        else:
            other += n
    biggest.sort(reverse=True)
    return {
        "params_total": emb + other,
        "params_embedding": emb,
        "params_compute": other,
        "embedding_share": emb / (emb + other) if (emb + other) else 0.0,
        "file_bytes": model_path.stat().st_size,
        "largest_tensors": [{"params": n, "name": nm} for n, nm in biggest[:4]],
    }


def load_sample() -> list[str]:
    rows = []
    for f in SAMPLE_FILES:
        p = ROOT / f
        if not p.is_file():
            continue
        rows += [r["text"] for r in H.load_jsonl(str(p))]
    rnd = random.Random(SEED)
    rnd.shuffle(rows)
    return rows[:N_SAMPLE]


def bench(sess, tok, texts, mode: str, max_len: int = 256) -> dict:
    lat = []
    for t in texts:
        content = tok.encode_content(t)
        if mode == "fixed":
            ids, mask = tok.encode(t)
        else:
            body = content[: max_len - 2]
            ids = [tok.v.get("[CLS]", 101)] + body + [tok.v.get("[SEP]", 102)]
            mask = [1] * len(ids)
        s = time.perf_counter()
        sess.run(["logits"], {"input_ids": [ids], "attention_mask": [mask]})
        lat.append((time.perf_counter() - s) * 1000.0)
    lat.sort()
    return {
        "p50_ms": round(lat[len(lat) // 2], 2),
        "p95_ms": round(lat[int(len(lat) * 0.95)], 2),
        "mean_ms": round(sum(lat) / len(lat), 2),
    }


def main() -> int:
    texts = load_sample()
    print(f"sample: {len(texts)} production-shaped rows from {len(SAMPLE_FILES)} files")
    print(f"threads: intra={ort.get_available_providers()}  (ORT defaults)\n")

    report = {"sample_rows": len(texts), "arms": {}}

    for name, d in ARMS:
        mp = ROOT / d / "model.onnx"
        print(f"===== {name} =====")
        pa = param_anatomy(mp)
        print(f"  file            {pa['file_bytes']:>13,} bytes")
        print(f"  params total    {pa['params_total']:>13,}")
        print(f"  params embed    {pa['params_embedding']:>13,}  ({pa['embedding_share']*100:.1f}% -- zero FLOPs)")
        print(f"  params compute  {pa['params_compute']:>13,}")

        labels, thr, ood, safe_idx, tok, sess = H.load_arm(str(ROOT / d))

        lens, unk = [], 0
        total_tok = 0
        for t in texts:
            c = tok.encode_content(t)
            lens.append(len(c) + 2)
            unk += sum(1 for i in c if i == tok.unk)
            total_tok += len(c)
        ls = sorted(lens)
        p50, p95 = ls[len(ls) // 2], ls[int(len(ls) * 0.95)]
        mean_len = sum(lens) / len(lens)
        print(f"  tokens/row      p50={p50}  p95={p95}  mean={mean_len:.1f}  max={ls[-1]}")
        print(f"  UNK rate        {unk/max(1,total_tok)*100:.3f}%")
        print(f"  padding waste   {(1 - mean_len/256)*100:.1f}% of every forward pass is [PAD]")

        bt = texts[:N_BENCH]
        fixed = bench(sess, tok, bt, "fixed")
        dyn = bench(sess, tok, bt, "dynamic")
        speedup = fixed["p50_ms"] / dyn["p50_ms"] if dyn["p50_ms"] else 0
        print(f"  latency fixed-256   p50={fixed['p50_ms']}ms  p95={fixed['p95_ms']}ms  mean={fixed['mean_ms']}ms")
        print(f"  latency dynamic     p50={dyn['p50_ms']}ms  p95={dyn['p95_ms']}ms  mean={dyn['mean_ms']}ms")
        print(f"  dynamic speedup     {speedup:.2f}x (p50)\n")

        report["arms"][name] = {
            **pa,
            "tokens": {"p50": p50, "p95": p95, "mean": round(mean_len, 1), "max": ls[-1]},
            "unk_rate_pct": round(unk / max(1, total_tok) * 100, 4),
            "latency_fixed256": fixed,
            "latency_dynamic": dyn,
            "dynamic_speedup_p50": round(speedup, 3),
            "vocab_size": len(tok.v),
            "do_lower_case": tok.do_lower,
        }

    out = ROOT / "artifacts" / "ml" / "v17-latency-anatomy.json"
    out.write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(f"Wrote {out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
