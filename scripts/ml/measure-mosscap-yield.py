#!/usr/bin/env python3
"""Measure the REAL yield of Lakera/mosscap under the outcome-label filter.

WHY THIS RUNS BEFORE ANY CAP CHANGE
  MOSSCAP_FAMILY_CAP is 14,000 against a headline of 278,945 rows, which reads like
  we are leaving 264k rows on the table. We are not: load_mosscap only keeps rows
  where Mosscap's own output guard INTERVENED (answer != raw_answer), which is a
  behavioural success label. The usable pool is that subset, not the headline.

  Raising the cap past the real yield buys nothing, and quoting "we added 279k real
  attacks" when the filter admits far fewer would be a false claim in the corpus
  manifest. Measure first, then set the cap to something the data can honour.

  Also reports the per-level split, because the v7 cross-distribution misses are
  concentrated in mosscap levels 3-8 (~560 of them) and level coverage is the axis
  that actually matters for that gap.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
import unicodedata
from collections import Counter
from pathlib import Path


def group_key_for(text: str) -> str:
    """Identical to fetch-external-corpora.py::group_key_for."""
    t = unicodedata.normalize("NFKD", text)
    t = "".join(ch for ch in t if not unicodedata.combining(ch)).lower()
    leet = {"0": "o", "1": "i", "3": "e", "4": "a", "5": "s", "7": "t", "@": "a", "$": "s", "!": "i"}
    t = "".join(leet.get(ch, ch) for ch in t)
    letters = re.findall(r"[a-z]+", t)
    letters.sort()
    return " ".join(letters)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default="artifacts/ml/mosscap-yield.json")
    ap.add_argument("--scan-limit", type=int, default=0, help="0 = whole corpus")
    args = ap.parse_args()

    from datasets import load_dataset

    print("[load] Lakera/mosscap_prompt_injection (streaming, MIT)")
    ds = load_dataset("Lakera/mosscap_prompt_injection", split="train", streaming=True)

    scanned = 0
    no_raw = 0
    not_intervened = 0
    kept = 0
    too_short = 0
    by_level = Counter()
    # Dedupe on the same skeleton the trainer groups by: two rows that collapse to
    # one group key are one training example, so counting them twice would overstate
    # the usable pool exactly where it matters.
    keys: set[str] = set()
    dupes = 0

    MIN_CHARS, MAX_CHARS = 8, 4000

    for r in ds:
        scanned += 1
        if args.scan_limit and scanned > args.scan_limit:
            scanned -= 1
            break
        answer = (r.get("answer") or "").strip()
        raw = (r.get("raw_answer") or "").strip()
        if not raw:
            no_raw += 1
            continue
        intervened = (not answer) or (group_key_for(answer) != group_key_for(raw))
        if not intervened:
            not_intervened += 1
            continue
        prompt = (r.get("prompt") or "").strip()
        if not (MIN_CHARS <= len(prompt) <= MAX_CHARS):
            too_short += 1
            continue
        k = group_key_for(prompt)
        if k in keys:
            dupes += 1
            continue
        keys.add(k)
        kept += 1
        by_level[str(r.get("level") or "na").strip().replace(" ", "").lower()] += 1
        if scanned % 25000 == 0:
            print(f"\r[scan] {scanned} scanned / {kept} kept", end="", flush=True)

    print(f"\r[scan] {scanned} scanned / {kept} kept")

    report = {
        "dataset": "Lakera/mosscap_prompt_injection",
        "licence": "MIT",
        "scanned": scanned,
        "kept_unique_outcome_labelled": kept,
        "dropped": {
            "no_raw_answer": no_raw,
            "guard_did_not_intervene_UNKNOWN": not_intervened,
            "length_out_of_range": too_short,
            "duplicate_group_key": dupes,
        },
        "by_level": dict(sorted(by_level.items())),
        "current_cap": 14000,
        "note": (
            "kept_unique_outcome_labelled is the honest ceiling for this source. "
            "Rows where the guard did not intervene are UNKNOWN and are never "
            "relabelled SAFE (see load_mosscap docstring)."
        ),
    }
    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")

    print(f"\n{'=' * 60}")
    print(f"  scanned                    {scanned}")
    print(f"  kept (unique, outcome-lab) {kept}")
    print(f"  dropped: no raw_answer     {no_raw}")
    print(f"  dropped: not intervened    {not_intervened}  (UNKNOWN, not SAFE)")
    print(f"  dropped: length            {too_short}")
    print(f"  dropped: dup group key     {dupes}")
    print(f"\n  current cap 14000 vs real ceiling {kept}")
    print("\n  by level:")
    for lvl, n in sorted(by_level.items()):
        print(f"    {lvl:14} {n}")
    print(f"\n[write] {out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
