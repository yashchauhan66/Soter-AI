#!/usr/bin/env python3
"""Can a combination of the existing arms beat every single arm?

v18 lost the battery fairly (see audit-battery-train-overlap.py: 0/4000 rows are
in any arm's fitted data, positive control passing). So the question "what is the
strongest detector we can field" is no longer "which checkpoint wins" -- the arms
disagree, and disagreement is exploitable.

The honest way to test that: a mean-probability ensemble is just a model whose
probability vector is the average of its members'. Push it through the IDENTICAL
decision contract imported from compare-v18-bases.py and it becomes directly
comparable to every single arm, with ZERO fitted parameters -- nothing is tuned
on the evaluation rows, so the full 4000 rows stay usable and there is no
threshold to overfit.

Weighted and thresholded variants DO fit parameters, so those are fitted on a
group-disjoint half and reported only on the other half. Rows are split by
group_key_for(), so near-duplicates cannot straddle the split.

Latency is reported as the sum of member p50s, because an ensemble runs every
member. A combination that wins detection but costs 750 ms is a different
product decision from one that costs 130 ms, and collapsing the two would hide
the only axis on which v18 was ever ahead.

ML-only diagnostic: rules, semantic veto and product gating are excluded.
"""
import argparse
import hashlib
import importlib.util
import itertools
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[2]
SCRIPTS = ROOT / "scripts/ml"
sys.path.insert(0, str(SCRIPTS))

from soter_augment import group_key_for  # noqa: E402


def _load_script(path, name):
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


compare = _load_script(SCRIPTS / "compare-v18-bases.py", "compare_v18_bases")

ARMS = ["v14", "v17-minilm", "v17-multilingual", "v18-candidate"]
GATE = "shared_input_gate"


def load_rows(path):
    with Path(path).open(encoding="utf-8") as f:
        return [json.loads(line) for line in f if line.strip()]


def load_arms(scores_dir, rows):
    expected = hashlib.sha256(
        json.dumps(rows, sort_keys=True, ensure_ascii=False).encode()
    ).hexdigest()
    loaded, labels = {}, None
    for arm in ARMS:
        data = json.loads((scores_dir / f"{arm}-scores.json").read_text(encoding="utf-8"))
        if data["identity"]["rows_sha256"] != expected:
            raise ValueError(f"{arm}: cached scores belong to a different row set")
        if labels is None:
            labels = data["identity"]["labels"]
        elif data["identity"]["labels"] != labels:
            # Averaging probability vectors is only meaningful when the arms share
            # one taxonomy in one order. Refuse rather than silently mis-add.
            raise ValueError(f"{arm}: label taxonomy differs from {ARMS[0]}; cannot average")
        loaded[arm] = {
            "probabilities": np.asarray(data["probabilities"], dtype=float),
            "content_lengths": data["content_lengths"],
            "latency_p50_fixed256_ms": data["latency"]["fixed256"]["p50_ms"],
            "model_bytes": data["model_bytes"],
            "model_sha256": data["identity"]["model_sha256"],
        }
    return loaded, labels


def gate_flags(probabilities, labels, content_lengths):
    """The shared decision contract. Empty calibration keeps the artifact-specific
    truncation mode inert so every configuration is judged on the common gate."""
    return compare.decisions(probabilities, labels, content_lengths, {})[GATE]


