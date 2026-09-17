#!/usr/bin/env python3
r"""Materialise the EXACT rows that eval-crossdist-production.ts scores at a given
--limit, as a standalone JSONL.

Why this exists: compare-models.ts (the paired McNemar harness) has no --limit and
scores every row of the file it is given. On crossdist-eval-v3.jsonl that is 22,681
rows x 2 arms of CPU ONNX inference with every per-row verdict buffered in memory,
which gets the process killed on a workstation. The gate is defined at
`--limit 4250` anyway, so the honest fix is to hand compare-models precisely the
gate's row set rather than to score 5.7x more rows than the gate asks for.

This is a REPLICA of sample() in eval-crossdist-production.ts (lines 51-67) and of
loadEvalSet() in _evalset.ts, which does no filtering -- rows stay in file order.
The replica is load-bearing, so it self-checks: --limit 4250 must yield exactly
3,987 rows, the count the v14 baseline artifact recorded. A stride bug would change
that count, and a silently different row set is exactly the trap the eval script's
own `limit` field was added to prevent (--limit 3987 yields 3,636 rows that are NOT
a subset of what 4250 yields).

    python scripts/ml/_make-crossdist-gate-subset.py            # limit 4250
    python scripts/ml/_make-crossdist-gate-subset.py --limit 4250 --out path.jsonl
"""
from __future__ import annotations

import argparse
import json
import re
from collections import OrderedDict
from pathlib import Path

# --limit 4250 is the documented gate bound; the v14 baseline
# (artifacts/ml/ultra-baseline-v14.json) recorded limit=4250 -> 3,987 rows.
EXPECTED = {4250: 3987}


def sample(rows: list[dict], n: int) -> list[dict]:
    """Byte-for-byte behavioural replica of sample() in eval-crossdist-production.ts.

    Stratified per-label stride, NOT first-N: SAFE dominates the file, so first-N
    would skew benign. Label order is first-appearance order (JS Map insertion
    order == Python OrderedDict), and the `out.length < n` cap means labels seen
    later can be truncated mid-stride -- both details change WHICH rows come out.
    """
    if not n or n >= len(rows):
        return rows
    by_label: OrderedDict[str, list[dict]] = OrderedDict()
    for r in rows:
        by_label.setdefault(r["label"], []).append(r)
    out: list[dict] = []
    per_label = max(1, n // len(by_label))
    for lst in by_label.values():
        step = max(1, len(lst) // per_label)
        i = 0
        while i < len(lst) and len(out) < n:
            out.append(lst[i])
            i += step
    return out


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--file", default="datasets/crossdist-eval-v3.jsonl")
    ap.add_argument("--limit", type=int, default=4250)
    ap.add_argument("--out", default="artifacts/ml/_crossdist-gate-subset.jsonl")
    args = ap.parse_args()

    src = Path(args.file)
    # Split on \r?\n ONLY, exactly as _evalset.ts does. Python's str.splitlines()
    # also breaks on U+2028, U+2029, U+0085, \x0b, \x0c, \x1c-\x1e -- and this is a
    # Unicode-smuggling attack corpus, so rows contain those characters INSIDE their
    # JSON strings. splitlines() therefore shreds payload rows into invalid JSON and
    # would silently produce a different corpus than the TS loader reads.
    rows = [json.loads(line) for line in re.split(r"\r?\n", src.read_text(encoding="utf-8")) if line]
    print(f"loaded  : {len(rows):,} rows from {src}")

    # The loader aborts on inthewild-regular-tainted sets; mirror that refusal
    # rather than quietly scoring a corpus whose SAFE labels are attacks.
    tainted = sum(1 for r in rows if "inthewild-regular" in (r.get("source") or ""))
    if tainted:
        raise SystemExit(f"[FATAL] {tainted} rows tagged inthewild-regular -- refusing (see _evalset.ts)")

    picked = sample(rows, args.limit)
    labels = OrderedDict()
    for r in picked:
        labels[r["label"]] = labels.get(r["label"], 0) + 1

    exp = EXPECTED.get(args.limit)
    if exp is not None and len(picked) != exp:
        raise SystemExit(
            f"[FATAL] stride replica MISMATCH: --limit {args.limit} produced {len(picked)} rows, "
            f"expected {exp}.\n        Do not use this subset -- it is a different experiment "
            f"than the recorded baseline."
        )

    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    with out.open("w", encoding="utf-8", newline="\n") as fh:
        for r in picked:
            fh.write(json.dumps(r, ensure_ascii=False) + "\n")

    attacks = sum(1 for r in picked if r["label"] != "SAFE")
    print(f"picked  : {len(picked):,} rows  (limit {args.limit})"
          + (f"  == baseline's {exp} [replica VERIFIED]" if exp else ""))
    print(f"          {attacks:,} attacks / {len(picked) - attacks:,} benign")
    print(f"labels  : {len(labels)}")
    for lab, c in labels.items():
        print(f"  {c:>6,}  {lab}")
    print(f"[write] {out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
