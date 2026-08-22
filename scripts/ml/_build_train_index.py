#!/usr/bin/env python3
"""Cache the training-corpus group-key set so held-out tests can decontaminate fast."""
import json, re, unicodedata
from pathlib import Path

def group_key_for(text: str) -> str:
    t = unicodedata.normalize("NFKD", text)
    t = "".join(ch for ch in t if not unicodedata.combining(ch)).lower()
    leet = {"0":"o","1":"i","3":"e","4":"a","5":"s","7":"t","@":"a","$":"s","!":"i"}
    t = "".join(leet.get(ch, ch) for ch in t)
    letters = re.findall(r"[a-z]+", t); letters.sort()
    return " ".join(letters)

FILES = ["datasets/ml-augmented-v8-final.jsonl","datasets/ml-v8-targeted-fix.jsonl",
         "datasets/ml-v10-advanced-attacks.jsonl","datasets/ml-v10-targeted-fix.jsonl"]
groups=set(); exact=set(); n=0
for fp in FILES:
    for line in open(fp, encoding="utf-8"):
        line=line.strip()
        if not line: continue
        try: o=json.loads(line)
        except: continue
        t=(o.get("text") or "").strip()
        if not t: continue
        n+=1; exact.add(t); groups.add(group_key_for(t))
    print(f"  indexed {fp} -> {n}", flush=True)
out=Path("artifacts/ml-v2/train-index-v10.json")
json.dump({"files":FILES,"rows":n,"groups":sorted(groups),"exact":sorted(exact)},
          open(out,"w",encoding="utf-8"))
print(f"cached {len(groups)} groups / {len(exact)} exact texts -> {out}")
