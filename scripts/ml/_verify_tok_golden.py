#!/usr/bin/env python3
"""Verify my BertTok port against the repo's HF goldens (uncased + cased)."""
import json, sys
sys.path.insert(0, "scripts/ml")
from v14_vs_v17_10k_honest import BertTok

def load_golden(path):
    g = json.load(open(path, encoding="utf-8"))
    meta, rows = g[0]["__meta__"], [r for r in g if "__meta__" not in r]
    return meta, rows

def build_tok(model_dir, meta):
    vocab = {}
    for i, line in enumerate(open(model_dir + "/tokenizer_config/vocab.txt", encoding="utf-8").read().split("\n")):
        t = line[:-1] if line.endswith("\r") else line
        if t: vocab[t] = i
    return BertTok(vocab, meta["do_lower_case"], meta.get("strip_accents"), meta.get("tokenize_chinese_chars", True), max_len=128)

for golden, model_dir in [("scripts/ml/_hf-tokenization-golden.json", "models/ml-classifier-v14"),
                          ("scripts/ml/_hf-tokenization-golden-cased.json", "models/ml-classifier-v17")]:
    meta, rows = load_golden(golden)
    tok = build_tok(model_dir, meta)
    ok = bad = 0
    for r in rows:
        ids, mask = tok.encode(r["text"])
        if ids == r["input_ids"]: ok += 1
        else:
            bad += 1
            if bad <= 2:
                safe = repr(r["text"][:70]).encode("ascii", "backslashreplace").decode("ascii")
                print(" MISMATCH:", safe)
                mine = [i for i, (a, b) in enumerate(zip(ids, r["input_ids"])) if a != b]
                print("   len mine/golden:", len(ids), len(r["input_ids"]), "diff idx:", mine[:5])
    print(f"{golden}: {ok}/{len(rows)} exact-match, {bad} mismatch (vocab={meta['vocab_size']})")
