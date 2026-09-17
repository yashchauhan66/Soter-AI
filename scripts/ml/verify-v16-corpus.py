#!/usr/bin/env python3
r"""Leak-guard, dedup and audit the v16 training increment before it is bundled for Colab.

WHY THIS EXISTS
    v16 is measured by re-scoring datasets/v16-probe-battery.jsonl. If a single probe row leaks
    into training, the re-score measures MEMORISATION and the whole "we closed the gap" claim is
    fraudulent. Same for datasets/v15-test-battery.jsonl and datasets/crossdist-eval-v3.jsonl,
    which are the other before/after instruments. A collision is therefore a HARD FAILURE (exit 2),
    never a warning.

    It also answers the question the v15 post-mortem raised: v15's weakest label
    (MULTI_TURN_ESCALATION) was 0.88% of the corpus and native non-English was ~3.1%. This script
    prints the BEFORE (9 files) and AFTER (10 files) shares, so the claim "the corpus root cause is
    addressed" is a measured number rather than an assertion.

USAGE
    python scripts/ml/verify-v16-corpus.py
    python scripts/ml/verify-v16-corpus.py --increment datasets/ml-v16-threat-corpus.jsonl
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

VALID_LABELS = {
    "SAFE", "PROMPT_INJECTION", "JAILBREAK", "SYSTEM_PROMPT_LEAK_ATTEMPT", "PII",
    "SECRET", "UNSAFE_OUTPUT", "RAG_POISONING", "DATA_EXFILTRATION_ATTEMPT",
    "TOOL_CALL_ABUSE", "ENCODING_OBFUSCATION", "MULTI_TURN_ESCALATION",
    "MODEL_EXTRACTION", "TOXICITY_HARASSMENT",
}
MIN_CHARS = 12

# The 9 files v15 trained on. v16 = these + the increment.
V15_CORPUS = [
    "datasets/ml-augmented-v8-final.jsonl",
    "datasets/ml-v8-targeted-fix.jsonl",
    "datasets/ml-v10-advanced-attacks.jsonl",
    "datasets/ml-v10-targeted-fix.jsonl",
    "datasets/ml-v11-weak-fix.jsonl",
    "artifacts/ml-v2/v12-toxicity-fix.jsonl",
    "datasets/ml-v13-meta-instructional.jsonl",
    "datasets/ml-v13-attack-gaps.jsonl",
    "datasets/ml-v15-threat-corpus.jsonl",
]

# Instruments. A training row that appears here destroys the measurement.
HOLDOUTS = [
    "datasets/v16-probe-battery.jsonl",
    "datasets/v15-test-battery.jsonl",
    "datasets/crossdist-eval-v3.jsonl",
    "artifacts/ml/_v15-tranches-scoreset.jsonl",
]


def ascii_safe(value: str) -> str:
    """Windows consoles are cp1252; printing a Cyrillic/CJK row raises UnicodeEncodeError
    from inside the leak report itself, so the guard would fire and then crash before
    naming a single offending row. Escape rather than crash."""
    return repr(value).encode("ascii", "backslashreplace").decode("ascii")


def read_jsonl(path: Path) -> list[dict]:
    """Split on \\r?\\n, NOT str.splitlines(): splitlines also breaks on U+2028/U+2029/
    U+0085/\\x0b/\\x0c/\\x1c-\\x1e, which shreds Unicode-smuggling payload rows into
    unparseable fragments."""
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
    }


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--increment", default="datasets/ml-v16-threat-corpus.jsonl")
    ap.add_argument("--out", default="datasets/ml-v16-threat-corpus.jsonl",
                    help="cleaned increment is rewritten here (in place by default)")
    ap.add_argument("--report-out", default="artifacts/ml/v16-corpus-report.json")
    args = ap.parse_args()

    inc_path = ROOT / args.increment
    if not inc_path.exists():
        print(f"[FATAL] increment not found: {inc_path}")
        return 2
    increment = read_jsonl(inc_path)
    print(f"increment: {len(increment):,} rows from {args.increment}")

    # ── existing training corpus ───────────────────────────────────────────────
    base_rows: list[dict] = []
    missing = []
    for rel in V15_CORPUS:
        rows = read_jsonl(ROOT / rel)
        if not rows:
            missing.append(rel)
        base_rows.extend(rows)
    if missing:
        print(f"[FATAL] existing training files missing/empty: {missing}")
        return 2
    base_keys = {group_key_for((r.get("text") or "")) for r in base_rows}
    print(f"existing v15 corpus: {len(base_rows):,} rows, {len(base_keys):,} distinct group keys")

    # ── holdout instruments ────────────────────────────────────────────────────
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
    print(f"holdout instruments: {hold_counts}")

    # ── clean + guard ──────────────────────────────────────────────────────────
    kept: list[dict] = []
    drops: collections.Counter = collections.Counter()
    leaks: list[dict] = []
    seen: set[str] = set()
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
            drops["already_in_v15_corpus"] += 1
            continue
        seen.add(gk)
        kept.append({
            "text": text,
            "label": label,
            "category": r.get("category") or "unspecified",
            "language": (r.get("language") or "en").strip().lower(),
            "source": r.get("source") or "v16-threat-corpus",
        })

    if leaks:
        print(f"\n[FATAL] {len(leaks)} increment rows collide with a HELD-OUT INSTRUMENT.")
        print("        Training on these would make the v15-vs-v16 re-score measure")
        print("        memorisation instead of generalisation. Refusing to proceed.")
        for r in leaks[:10]:
            print(f"          {r['label']:<28} {ascii_safe(r['text'][:110])}")
        return 2

    print("\ndrops:")
    for k, v in drops.most_common():
        print(f"  {v:>6}  {k}")
    print(f"kept: {len(kept):,}")

    out_path = ROOT / args.out
    with out_path.open("w", encoding="utf-8", newline="\n") as fh:
        for r in kept:
            fh.write(json.dumps(r, ensure_ascii=False) + "\n")
    print(f"[write] {out_path}")

    # ── the root-cause audit: does the corpus mix actually change? ─────────────
    before = stats(base_rows)
    after = stats(base_rows + kept)
    inc = stats(kept)

    print("\n" + "=" * 78)
    print("CORPUS ROOT-CAUSE AUDIT  (v15 = 9 files -> v16 = 10 files)")
    print("=" * 78)
    print(f"{'metric':<34}{'v15 corpus':>14}{'v16 corpus':>14}{'delta':>14}")
    for key, name in (("rows", "total rows"),
                      ("multi_turn_share_pct", "MULTI_TURN_ESCALATION share %"),
                      ("non_english_share_pct", "non-English share %"),
                      ("safe_share_pct", "SAFE share %")):
        b, a = before[key], after[key]
        d = a - b
        fmt = ",.0f" if key == "rows" else ".3f"
        print(f"{name:<34}{b:>14{fmt}}{a:>14{fmt}}{d:>+14{fmt}}")

    print("\nMULTI_TURN_ESCALATION absolute count: "
          f"{before['labels'].get('MULTI_TURN_ESCALATION', 0):,} -> "
          f"{after['labels'].get('MULTI_TURN_ESCALATION', 0):,}")
    print("\nnon-English rows by language (v15 -> v16):")
    langs = sorted(set(before["languages"]) | set(after["languages"]),
                   key=lambda k: -after["languages"].get(k, 0))
    for k in langs:
        b = before["languages"].get(k, 0)
        a = after["languages"].get(k, 0)
        if k == "en" or a == 0:
            continue
        print(f"  {k:<12}{b:>8,} -> {a:>8,}   ({a-b:+,})")
    print("\n  NOTE: 97% of pre-v15 rows carry no `language` field and default to 'en', so the "
          "\n  non-English share is a LOWER BOUND on v15 and an accurate count for the increment.")

    print("\nincrement composition:")
    for k, v in inc["labels"].items():
        print(f"  {v:>6}  {k}")

    report = {
        "increment_file": args.increment,
        "increment_rows_in": len(increment),
        "increment_rows_kept": len(kept),
        "drops": dict(drops),
        "holdout_collisions": 0,
        "holdouts_checked": hold_counts,
        "v15_corpus_files": V15_CORPUS,
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
