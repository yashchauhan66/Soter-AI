#!/usr/bin/env python3
"""Direct overlap said the battery is clean for every arm. Lineage says otherwise.

audit-battery-train-overlap.py measured DIRECT overlap -- does a battery row's
normalized text appear verbatim in an arm's fitted data -- and found 0/4000 for
all four arms. That is a real result but it answers the weaker question.

v18's corpus was built by REMOVING 27,426 rows for `external_holdout_lineage`:
rows that share a lineage component with the holdout files the battery is drawn
from (external-real-v1/v2/v3 contributed 2136 + 6858 + 27326 linked rows). v14
and v17 were trained BEFORE that filter existed, so they kept those rows. None
of them is a verbatim battery row -- which is exactly why direct matching
reports zero -- but they are template relatives of battery rows, and v18 is the
only arm that had them taken away.

This script measures that asymmetry at the standard v18's own corpus builder
used: union rows that share a normalized-text group OR a declared lineage
identifier scoped to their corpus, then ask how many battery rows land in a
component that also contains one of an arm's fitted rows.

If the answer is large for v14/v17 and zero for v18, then the NO-GO compared a
model penalised by a leak filter against models that were never subjected to it.

Imports the linking primitives from prepare-v18-data.py rather than restating
them, so this cannot drift from the filter that actually built the corpus.
"""
import argparse
import importlib.util
import json
import sys
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[2]
SCRIPTS = ROOT / "scripts/ml"
sys.path.insert(0, str(SCRIPTS))


def _load_script(path, name):
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


prepare = _load_script(SCRIPTS / "prepare-v18-data.py", "prepare_v18_data")
compare = _load_script(SCRIPTS / "compare-v18-bases.py", "compare_v18_bases")

ARM_DIRS = {
    "v14": "models/ml-classifier-v14",
    "v17-minilm": "models/ml-classifier-v17-minilm",
    "v17-multilingual": "models/ml-classifier-v17",
    "v18-candidate": "models/ml-classifier-v18-candidate",
}
GATE = "shared_input_gate"


def resolve_dataset(rel):
    direct = ROOT / rel
    if direct.exists():
        return direct
    local = ROOT / "datasets" / Path(rel).name
    if local.exists():
        return local
    raise FileNotFoundError(rel)


_CORPUS_CACHE = {}


def corpus_tokens(path):
    """Lineage token sets per row, in file order. Memoized across arms."""
    path = Path(path)
    if path not in _CORPUS_CACHE:
        try:
            rows = prepare.read_rows(path)
        except ValueError as exc:
            if "reserved _v18 provenance field" not in str(exc):
                raise
            # v18's clean corpus was emitted WITH provenance already attached, so
            # the strict reader refuses it. Its stored provenance is the scope
            # lineage_tokens needs, so read it as-is rather than re-deriving one.
            rows = [json.loads(line) for line in
                    path.read_text(encoding="utf-8-sig").splitlines() if line.strip()]
            for n, row in enumerate(rows, 1):
                row.setdefault("_v18", {"source_file": path.name, "source_line": n})
        _CORPUS_CACHE[path] = [prepare.lineage_tokens(r) for r in rows]
        print(f"  tokenized {len(rows):>7} rows  {path.name}", flush=True)
    return _CORPUS_CACHE[path]


