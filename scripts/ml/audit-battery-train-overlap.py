#!/usr/bin/env python3
"""Is the 4000-row comparison battery actually held out for EVERY arm?

The v18 NO-GO verdict ranks four models that were trained on DIFFERENT corpora.
That is only a detection comparison if no arm was fitted on the evaluation text.
`v18-lineage-audit` already established the asymmetry in one direction: 8152 of
the 10238 rows in v18's own test split sit in the teacher's training partition,
so v18's 99.5% self-report is not teacher-independent. This script asks the
question that actually decides the verdict, in the other direction: how much of
the shared battery sits inside v14's and v17's fitted data, and inside v18's?

If the battery is held out for v18 but memorised by v14/v17, then the reported
gap measures recall of training text, not detection, and the NO-GO is an
artifact of the benchmark rather than a property of the model.

Method:
  * A row is FITTED for an arm when it appears in that arm's train OR calibration
    partition — calibration counts because each arm ships thresholds fitted on it.
  * Exact match  = SHA-256 of text.strip(); normalized match = group_key_for(),
    the same key the training splits use, so near-duplicates (case, leet,
    homoglyph, combining marks) collapse together. Both are reported; the
    normalized key is what a split-leak check must use.
  * Augmented rows live past the end of the corpus file and cannot be hashed
    here. They derive only from train parents, so excluding them can only
    UNDERCOUNT overlap, never invent it.
  * Metrics on any subset are recomputed from the cached per-row probabilities
    written by compare-v18-bases.py. No new inference runs, and the decision
    contract is imported from that script rather than restated, so the gates
    cannot drift from the numbers they are being compared against.

Diagnostic evidence. Not a release gate and not a deployment calibration.
"""
import argparse
import hashlib
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

from soter_augment import group_key_for  # noqa: E402

ARM_DIRS = {
    "v14": "models/ml-classifier-v14",
    "v17-minilm": "models/ml-classifier-v17-minilm",
    "v17-multilingual": "models/ml-classifier-v17",
    "v18-candidate": "models/ml-classifier-v18-candidate",
}


def _load_script(path, name):
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


# Import the live decision contract instead of re-implementing it.
compare = _load_script(SCRIPTS / "compare-v18-bases.py", "compare_v18_bases")


def sha256_file(path):
    h = hashlib.sha256()
    with Path(path).open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def exact_key(text):
    return hashlib.sha256(text.strip().encode("utf-8")).hexdigest()


_FILE_CACHE = {}


def file_keys(path):
    """(exact, normalized) key per row, in file order. Memoized: v14's corpus is
    a prefix of v17's, so the shared files are parsed and keyed exactly once."""
    path = Path(path)
    if path in _FILE_CACHE:
        return _FILE_CACHE[path]
    keys = []
    with path.open(encoding="utf-8") as f:
        for line in f:
            if not line.strip():
                continue
            text = json.loads(line).get("text")
            if not isinstance(text, str):
                raise ValueError(f"{path}: row without text")
            stripped = text.strip()
            keys.append((exact_key(stripped), group_key_for(stripped)))
    _FILE_CACHE[path] = keys
    print(f"  keyed {len(keys):>7} rows  {path.name}", flush=True)
    return keys


def resolve_dataset(rel):
    """Colab-trained manifests record absolute /content paths; fall back to the
    repo copy of the same basename so the corpus resolves locally."""
    direct = ROOT / rel
    if direct.exists():
        return direct
    local = ROOT / "datasets" / Path(rel).name
    if local.exists():
        return local
    raise FileNotFoundError(f"cannot resolve dataset {rel}")


