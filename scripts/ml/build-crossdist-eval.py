#!/usr/bin/env python3
"""
Carve a FROZEN cross-distribution eval set out of the real-human corpora.

WHY THIS IS THE MOST IMPORTANT FILE IN THE RETRAIN
  v4 reports 99.2% F1. That number is measured on a validation split of the same
  synthetic templates it trained on, so it answers "did the model memorize the
  template family?" and not "will it catch an attack a stranger writes?". The
  honest answer to the second question was 46.5% recall at 34% FPR.

  You cannot fix what you cannot measure, and you cannot measure it with a split
  of the training distribution. This builds the other kind of split: held out by
  SOURCE, not by row. Nothing from `external:*` that lands in eval may appear in
  training in any form — not the row, not a leet-speak sibling, not a reordering.

  The guarantee is enforced on group_key_for(), the same augmentation-invariant
  skeleton the trainer uses, which is what caught the original 35.8% leak.

WHAT "PARITY WITH LAKERA" MEANS OPERATIONALLY
  Lakera's PINT dataset is private (4,314 inputs) precisely so nobody can train
  on it. So PINT is the neutral referee, and this file is the pre-referee scrim:
  if recall here is bad, PINT will be worse. Do not email opensource@lakera.ai
  for a verified run until this set looks good, because a PINT score is published
  and permanent.

USAGE
  python scripts/ml/build-crossdist-eval.py \
      --external datasets/external-real-v1.jsonl \
      --train datasets/ml-augmented-v6.jsonl \
      --eval-out datasets/crossdist-eval-v1.jsonl \
      --train-out datasets/external-train-v1.jsonl
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import sys
import unicodedata
from collections import Counter
from pathlib import Path


# Mirrors fetch-external-corpora.py::DEFAULT_SOURCES. Only used in the error
# message that tells you how to refetch, so a drift here is cosmetic, not silent.
DEFAULT_SOURCES_HINT = "gandalf,deepset,inthewild,dolly,openorca"


def group_key_for(text: str) -> str:
    """Must match train-soterllm-v4.py::group_key_for exactly."""
    t = unicodedata.normalize("NFKD", text)
    t = "".join(ch for ch in t if not unicodedata.combining(ch)).lower()
    leet = {"0": "o", "1": "i", "3": "e", "4": "a", "5": "s", "7": "t", "@": "a", "$": "s", "!": "i"}
    t = "".join(leet.get(ch, ch) for ch in t)
    letters = re.findall(r"[a-z]+", t)
    letters.sort()
    return " ".join(letters)


def stable_bucket(key: str) -> int:
    """Deterministic 0-99 bucket from the GROUP key, not the row.

    Hashing the group key (rather than the text) is what keeps every sibling of a
    skeleton on the same side of the split. Hashing the row would scatter them and
    reintroduce the exact leak this file exists to prevent. sha1 over random is
    deliberate: the split must be reproducible across machines and reruns.
    """
    return int(hashlib.sha1(key.encode("utf-8")).hexdigest()[:8], 16) % 100


def read_jsonl(path: Path) -> list[dict]:
    rows = []
    with path.open(encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                rows.append(json.loads(line))
            except json.JSONDecodeError:
                continue
    return rows


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--external", required=True, help="output of fetch-external-corpora.py")
    ap.add_argument("--train", nargs="*", default=[], help="existing synthetic training files")
    ap.add_argument("--eval-out", default="datasets/crossdist-eval-v2.jsonl")
    ap.add_argument("--train-out", default="datasets/external-train-v2.jsonl")
    ap.add_argument("--eval-pct", type=int, default=20, help="percent of group keys held out")
    args = ap.parse_args()

    ext_path = Path(args.external)
    if not ext_path.exists():
        print(f"[ERROR] {ext_path} not found. Run fetch-external-corpora.py first.", file=sys.stderr)
        return 2

    external = read_jsonl(ext_path)
    print(f"[load] {len(external)} external rows")

    # Upstream poison guard. `inthewild-regular` means "not flagged as a jailbreak
    # by the paper's own pipeline" — NOT benign; it is scraped from the same forums
    # as the jailbreaks and is full of DAN variants. The v1 sets were built with it
    # mapped to SAFE and reported a 39-50% FPR that was mostly the guard being
    # RIGHT. Catching it here, rather than only in the TS evaluators, means a
    # poisoned eval set never reaches disk to be measured by something else later.
    tainted = [r for r in external if "inthewild-regular" in str(r.get("source", ""))]
    if tainted:
        print(
            f"[FATAL] {len(tainted)} rows tagged external:inthewild-regular in {ext_path}.\n"
            f"        That config is an attack corpus regardless of its published label.\n"
            f"        Refusing to build an eval set from it — refetch with defaults\n"
            f"        ({DEFAULT_SOURCES_HINT}) and rerun.",
            file=sys.stderr,
        )
        return 1

    # Every group key already present in synthetic training data. Anything
    # colliding with these is forced OUT of eval: if the model saw the skeleton
    # during training, scoring it here would measure memorization again.
    train_keys: set[str] = set()
    for p in args.train:
        path = Path(p)
        if not path.exists():
            print(f"[WARN] train file missing: {path}", file=sys.stderr)
            continue
        rows = read_jsonl(path)
        train_keys.update(group_key_for(r["text"]) for r in rows if "text" in r)
        print(f"[load] {len(rows)} rows from {path} ({len(train_keys)} cumulative keys)")

    eval_rows: list[dict] = []
    train_rows: list[dict] = []
    forced_to_train = 0

    for r in external:
        text = r.get("text")
        if not isinstance(text, str):
            continue
        key = group_key_for(text)
        if key in train_keys:
            forced_to_train += 1
            train_rows.append(r)
            continue
        if stable_bucket(key) < args.eval_pct:
            eval_rows.append(r)
        else:
            train_rows.append(r)
            train_keys.add(key)

    # Hard assertion, not a warning. A silent leak here invalidates every number
    # downstream, and a "mostly clean" eval set is worse than none — it produces a
    # confident wrong answer about whether we reached parity.
    eval_keys = {group_key_for(r["text"]) for r in eval_rows}
    train_all_keys = {group_key_for(r["text"]) for r in train_rows} | train_keys
    overlap = eval_keys & train_all_keys
    if overlap:
        print(f"[FATAL] {len(overlap)} group keys in BOTH eval and train", file=sys.stderr)
        for k in list(overlap)[:5]:
            print(f"  {k[:120]}", file=sys.stderr)
        return 1

    Path(args.eval_out).parent.mkdir(parents=True, exist_ok=True)
    for path, rows in ((args.eval_out, eval_rows), (args.train_out, train_rows)):
        with Path(path).open("w", encoding="utf-8") as f:
            for r in rows:
                f.write(json.dumps(r, ensure_ascii=False) + "\n")

    print(f"\n[split] eval  {len(eval_rows):>7} rows -> {args.eval_out}")
    print(f"[split] train {len(train_rows):>7} rows -> {args.train_out}")
    print(f"[split] {forced_to_train} rows forced to train (collided with synthetic keys)")
    print(f"[split] leak check PASSED: 0 shared group keys\n")

    for name, rows in (("EVAL", eval_rows), ("TRAIN", train_rows)):
        print(f"{name} label mix:")
        for label, n in Counter(r["label"] for r in rows).most_common():
            pct = 100 * n / max(1, len(rows))
            print(f"  {label:28} {n:>7}  ({pct:.1f}%)")
        print(f"{name} source mix:")
        for src, n in Counter(r.get("source", "?") for r in rows).most_common(10):
            print(f"  {src:28} {n:>7}")
        print()

    if not eval_rows:
        print("[ERROR] eval set is empty", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
