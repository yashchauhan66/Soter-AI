#!/usr/bin/env python3
r"""Leak-guard, dedup and audit the v17 training increment before it is bundled for Colab.

WHY THIS EXISTS
    v17's whole claim is "better than v14 in BOTH English and non-English". That claim is
    made by re-scoring held-out instruments. If one instrument row leaks into training, the
    re-score measures MEMORISATION and the claim is fraudulent. A collision is therefore a
    HARD FAILURE (exit 2), never a warning.

    This is the second net, not the first: _build_v17_corpus.py already refuses to emit a
    colliding row. This script re-checks the FILE ON DISK, because between generation and
    upload the file can be regenerated, hand-edited, or restored from a stale copy. The
    bundle builder then re-checks a third time at pack time. Three nets, because after the
    upload there is no gate left.

TWO DIFFERENCES FROM verify-v16-corpus.py, BOTH DELIBERATE
    1. The base corpus is 10 files, not 9: v17 sits on top of v15's nine AND the v16
       increment. Checking only against v15's nine would let v17 silently re-state rows
       v16 already contains, inflating the corpus with duplicates that train nothing.

    2. It PRESERVES the `provenance` field. v16's verifier rebuilds each kept row with a
       fixed five-key shape, which would silently delete v17's `v17-authored-unreviewed`
       tag -- the one thing that makes this tranche ablatable. A tranche that cannot be
       removed and re-measured can only be argued about, so the tag is load-bearing and
       any unknown field is carried through rather than dropped.

USAGE
    python scripts/ml/verify-v17-corpus.py
"""
from __future__ import annotations

import argparse
import collections
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(Path(__file__).resolve().parent))
import soter_augment  # noqa: E402

group_key_for = soter_augment.group_key_for

# The 14 trained labels, plus MEMORY_POISONING which is reachable only via
# `_build_v17_corpus.py --memory-poisoning keep`. The default is `remap`, so in the
# normal build this 15th label never appears; it is listed so that using the flag
# produces a real training file instead of a confusing wall of bad_label drops.
VALID_LABELS = {
    "SAFE", "PROMPT_INJECTION", "JAILBREAK", "SYSTEM_PROMPT_LEAK_ATTEMPT", "PII",
    "SECRET", "UNSAFE_OUTPUT", "RAG_POISONING", "DATA_EXFILTRATION_ATTEMPT",
    "TOOL_CALL_ABUSE", "ENCODING_OBFUSCATION", "MULTI_TURN_ESCALATION",
    "MODEL_EXTRACTION", "TOXICITY_HARASSMENT", "MEMORY_POISONING",
}
MIN_CHARS = 12

# v15's nine + the v16 increment. v17 = these + the v17 increment.
BASE_CORPUS = [
    "datasets/ml-augmented-v8-final.jsonl",
    "datasets/ml-v8-targeted-fix.jsonl",
    "datasets/ml-v10-advanced-attacks.jsonl",
    "datasets/ml-v10-targeted-fix.jsonl",
    "datasets/ml-v11-weak-fix.jsonl",
    "artifacts/ml-v2/v12-toxicity-fix.jsonl",
    "datasets/ml-v13-meta-instructional.jsonl",
    "datasets/ml-v13-attack-gaps.jsonl",
    "datasets/ml-v15-threat-corpus.jsonl",
    "datasets/ml-v16-threat-corpus.jsonl",
]

# Instruments. A training row that appears here destroys the measurement.
# The first four are the canonical set v14/v15/v16 were all scored on and must not
# change. The fifth is the new multilingual seed battery (234 rows / 39 languages).
HOLDOUTS = [
    "datasets/v16-probe-battery.jsonl",
    "datasets/v15-test-battery.jsonl",
    "datasets/crossdist-eval-v3.jsonl",
    "artifacts/ml/_v15-tranches-scoreset.jsonl",
    "datasets/v17-multilingual-battery.jsonl",
]