def arm_partitions(arm):
    """Exact and normalized key sets for each split partition of one arm."""
    directory = ROOT / ARM_DIRS[arm]
    manifest = json.loads((directory / "dataset_manifest.json").read_text(encoding="utf-8"))
    split = json.loads((directory / "split_indices.json").read_text(encoding="utf-8"))

    keys, sources = [], {}
    for rel in manifest["datasets"]:
        path = resolve_dataset(rel)
        rows = file_keys(path)
        expected = manifest["rows_per_file"][rel]
        if len(rows) != expected:
            raise ValueError(f"{arm}: {rel} has {len(rows)} rows, manifest says {expected}")
        sources[rel] = {"path": str(path.relative_to(ROOT)), "rows": len(rows)}
        keys.extend(rows)
    if len(keys) != manifest["rows_total"]:
        raise ValueError(f"{arm}: corpus is {len(keys)} rows, manifest says {manifest['rows_total']}")

    partitions, dropped = {}, {}
    for name, indices in split["indices"].items():
        inside = [i for i in indices if i < len(keys)]
        dropped[name] = len(indices) - len(inside)
        partitions[name] = {
            "rows": len(inside),
            "augmented_rows_excluded": dropped[name],
            "exact": {keys[i][0] for i in inside},
            "normalized": {keys[i][1] for i in inside},
        }
    return {
        "manifest": manifest,
        "split_sha256": split.get("sha256"),
        "split_indices_train": split["indices"]["train"],
        "sources": sources,
        "corpus_rows": len(keys),
        "partitions": partitions,
    }


def load_rows(path):
    rows = []
    with Path(path).open(encoding="utf-8") as f:
        for line in f:
            if line.strip():
                rows.append(json.loads(line))
    return rows


def positive_control(arm, info, limit=200):
    """A zero-overlap result is only evidence if a non-zero one was reachable.

    Take real texts out of this arm's own train partition and push them through
    the SAME keying path the battery rows take. They must all match. If the
    battery-side and corpus-side keys were computed differently -- a missing
    strip, a different normalizer, an off-by-one in the index mapping -- this
    control collapses to 0 and the clean result is exposed as vacuous.
    """
    manifest = info["manifest"]
    first = manifest["datasets"][0]
    path, count = resolve_dataset(first), manifest["rows_per_file"][first]
    # The first dataset starts at global offset 0, so indices below its row count
    # address it directly.
    wanted = sorted(i for i in info["split_indices_train"] if i < count)[:limit]
    if not wanted:
        raise ValueError(f"{arm}: no train rows land in the first dataset; control cannot run")
    target = set(wanted)
    texts = []
    with path.open(encoding="utf-8") as f:
        for n, line in enumerate(f):
            if not line.strip():
                continue
            if n in target:
                texts.append(json.loads(line)["text"])
            if len(texts) == len(wanted):
                break
    part = info["partitions"]["train"]
    exact_hits = sum(exact_key(t) in part["exact"] for t in texts)
    norm_hits = sum(group_key_for(t.strip()) in part["normalized"] for t in texts)
    return {
        "dataset": str(path.relative_to(ROOT)),
        "sampled_train_rows": len(texts),
        "exact_matches": exact_hits,
        "normalized_matches": norm_hits,
        "passed": exact_hits == len(texts) == norm_hits,
    }


def load_cache(out_dir, arm, rows):
    cache = out_dir / f"{arm}-scores.json"
    data = json.loads(cache.read_text(encoding="utf-8"))
    expected = hashlib.sha256(
        json.dumps(rows, sort_keys=True, ensure_ascii=False).encode()
    ).hexdigest()
    if data["identity"]["rows_sha256"] != expected:
        raise ValueError(f"{arm}: cached scores were produced for different rows")
    if len(data["probabilities"]) != len(rows):
        raise ValueError(f"{arm}: cache covers {len(data['probabilities'])} of {len(rows)} rows")
    return data


