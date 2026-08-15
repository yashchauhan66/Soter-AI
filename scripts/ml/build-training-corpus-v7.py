#!/usr/bin/env python3
"""
Assemble the v7 training corpus: synthetic templates + real-human external rows,
with per-source caps so no single corpus dictates what "an attack" looks like.

WHY CAPS AND NOT JUST CONCATENATION
  external-train-v3.jsonl is 91,125 rows, but 36,399 of them (40%) come from one
  source (quickium) and 25,547 carry one label (PII) that the previous corpus had
  almost none of. Concatenating raw would hand ~40% of the gradient to a single
  publisher's labelling conventions and turn a prompt-injection classifier into a
  PII classifier by accident.

  That failure has already happened here once in the other direction: v6 added more
  same-shape synthetic rows, regressed core hybrid 100 -> 95.8%, and was rolled back
  (docs/ml/LAKERA-PARITY-PROGRAM.md §1). The lesson was not "less data" — it was
  "watch the mix".

WHAT THIS DOES NOT DO
  It never reads datasets/crossdist-eval-v*.jsonl. The eval split is frozen and
  built upstream by build-crossdist-eval.py; this script consumes only the *-train-*
  side. It re-asserts that on exit anyway, because a leak here would silently
  invalidate every number measured downstream.

USAGE
  python scripts/ml/build-training-corpus-v7.py \
      --synthetic datasets/ml-augmented-v6.jsonl \
      --external datasets/external-train-v3.jsonl \
      --out datasets/ml-augmented-v7.jsonl \
      --assert-no-leak datasets/crossdist-eval-v3.jsonl
"""

from __future__ import annotations

import argparse
import json
import re
import sys
import unicodedata
from collections import Counter, defaultdict
from pathlib import Path

ALL_LABELS = [
    "SAFE",
    "PROMPT_INJECTION",
    "JAILBREAK",
    "SYSTEM_PROMPT_LEAK_ATTEMPT",
    "PII",
    "SECRET",
    "UNSAFE_OUTPUT",
    "RAG_POISONING",
    "DATA_EXFILTRATION_ATTEMPT",
]

# Per-source ceilings on the EXTERNAL side, chosen so that no single publisher
# exceeds roughly the size of the largest genuinely-distinct attack family.
#
# Rationale per entry, not round numbers for their own sake:
#   quickium  12000 — 36k available. Its value is multilingual PI + PII breadth, but
#                     it is one publisher's label convention; capped near mosscap so
#                     neither dominates. Its jailbreak axis is vestigial anyway.
#   mosscap   14000 — outcome-labelled real humans beating a real defence. The single
#                     most trustworthy attack signal in the corpus, so the highest cap;
#                     applied across all levels combined, not per level.
#   spml       8000 — 12.7k available; the only (system, user) application-context
#                     register we have. Enough to teach the register without letting
#                     one chatbot-shaped template family take over.
#   dolly     10000 — clean-provenance benign. Deliberately >= the largest attack
#                     source: FPR is the metric we already hold at 5.3% and must not lose.
#   others      full — each is under 1.5k rows; capping them would delete signal.
SOURCE_CAPS = {
    "external:quickium": 12000,
    "external:spml": 8000,
    "external:dolly": 10000,
    "external:openorca": 8000,
}
MOSSCAP_FAMILY_CAP = 14000  # applied to external:mosscap-* combined


def group_key_for(text: str) -> str:
    """Must match train-soterllm-v4.py::group_key_for exactly."""
    t = unicodedata.normalize("NFKD", text)
    t = "".join(ch for ch in t if not unicodedata.combining(ch)).lower()
    leet = {"0": "o", "1": "i", "3": "e", "4": "a", "5": "s", "7": "t", "@": "a", "$": "s", "!": "i"}
    t = "".join(leet.get(ch, ch) for ch in t)
    letters = re.findall(r"[a-z]+", t)
    letters.sort()
    return " ".join(letters)


def read_jsonl(path: Path) -> list[dict]:
    rows: list[dict] = []
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


def cap_family(source: str) -> str:
    """Collapse mosscap levels into one family so the cap applies to the corpus,
    not to each difficulty level (8 levels x a per-level cap = no cap at all)."""
    return "external:mosscap-*" if source.startswith("external:mosscap") else source