def ascii_safe(value: str) -> str:
    """Windows consoles are cp1252; printing a Devanagari/CJK row raises
    UnicodeEncodeError from inside the leak report itself, so the guard would fire
    and then crash before naming a single offending row. Escape rather than crash."""
    return repr(value).encode("ascii", "backslashreplace").decode("ascii")


def read_jsonl(path: Path) -> list[dict]:
    r"""Split on \r?\n, NOT str.splitlines(): splitlines also breaks on U+2028/U+2029/
    U+0085/\x0b/\x0c/\x1c-\x1e, which shreds Unicode-smuggling payload rows into
    unparseable fragments and silently under-counts."""
    if not path.exists():
        return []
    out = []
    for line in re.split(r"\r?\n", path.read_text(encoding="utf-8")):
        line = line.strip()
        if line:
            try:
                out.append(json.loads(line))
            except json.JSONDecodeError:
                pass
    return out


def stats(rows: list[dict]) -> dict:
    labels = collections.Counter((r.get("label") or "?").strip().upper() for r in rows)
    langs = collections.Counter((r.get("language") or "en").strip().lower() for r in rows)
    n = max(1, len(rows))
    non_en = sum(v for k, v in langs.items() if k != "en")
    return {
        "rows": len(rows),
        "labels": dict(labels.most_common()),
        "languages": dict(langs.most_common()),
        "multi_turn_share_pct": round(100 * labels.get("MULTI_TURN_ESCALATION", 0) / n, 3),
        "non_english_share_pct": round(100 * non_en / n, 3),
        "safe_share_pct": round(100 * labels.get("SAFE", 0) / n, 3),
        "distinct_languages": len(langs),
    }


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--increment", default="datasets/ml-v17-threat-corpus.jsonl")
    ap.add_argument("--out", default="datasets/ml-v17-threat-corpus.jsonl",
                    help="cleaned increment is rewritten here (in place by default)")
    ap.add_argument("--report-out", default="artifacts/ml/v17-corpus-report.json")
    args = ap.parse_args()

    inc_path = ROOT / args.increment
    if not inc_path.exists():
        print(f"[FATAL] increment not found: {inc_path}")
        return 2
    increment = read_jsonl(inc_path)
    print(f"increment: {len(increment):,} rows from {args.increment}")

    base_rows: list[dict] = []
    missing = []
    for rel in BASE_CORPUS:
        rows = read_jsonl(ROOT / rel)
        if not rows:
            missing.append(rel)
        base_rows.extend(rows)
    if missing:
        print(f"[FATAL] existing training files missing/empty: {missing}")
        return 2
    base_keys = {group_key_for((r.get("text") or "")) for r in base_rows}
    print(f"base corpus (v15 9 files + v16): {len(base_rows):,} rows, "
          f"{len(base_keys):,} distinct group keys")

    hold_exact: set[str] = set()
    hold_keys: set[str] = set()
    hold_counts = {}
    for rel in HOLDOUTS:
        rows = read_jsonl(ROOT / rel)
        hold_counts[rel] = len(rows)
        if not rows:
            print(f"[FATAL] holdout instrument missing or empty, cannot guard: {rel}")
            return 2
        for r in rows:
            t = (r.get("text") or "").strip()
            hold_exact.add(t)
            hold_keys.add(group_key_for(t))
    print("holdout instruments:")
    for k, v in hold_counts.items():
        print(f"  {v:>6,}  {k}")

    kept: list[dict] = []
    drops: collections.Counter = collections.Counter()
    leaks: list[dict] = []
    seen: set[str] = set()
    lost_provenance = 0
    for r in increment:
        text = (r.get("text") or "").strip()
        label = (r.get("label") or "").strip().upper()
        if not text:
            drops["empty_text"] += 1
            continue
        if len(text) < MIN_CHARS:
            drops["too_short"] += 1
            continue
        if label not in VALID_LABELS:
            drops[f"bad_label:{label or '(blank)'}"] += 1
            continue
        gk = group_key_for(text)
        if text in hold_exact or gk in hold_keys:
            leaks.append({"text": text, "label": label})
            continue
        if gk in seen:
            drops["internal_duplicate"] += 1
            continue
        if gk in base_keys:
            drops["already_in_base_corpus"] += 1
            continue
        seen.add(gk)
        if not r.get("provenance"):
            lost_provenance += 1
        # Carry the whole row through, normalising only the fields with a contract.
        # Unknown keys (notably `provenance`) survive on purpose -- see the docstring.
        row = dict(r)
        row.update({
            "text": text,
            "label": label,
            "category": r.get("category") or "unspecified",
            "language": (r.get("language") or "en").strip().lower(),
            "source": r.get("source") or "v17-threat-corpus",
        })
        kept.append(row)

    if leaks:
        print(f"\n[FATAL] {len(leaks)} increment rows collide with a HELD-OUT INSTRUMENT.")
        print("        Training on these would make the v14-vs-v17 re-score measure")
        print("        memorisation instead of generalisation. Refusing to proceed.")
        for r in leaks[:10]:
            print(f"          {r['label']:<28} {ascii_safe(r['text'][:110])}")
        return 2

    if drops:
        print("\ndrops:")
        for k, v in drops.most_common():
            print(f"  {v:>6}  {k}")
    print(f"kept: {len(kept):,}")

    if lost_provenance:
        print(f"\n[WARN] {lost_provenance:,} kept rows carry NO `provenance` tag. The v17")
        print("       tranche is only ablatable while every row is tagged; untagged rows")
        print("       cannot be removed and re-measured later.")

    out_path = ROOT / args.out
    with out_path.open("w", encoding="utf-8", newline="\n") as fh:
        for r in kept:
            fh.write(json.dumps(r, ensure_ascii=False) + "\n")
    print(f"[write] {out_path}")

    before = stats(base_rows)
    after = stats(base_rows + kept)
    inc = stats(kept)

    print("\n" + "=" * 78)
    print("CORPUS AUDIT  (v16 = 10 files -> v17 = 11 files)")
    print("=" * 78)
    print(f"{'metric':<34}{'v16 corpus':>14}{'v17 corpus':>14}{'delta':>14}")
    for key, name in (("rows", "total rows"),
                      ("distinct_languages", "distinct languages"),
                      ("multi_turn_share_pct", "MULTI_TURN_ESCALATION share %"),
                      ("non_english_share_pct", "non-English share %"),
                      ("safe_share_pct", "SAFE share %")):
        b, a = before[key], after[key]
        d = a - b
        fmt = ",.0f" if key in ("rows", "distinct_languages") else ".3f"
        print(f"{name:<34}{b:>14{fmt}}{a:>14{fmt}}{d:>+14{fmt}}")

    print("\n  NOTE: ~97% of pre-v15 rows carry no `language` field and default to 'en',")
    print("  so the non-English share is a LOWER BOUND on the base and an accurate")
    print("  count for the increment. The delta is the trustworthy number here.")

    print("\nnew languages added by this increment:")
    new_langs = sorted(set(inc["languages"]) - set(before["languages"]))
    print(f"  {len(new_langs)}: {', '.join(new_langs) if new_langs else '(none)'}")

    print("\nincrement composition:")
    for k, v in inc["labels"].items():
        print(f"  {v:>6}  {k}")

    report = {
        "increment_file": args.increment,
        "increment_rows_in": len(increment),
        "increment_rows_kept": len(kept),
        "rows_missing_provenance": lost_provenance,
        "drops": dict(drops),
        "holdout_collisions": 0,
        "holdouts_checked": hold_counts,
        "base_corpus_files": BASE_CORPUS,
        "new_languages": new_langs,
        "before": before,
        "after": after,
        "increment": inc,
    }
    rp = ROOT / args.report_out
    rp.parent.mkdir(parents=True, exist_ok=True)
    rp.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"\n[write] {rp}")
    print("\nOK: no holdout collisions. Increment is safe to train on.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
