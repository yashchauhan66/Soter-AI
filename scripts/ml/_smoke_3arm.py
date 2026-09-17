#!/usr/bin/env python3
"""Smoke-test: 30 rows x 3 arms through the harness path; verify v14 arm reproduces
known v14 behaviour (v14-10k-audit was run through the production TS backend)."""
import sys
sys.path.insert(0, "scripts/ml")
import json, time
from v14_vs_v17_10k_honest import load_arm, decide, load_jsonl, ROOT

rows = load_jsonl(str(ROOT / "datasets/v15-test-battery.jsonl"))[:30]
for name, d in [("v14", "models/ml-classifier-v14"),
                ("v17-control-minilm", "models/ml-classifier-v17-minilm"),
                ("v17-candidate-mdistilbert", "models/ml-classifier-v17")]:
    labels, thr, ood, safe_idx, tok, sess = load_arm(str(ROOT / d))
    hit = 0; atk = 0; hit_atk = 0; fp = 0; ben = 0
    for r in rows:
        ids, mask = tok.encode(r["text"])
        logits = sess.run(["logits"], {"input_ids": [ids], "attention_mask": [mask]})[0][0]
        pname = decide(logits, labels, thr, ood, safe_idx)
        caught = pname != "SAFE"
        if r["label"] != "SAFE":
            atk += 1; hit_atk += caught
        else:
            ben += 1; fp += caught
    print(f"{name}: attacks {hit_atk}/{atk} caught, benign FP {fp}/{ben}")
