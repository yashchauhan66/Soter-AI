#!/usr/bin/env python3
"""How much of v17's 119,547-row embedding table is actually reachable?

The size gate is blocked by ONE tensor: word_embeddings.weight [119547, 768],
91,812,096 params = 367 MB of the 541 MB file. Rows the corpus never touches
cost bytes and RAM and contribute nothing.

Unlike quantization, pruning is arithmetically EXACT for any text whose tokens
survive: a Gather of row k is identical whether the table has 119,547 rows or
40,000, as long as k is remapped consistently in vocab.txt. The risk is not
numerical, it is coverage -- a token pruned today that appears in traffic
tomorrow becomes [UNK].

So this measures coverage honestly, on three disjoint pools:
  TRAIN  what the model was fitted on   -> pruning here is free by construction
  EVAL   held-out rows                  -> the real generalization test
  BATTERY the 39-language battery       -> the multilingual case v17 exists for

and reports, for each candidate keep-set, the share of held-out tokens that
would newly become [UNK]. A keep-set is only safe if that share is ~0 on rows
the training pool never saw.

Run:  python scripts/ml/_vocab_coverage_probe.py
"""
from __future__ import annotations

import json
import sys
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(Path(__file__).resolve().parent))
import v14_vs_v17_10k_honest as H  # noqa: E402

MODEL = ROOT / "models" / "ml-classifier-v17"
HID = 768
BYTES_PER_PARAM = 4
GATE = 512 * 1024 * 1024

TRAIN = ["datasets/ml-augmented-v8-final.jsonl", "datasets/ml-v8-targeted-fix.jsonl",
         "datasets/ml-v10-advanced-attacks.jsonl", "datasets/ml-v10-targeted-fix.jsonl",
         "datasets/ml-v11-weak-fix.jsonl", "artifacts/ml-v2/v12-toxicity-fix.jsonl",
         "datasets/ml-v13-meta-instructional.jsonl", "datasets/ml-v13-attack-gaps.jsonl",
         "datasets/ml-v15-threat-corpus.jsonl", "datasets/ml-v16-threat-corpus.jsonl",
         "datasets/ml-v17-threat-corpus.jsonl",
         "datasets/external-train-v1.jsonl", "datasets/external-train-v2.jsonl",
         "datasets/external-train-v3.jsonl", "datasets/ml-adversarial-training.jsonl"]
EVAL = ["datasets/crossdist-eval-v3.jsonl", "datasets/crossdist-eval-v3-complement.jsonl",
        "datasets/external-real-v1.jsonl", "datasets/external-real-v2.jsonl",
        "datasets/external-real-v3.jsonl", "datasets/v15-test-battery.jsonl",
        "datasets/v16-probe-battery.jsonl"]
BATTERY = ["datasets/v17-multilingual-battery.jsonl"]


def build_tok():
    """Tokenizer only -- do NOT create an InferenceSession (541 MB alloc)."""
    tk = MODEL / "tokenizer_config"
    vocab = {}
    with open(tk / "vocab.txt", encoding="utf-8") as fh:
        for i, line in enumerate(fh):
            vocab[line.rstrip("\n")] = i
    cfg = json.loads((tk / "tokenizer_config.json").read_text(encoding="utf-8"))
    return H.BertTok(vocab, bool(cfg.get("do_lower_case", True)), 256)


def count(tok, files):
    c = Counter()
    rows = 0
    for f in files:
        p = ROOT / f
        if not p.is_file():
            continue
        for r in H.load_jsonl(str(p)):
            t = r.get("text")
            if not isinstance(t, str):
                continue
            rows += 1
            c.update(tok.encode_content(t))
    return c, rows


def main() -> int:
    tok = build_tok()
    V = len(tok.v)
    print(f"vocab {V:,}   embedding {V*HID:,} params = {V*HID*BYTES_PER_PARAM/1e6:.1f} MB\n")

    ctr, out = {}, {}
    for name, files in (("train", TRAIN), ("eval", EVAL), ("battery", BATTERY)):
        c, rows = count(tok, files)
        ctr[name] = c
        print(f"{name:<8} rows {rows:>7,}   tokens {sum(c.values()):>12,}   distinct ids {len(c):>7,}"
              f"  ({len(c)/V*100:.1f}% of vocab)")
        out[name] = {"rows": rows, "tokens": sum(c.values()), "distinct_ids": len(c),
                     "vocab_share_pct": round(len(c) / V * 100, 2)}

    # Special tokens and every single-character piece must survive: WordPiece
    # falls back to them, so dropping one turns whole words into [UNK].
    always = {i for t, i in tok.v.items() if t.startswith("[") and t.endswith("]")}
    always |= {i for t, i in tok.v.items() if len(t.lstrip("#")) == 1}
    print(f"\nalways-keep (specials + single chars): {len(always):,}")

    print("\n-- candidate keep-sets: what would newly become [UNK] on HELD-OUT text --")
    eval_tot = sum(ctr["eval"].values())
    batt_tot = sum(ctr["battery"].values())
    cands = []
    for tag, keep in (
        ("train-only", set(ctr["train"]) | always),
        ("train+minfreq1-all", set(ctr["train"]) | set(ctr["eval"]) | set(ctr["battery"]) | always),
        ("train-freq>=2", {i for i, n in ctr["train"].items() if n >= 2} | always),
        ("train-freq>=5", {i for i, n in ctr["train"].items() if n >= 5} | always),
    ):
        rows_k = len(keep)
        params = rows_k * HID
        # total file = current file - (dropped embedding params * 4 bytes)
        dropped = (V - rows_k) * HID * BYTES_PER_PARAM
        newsize = (MODEL / "model.onnx").stat().st_size - dropped
        lost_e = sum(n for i, n in ctr["eval"].items() if i not in keep)
        lost_b = sum(n for i, n in ctr["battery"].items() if i not in keep)
        print(f"  {tag:<20} keep {rows_k:>7,} rows ({rows_k/V*100:5.1f}%)  "
              f"model ~{newsize/1e6:6.1f} MB  under gate: {str(newsize <= GATE):<5}  "
              f"new UNK eval {lost_e/max(1,eval_tot)*100:.4f}%  battery {lost_b/max(1,batt_tot)*100:.4f}%")
        cands.append({"keep_set": tag, "keep_rows": rows_k, "keep_share_pct": round(rows_k / V * 100, 2),
                      "embedding_params": params, "projected_model_bytes": newsize,
                      "under_gate": newsize <= GATE,
                      "new_unk_eval_pct": round(lost_e / max(1, eval_tot) * 100, 5),
                      "new_unk_battery_pct": round(lost_b / max(1, batt_tot) * 100, 5)})

    out["always_keep"] = len(always)
    out["vocab"] = V
    out["candidates"] = cands
    p = ROOT / "artifacts" / "ml" / "v17-vocab-coverage.json"
    p.write_text(json.dumps(out, indent=2), encoding="utf-8")
    print(f"\nWrote {p}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
