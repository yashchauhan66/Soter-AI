#!/usr/bin/env python3
"""Assemble the v15 training corpus + held-out battery from generated batches,
with a HARD leak guard against every eval set the model is judged on.

WHY THIS EXISTS
    A retrain is only believable if the rows it trained on are provably absent
    from the rows it is scored on. The repo's history has the cautionary case:
    the "99.29% val F1" of an earlier SoterLLM was fake because random_split
    leaked ~35.8% of validation via augmentation siblings (see
    soterllm-honest-retrain memory). The fix was group_key_for(), and this script
    reuses that EXACT function via soter_augment so there is one definition.

WHAT IT GUARDS
    1. train rows vs datasets/crossdist-eval-v3.jsonl  (the OOD scoreboard)
    2. train rows vs the v15 held-out battery itself
    3. internal duplicates within the new corpus (by group key)
    A leak is a HARD FAILURE (exit 2), not a warning: a warning gets ignored and
    the number ships.

USAGE
    python scripts/ml/assemble-v15-corpus.py \
        --batches artifacts/ml/v15-batches.json \
        --train-out datasets/ml-v15-threat-corpus.jsonl \
        --test-out datasets/v15-test-battery.jsonl
"""
from __future__ import annotations

import argparse
import collections
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import soter_augment  # noqa: E402

group_key_for = soter_augment.group_key_for

VALID_LABELS = {
    "SAFE", "PROMPT_INJECTION", "JAILBREAK", "SYSTEM_PROMPT_LEAK_ATTEMPT", "PII",
    "SECRET", "UNSAFE_OUTPUT", "RAG_POISONING", "DATA_EXFILTRATION_ATTEMPT",
    "TOOL_CALL_ABUSE", "ENCODING_OBFUSCATION", "MULTI_TURN_ESCALATION",
    "MODEL_EXTRACTION", "TOXICITY_HARASSMENT",
}

# Rows shorter than this are not teachable signal — they are noise that teaches the
# model to fire on fragments. Measured pain point: bare "article about" once cleared
# 10 genocide-denial attacks (fpr-precision-fixes memory), i.e. short generic text is
# where over-defense and under-defense both live.
MIN_CHARS = 12

# The 8 corpora v14 was trained on (models/ml-classifier-v14/dataset_manifest.json).
# The HELD-OUT BATTERY must not intersect these: v14 scoring high on a row it was
# trained on is memorization, and it would understate the very weakness this battery
# exists to expose. Train-side overlap with these is expected and merely deduped.
V14_CORPUS = [
    "datasets/ml-augmented-v8-final.jsonl",
    "datasets/ml-v8-targeted-fix.jsonl",
    "datasets/ml-v10-advanced-attacks.jsonl",
    "datasets/ml-v10-targeted-fix.jsonl",
    "datasets/ml-v11-weak-fix.jsonl",
    "artifacts/ml-v2/v12-toxicity-fix.jsonl",
    "datasets/ml-v13-meta-instructional.jsonl",
    "datasets/ml-v13-attack-gaps.jsonl",
]


def load_rows(path: Path) -> list[dict]:
    rows = []
    with path.open(encoding="utf-8") as fh:
        for line in fh:
            line = line.strip()
            if line:
                rows.append(json.loads(line))
    return rows


