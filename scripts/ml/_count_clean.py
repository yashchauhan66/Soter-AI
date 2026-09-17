#!/usr/bin/env python3
"""Count how many eval rows survive the group-key holdout filter."""
import sys
sys.path.insert(0, "scripts/ml")
import json
from pathlib import Path
import soter_augment
from v14_vs_v17_10k_honest import load_jsonl, ROOT, EVAL_FILES

gk = soter_augment.group_key_for
train = ["datasets/ml-augmented-v8-final.jsonl", "datasets/ml-v8-targeted-fix.jsonl",
         "datasets/ml-v10-advanced-attacks.jsonl", "datasets/ml-v10-targeted-fix.jsonl",
         "datasets/ml-v11-weak-fix.jsonl", "artifacts/ml-v2/v12-toxicity-fix.jsonl",
         "datasets/ml-v13-meta-instructional.jsonl", "datasets/ml-v13-attack-gaps.jsonl",
         "datasets/ml-v15-threat-corpus.jsonl", "datasets/ml-v16-threat-corpus.jsonl",
         "datasets/ml-v17-threat-corpus.jsonl"]
tg = set()
for f in train:
    for l in open(str(ROOT / f), encoding="utf-8"):
        if l.strip():
            try: tg.add(gk(json.loads(l)["text"]))
            except Exception: pass
print("train groups:", len(tg))
rows = []
for f in EVAL_FILES:
    rows.extend(load_jsonl(str(ROOT / f)))
seen = set(); ded = []
for r in rows:
    if r["text"] not in seen:
        seen.add(r["text"]); ded.append(r)
ca = [r for r in ded if r["label"] != "SAFE" and gk(r["text"]) not in tg]
cb = [r for r in ded if r["label"] == "SAFE" and gk(r["text"]) not in tg]
print(f"dedup pool: {len(ded)} -> CLEAN atk: {len(ca)}  CLEAN ben: {len(cb)}")
import collections
print("clean-attack labels:", dict(collections.Counter(r['label'] for r in ca)))