def arm_fitted_tokens(arm):
    """Token sets for the rows this arm actually fitted (train + calibration)."""
    directory = ROOT / ARM_DIRS[arm]
    manifest = json.loads((directory / "dataset_manifest.json").read_text(encoding="utf-8"))
    split = json.loads((directory / "split_indices.json").read_text(encoding="utf-8"))
    tokens = []
    for rel in manifest["datasets"]:
        tokens.extend(corpus_tokens(resolve_dataset(rel)))
    fitted = sorted({i for name in ("train", "calibration") for i in split["indices"].get(name, [])
                     if i < len(tokens)})
    return [tokens[i] for i in fitted], len(tokens)


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--rows", type=Path, default=ROOT / "artifacts/ml/v18-balanced-comparison-rows.jsonl")
    parser.add_argument("--scores", type=Path, default=ROOT / "artifacts/ml/v18-candidate-comparison")
    parser.add_argument("--out", type=Path, default=ROOT / "artifacts/ml/battery-lineage-linkage.json")
    args = parser.parse_args()

    battery = [json.loads(line) for line in args.rows.read_text(encoding="utf-8").splitlines() if line.strip()]
    for n, row in enumerate(battery, 1):
        row.setdefault("_v18", {"source_file": str(args.rows.name), "source_line": n})
    truth = np.array([r["label"] != "SAFE" for r in battery])
    battery_tokens = [prepare.lineage_tokens(r) for r in battery]
    print(f"battery {len(battery)} rows ({int(truth.sum())} attack / {int((~truth).sum())} benign)\n")

    results, linked_masks = {}, {}
    for arm in ARM_DIRS:
        print(f"{arm}:", flush=True)
        fitted_tokens, corpus_rows = arm_fitted_tokens(arm)

        # One component space per arm: battery rows first, then this arm's fitted
        # rows. Union anything sharing a token, then read off which battery rows
        # ended up connected to fitted data.
        dsu = prepare.DisjointSet()
        nodes = [dsu.add() for _ in range(len(battery) + len(fitted_tokens))]
        owner = {}
        for index, tokens in enumerate(battery_tokens + fitted_tokens):
            for token in tokens:
                if token in owner:
                    dsu.union(nodes[index], nodes[owner[token]])
                else:
                    owner[token] = index
        fitted_roots = {dsu.find(nodes[len(battery) + i]) for i in range(len(fitted_tokens))}
        linked = np.array([dsu.find(nodes[i]) in fitted_roots for i in range(len(battery))])
        linked_masks[arm] = linked
        results[arm] = {
            "corpus_rows": corpus_rows,
            "fitted_rows": len(fitted_tokens),
            "battery_rows_lineage_linked": int(linked.sum()),
            "battery_rows_lineage_linked_rate": float(linked.mean()),
            "attack_rows_linked": int((linked & truth).sum()),
            "benign_rows_linked": int((linked & ~truth).sum()),
            "by_source": dict(Counter(battery[i].get("source", "unknown")
                                      for i in np.flatnonzero(linked)).most_common(12)),
        }
        print(f"  linked {int(linked.sum())}/{len(battery)} battery rows "
              f"({linked.mean():.2%})\n", flush=True)

    print("── battery rows sharing a lineage component with each arm's fitted data ──")
    for arm in ARM_DIRS:
        r = results[arm]
        print(f"  {arm:<18} {r['battery_rows_lineage_linked']:>5} / {len(battery)} "
              f"({r['battery_rows_lineage_linked_rate']:6.2%})   "
              f"attack {r['attack_rows_linked']:>4}  benign {r['benign_rows_linked']:>4}")

    # Rows linked for NO arm: the strictest like-for-like subset available.
    any_linked = np.zeros(len(battery), dtype=bool)
    for mask in linked_masks.values():
        any_linked |= mask
    clean = ~any_linked
    clean_ix = np.flatnonzero(clean)
    print(f"\n  unlinked for EVERY arm: {int(clean.sum())} rows "
          f"({int((clean & truth).sum())} attack / {int((clean & ~truth).sum())} benign)")

    # Re-score from cache on that subset, and on each arm's own linked/unlinked split.
    scored = {}
    if clean.sum() >= 50:
        for arm in ARM_DIRS:
            data = json.loads((args.scores / f"{arm}-scores.json").read_text(encoding="utf-8"))
            flags = compare.decisions(data["probabilities"], data["identity"]["labels"],
                                      data["content_lengths"], data["calibration"])[GATE]
            own = linked_masks[arm]
            scored[arm] = {
                "full_battery": compare.metrics(truth, flags),
                "unlinked_for_every_arm": compare.metrics(truth[clean_ix], flags[clean_ix]),
                "rows_linked_to_this_arm": compare.metrics(truth[own], flags[own]) if own.any() else None,
                "rows_not_linked_to_this_arm": compare.metrics(truth[~own], flags[~own]),
            }
        print(f"\n── {GATE}: full battery -> rows unlinked for EVERY arm ──")
        print(f"  {'arm':<18} {'recall':>18}   {'fpr':>18}")
        for arm in ARM_DIRS:
            full, sub = scored[arm]["full_battery"], scored[arm]["unlinked_for_every_arm"]
            print(f"  {arm:<18} {full['recall']:.4f} -> {sub['recall']:.4f}"
                  f"   {full['fpr']:.4f} -> {sub['fpr']:.4f}")
        print(f"\n── each arm on rows linked to ITSELF vs not (memorisation tell) ──")
        for arm in ARM_DIRS:
            own = scored[arm]["rows_linked_to_this_arm"]
            other = scored[arm]["rows_not_linked_to_this_arm"]
            if own is None:
                print(f"  {arm:<18} no linked rows")
                continue
            print(f"  {arm:<18} linked n={own['attacks']+own['benign']:<5} recall {own['recall']:.4f} "
                  f"fpr {own['fpr']:.4f}   |   unlinked n={other['attacks']+other['benign']:<5} "
                  f"recall {other['recall']:.4f} fpr {other['fpr']:.4f}")
    else:
        print("\n  Too few unlinked rows to re-score; reporting linkage counts only.")

    report = {
        "schema_version": 1,
        "generated_at_utc": datetime.now(timezone.utc).isoformat(),
        "purpose": "Measure lineage-component linkage between the battery and each arm's fitted "
                   "data, the standard v18's own corpus filter used, and re-measure on rows "
                   "unlinked for every arm.",
        "gate": GATE,
        "rows_file": str(args.rows),
        "rows": len(battery),
        "method": {
            "linking": "prepare-v18-data.lineage_tokens: normalized-text group plus declared "
                       "lineage identifiers scoped to the row's corpus/dataset/source.",
            "components": "Union-find over battery rows and the arm's train+calibration rows; a "
                          "battery row counts as linked when its component contains a fitted row.",
            "note": "Linkage is NOT proof a model memorised a battery row. It measures that the "
                    "arm was trained on template relatives that v18's corpus filter removed.",
        },
        "arms": results,
        "unlinked_for_every_arm": {
            "rows": int(clean.sum()),
            "attacks": int((clean & truth).sum()),
            "benign": int((clean & ~truth).sum()),
            "by_source": dict(Counter(battery[i].get("source", "unknown")
                                      for i in clean_ix).most_common(12)),
        },
        "metrics": scored,
        "limitations": [
            "ML-only binary detection; rules, semantic veto and product gating are excluded.",
            "Lineage linkage depends on declared identifiers; corpora that declare none link only "
            "by normalized text, so linkage is a LOWER bound.",
            "Component linkage can chain through a shared hub row and overstate relatedness for "
            "individual pairs; counts are a population signal, not per-row proof of leakage.",
            "Subsetting shrinks n and shifts the source mix; intervals widen accordingly.",
        ],
    }
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(f"\nWrote {args.out}")


if __name__ == "__main__":
    main()
