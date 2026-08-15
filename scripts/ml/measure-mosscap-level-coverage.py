#!/usr/bin/env python3
"""What did MOSSCAP_FAMILY_CAP actually keep, per difficulty level?

WHY THIS RUNS BEFORE RAISING THE CAP
  cap_family() collapses mosscap-level3..level8 into one family and stops at
  MOSSCAP_FAMILY_CAP. The cap is applied in FILE ORDER, and the fetcher streams
  the HF dataset in its native order, so "first 14,000" is not a sample across
  levels -- it is a prefix. If that prefix is mostly level3/level4, then the hard
  levels were not down-weighted, they were DELETED, and the corpus taught the
  model the easy end of a difficulty ladder while the cross-distribution eval
  scores it on the hard end.

  Raising a cap fixes a shortage. Fixing a prefix bias needs a different change
  (stratify before capping). Those are different bugs and the numbers below decide
  which one we actually have. Guessing here costs a full retrain to find out.
"""

from __future__ import annotations

import argparse
import json
from collections import Counter
from pathlib import Path


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--external", default="datasets/external-train-v3.jsonl")
    ap.add_argument("--corpus", default="datasets/ml-augmented-v7.jsonl")
    ap.add_argument("--out", default="artifacts/ml/mosscap-level-coverage.json")
    args = ap.parse_args()

    avail: Counter[str] = Counter()
    avail_order: list[str] = []
    ext = Path(args.external)
    if ext.exists():
        with ext.open("r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue
                try:
                    r = json.loads(line)
                except json.JSONDecodeError:
                    continue
                src = str(r.get("source") or "")
                if src.startswith("external:mosscap"):
                    lvl = src.split("mosscap-", 1)[-1] or "na"
                    avail[lvl] += 1
                    avail_order.append(lvl)

    kept: Counter[str] = Counter()
    corpus = Path(args.corpus)
    if corpus.exists():
        with corpus.open("r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue
                try:
                    r = json.loads(line)
                except json.JSONDecodeError:
                    continue
                src = str(r.get("source") or "")
                if src.startswith("external:mosscap"):
                    kept[src.split("mosscap-", 1)[-1] or "na"] += 1

    # What the first-14000 prefix of the available file would take, per level.
    prefix: Counter[str] = Counter(avail_order[:14000])

    levels = sorted(set(avail) | set(kept))
    report = {
        "available_in_external_file": dict(sorted(avail.items())),
        "available_total": sum(avail.values()),
        "kept_in_v7_corpus": dict(sorted(kept.items())),
        "kept_total": sum(kept.values()),
        "what_a_prefix_cap_would_take": dict(sorted(prefix.items())),
        "coverage_pct_by_level": {
            lvl: (round(100.0 * kept[lvl] / avail[lvl], 1) if avail[lvl] else None)
            for lvl in levels
        },
        "measured_source_ceiling": 33235,
        "note": (
            "If coverage_pct_by_level is roughly flat, the cap sampled evenly and "
            "raising it adds volume. If it is high for early levels and ~0 for late "
            "ones, the cap is a PREFIX and the hard levels were deleted -- stratify "
            "before capping instead of just raising the number."
        ),
    }

    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")

    print(f"{'level':10} {'available':>10} {'kept in v7':>12} {'coverage':>10}")
    print("-" * 46)
    for lvl in levels:
        cov = report["coverage_pct_by_level"][lvl]
        print(f"{lvl:10} {avail[lvl]:>10} {kept[lvl]:>12} {('%.1f%%' % cov) if cov is not None else 'n/a':>10}")
    print("-" * 46)
    print(f"{'TOTAL':10} {sum(avail.values()):>10} {sum(kept.values()):>12}")
    print(f"\nmeasured source ceiling (whole HF corpus): 33235")
    print(f"[write] {out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