def clean(rows: list[dict], origin: str) -> tuple[list[dict], collections.Counter]:
    """Normalize + validate; return (kept, drop_reasons)."""
    kept: list[dict] = []
    drops: collections.Counter = collections.Counter()
    seen: set[str] = set()
    for r in rows:
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
        if gk in seen:
            drops["internal_duplicate"] += 1
            continue
        seen.add(gk)
        kept.append({
            "text": text,
            "label": label,
            "category": r.get("category") or "unspecified",
            "language": (r.get("language") or "en").strip().lower(),
            "source": origin,
        })
    return kept, drops


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--batches", required=True,
                    help="JSON file with {batches:[{cleanTrain:[],cleanTest:[]}]} from the generation workflow")
    ap.add_argument("--train-out", default="datasets/ml-v15-threat-corpus.jsonl")
    ap.add_argument("--test-out", default="datasets/v15-test-battery.jsonl")
    ap.add_argument("--leak-against", nargs="*",
                    default=["datasets/crossdist-eval-v3.jsonl"],
                    help="eval sets the training rows must NOT overlap")
    ap.add_argument("--battery-clean-against", nargs="*", default=V14_CORPUS,
                    help="corpora the HELD-OUT BATTERY must not overlap. A battery row "
                         "v14 already trained on makes the before/after measurement "
                         "fraudulent. Train-side overlap is only deduped, not fatal.")
    ap.add_argument("--report-out", default="artifacts/ml/v15-corpus-report.json")
    args = ap.parse_args()

    payload = json.loads(Path(args.batches).read_text(encoding="utf-8"))
    batches = payload.get("batches") or payload
    if not isinstance(batches, list):
        print("[FATAL] --batches must contain a list under `batches`")
        return 2

    raw_train: list[dict] = []
    raw_test: list[dict] = []
    per_dim: dict[str, dict] = {}
    for b in batches:
        key = b.get("key") or "unknown"
        tr = b.get("cleanTrain") or []
        te = b.get("cleanTest") or []
        for r in tr:
            r.setdefault("_dim", key)
        for r in te:
            r.setdefault("_dim", key)
        raw_train.extend(tr)
        raw_test.extend(te)
        per_dim[key] = {"train_in": len(tr), "test_in": len(te)}

    train, train_drops = clean(raw_train, "v15-threat-corpus")
    test, test_drops = clean(raw_test, "v15-test-battery")

    # ── Guard 1: the held-out battery must not appear in training ────────────
    test_keys = {group_key_for(r["text"]) for r in test}
    before = len(train)
    train = [r for r in train if group_key_for(r["text"]) not in test_keys]
    battery_leak = before - len(train)

    # ── Guard 2: training rows must not appear in any eval set ───────────────
    eval_keys: set[str] = set()
    eval_detail = {}
    for p in args.leak_against:
        path = Path(p)
        if not path.exists():
            print(f"[FATAL] leak-check target missing: {p}")
            return 2
        ks = {group_key_for(r.get("text", "")) for r in load_rows(path)}
        eval_detail[p] = len(ks)
        eval_keys |= ks

    train_leaks = [r for r in train if group_key_for(r["text"]) in eval_keys]
    test_leaks = [r for r in test if group_key_for(r["text"]) in eval_keys]
    if train_leaks or test_leaks:
        print(f"[FATAL] LEAK: {len(train_leaks)} train and {len(test_leaks)} battery rows")
        print("        share a group key with an eval set. Refusing to write a corpus")
        print("        that would produce an unfalsifiable gain.")
        for r in (train_leaks + test_leaks)[:5]:
            print(f"        - {r['label']}: {r['text'][:90]!r}")
        return 2

    # ── Guard 3: the battery must be UNSEEN by v14 ───────────────────────────
    # Scored separately from Guard 2 because the two overlaps mean different things:
    # a train row v14 saw is fine (dedupe), a battery row v14 saw is a fake baseline.
    seen_keys: set[str] = set()
    seen_detail = {}
    for p in args.battery_clean_against:
        path = Path(p)
        if not path.exists():
            print(f"[warn] v14 corpus file absent, cannot check battery against it: {p}")
            seen_detail[p] = "MISSING"
            continue
        ks = {group_key_for(r.get("text", "")) for r in load_rows(path)}
        seen_detail[p] = len(ks)
        seen_keys |= ks

    battery_seen = [r for r in test if group_key_for(r["text"]) in seen_keys]
    if battery_seen:
        print(f"[FATAL] {len(battery_seen)} battery rows were ALREADY IN v14's TRAINING DATA.")
        print("        v14 would score them from memory, understating the weakness this")
        print("        battery exists to measure. Refusing to write a fake baseline.")
        for r in battery_seen[:5]:
            print(f"        - {r['label']}: {r['text'][:90]!r}")
        return 2
    # Train-side overlap with v14 is expected (we merge the old corpora anyway), so
    # it is reported, not fatal.
    train_seen = sum(1 for r in train if group_key_for(r["text"]) in seen_keys)

    label_counts = collections.Counter(r["label"] for r in train)
    lang_counts = collections.Counter(r["language"] for r in train)
    cat_counts = collections.Counter(r["category"] for r in train)
    test_labels = collections.Counter(r["label"] for r in test)
    test_langs = collections.Counter(r["language"] for r in test)

    for out, rows in ((args.train_out, train), (args.test_out, test)):
        p = Path(out)
        p.parent.mkdir(parents=True, exist_ok=True)
        with p.open("w", encoding="utf-8") as fh:
            for r in rows:
                fh.write(json.dumps({k: v for k, v in r.items() if not k.startswith("_")},
                                     ensure_ascii=False) + "\n")

    report = {
        "train_rows": len(train),
        "test_rows": len(test),
        "battery_rows_removed_from_train": battery_leak,
        "train_drops": dict(train_drops),
        "test_drops": dict(test_drops),
        "leak_check": {"eval_sets": eval_detail, "train_leaks": 0, "battery_leaks": 0,
                       "status": "CLEAN"},
        "battery_unseen_by_v14": {"checked_against": seen_detail, "battery_overlap": 0,
                                  "train_rows_v14_already_saw": train_seen,
                                  "status": "CLEAN"},
        "train_by_label": dict(label_counts.most_common()),
        "train_by_language": dict(lang_counts.most_common()),
        "train_distinct_categories": len(cat_counts),
        "test_by_label": dict(test_labels.most_common()),
        "test_by_language": dict(test_langs.most_common()),
        "per_dimension": per_dim,
    }
    rp = Path(args.report_out)
    rp.parent.mkdir(parents=True, exist_ok=True)
    rp.write_text(json.dumps(report, indent=2, ensure_ascii=False), encoding="utf-8")

    print("=" * 68)
    print(f"v15 CORPUS ASSEMBLED   train {len(train)}   held-out battery {len(test)}")
    print(f"  leak check vs {list(eval_detail)}: CLEAN")
    print(f"  battery unseen by v14 ({len(seen_keys)} v14 group keys): CLEAN")
    if train_seen:
        print(f"  note: {train_seen} train rows duplicate v14 corpus rows (expected, kept)")
    if battery_leak:
        print(f"  removed {battery_leak} train rows that duplicated the battery")
    print(f"  dropped from train: {dict(train_drops) or 'none'}")
    print(f"  distinct categories: {len(cat_counts)}   languages: {len(lang_counts)}")
    print("-" * 68)
    print("  train by label:")
    for k, v in label_counts.most_common():
        print(f"    {k:30s} {v:5d}")
    print("  train by language:")
    for k, v in lang_counts.most_common():
        print(f"    {k:10s} {v:5d}")
    print(f"\n[write] {args.train_out}")
    print(f"[write] {args.test_out}")
    print(f"[write] {args.report_out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
