#!/usr/bin/env python3
"""Analyze paired cached scores only; never load a model or calibrate deployment.

ROC thresholds are selected on the SAME diagnostic evaluation rows to describe
recall at matched empirical FPR budgets. They are optimistically selected test
statistics, not calibration artifacts or estimates of future deployed FPR.
"""
import argparse
import hashlib
import importlib.util
import itertools
import json
from pathlib import Path

import numpy as np
from scipy.stats import binomtest
from sklearn.metrics import roc_auc_score, roc_curve

ROOT = Path(__file__).resolve().parents[2]
ARMS = ("v14", "v17-minilm", "v17-multilingual")
CANDIDATE = "v18-candidate"
MODES = ("raw_argmax", "shared_attack_probability_0.90", "shared_input_gate", "shared_input_gate_with_mte",
         "input_gate_with_artifact_truncation")
FPR_BUDGETS = (.01, .05, .10)
SCORER_PATH = ROOT / "scripts/ml/compare-v18-bases.py"


def scorer_module():
    # Importing this module uses NumPy; ORT/tokenizers are imported only inside
    # run_arm(), which this analysis never calls. Reuse its decision contract.
    spec = importlib.util.spec_from_file_location("v18_comparison_contract", SCORER_PATH)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def file_hash(path):
    h = hashlib.sha256()
    with Path(path).open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def require_complete(report, require_candidate=False):
    reported = set(report.get("arms", {}))
    arms = ARMS + ((CANDIDATE,) if require_candidate or CANDIDATE in reported else ())
    missing = set(arms) - reported
    if missing:
        raise ValueError(f"Incomplete comparison report; missing arms: {sorted(missing)}")
    unexpected = reported - set(arms)
    if unexpected:
        raise ValueError(f"Unsupported comparison arms: {sorted(unexpected)}")
    for a, b in itertools.combinations(arms, 2):
        pair = report.get("paired", {}).get(f"{a}_vs_{b}", {})
        if not set(MODES) <= set(pair):
            raise ValueError(f"Incomplete comparison report; missing paired decisions: {a}_vs_{b}")
    return arms


def paired_flags(a, b):
    """Exact two-sided McNemar: binomial test of the discordant paired rows."""
    a, b = np.asarray(a, dtype=bool), np.asarray(b, dtype=bool)
    if a.shape != b.shape or a.ndim != 1:
        raise ValueError("paired flags must be equally sized vectors")
    a_only, b_only = int((a & ~b).sum()), int((~a & b).sum())
    discordant = a_only + b_only
    p = (float(binomtest(a_only, discordant, p=.5, alternative="two-sided").pvalue)
         if discordant else (1.0 if len(a) else None))
    return {"rows": len(a), "both_flagged": int((a & b).sum()),
            "neither_flagged": int((~a & ~b).sum()), "a_only_flagged": a_only,
            "b_only_flagged": b_only, "discordant": discordant,
            "exact_mcnemar_pvalue_two_sided": p}


def roc_diagnostic(truth, scores, metrics):
    truth, scores = np.asarray(truth, dtype=bool), np.asarray(scores, dtype=float)
    if truth.shape != scores.shape or truth.ndim != 1 or not np.isfinite(scores).all():
        raise ValueError("ROC requires equal-length truth and finite score vectors")
    counts = {"rows": len(truth), "attacks": int(truth.sum()), "benign": int((~truth).sum())}
    if not truth.any() or truth.all():
        return {**counts, "auc": None, "reason": "ROC requires both attack and benign rows",
                "matched_fpr_descriptive": {}, "curve": None}
    fpr, tpr, thresholds = roc_curve(truth, scores, drop_intermediate=False)
    matched = {}
    for budget in FPR_BUDGETS:
        eligible = np.flatnonzero(fpr <= budget + 1e-12)
        # Highest recall within the budget; break recall ties conservatively by
        # lower FPR, then a higher threshold. Equal scores always move together.
        best = max(eligible, key=lambda i: (tpr[i], -fpr[i], thresholds[i]))
        threshold = float(thresholds[best])
        matched[f"{budget:.0%}"] = {
            "target_fpr_ceiling": budget,
            "threshold": threshold if np.isfinite(threshold) else None,
            "flag_none": not np.isfinite(threshold),
            **metrics(truth, scores >= threshold),
        }
    return {**counts, "auc": float(roc_auc_score(truth, scores)),
            "matched_fpr_descriptive": matched,
            "curve": {"fpr": fpr.tolist(), "tpr": tpr.tolist(),
                      "thresholds": [float(x) if np.isfinite(x) else None for x in thresholds]}}