def subset_metrics(flags, truth, index):
    return {mode: compare.metrics(truth[index], flag[index]) for mode, flag in flags.items()}


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--rows", type=Path, default=ROOT / "artifacts/ml/v18-balanced-comparison-rows.jsonl")
    parser.add_argument("--scores", type=Path, default=ROOT / "artifacts/ml/v18-candidate-comparison",
                        help="Directory holding the cached <arm>-scores.json files")
    parser.add_argument("--out", type=Path, default=ROOT / "artifacts/ml/battery-train-overlap.json")
    parser.add_argument("--gate", default="shared_input_gate")
    args = parser.parse_args()

    rows = load_rows(args.rows)
    truth = np.array([r["label"] != "SAFE" for r in rows])
    battery = [(exact_key(r["text"]), group_key_for(r["text"].strip())) for r in rows]
    print(f"battery: {len(rows)} rows ({int(truth.sum())} attack / {int((~truth).sum())} benign)\n")

    print("keying training corpora (shared files are keyed once):", flush=True)
    arms = {}
    for arm in ARM_DIRS:
        print(f" {arm}:", flush=True)
        arms[arm] = arm_partitions(arm)

    # ── Overlap of the battery with each arm's partitions ─────────────────────
    overlap, fitted_normalized, controls = {}, {}, {}
    for arm, info in arms.items():
        controls[arm] = positive_control(arm, info)
        entry = {"corpus_rows": info["corpus_rows"], "split_sha256": info["split_sha256"],
                 "datasets": info["sources"], "keying_positive_control": controls[arm],
                 "partitions": {}}
        for name, part in info["partitions"].items():
            hit_exact = [i for i, (e, _) in enumerate(battery) if e in part["exact"]]
            hit_norm = [i for i, (_, g) in enumerate(battery) if g in part["normalized"]]
            entry["partitions"][name] = {
                "partition_rows": part["rows"],
                "augmented_rows_excluded": part["augmented_rows_excluded"],
                "battery_exact_matches": len(hit_exact),
                "battery_normalized_matches": len(hit_norm),
                "battery_normalized_rate": len(hit_norm) / len(rows),
            }
        fit = set()
        for name in ("train", "calibration"):
            if name in info["partitions"]:
                fit |= info["partitions"][name]["normalized"]
        fitted = np.array([g in fit for _, g in battery])
        fitted_normalized[arm] = fitted
        entry["fitted_train_plus_calibration"] = {
            "battery_rows_fitted": int(fitted.sum()),
            "battery_rows_fitted_rate": float(fitted.mean()),
            "attack_rows_fitted": int((fitted & truth).sum()),
            "benign_rows_fitted": int((fitted & ~truth).sum()),
            "by_source": dict(Counter(
                rows[i].get("source", "unknown") for i in np.flatnonzero(fitted)
            ).most_common()),
        }
        overlap[arm] = entry

    any_fitted = np.zeros(len(rows), dtype=bool)
    for mask in fitted_normalized.values():
        any_fitted |= mask
    neutral = ~any_fitted
    neutral_ix = np.flatnonzero(neutral)
    contaminated_ix = np.flatnonzero(any_fitted)

    print("\n── keying positive control (train text must match its own arm) ──")
    for arm, control in controls.items():
        state = "PASS" if control["passed"] else "FAIL"
        print(f"  {arm:<18} {state}  exact {control['exact_matches']}/{control['sampled_train_rows']}"
              f"  normalized {control['normalized_matches']}/{control['sampled_train_rows']}")
    if not all(c["passed"] for c in controls.values()):
        raise SystemExit("Positive control failed: a zero-overlap result would be vacuous.")

    print("\n── battery rows fitted by each arm (train + calibration, normalized) ──")
    for arm in ARM_DIRS:
        fit = overlap[arm]["fitted_train_plus_calibration"]
        parts = overlap[arm]["partitions"]
        searched = parts["train"]["partition_rows"] + parts.get("calibration", {}).get("partition_rows", 0)
        print(f"  {arm:<18} {fit['battery_rows_fitted']:>5} / {len(rows)} "
              f"({fit['battery_rows_fitted_rate']:6.2%})  "
              f"attack {fit['attack_rows_fitted']:>4}  benign {fit['benign_rows_fitted']:>4}"
              f"   [searched {searched} fitted rows]")
    print(f"\n  clean for EVERY arm: {int(neutral.sum())} rows "
          f"({int((neutral & truth).sum())} attack / {int((neutral & ~truth).sum())} benign)")

    # ── Re-score every arm on the neutral subset, from cache ──────────────────
    results = {}
    for arm in ARM_DIRS:
        data = load_cache(args.scores, arm, rows)
        flags = compare.decisions(data["probabilities"], data["identity"]["labels"],
                                  data["content_lengths"], data["calibration"])
        results[arm] = {
            "flags": flags,
            "full_battery": subset_metrics(flags, truth, np.arange(len(rows))),
            "clean_for_all_arms": subset_metrics(flags, truth, neutral_ix),
            "fitted_by_some_arm": subset_metrics(flags, truth, contaminated_ix),
            "self_fitted_only": subset_metrics(flags, truth, np.flatnonzero(fitted_normalized[arm])),
            "model_sha256": data["identity"]["model_sha256"],
        }

    gate = args.gate
    print(f"\n── {gate}: full battery  ->  rows clean for EVERY arm ──")
    print(f"  {'arm':<18} {'recall':>16}   {'fpr':>16}")
    for arm in ARM_DIRS:
        full = results[arm]["full_battery"][gate]
        clean = results[arm]["clean_for_all_arms"][gate]
        print(f"  {arm:<18} {full['recall']:.4f} -> {clean['recall']:.4f}   "
              f"{full['fpr']:.4f} -> {clean['fpr']:.4f}")

    # Paired discordance on the neutral rows only: where do arms actually differ
    # once memorised text is removed?
    paired = {}
    names = list(ARM_DIRS)
    for i, a in enumerate(names):
        for b in names[i + 1:]:
            af = results[a]["flags"][gate][neutral_ix]
            bf = results[b]["flags"][gate][neutral_ix]
            t = truth[neutral_ix]
            paired[f"{a}_vs_{b}"] = {
                "attack_a_only": int((t & af & ~bf).sum()), "attack_b_only": int((t & bf & ~af).sum()),
                "benign_a_only_flag": int((~t & af & ~bf).sum()), "benign_b_only_flag": int((~t & bf & ~af).sum()),
            }

    report = {
        "schema_version": 1,
        "generated_at_utc": datetime.now(timezone.utc).isoformat(),
        "purpose": "Decide whether the shared battery is held out for every compared arm, and "
                   "re-measure the comparison on the subset that is clean for all of them.",
        "gate": gate,
        "rows_file": str(args.rows),
        "rows_file_sha256": sha256_file(args.rows),
        "rows": len(rows),
        "attacks": int(truth.sum()),
        "benign": int((~truth).sum()),
        "method": {
            "fitted": "train + calibration partition of that arm; calibration counts because each "
                      "arm ships thresholds fitted on it.",
            "exact": "SHA-256 of text.strip() (UTF-8). No raw text stored.",
            "normalized": "group_key_for() from scripts/ml/soter_augment.py, the split key.",
            "augmented_rows": "Appended past corpus end, not hashable here; derived from train "
                              "parents only, so omission can undercount overlap, never invent it.",
            "metrics": "Recomputed from cached probabilities via compare-v18-bases.decisions(); "
                       "no new inference. ML-only binary attack detection, rules and veto excluded.",
        },
        "overlap": overlap,
        "keying_positive_control": controls,
        "subsets": {
            "clean_for_all_arms": {
                "rows": int(neutral.sum()),
                "attacks": int((neutral & truth).sum()),
                "benign": int((neutral & ~truth).sum()),
                "by_source": dict(Counter(rows[i].get("source", "unknown") for i in neutral_ix).most_common()),
                "by_language": dict(Counter(rows[i].get("language", "unknown") for i in neutral_ix).most_common()),
            },
            "fitted_by_some_arm": {
                "rows": int(any_fitted.sum()),
                "attacks": int((any_fitted & truth).sum()),
                "benign": int((any_fitted & ~truth).sum()),
                "by_source": dict(Counter(rows[i].get("source", "unknown") for i in contaminated_ix).most_common()),
            },
        },
        "arms": {arm: {k: v for k, v in r.items() if k != "flags"} for arm, r in results.items()},
        "paired_on_clean_rows": paired,
        "limitations": [
            "ML-only binary detection; rules, semantic veto and product gating are excluded.",
            "Normalized overlap uses the split key, which collapses case/leet/homoglyph variants "
            "but not paraphrase; semantic near-duplicates are NOT detected and remain uncounted.",
            "Subsetting an existing evaluation shrinks n; the clean subset carries wider intervals "
            "and its source mix differs from the full battery.",
            "Absence of overlap does not make a set independent: shared upstream provenance can "
            "still correlate an arm's training data with these rows.",
        ],
    }
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(f"\nWrote {args.out}")


if __name__ == "__main__":
    main()
