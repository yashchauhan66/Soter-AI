#!/usr/bin/env python3
"""Forensic audit and provisional split-freeze tool for SoterAI JSONL data.

This command is deliberately CPU-safe. It performs exact and normalized
duplicate analysis, conflicting-label quarantine, deterministic lexical
near-duplicate clustering, and source-aware partitioning. It does *not* call
the lexical clustering "semantic" clustering: embedding-based semantic review
must run in the Colab accelerator pipeline before a holdout can be promoted to
FINAL_LOCKED.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import random
import re
import subprocess
import unicodedata
from collections import Counter, defaultdict
from dataclasses import asdict
from pathlib import Path
from typing import Any

from soterai_dataset_audit import ML_LABELS, normalize_record, read_jsonl


SCHEMA_VERSION = "soterai-data-freeze/v1"
PARTITIONS = ("train", "development_validation", "locked_internal_test", "final_untouched_holdout")
DEFAULT_RATIOS = (0.70, 0.10, 0.10, 0.10)
SYNTHETIC_GENERATORS = {
    "template",
    "prefix-suffix",
    "leet",
    "multi-turn",
    "benign-variation",
    "generated",
    "augmentation",
    "mutation",
    "hinglish",
}


def canonical_text(text: str) -> str:
    value = unicodedata.normalize("NFKC", text).casefold()
    value = "".join(" " if unicodedata.category(ch).startswith("Z") else ch for ch in value)
    value = re.sub(r"[\W_]+", " ", value, flags=re.UNICODE)
    return " ".join(value.split())


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def stable_json(value: Any) -> bytes:
    return (json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":")) + "\n").encode("utf-8")


def git_commit() -> str:
    try:
        return subprocess.check_output(["git", "rev-parse", "HEAD"], text=True, stderr=subprocess.DEVNULL).strip()
    except Exception:
        return "unknown"


def generator_for(source: str) -> str:
    source = str(source or "<missing>").strip().casefold()
    return source.split(":", 1)[0] if source else "<missing>"


def source_group_for(source: str, record_id: str | None) -> str:
    """Return a conservative source group.

    Generator families are kept together. Explicit parent-like identifiers are
    included when available, but never used to split one generator template
    across evaluation partitions.
    """
    generator = generator_for(source)
    normalized_source = str(source or "<missing>").strip().casefold() or "<missing>"
    if generator in SYNTHETIC_GENERATORS:
        # Keep each explicit generator/template family indivisible without
        # collapsing unrelated labels from the same broad generator.
        return normalized_source
    if generator == "<missing>":
        # Missing provenance cannot support an independent holdout. Keep it in
        # one conservative group and expose the limitation in the audit.
        return "<missing>"
    parent = re.sub(r"(?:[-_:](?:variant|mutation|aug)?\d+)+$", "", (record_id or "").casefold())
    return f"{generator}:{parent}" if parent else generator


def token_shingles(text: str, size: int = 3) -> set[str]:
    tokens = canonical_text(text).split()
    if not tokens:
        return set()
    if len(tokens) < size:
        return {" ".join(tokens)}
    return {" ".join(tokens[i : i + size]) for i in range(len(tokens) - size + 1)}


def minhash_signature(shingles: set[str], permutations: int = 48) -> tuple[int, ...]:
    if not shingles:
        return tuple([0] * permutations)
    values: list[int] = []
    for seed in range(permutations):
        prefix = seed.to_bytes(2, "big")
        values.append(min(int.from_bytes(hashlib.blake2b(prefix + item.encode("utf-8"), digest_size=8).digest(), "big") for item in shingles))
    return tuple(values)


class UnionFind:
    def __init__(self, size: int) -> None:
        self.parent = list(range(size))
        self.rank = [0] * size

    def find(self, item: int) -> int:
        while self.parent[item] != item:
            self.parent[item] = self.parent[self.parent[item]]
            item = self.parent[item]
        return item

    def union(self, left: int, right: int) -> None:
        left_root, right_root = self.find(left), self.find(right)
        if left_root == right_root:
            return
        if self.rank[left_root] < self.rank[right_root]:
            left_root, right_root = right_root, left_root
        self.parent[right_root] = left_root
        if self.rank[left_root] == self.rank[right_root]:
            self.rank[left_root] += 1


def lexical_clusters(texts: list[str], threshold: float, max_bucket: int = 250) -> tuple[list[int], dict[str, Any]]:
    """Cluster likely paraphrastic/template variants with MinHash LSH + Jaccard.

    This is an inexpensive leakage guard, not an embedding-semantic audit.
    Oversized buckets are skipped and reported to prevent quadratic blow-ups.
    """
    shingles = [token_shingles(text) for text in texts]
    signatures = [minhash_signature(value) for value in shingles]
    bands, rows = 12, 4
    buckets: defaultdict[tuple[int, tuple[int, ...]], list[int]] = defaultdict(list)
    for idx, signature in enumerate(signatures):
        for band in range(bands):
            start = band * rows
            buckets[(band, signature[start : start + rows])].append(idx)

    uf = UnionFind(len(texts))
    compared: set[tuple[int, int]] = set()
    skipped_buckets = 0
    candidate_pairs = 0
    accepted_pairs = 0
    for members in buckets.values():
        if len(members) < 2:
            continue
        if len(members) > max_bucket:
            skipped_buckets += 1
            continue
        for pos, left in enumerate(members):
            for right in members[pos + 1 :]:
                pair = (left, right) if left < right else (right, left)
                if pair in compared:
                    continue
                compared.add(pair)
                candidate_pairs += 1
                union = shingles[left] | shingles[right]
                score = len(shingles[left] & shingles[right]) / len(union) if union else 1.0
                if score >= threshold:
                    uf.union(left, right)
                    accepted_pairs += 1
    roots = [uf.find(i) for i in range(len(texts))]
    root_to_cluster = {root: idx for idx, root in enumerate(sorted(set(roots)))}
    return [root_to_cluster[root] for root in roots], {
        "method": "48-permutation MinHash LSH candidate generation; exact token-trigram Jaccard verification",
        "jaccard_threshold": threshold,
        "candidate_pairs": candidate_pairs,
        "accepted_pairs": accepted_pairs,
        "skipped_oversized_lsh_buckets": skipped_buckets,
        "semantic_embedding_audit_complete": False,
        "promotion_blocker": "Run multilingual embedding clustering in Colab GPU and review cross-cluster candidates before FINAL_LOCKED promotion.",
    }


def choose_partitions(group_sizes: dict[str, int], ratios: tuple[float, ...], seed: int) -> dict[str, str]:
    total = sum(group_sizes.values())
    targets = dict(zip(PARTITIONS, (total * ratio for ratio in ratios)))
    current = {name: 0 for name in PARTITIONS}
    groups = list(group_sizes)
    random.Random(seed).shuffle(groups)
    groups.sort(key=lambda group: group_sizes[group], reverse=True)
    assignment: dict[str, str] = {}
    for group in groups:
        destination = max(PARTITIONS, key=lambda name: (targets[name] - current[name]) / max(1.0, targets[name]))
        assignment[group] = destination
        current[destination] += group_sizes[group]
    return assignment


def write_json(path: Path, value: Any) -> str:
    payload = stable_json(value)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(payload)
    return sha256_bytes(payload)


def main() -> None:
    parser = argparse.ArgumentParser(description="Audit and provisionally freeze a SoterAI dataset.")
    parser.add_argument("--dataset", required=True)
    parser.add_argument("--output-dir", required=True)
    parser.add_argument("--taxonomy-version", default="SOTERAI-ML-TAXONOMY-v1")
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--near-duplicate-threshold", type=float, default=0.82)
    args = parser.parse_args()

    dataset_path = Path(args.dataset)
    output_dir = Path(args.output_dir)
    raw_objects = list(read_jsonl(dataset_path))
    records: list[dict[str, Any]] = []
    invalid_rows = 0
    for line_index, raw in enumerate(raw_objects, start=1):
        rec = normalize_record(raw)
        if rec is None or not rec.text or rec.label not in ML_LABELS:
            invalid_rows += 1
            continue
        exact_hash = sha256_bytes(rec.text.encode("utf-8"))
        normalized_hash = sha256_bytes(canonical_text(rec.text).encode("utf-8"))
        records.append(
            {
                **asdict(rec),
                "line_number": line_index,
                "exact_text_sha256": exact_hash,
                "normalized_text_sha256": normalized_hash,
                "generator": generator_for(rec.source),
                "source_group": source_group_for(rec.source, rec.record_id),
            }
        )

    by_exact: defaultdict[str, list[int]] = defaultdict(list)
    by_normalized: defaultdict[str, list[int]] = defaultdict(list)
    for idx, record in enumerate(records):
        by_exact[record["exact_text_sha256"]].append(idx)
        by_normalized[record["normalized_text_sha256"]].append(idx)

    conflicting_hashes = {
        key: sorted({records[idx]["label"] for idx in members})
        for key, members in by_normalized.items()
        if len({records[idx]["label"] for idx in members}) > 1
    }
    conflict_indices = {idx for key in conflicting_hashes for idx in by_normalized[key]}

    # Keep one representative per normalized text after conflict quarantine.
    retained_indices: list[int] = []
    duplicate_indices: set[int] = set()
    for key, members in sorted(by_normalized.items()):
        if key in conflicting_hashes:
            continue
        retained_indices.append(members[0])
        duplicate_indices.update(members[1:])

    retained = [records[idx] for idx in retained_indices]
    clusters, lexical_details = lexical_clusters([record["text"] for record in retained], args.near_duplicate_threshold)
    for record, cluster in zip(retained, clusters):
        record["lexical_cluster_id"] = f"lex-{cluster:08d}"

    # Connected split groups combine lexical clusters with source groups. A
    # source group is intentionally indivisible, making this conservative.
    source_to_cluster_ids: defaultdict[str, set[str]] = defaultdict(set)
    for record in retained:
        source_to_cluster_ids[record["source_group"]].add(record["lexical_cluster_id"])
    cluster_uf = UnionFind(max(1, len(set(clusters))))
    for cluster_ids in source_to_cluster_ids.values():
        numeric = [int(value.split("-")[-1]) for value in cluster_ids]
        for value in numeric[1:]:
            cluster_uf.union(numeric[0], value)
    for record in retained:
        cluster = int(record["lexical_cluster_id"].split("-")[-1])
        record["split_group"] = f"group-{cluster_uf.find(cluster):08d}"

    group_sizes = Counter(record["split_group"] for record in retained)
    assignments = choose_partitions(dict(group_sizes), DEFAULT_RATIOS, args.seed)
    partition_rows: dict[str, list[dict[str, Any]]] = {name: [] for name in PARTITIONS}
    for record in retained:
        partition = assignments[record["split_group"]]
        partition_rows[partition].append(
            {
                "line_number": record["line_number"],
                "exact_text_sha256": record["exact_text_sha256"],
                "normalized_text_sha256": record["normalized_text_sha256"],
                "label": record["label"],
                "language": record["language"],
                "source": record["source"],
                "source_group": record["source_group"],
                "lexical_cluster_id": record["lexical_cluster_id"],
                "split_group": record["split_group"],
            }
        )

    quarantine_path = output_dir / "conflicting-label-quarantine.jsonl"
    quarantine_path.parent.mkdir(parents=True, exist_ok=True)
    with quarantine_path.open("w", encoding="utf-8") as handle:
        for idx in sorted(conflict_indices):
            record = records[idx]
            handle.write(json.dumps({**record, "text": "<redacted-from-manifest>"}, ensure_ascii=False) + "\n")

    partition_manifest_paths: dict[str, dict[str, Any]] = {}
    for partition, rows in partition_rows.items():
        path = output_dir / f"{partition}.manifest.json"
        digest = write_json(path, rows)
        partition_manifest_paths[partition] = {
            "path": str(path).replace("\\", "/"),
            "sha256": digest,
            "rows": len(rows),
            "labels": dict(sorted(Counter(row["label"] for row in rows).items())),
            "languages": dict(sorted(Counter(row["language"] for row in rows).items())),
            "source_groups": len({row["source_group"] for row in rows}),
        }

    coverage_failures: list[str] = []
    for partition, details in partition_manifest_paths.items():
        if details["rows"] == 0:
            coverage_failures.append(f"{partition}:empty")
        for label in sorted(ML_LABELS):
            if details["labels"].get(label, 0) == 0:
                coverage_failures.append(f"{partition}:missing_label:{label}")
    if partition_manifest_paths["final_untouched_holdout"]["source_groups"] < 5:
        coverage_failures.append("final_untouched_holdout:source_group_count_below_5")

    audit = {
        "schema_version": SCHEMA_VERSION,
        "status": "PROVISIONAL_NOT_INDEPENDENT_NOT_SEMANTICALLY_LOCKED",
        "dataset": str(dataset_path).replace("\\", "/"),
        "dataset_sha256": sha256_file(dataset_path),
        "code_commit": git_commit(),
        "taxonomy_version": args.taxonomy_version,
        "seed": args.seed,
        "input_rows": len(raw_objects),
        "usable_rows": len(records),
        "invalid_rows": invalid_rows,
        "unique_exact_texts": len(by_exact),
        "unique_normalized_texts": len(by_normalized),
        "exact_duplicate_groups": sum(1 for value in by_exact.values() if len(value) > 1),
        "exact_duplicate_affected_rows": sum(len(value) for value in by_exact.values() if len(value) > 1),
        "normalized_duplicate_groups": sum(1 for value in by_normalized.values() if len(value) > 1),
        "normalized_duplicate_affected_rows": sum(len(value) for value in by_normalized.values() if len(value) > 1),
        "conflicting_label_groups": len(conflicting_hashes),
        "conflicting_label_rows": len(conflict_indices),
        "duplicate_rows_removed_after_quarantine": len(duplicate_indices),
        "retained_rows": len(retained),
        "label_distribution": dict(sorted(Counter(record["label"] for record in records).items())),
        "language_distribution": dict(sorted(Counter(record["language"] for record in records).items())),
        "generator_distribution": dict(sorted(Counter(record["generator"] for record in records).items())),
        "synthetic_or_augmented_rows": sum(record["generator"] in SYNTHETIC_GENERATORS for record in records),
        "synthetic_or_augmented_percentage": round(100 * sum(record["generator"] in SYNTHETIC_GENERATORS for record in records) / max(1, len(records)), 4),
        "lexical_near_duplicate_audit": lexical_details,
        "partition_manifests": partition_manifest_paths,
        "coverage_gate": {
            "passed": not coverage_failures,
            "failures": coverage_failures,
            "minimum_label_coverage_per_partition": 1,
            "minimum_final_holdout_source_groups": 5,
        },
        "quarantine": {
            "path": str(quarantine_path).replace("\\", "/"),
            "sha256": sha256_file(quarantine_path),
        },
        "promotion_requirements": [
            "Complete accelerator-based multilingual semantic clustering and human review.",
            "Replace final holdout with independently sourced, native, non-template examples.",
            "Verify licence, privacy, annotation method, and confidence for every retained source.",
            "Freeze benchmark configuration before any final comparison.",
        ],
    }
    audit_path = output_dir / "dataset-forensic-audit.json"
    audit_hash = write_json(audit_path, audit)
    freeze = {
        "schema_version": SCHEMA_VERSION,
        "status": audit["status"],
        "dataset_sha256": audit["dataset_sha256"],
        "audit_path": str(audit_path).replace("\\", "/"),
        "audit_sha256": audit_hash,
        "partition_manifests": partition_manifest_paths,
        "taxonomy_version": args.taxonomy_version,
        "code_commit": audit["code_commit"],
    }
    freeze_path = output_dir / "split-freeze.json"
    freeze_hash = write_json(freeze_path, freeze)
    print(json.dumps({**audit, "audit_sha256": audit_hash, "split_freeze_sha256": freeze_hash}, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()