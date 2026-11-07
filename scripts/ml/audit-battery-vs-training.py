"""
audit-battery-vs-training.py — is the 4,000-row dev battery already inside the
training corpora a v19 would be trained on?

Exact and normalized (NFKC + casefold + non-alphanumeric collapse) matching only:
near-duplicate matching over ~250k training rows x 4k battery rows is not
affordable in pure Python, and exact/normalized is the membership question that
matters. Reports per corpus file and per battery source, so a partially
contaminated source can be excluded rather than the whole battery.

Run: python -I -X utf8 scripts/ml/audit-battery-vs-training.py
"""
import hashlib
import json
import re
import sys
import unicodedata
from collections import Counter, defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
BATTERY = ROOT / "artifacts/ml/v18-balanced-comparison-rows.jsonl"
CORPORA = [
    "datasets/ml-augmented-v8-final.jsonl",
    "datasets/ml-v8-targeted-fix.jsonl",
    "datasets/ml-v10-advanced-attacks.jsonl",
    "datasets/ml-v10-targeted-fix.jsonl",
    "datasets/ml-v11-weak-fix.jsonl",
    "artifacts/ml-v2/v12-toxicity-fix.jsonl",
    "datasets/ml-v13-meta-instructional.jsonl",
    "datasets/ml-v13-attack-gaps.jsonl",
    "datasets/ml-v18-clean-corpus.jsonl",
    "datasets/external-train-v1.jsonl",
    "datasets/external-train-v2.jsonl",
    "datasets/external-train-v3.jsonl",
    "datasets/external-real-v4.jsonl",
]
WORD = re.compile(r"[^\w]+", re.UNICODE)


def norm(t):
    return WORD.sub(" ", unicodedata.normalize("NFKC", t).casefold()).strip()


def main():
    battery = [json.loads(l) for l in BATTERY.open(encoding="utf-8") if l.strip()]
    b_exact = {hashlib.sha256(r["text"].encode()).hexdigest(): i for i, r in enumerate(battery)}
    b_norm = defaultdict(list)
    for i, r in enumerate(battery):
        b_norm[norm(r["text"])].append(i)

    hits_exact = [set() for _ in battery]
    hits_norm = [set() for _ in battery]
    per_file = {}
    for rel in CORPORA:
        p = ROOT / rel
        if not p.exists():
            per_file[rel] = "missing"
            continue
        n = e = nm = 0
        with p.open(encoding="utf-8") as fh:
            for line in fh:
                if not line.strip():
                    continue
                n += 1
                text = json.loads(line).get("text", "")
                if not text:
                    continue
                h = hashlib.sha256(text.encode()).hexdigest()
                if h in b_exact:
                    e += 1
                    hits_exact[b_exact[h]].add(rel)
                for i in b_norm.get(norm(text), ()):
                    nm += 1
                    hits_norm[i].add(rel)
        per_file[rel] = {"rows": n, "exact_battery_rows": e, "normalized_battery_rows": nm}

    by_source = defaultdict(lambda: {"n": 0, "exact": 0, "normalized": 0})
    by_corpus = defaultdict(lambda: {"battery_rows_hit": 0})
    for i, r in enumerate(battery):
        s = by_source[r.get("source") or "?"]
        s["n"] += 1
        s["exact"] += bool(hits_exact[i])
        s["normalized"] += bool(hits_norm[i])
        for c in hits_exact[i] | hits_norm[i]:
            by_corpus[c]["battery_rows_hit"] += 1
    out = {
        "battery_rows": len(battery),
        "battery_rows_exact_in_training": sum(1 for h in hits_exact if h),
        "battery_rows_normalized_in_training": sum(1 for h in hits_norm if h),
        "per_corpus_file": per_file,
        "per_battery_source": dict(by_source),
        "battery_rows_hit_per_corpus": dict(by_corpus),
    }
    (ROOT / "artifacts/ml/battery-contamination-2026-10-17.json").write_text(json.dumps(out, indent=2), encoding="utf-8")
    print(json.dumps({k: out[k] for k in ("battery_rows", "battery_rows_exact_in_training", "battery_rows_normalized_in_training")}, indent=2))
    for k, v in by_source.items():
        print(f"  {k:32} n={v['n']:4} exact={v['exact']:4} norm={v['normalized']:4}")


if __name__ == "__main__":
    sys.exit(main())