def main() -> int:
    ap = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter
    )
    ap.add_argument("--synthetic", default="datasets/ml-augmented-v6.jsonl")
    ap.add_argument("--external", default="datasets/external-train-v3.jsonl")
    ap.add_argument("--out", default="datasets/ml-augmented-v7.jsonl")
    ap.add_argument(
        "--assert-no-leak",
        default="datasets/crossdist-eval-v3.jsonl",
        help="frozen eval file; build FAILS if any output row shares a group key",
    )
    ap.add_argument(
        "--max-rows",
        type=int,
        default=0,
        help="0 = no global cap. Use for CPU-budget training runs.",
    )
    args = ap.parse_args()

    syn_path, ext_path = Path(args.synthetic), Path(args.external)
    for p in (syn_path, ext_path):
        if not p.exists():
            print(f"[ERROR] {p} not found", file=sys.stderr)
            return 2

    synthetic = read_jsonl(syn_path)
    external = read_jsonl(ext_path)
    print(f"[load] synthetic {len(synthetic):>7} rows  {syn_path}")
    print(f"[load] external  {len(external):>7} rows  {ext_path}")

    caps = {**SOURCE_CAPS, "external:mosscap-*": MOSSCAP_FAMILY_CAP}
    kept: list[dict] = []
    seen_keys: set[str] = set()
    per_family: Counter[str] = Counter()
    dropped_cap: Counter[str] = Counter()
    dropped_dupe = 0

    # Synthetic rows pass through uncapped: they are the tuned-corpus signal that
    # holds core hybrid at 100%, and the v6 rollback showed that disturbing them is
    # what breaks it. The mix problem is on the external side.
    for r in synthetic:
        text = r.get("text")
        if not isinstance(text, str) or r.get("label") not in ALL_LABELS:
            continue
        key = group_key_for(text)
        if key in seen_keys:
            dropped_dupe += 1
            continue
        seen_keys.add(key)
        kept.append({**r, "source": r.get("source", "synthetic")})

    n_synthetic = len(kept)
    print(f"[keep] synthetic {n_synthetic} rows ({dropped_dupe} dupes dropped)")

    # External rows, largest-cap families first so a cap is never spent on rows that
    # a later family would have deduped away.
    for r in external:
        text = r.get("text")
        if not isinstance(text, str) or r.get("label") not in ALL_LABELS:
            continue
        family = cap_family(str(r.get("source", "?")))
        cap = caps.get(family)
        if cap is not None and per_family[family] >= cap:
            dropped_cap[family] += 1
            continue
        key = group_key_for(text)
        if key in seen_keys:
            dropped_dupe += 1
            continue
        seen_keys.add(key)
        per_family[family] += 1
        kept.append(r)

    n_external = len(kept) - n_synthetic
    print(f"[keep] external  {n_external} rows after caps")

    if args.max_rows and len(kept) > args.max_rows:
        # Group-aware truncation: drop whole group keys, never split a skeleton
        # across the boundary, or the trainer's leak-free split stops meaning anything.
        by_key: dict[str, list[dict]] = defaultdict(list)
        for r in kept:
            by_key[group_key_for(r["text"])].append(r)
        truncated: list[dict] = []
        for rows in by_key.values():
            if len(truncated) >= args.max_rows:
                break
            truncated.extend(rows)
        print(f"[cap]  global --max-rows {args.max_rows}: {len(kept)} -> {len(truncated)}")
        kept = truncated

    # Hard leak assertion. This is the whole reason the frozen eval set is worth
    # anything; a warning here would be read past.
    leak_path = Path(args.assert_no_leak) if args.assert_no_leak else None
    if leak_path and leak_path.exists():
        eval_keys = {group_key_for(r["text"]) for r in read_jsonl(leak_path) if "text" in r}
        out_keys = {group_key_for(r["text"]) for r in kept}
        overlap = eval_keys & out_keys
        if overlap:
            print(
                f"\n[FATAL] {len(overlap)} group keys appear in BOTH the training corpus\n"
                f"        and the frozen eval set {leak_path}. Nothing was written.\n"
                f"        Every recall/FPR number measured on that file would be\n"
                f"        memorization, not generalization.",
                file=sys.stderr,
            )
            for k in list(overlap)[:5]:
                print(f"          {k[:110]}", file=sys.stderr)
            return 1
        print(f"[leak] PASSED: 0 shared group keys with {leak_path.name} ({len(eval_keys)} eval keys)")
    elif leak_path:
        print(f"[WARN] --assert-no-leak file missing: {leak_path}", file=sys.stderr)

    out_path = Path(args.out)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    with out_path.open("w", encoding="utf-8") as f:
        for r in kept:
            f.write(json.dumps(r, ensure_ascii=False) + "\n")

    labels = Counter(r["label"] for r in kept)
    print(f"\n[write] {len(kept)} rows -> {out_path}")
    print(f"[mix]   synthetic {n_synthetic} ({100*n_synthetic/len(kept):.1f}%)  "
          f"real-human {len(kept)-n_synthetic} ({100*(len(kept)-n_synthetic)/len(kept):.1f}%)")
    print("\nlabel mix:")
    for name in ALL_LABELS:
        n = labels.get(name, 0)
        print(f"  {name:30} {n:>7}  ({100*n/len(kept):.1f}%)")
    if dropped_cap:
        print("\nrows dropped by per-source cap:")
        for k, v in dropped_cap.most_common():
            print(f"  {k:30} {v:>7}  (cap {caps.get(k)})")
    print(f"\ndeduped on group key: {dropped_dupe} rows")

    missing = [n for n in ALL_LABELS if not labels.get(n)]
    if missing:
        print(
            f"\n[WARN] {len(missing)} labels have ZERO rows: {', '.join(missing)}\n"
            f"       The trainer will still emit these classes, but they cannot be\n"
            f"       learned and their per-label recall is meaningless.",
            file=sys.stderr,
        )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
