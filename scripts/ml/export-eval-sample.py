#!/usr/bin/env python3
"""
Freeze the stratified eval sample to a file so two different models can be scored
on BYTE-IDENTICAL rows.

WHY THIS EXISTS
  eval-crossdist-production.ts samples internally (stratified, deterministic), and
  benchmark-vs-lakera.py takes first-N. Run them on the same source file with the
  same --limit and they still score DIFFERENT rows, so the resulting "head-to-head"
  would compare two models on two samples — a difference in the sample would read
  as a difference in the models. This dumps the sample once; both harnesses then
  read the dumped file with no sampling of their own (--limit 0).

  It also emits the PG2-scope subset. Meta's Llama-Prompt-Guard-2 answers only
  "does this text try to override prior instructions?" — it does not judge content
  harm — so PII/SECRET/UNSAFE_OUTPUT/RAG_POISONING rows are OUT OF ITS SCOPE.
  Scoring it on those would manufacture a flattering result for us, so they are
  excluded from the head-to-head file rather than counted as PG2 misses.

USAGE
  python scripts/ml/export-eval-sample.py --file datasets/crossdist-eval-v3.jsonl \
      --limit 4500 --out datasets/crossdist-eval-v3-sample.jsonl
"""
from __future__ import annotations

import argparse
import json
import re
from pathlib import Path

# Must stay identical to PG2_IN_SCOPE_LABELS in benchmark-vs-lakera.py.
PG2_IN_SCOPE = {"PROMPT_INJECTION", "JAILBREAK", "SYSTEM_PROMPT_LEAK_ATTEMPT", "SAFE"}


def stratified_sample(all_rows: list[dict], n: int) -> list[dict]:
    """Port of sample() in scripts/ml/eval-crossdist-production.ts.

    Kept a line-for-line port on purpose: if the two drift, the dumped file stops
    being the rows the TS harness would have scored, and the head-to-head silently
    becomes a comparison of two samples again.
    """
    if not n or n >= len(all_rows):
        return list(all_rows)
    by_label: dict[str, list[dict]] = {}
    for r in all_rows:
        by_label.setdefault(r["label"], []).append(r)
    out: list[dict] = []
    per_label = max(1, n // len(by_label))
    for rows in by_label.values():
        step = max(1, len(rows) // per_label)
        i = 0
        while i < len(rows) and len(out) < n:
            out.append(rows[i])
            i += step
    return out


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--file", default="datasets/crossdist-eval-v3.jsonl")
    ap.add_argument("--limit", type=int, default=4500)
    ap.add_argument("--out", default="datasets/crossdist-eval-v3-sample.jsonl")
    ap.add_argument(
        "--scope-out",
        default="",
        help="also write the PG2-in-scope subset here (default: <out>-pg2scope.jsonl)",
    )
    args = ap.parse_args()

    src = Path(args.file)
    if not src.exists():
        print(f"[ERROR] {src} not found")
        return 2

    # Split on CR?LF ONLY - never str.splitlines(), which also breaks on vertical tab,
    # form feed and U+2028/U+2029. Those characters occur INSIDE attack payloads in this
    # corpus, so splitlines() tears single rows in half and then fails to parse them.
    # _evalset.ts splits on the regex CR?LF, and this file exists to dump exactly the
    # rows that harness would score, so the split must match it character-for-character.
    raw = src.read_text(encoding="utf-8")
    rows = [json.loads(line) for line in re.split(r"\r?\n", raw) if line.strip()]
    # Same guard as _evalset.ts: a renamed file must not smuggle attack rows in as SAFE.
    tainted = sum(1 for r in rows if "inthewild-regular" in str(r.get("source", "")))
    if src.name.endswith("-v1.jsonl") or tainted:
        print(f"[FATAL] refusing to sample {src}: -v1 set or {tainted} inthewild-regular rows")
        return 2

    sample = stratified_sample(rows, args.limit)
    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(
        "".join(json.dumps(r, ensure_ascii=False) + "\n" for r in sample), encoding="utf-8"
    )

    scope_path = Path(args.scope_out) if args.scope_out else out.with_name(
        out.stem + "-pg2scope.jsonl"
    )
    scoped = [r for r in sample if r.get("label") in PG2_IN_SCOPE]
    scope_path.write_text(
        "".join(json.dumps(r, ensure_ascii=False) + "\n" for r in scoped), encoding="utf-8"
    )

    def counts(rs: list[dict]) -> dict[str, int]:
        c: dict[str, int] = {}
        for r in rs:
            c[r["label"]] = c.get(r["label"], 0) + 1
        return dict(sorted(c.items(), key=lambda x: -x[1]))

    print(f"[read]  {len(rows)} rows from {src.name}")
    print(f"[write] {len(sample)} sampled -> {out}")
    for k, v in counts(sample).items():
        print(f"          {k:30} {v}")
    print(f"[write] {len(scoped)} PG2-in-scope -> {scope_path}")
    for k, v in counts(scoped).items():
        print(f"          {k:30} {v}")
    print(f"        excluded {len(sample) - len(scoped)} rows outside PG2's scope")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
