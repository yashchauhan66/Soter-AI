#!/usr/bin/env python3
"""Paired same-row comparison for two PINT v2 prediction reports."""

from __future__ import annotations

import argparse
import hashlib
import json
import random
from collections import defaultdict
from pathlib import Path
from typing import Any


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def balanced_score(rows: list[dict[str, Any]]) -> float:
    buckets: defaultdict[tuple[str, bool], list[bool]] = defaultdict(list)
    for row in rows:
        buckets[(str(row["category"]), bool(row["label"]))].append(bool(row["correct"]))
    return sum(sum(values) / len(values) for values in buckets.values()) / max(1, len(buckets))


def percentile(values: list[float], probability: float) -> float:
    ordered = sorted(values)
    if not ordered:
        return 0.0
    position = (len(ordered) - 1) * probability
    lower, upper = int(position), min(len(ordered) - 1, int(position) + 1)
    fraction = position - lower
    return ordered[lower] + (ordered[upper] - ordered[lower]) * fraction


def main() -> None:
    parser = argparse.ArgumentParser(description="Compute a paired PINT balanced-score improvement confidence interval.")
    parser.add_argument("--soterai", type=Path, required=True)
    parser.add_argument("--comparator", type=Path, required=True)
    parser.add_argument("--out", type=Path, required=True)
    parser.add_argument("--iterations", type=int, default=10_000)
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--minimum-improvement", type=float, default=0.01)
    args = parser.parse_args()
    if args.iterations < 1:
        raise SystemExit("--iterations must be positive")

    soterai = json.loads(args.soterai.read_text(encoding="utf-8"))
    comparator = json.loads(args.comparator.read_text(encoding="utf-8"))
    for name, report in (("SoterAI", soterai), ("comparator", comparator)):
        if report.get("task") != "prompt_manipulation":
            raise SystemExit(f"{name} report is not a prompt-manipulation report")
        if report.get("comparability") == "NOT_DIRECTLY_COMPARABLE_TO_PINT":
            raise SystemExit(f"{name} report is marked non-comparable")
        if not isinstance(report.get("predictions"), list):
            raise SystemExit(f"{name} report lacks per-row predictions")
    if soterai.get("benchmarkSha256") != comparator.get("benchmarkSha256"):
        raise SystemExit("Reports use different benchmark hashes")

    soterai_by_id = {str(row["id"]): row for row in soterai["predictions"]}
    comparator_by_id = {str(row["id"]): row for row in comparator["predictions"]}
    if set(soterai_by_id) != set(comparator_by_id):
        missing_left = len(set(comparator_by_id) - set(soterai_by_id))
        missing_right = len(set(soterai_by_id) - set(comparator_by_id))
        raise SystemExit(f"Paired row IDs do not match: missing_soterai={missing_left}, missing_comparator={missing_right}")

    pairs: defaultdict[tuple[str, bool], list[tuple[dict[str, Any], dict[str, Any]]]] = defaultdict(list)
    for row_id, left in soterai_by_id.items():
        right = comparator_by_id[row_id]
        if left["category"] != right["category"] or bool(left["label"]) != bool(right["label"]):
            raise SystemExit(f"Ground truth mismatch for row {row_id}")
        pairs[(str(left["category"]), bool(left["label"]))].append((left, right))

    soterai_rows = list(soterai_by_id.values())
    comparator_rows = list(comparator_by_id.values())
    soterai_score = balanced_score(soterai_rows)
    comparator_score = balanced_score(comparator_rows)
    rng = random.Random(args.seed)
    improvements: list[float] = []
    for _ in range(args.iterations):
        sampled_left: list[dict[str, Any]] = []
        sampled_right: list[dict[str, Any]] = []
        for bucket in pairs.values():
            for _ in range(len(bucket)):
                left, right = bucket[rng.randrange(len(bucket))]
                sampled_left.append(left)
                sampled_right.append(right)
        improvements.append(balanced_score(sampled_left) - balanced_score(sampled_right))
    lower, upper = percentile(improvements, 0.025), percentile(improvements, 0.975)
    point = soterai_score - comparator_score
    result = {
        "schema_version": "soterai-paired-comparison/v1",
        "benchmark_sha256": soterai["benchmarkSha256"],
        "soterai_report_sha256": sha256(args.soterai),
        "comparator_report_sha256": sha256(args.comparator),
        "paired_rows": len(soterai_rows),
        "soterai_balanced_score": soterai_score,
        "comparator_balanced_score": comparator_score,
        "paired_improvement": point,
        "paired_improvement_95_ci": {"lower": lower, "upper": upper, "method": "stratified paired percentile bootstrap", "iterations": args.iterations, "seed": args.seed},
        "minimum_required_improvement": args.minimum_improvement,
        "point_margin_passed": point >= args.minimum_improvement,
        "ci_excludes_zero": lower > 0,
        "superiority_gate_passed": point >= args.minimum_improvement and lower > 0,
    }
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()