def language_slices(rows):
    def bucket(row):
        language = str(row.get("language") or row.get("lang") or "unknown").strip().lower().replace("_", "-")
        if language in {"unknown", "und", "", "unspecified", "none", "null"}:
            return "unknown"
        if language in {"en", "eng", "english"} or language.startswith("en-"):
            return "english"
        return "non_english"
    groups = np.array([bucket(row) for row in rows])
    return {"overall": np.ones(len(rows), dtype=bool),
            **{name: groups == name for name in ("english", "non_english", "unknown")}}


def analyze(comparison_dir, rows_path, expected_rows=4000, require_candidate=False):
    report_path = comparison_dir / "report.json"
    report = json.loads(report_path.read_text(encoding="utf-8"))
    arms = require_complete(report, require_candidate)
    scorer = scorer_module()
    rows = scorer.read_rows(rows_path)
    if len(rows) != expected_rows or report.get("rows") != len(rows):
        raise ValueError("Row count differs from the expected completed comparison")
    rows_file_hash = file_hash(rows_path)
    if report.get("rows_file_sha256") != rows_file_hash:
        raise ValueError("Rows file does not match the completed report")
    rows_identity = hashlib.sha256(json.dumps(rows, sort_keys=True, ensure_ascii=False).encode()).hexdigest()
    expected_settings = {"binary_entropy_budget": .4, "confidence_floor": .5,
                         "attack_probability_floor": .85, "max_length": 256,
                         "reliable_labels": sorted(scorer.RELIABLE)}
    if report.get("settings") != expected_settings:
        raise ValueError("Report settings differ from the comparison decision contract")
    truth = np.array([r["label"] != "SAFE" for r in rows])
    slices = language_slices(rows)
    analysis = {
        "format_version": 2,
        "provenance": {"rows": len(rows), "rows_file_sha256": rows_file_hash,
                       "report_sha256": file_hash(report_path),
                       "decision_source_sha256": file_hash(SCORER_PATH),
                       "analysis_source_sha256": file_hash(__file__), "cache_sha256": {},
                       "arm_names": list(arms)},
        "settings": expected_settings,
        "limitations": [
            "Development-set diagnostics only; no new inference, deployment calibration or release approval.",
            "Matched-FPR thresholds maximize recall on these SAME evaluation rows, separately per slice. Do not deploy them or treat achieved FPR as prospective performance.",
            "ROC uses 1-P(SAFE) and excludes label allowlists, rules, semantic veto and long-context coverage behavior.",
            "Exact McNemar p-values use paired row discordance; source/family correlation violates independent-row assumptions. P-values are exploratory and unadjusted for multiple comparisons.",
            "Non-English includes every known non-English language plus mixed and Hinglish labels; unknown stays separate. English is en/eng/english/en-* metadata, never inferred from source.",
            "ROC null threshold means flag none. Tied scores are never split to manufacture a target FPR; achieved FPR may be below its ceiling.",
        ],
        "slice_rows": {name: int(mask.sum()) for name, mask in slices.items()},
        "arms": {}, "paired_common_points": {},
    }
    flags_by_arm = {}
    for name in arms:
        cache_path = comparison_dir / f"{name}-scores.json"
        data = json.loads(cache_path.read_text(encoding="utf-8"))
        identity = data.get("identity", {})
        if identity != report["arms"][name].get("identity") or identity.get("rows_sha256") != rows_identity:
            raise ValueError(f"{name}: cache identity does not match report/rows")
        labels = identity.get("labels", [])
        if len(labels) != len(set(labels)) or labels.count("SAFE") != 1:
            raise ValueError(f"{name}: invalid label map")
        probabilities = np.asarray(data.get("probabilities"), dtype=float)
        lengths = data.get("content_lengths", [])
        if (probabilities.shape != (len(rows), len(labels)) or not np.isfinite(probabilities).all()
                or np.any(probabilities < 0) or np.any(probabilities > 1)
                or not np.allclose(probabilities.sum(axis=1), 1, atol=1e-6, rtol=0)
                or len(lengths) != len(rows) or any(type(n) is not int or n < 0 for n in lengths)):
            raise ValueError(f"{name}: invalid or incomplete probabilities/content lengths")
        flags = scorer.decisions(probabilities, labels, lengths, data["calibration"])
        for mode in MODES:
            observed = scorer.metrics(truth, flags[mode])
            recorded = report["arms"][name].get("metrics", {}).get(mode, {})
            if any(observed[k] != recorded.get(k) for k in ("attacks", "benign", "tp", "fn", "fp", "tn")):
                raise ValueError(f"{name}/{mode}: report counts differ from cached decisions")
        flags_by_arm[name] = flags
        scores = 1 - probabilities[:, labels.index("SAFE")]
        analysis["provenance"]["cache_sha256"][name] = file_hash(cache_path)
        analysis["arms"][name] = {
            "identity": identity,
            "error_row_indices": {
                "note": "Zero-based positions in the hash-bound rows file; diagnostic examples must stay excluded from training.",
                "shared_input_gate_false_negatives": np.flatnonzero(truth & ~flags["shared_input_gate"]).tolist(),
                "shared_input_gate_false_positives": np.flatnonzero(~truth & flags["shared_input_gate"]).tolist(),
            },
            "slices": {slice_name: {
                "common_points": {mode: scorer.metrics(truth[mask], flags[mode][mask]) for mode in MODES},
                "roc_attack_probability": roc_diagnostic(truth[mask], scores[mask], scorer.metrics),
            } for slice_name, mask in slices.items()},
        }
    for a, b in itertools.combinations(arms, 2):
        key = f"{a}_vs_{b}"
        comparison = {}
        for mode in MODES:
            af, bf = flags_by_arm[a][mode], flags_by_arm[b][mode]
            recorded = report["paired"][key][mode]
            counts = {"attack_a_only": int((truth & af & ~bf).sum()),
                      "attack_b_only": int((truth & ~af & bf).sum()),
                      "benign_a_only_flag": int((~truth & af & ~bf).sum()),
                      "benign_b_only_flag": int((~truth & ~af & bf).sum())}
            if any(recorded.get(k) != value for k, value in counts.items()):
                raise ValueError(f"{key}/{mode}: paired report counts differ from caches")
            comparison[mode] = {}
            for slice_name, mask in slices.items():
                ma, mb = scorer.metrics(truth[mask], af[mask]), scorer.metrics(truth[mask], bf[mask])
                comparison[mode][slice_name] = {
                    "a": ma, "b": mb,
                    "recall_delta_b_minus_a": mb["recall"] - ma["recall"] if ma["recall"] is not None else None,
                    "fpr_delta_b_minus_a": mb["fpr"] - ma["fpr"] if ma["fpr"] is not None else None,
                    "attack_detection": paired_flags(af[mask & truth], bf[mask & truth]),
                    "benign_false_positives": paired_flags(af[mask & ~truth], bf[mask & ~truth]),
                }
        analysis["paired_common_points"][key] = comparison
    return analysis


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--comparison-dir", type=Path, default=ROOT / "artifacts/ml/v18-balanced-comparison")
    parser.add_argument("--rows", type=Path, default=ROOT / "artifacts/ml/v18-balanced-comparison-rows.jsonl")
    parser.add_argument("--expected-rows", type=int, default=4000)
    parser.add_argument("--require-candidate", action="store_true", help="Fail unless the completed v18 candidate and all its paired results are present")
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()
    if args.expected_rows < 2:
        parser.error("expected-rows must be at least 2")
    result = analyze(args.comparison_dir, args.rows, args.expected_rows, args.require_candidate)
    output = args.output or args.comparison_dir / "analysis.json"
    output.parent.mkdir(parents=True, exist_ok=True)
    temporary = output.with_suffix(output.suffix + ".tmp")
    temporary.write_text(json.dumps(result, indent=2, allow_nan=False), encoding="utf-8")
    temporary.replace(output)
    print(f"Wrote paired {len(result['arms'])}-arm diagnostics: {output}")


if __name__ == "__main__":
    main()
