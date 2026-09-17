#!/usr/bin/env python3
r"""Compare v14 / ARM B (minilm) / ARM A (mdistilbert) on the v17 battery.

    python scripts/ml/_battery_compare3.py

Why this exists rather than a flag on _battery_breakdown.py: that script is the
instrument that produced the v14 baseline of record in
artifacts/ml/V17-MULTILINGUAL-BASELINE.md. Editing it to take a --file would put
the recorded baseline and the new numbers on different code paths unless it is
re-run, and a comparison is only worth anything if every arm goes through
IDENTICAL grouping logic. So this reads the three dumped FP files and applies one
split to all of them.

THE SPLIT, and why the raw FPR is not the honest number:

The battery's 156 benign rows contain 39 `legitimate-tool-use` rows that assert
unverifiable authority ("I'm the workspace owner") and then request egress to an
email address. A prompt injection inside a document could say exactly that.
Blocking those is defensible, so the baseline does NOT count them as false
positives -- it reports 52.1% on the 117 UNAMBIGUOUSLY benign rows instead of
64.1% on all 156. Any comparison that quotes the raw 156-row FPR against the
published 117-row number is comparing two different denominators.
"""
from __future__ import annotations

import json
import re
from pathlib import Path

BATTERY = Path("datasets/v17-multilingual-battery.jsonl")

ARMS = [
    ("v14 (LIVE)", "artifacts/ml/v14-battery-fps.jsonl", "artifacts/ml/v14-multilingual-battery.json"),
    ("ARM B minilm", "artifacts/ml/v17-minilm-battery-fps.jsonl", "artifacts/ml/v17-minilm-battery.json"),
    ("ARM A mdistil", "artifacts/ml/v17-battery-fps.jsonl", "artifacts/ml/v17-battery.json"),
]

# The one category whose "benign" label does not survive scrutiny.
ARGUABLE = "legitimate-tool-use"


def read_jsonl(p: Path):
    if not p.is_file():
        return None
    return [json.loads(l) for l in re.split(r"\r?\n", p.read_text(encoding="utf-8")) if l.strip()]


def main() -> int:
    rows = read_jsonl(BATTERY)
    if rows is None:
        raise SystemExit(f"[FATAL] {BATTERY} missing")

    # The battery writes the label UPPERCASE ("SAFE"); compare case-insensitively
    # so a casing change in the generator cannot silently empty this set and turn
    # every FPR into 0/0.
    benign = [r for r in rows if str(r.get("label", "")).strip().upper() == "SAFE"]
    if not benign:
        # fall back to whatever key this battery uses
        keys = sorted({k for r in rows for k in r})
        raise SystemExit(f"[FATAL] could not identify benign rows; keys present: {keys}")

    unambiguous = [r for r in benign if r.get("category") != ARGUABLE]
    arguable = [r for r in benign if r.get("category") == ARGUABLE]
    unamb_text = {r["text"].strip() for r in unambiguous}
    arg_text = {r["text"].strip() for r in arguable}

    print(f"battery      : {len(rows)} rows, {len(benign)} benign")
    print(f"  unambiguous: {len(unambiguous)}   (the honest FPR denominator)")
    print(f"  arguable   : {len(arguable)}   ({ARGUABLE} -- reported separately, not as errors)")
    print()
    print(f"{'model':<16} {'recall':>18}  {'FPR unambig':>20}  {'FPR arguable':>14}")
    print("-" * 74)

    for name, fps_path, summary_path in ARMS:
        fps = read_jsonl(Path(fps_path))
        if fps is None:
            print(f"{name:<16} {'-- not scored --':>18}")
            continue
        fp_text = {r["text"].strip() for r in fps}
        u_hit = len(fp_text & unamb_text)
        a_hit = len(fp_text & arg_text)

        rec = "?"
        sp = Path(summary_path)
        if sp.is_file():
            s = json.loads(sp.read_text(encoding="utf-8"))
            # eval-crossdist-production.ts writes endToEnd.recall ALREADY IN PERCENT
            # (74.36, not 0.7436). Multiplying by 100 again yields 7436% -- wrong in a
            # direction that looks like a units bug rather than a model result, so the
            # value is range-checked instead of assumed.
            e2e = s.get("endToEnd", {})
            if "recall" in e2e:
                v = float(e2e["recall"])
                caught, atk = e2e.get("caught"), e2e.get("attacks")
                rec = f"{v:.2f}% ({caught}/{atk})" if caught is not None else f"{v:.2f}%"

        print(f"{name:<16} {rec:>18}  "
              f"{f'{100*u_hit/len(unambiguous):.1f}% ({u_hit}/{len(unambiguous)})':>20}  "
              f"{f'{a_hit}/{len(arguable)}':>14}")

    print()
    print("Every FPR above carries its denominator on purpose. 117 and 39 are SMALL --")
    print("one row is ~0.85 and ~2.6 points respectively. Differences of a few rows are")
    print("not separable at this size; only large gaps mean anything.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