def mcnemar(truth, a_flags, b_flags):
    """Exact two-sided binomial test on discordant pairs. Exploratory only:
    source/family correlation violates the independent-row assumption."""
    from math import comb
    correct_a = (a_flags == truth)
    correct_b = (b_flags == truth)
    b_only = int((correct_a & ~correct_b).sum())
    a_only = int((correct_b & ~correct_a).sum())
    n = b_only + a_only
    if n == 0:
        return {"a_better": b_only, "b_better": a_only, "p_value": 1.0}
    k = min(b_only, a_only)
    tail = sum(comb(n, i) for i in range(k + 1)) / (2 ** n)
    return {"a_better": b_only, "b_better": a_only, "p_value": min(1.0, 2 * tail)}


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--rows", type=Path, default=ROOT / "artifacts/ml/v18-balanced-comparison-rows.jsonl")
    parser.add_argument("--scores", type=Path, default=ROOT / "artifacts/ml/v18-candidate-comparison")
    parser.add_argument("--out", type=Path, default=ROOT / "artifacts/ml/arm-fusion.json")
    args = parser.parse_args()

    rows = load_rows(args.rows)
    truth = np.array([r["label"] != "SAFE" for r in rows])
    arms, labels = load_arms(args.scores, rows)
    lengths = arms[ARMS[0]]["content_lengths"]
    print(f"rows {len(rows)}  attacks {int(truth.sum())}  benign {int((~truth).sum())}")

    # Group-disjoint halves for anything that fits a parameter.
    groups = [group_key_for(r["text"].strip()) for r in rows]
    fit_mask = np.array([
        int(hashlib.sha256(g.encode("utf-8")).hexdigest(), 16) % 2 == 0 for g in groups
    ])
    fit_ix, test_ix = np.flatnonzero(fit_mask), np.flatnonzero(~fit_mask)
    print(f"group-disjoint split: fit {len(fit_ix)}  test {len(test_ix)}  "
          f"(shared groups {len(set(np.array(groups)[fit_ix]) & set(np.array(groups)[test_ix]))})")

    configurations = {}

    # ── Single arms ───────────────────────────────────────────────────────────
    for arm in ARMS:
        configurations[arm] = {
            "kind": "single",
            "members": [arm],
            "flags": gate_flags(arms[arm]["probabilities"], labels, lengths),
            "fitted_parameters": 0,
            "latency_p50_sum_ms": arms[arm]["latency_p50_fixed256_ms"],
            "model_bytes_sum": arms[arm]["model_bytes"],
        }

    # ── Zero-parameter combinations ───────────────────────────────────────────
    for size in (2, 3, 4):
        for members in itertools.combinations(ARMS, size):
            stack = np.stack([arms[m]["probabilities"] for m in members])
            latency = sum(arms[m]["latency_p50_fixed256_ms"] for m in members)
            size_bytes = sum(arms[m]["model_bytes"] for m in members)
            member_flags = [configurations[m]["flags"] for m in members]

            configurations[f"mean({'+'.join(members)})"] = {
                "kind": "mean_probability", "members": list(members),
                "flags": gate_flags(stack.mean(axis=0), labels, lengths),
                "fitted_parameters": 0, "latency_p50_sum_ms": latency, "model_bytes_sum": size_bytes,
            }
            configurations[f"or({'+'.join(members)})"] = {
                "kind": "union_of_gates", "members": list(members),
                "flags": np.logical_or.reduce(member_flags),
                "fitted_parameters": 0, "latency_p50_sum_ms": latency, "model_bytes_sum": size_bytes,
            }
            configurations[f"and({'+'.join(members)})"] = {
                "kind": "intersection_of_gates", "members": list(members),
                "flags": np.logical_and.reduce(member_flags),
                "fitted_parameters": 0, "latency_p50_sum_ms": latency, "model_bytes_sum": size_bytes,
            }
            if size >= 3:
                votes = np.sum(member_flags, axis=0)
                configurations[f"majority({'+'.join(members)})"] = {
                    "kind": "majority_vote", "members": list(members),
                    "flags": votes >= (size // 2 + 1),
                    "fitted_parameters": 0, "latency_p50_sum_ms": latency, "model_bytes_sum": size_bytes,
                }

    # ── Evaluate ──────────────────────────────────────────────────────────────
    for name, config in configurations.items():
        flags = config["flags"]
        config["full_battery"] = compare.metrics(truth, flags)
        config["fit_half"] = compare.metrics(truth[fit_ix], flags[fit_ix])
        config["test_half"] = compare.metrics(truth[test_ix], flags[test_ix])

    # ── Ranking: only configurations that fit nothing may claim the full battery ──
    baseline = max(ARMS, key=lambda a: configurations[a]["full_battery"]["recall"])
    print(f"\nbest single arm by recall: {baseline}")

    def dominates(config, reference):
        return (config["full_battery"]["recall"] >= reference["full_battery"]["recall"]
                and config["full_battery"]["fpr"] <= reference["full_battery"]["fpr"])

    ranked = sorted(
        configurations.items(),
        key=lambda kv: (-kv[1]["full_battery"]["recall"], kv[1]["full_battery"]["fpr"]),
    )
    print(f"\n── {GATE} on the full battery (no configuration below fits any parameter) ──")
    print(f"  {'configuration':<46} {'recall':>7} {'fpr':>7} {'lat p50':>9}  dominates-best-single")
    for name, config in ranked[:18]:
        full = config["full_battery"]
        mark = "YES" if dominates(config, configurations[baseline]) and name != baseline else ""
        print(f"  {name:<46} {full['recall']:>7.4f} {full['fpr']:>7.4f} "
              f"{config['latency_p50_sum_ms']:>8.1f}ms  {mark}")

    pareto = []
    for name, config in configurations.items():
        full = config["full_battery"]
        if not any(
            other is not config
            and other["full_battery"]["recall"] >= full["recall"]
            and other["full_battery"]["fpr"] <= full["fpr"]
            and (other["full_battery"]["recall"] > full["recall"]
                 or other["full_battery"]["fpr"] < full["fpr"])
            for other in configurations.values()
        ):
            pareto.append(name)
    print(f"\n── Pareto front (recall up, FPR down) ──")
    for name in sorted(pareto, key=lambda n: -configurations[n]["full_battery"]["recall"]):
        full = configurations[name]["full_battery"]
        print(f"  {name:<46} recall {full['recall']:.4f}  fpr {full['fpr']:.4f}  "
              f"{configurations[name]['latency_p50_sum_ms']:.1f}ms")

    # Paired significance of the top dominating configuration against the best single arm.
    significance = {}
    for name in pareto:
        if configurations[name]["kind"] == "single":
            continue
        significance[name] = {
            "vs": baseline,
            "attacks": mcnemar(truth[truth], configurations[name]["flags"][truth],
                               configurations[baseline]["flags"][truth]),
            "benign": mcnemar(np.zeros(int((~truth).sum()), dtype=bool),
                              configurations[name]["flags"][~truth],
                              configurations[baseline]["flags"][~truth]),
        }

    report = {
        "schema_version": 1,
        "generated_at_utc": datetime.now(timezone.utc).isoformat(),
        "purpose": "Measure whether combining the existing arms beats the best single arm on the "
                   "shared decision contract, and at what latency cost.",
        "gate": GATE,
        "rows": len(rows),
        "attacks": int(truth.sum()),
        "benign": int((~truth).sum()),
        "rows_file_sha256": hashlib.sha256(args.rows.read_bytes()).hexdigest(),
        "arm_identity": {a: {"model_sha256": arms[a]["model_sha256"],
                             "model_bytes": arms[a]["model_bytes"],
                             "latency_p50_fixed256_ms": arms[a]["latency_p50_fixed256_ms"]} for a in ARMS},
        "best_single_arm_by_recall": baseline,
        "pareto_front": pareto,
        "significance_vs_best_single": significance,
        "group_split": {"fit_rows": len(fit_ix), "test_rows": len(test_ix),
                        "note": "Split by group_key_for so near-duplicates cannot straddle; only "
                                "needed for parameter-fitting variants, none of which are ranked above."},
        "configurations": {
            name: {k: v for k, v in config.items() if k != "flags"}
            for name, config in configurations.items()
        },
        "limitations": [
            "ML-only binary detection on one 4000-row battery; rules, semantic veto and product "
            "gating are excluded. These are not product recall/FPR.",
            "No configuration here fits a parameter, so the full battery is a legitimate readout, "
            "but SELECTING the winner over ~30 configurations on these rows is itself a choice made "
            "on this data. Confirm any pick on a fresh battery before shipping it.",
            "An ensemble runs every member: latency is the sum, and the deployed runtime currently "
            "loads exactly one ONNX model, so multi-member configurations are not drop-in.",
            "McNemar p-values are exploratory: rows within a source family are correlated, and the "
            "values are unadjusted for multiple comparisons.",
        ],
    }
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(f"\nWrote {args.out}")


if __name__ == "__main__":
    main()
