#!/usr/bin/env python3
"""Prepare auditable v18 data without manufacturing examples from evaluation rows.

JSONL is split on LF, not ``str.splitlines``: U+2028 inside a JSON string is
valid text and must not be mistaken for a record boundary.
"""
from __future__ import annotations

import argparse
import collections
from functools import lru_cache
import hashlib
import json
import math
from pathlib import Path
import random
import sys

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(Path(__file__).resolve().parent))
from soter_augment import group_key_for

LABELS = (
    "SAFE", "PROMPT_INJECTION", "JAILBREAK", "SYSTEM_PROMPT_LEAK_ATTEMPT",
    "PII", "SECRET", "UNSAFE_OUTPUT", "RAG_POISONING",
    "DATA_EXFILTRATION_ATTEMPT", "TOOL_CALL_ABUSE", "ENCODING_OBFUSCATION",
    "MULTI_TURN_ESCALATION", "MODEL_EXTRACTION", "TOXICITY_HARASSMENT",
)
PRIORITY_LANGUAGES = (
    "en", "hi", "hinglish", "es", "pt", "fr", "de", "ar", "zh", "ja",
    "ko", "ru", "id", "bn", "ta", "te", "tr", "vi",
)
DEFAULT_HOLDOUTS = (
    "datasets/crossdist-eval-v3-complement.jsonl",
    "datasets/external-real-v1.jsonl", "datasets/external-real-v2.jsonl",
    "datasets/external-real-v3.jsonl", "datasets/v15-test-battery.jsonl",
    "datasets/v16-probe-battery.jsonl", "datasets/v17-multilingual-battery.jsonl",
)
EXTRA_HOLDOUTS = ("datasets/crossdist-eval-v3.jsonl",)
LINEAGE_FIELDS = (
    "template_id", "template_family", "family_id", "family", "translation_group",
    "translation_group_id", "canonical_id", "original_id", "parent_id", "base_id",
    "seed_id", "variant_of",
)


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


@lru_cache(maxsize=512)
def relative(path: Path) -> str:
    try:
        return path.resolve().relative_to(ROOT).as_posix()
    except ValueError:
        return str(path.resolve())


def read_rows(path: Path) -> list[dict]:
    rows = []
    with path.open(encoding="utf-8-sig") as stream:
        for number, line in enumerate(stream, 1):
            if not line.strip():
                continue
            try:
                row = json.loads(line, parse_constant=reject_json_constant,
                                 object_pairs_hook=unique_json_object)
            except (ValueError, TypeError) as exc:
                raise ValueError(f"{path}:{number}: invalid JSON: {exc}") from exc
            if not isinstance(row, dict):
                raise ValueError(f"{path}:{number}: expected a JSON object")
            if not isinstance(row.get("text"), str) or not row["text"].strip():
                raise ValueError(f"{path}:{number}: text must be a nonempty string")
            if row.get("label") not in LABELS:
                raise ValueError(f"{path}:{number}: missing or unknown label {row.get('label')!r}")
            if "language" in row and (not isinstance(row["language"], str) or not row["language"].strip()):
                raise ValueError(f"{path}:{number}: language must be a nonempty string when supplied")
            if "_v18" in row:
                raise ValueError(f"{path}:{number}: reserved _v18 provenance field already present")
            row["_v18"] = {"source_file": relative(path), "source_line": number}
            rows.append(row)
    return rows


def reject_json_constant(value: str):
    raise ValueError(f"non-JSON numeric constant {value}")


def unique_json_object(pairs):
    result = {}
    for key, value in pairs:
        if key in result:
            raise ValueError(f"duplicate JSON key {key!r}")
        result[key] = value
    return result


def language(row: dict) -> str:
    # Missing annotations remain unknown. Guessing English would overstate coverage.
    value = row.get("language", "unknown").lower().replace("_", "-")
    return value.split("-")[0]


def write_jsonl(path: Path, rows: list[dict]) -> str:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8", newline="\n") as stream:
        for row in rows:
            stream.write(json.dumps(row, ensure_ascii=False, separators=(",", ":")) + "\n")
    return sha256_file(path)


def coverage(rows: list[dict]) -> dict:
    by_language = collections.defaultdict(collections.Counter)
    for row in rows:
        by_language[language(row)][row["label"]] += 1
    return {
        "rows": len(rows),
        "labels": dict(collections.Counter(r["label"] for r in rows)),
        "languages": {lang: dict(counts) for lang, counts in sorted(by_language.items())},
        "priority_language_gaps": {
            lang: {"rows": sum(by_language[lang].values()), "benign": by_language[lang]["SAFE"],
                   "missing_labels": [label for label in LABELS if not by_language[lang][label]]}
            for lang in PRIORITY_LANGUAGES
        },
        "language_annotation_note": "Missing language metadata is unknown; counts are annotations, not verified proficiency.",
    }


def diverse_sample(rows: list[dict], count: int, seed: int,
                   label_limits: dict[str, int] | None = None) -> list[dict]:
    """Round-robin labels, then language/source strata within each label.

    Hierarchical rotation prevents a label with many translated source buckets
    from receiving more weight merely because it has more buckets. Limits are
    hard caps: a scarce pool returns fewer rows instead of silently relaxing them.
    """
    if count <= 0:
        return []
    rng = random.Random(seed)
    buckets = collections.defaultdict(lambda: collections.defaultdict(list))
    for row in rows:
        source = row.get("source")
        source_key = source if isinstance(source, str) else "unknown"
        key = (language(row), source_key, row["_v18"]["source_file"])
        buckets[row["label"]][key].append(row)
    labels = sorted(buckets)
    rotations = {}
    for label in labels:
        rotations[label] = collections.deque(sorted(buckets[label]))
        for key in rotations[label]:
            rng.shuffle(buckets[label][key])
    result = []
    selected_counts = collections.Counter()
    while len(result) < count:
        progressed = False
        for label in labels:
            if label_limits is not None and selected_counts[label] >= label_limits.get(label, count):
                continue
            rotation = rotations[label]
            if not rotation:
                continue
            key = rotation.popleft()
            result.append(buckets[label][key].pop())
            selected_counts[label] += 1
            if buckets[label][key]:
                rotation.append(key)
            progressed = True
            if len(result) == count:
                break
        if not progressed:
            break
    return result


def balanced_comparison_sample(pool: list[dict], per_class: int, seed: int) -> tuple[list[dict], dict]:
    """Reserve half of each binary class for English and half for non-English.

    Annotated non-English is sampled first because its non-PII attack pool is
    scarce. English then uses the remaining shared PII allowance. Unfilled
    language quotas are filled from any remaining explicit language bucket,
    including unknown, without exceeding the total class size or PII cap.
    """
    selected = []
    audit = {}
    pii_cap = int(per_class * .35)
    for class_index, benign in enumerate((False, True)):
        candidates = [r for r in pool if (r["label"] == "SAFE") == benign]
        english = [r for r in candidates if language(r) == "en"]
        non_english = [r for r in candidates if language(r) not in ("en", "unknown")]
        unknown = [r for r in candidates if language(r) == "unknown"]
        english_target = per_class // 2
        non_english_target = per_class - english_target
        chosen = diverse_sample(non_english, non_english_target, seed + 10 * class_index,
                                None if benign else {"PII": pii_cap})
        pii_used = sum(r["label"] == "PII" for r in chosen)
        chosen += diverse_sample(english, english_target, seed + 10 * class_index + 1,
                                 None if benign else {"PII": max(0, pii_cap - pii_used)})
        selected_ids = {id(row) for row in chosen}
        remaining = [r for r in candidates if id(r) not in selected_ids]
        pii_used = sum(r["label"] == "PII" for r in chosen)
        chosen += diverse_sample(remaining, per_class - len(chosen), seed + 10 * class_index + 2,
                                 None if benign else {"PII": max(0, pii_cap - pii_used)})
        chosen_languages = collections.Counter(
            "english" if language(r) == "en" else "unknown" if language(r) == "unknown" else "non_english"
            for r in chosen
        )
        audit["benign" if benign else "attacks"] = {
            "available": {"english": len(english), "non_english": len(non_english), "unknown": len(unknown)},
            "target": {"total": per_class, "english": english_target, "non_english": non_english_target},
            "selected": {"total": len(chosen), **dict(chosen_languages)},
            "total_shortfall": per_class - len(chosen),
            "english_quota_shortfall": max(0, english_target - chosen_languages["english"]),
            "non_english_quota_shortfall": max(0, non_english_target - chosen_languages["non_english"]),
        }
        if not benign:
            audit["attacks"]["pii_cap_rows"] = pii_cap
            audit["attacks"]["selected_pii_rows"] = sum(r["label"] == "PII" for r in chosen)
            audit["attacks"]["selected_pii_fraction"] = (
                audit["attacks"]["selected_pii_rows"] / len(chosen) if chosen else None
            )
            audit["attacks"]["pii_cap_note"] = "Cap is35% of target attack rows; selected share can exceed35% when the pool cannot fill the quota."
        selected.extend(chosen)
    return selected, audit


def prepare_comparison(train_paths: list[Path], holdout_paths: list[Path], output: Path,
                       per_class: int = 2000, seed: int = 20260918,
                       exclude_paths: list[Path] | None = None) -> dict:
    train_groups = set()
    inputs = []
    for path in train_paths:
        rows = read_rows(path)
        train_groups.update(group_key_for(r["text"]) for r in rows)
        inputs.append({"path": relative(path), "rows": len(rows), "sha256": sha256_file(path)})
        print(f"Indexed training {relative(path)}: {len(rows)}", flush=True)
    # Groups already spent on a previous battery. Drawing a second sample from the
    # same pool with a new seed would otherwise re-draw some of the same rows, and
    # a confirmation set that shares rows with the set a choice was made on cannot
    # confirm anything.
    excluded_groups, exclusions = set(), []
    for path in exclude_paths or []:
        # Deliberately not read_rows(): a previously emitted battery already carries
        # the reserved provenance field that reader rejects, and only the text is
        # needed to compute the groups being withheld.
        texts = [json.loads(line)["text"] for line in path.read_text(encoding="utf-8").splitlines() if line.strip()]
        excluded_groups.update(group_key_for(text) for text in texts)
        exclusions.append({"path": relative(path), "rows": len(texts), "sha256": sha256_file(path)})
        print(f"Excluding prior battery {relative(path)}: {len(texts)}", flush=True)
    pool = []
    audit = []
    seen = {}
    conflicts = set()
    prior_battery_overlap = 0
    for path in holdout_paths:
        rows = read_rows(path)
        overlap = 0
        excluded = 0
        for row in rows:
            key = group_key_for(row["text"])
            if key in train_groups:
                overlap += 1
                continue
            if key in excluded_groups:
                excluded += 1
                prior_battery_overlap += 1
                continue
            exact = row["text"].strip()
            if exact in seen:
                if seen[exact]["label"] != row["label"]:
                    conflicts.add(exact)
                continue
            seen[exact] = row
            pool.append(row)
        audit.append({"path": relative(path), "rows": len(rows), "training_group_overlap": overlap,
                      "prior_battery_group_overlap": excluded, "sha256": sha256_file(path)})
        print(f"Audited heldout {relative(path)}: {len(rows)}, overlap {overlap}, "
              f"prior-battery {excluded}", flush=True)
    pool = [row for row in pool if row["text"].strip() not in conflicts]
    selected, selection_audit = balanced_comparison_sample(pool, per_class, seed)
    digest = write_jsonl(output, selected)
    report = {
        "schema_version": 1, "purpose": "shared heldout model comparison; never train or calibrate on these rows",
        "seed": seed, "target_rows_per_binary_class": per_class,
        "selection_policy": "fixed binary-class quotas; half English/half annotated non-English where available; label then language/source round-robin; PII capped at35% of target attack rows; shortages filled from remaining languages with unknown explicit",
        "selection_audit": selection_audit,
        "output": relative(output), "dataset_sha256": digest,
        "train_inputs": inputs, "holdout_audit": audit, "pool_coverage": coverage(pool),
        "selected_coverage": coverage(selected), "conflicting_exact_texts_quarantined": len(conflicts),
        "training_group_overlap_after_filter": sum(group_key_for(r["text"]) in train_groups for r in selected),
        "excluded_batteries": exclusions,
        "prior_battery_rows_removed_from_pool": prior_battery_overlap,
        "prior_battery_group_overlap_after_filter": sum(group_key_for(r["text"]) in excluded_groups for r in selected),
        "limitations": ["Normalized lexical groups do not establish semantic, template or translation independence.",
                        "Existing heldouts have been inspected previously and are not an untouched future release test.",
                        "Source/language-balanced sampling changes prevalence; report recall and FPR separately."],
    }
    report_path = output.with_suffix(".meta.json")
    report_path.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return report


class DisjointSet:
    def __init__(self):
        self.parent = []
        self.size = []

    def add(self):
        value = len(self.parent)
        self.parent.append(value)
        self.size.append(1)
        return value

    def find(self, item):
        while self.parent[item] != item:
            self.parent[item] = self.parent[self.parent[item]]
            item = self.parent[item]
        return item

    def union(self, first, second):
        first, second = self.find(first), self.find(second)
        if first == second:
            return
        if self.size[first] < self.size[second]:
            first, second = second, first
        self.parent[second] = first
        self.size[first] += self.size[second]


@lru_cache(maxsize=32768)
def lexical_token(text: str) -> str:
    return "text:" + hashlib.sha256(group_key_for(text).encode("utf-8")).hexdigest()


def lineage_tokens(row: dict) -> set[str]:
    """Link declared lineage, never every row from a source or attack category.

    Identifiers are scoped to the declared corpus/dataset/source. With no such
    declaration, the input filename scopes identifiers; it is not reported as an
    inferred semantic source. Explicit parent IDs link to row IDs in that scope.
    """
    scope = next((str(row[k]) for k in ("corpus_id", "dataset_id", "source")
                  if isinstance(row.get(k), (str, int)) and str(row[k]).strip()),
                 row["_v18"]["source_file"])
    tokens = {lexical_token(row["text"])}
    containers = [row] + [row[key] for key in ("metadata", "provenance", "augmentation")
                          if isinstance(row.get(key), dict)]
    for container in containers:
        for field in LINEAGE_FIELDS:
            value = container.get(field)
            if not isinstance(value, (str, int)) or isinstance(value, bool) or not str(value).strip():
                continue
            # A taxonomy label alone is not a template family identifier.
            if field in ("family", "family_id") and str(value).upper() in LABELS:
                continue
            kind = "id" if field in ("parent_id", "original_id", "variant_of") else field
            tokens.add(f"lineage:{scope}:{kind}:{value}")
        if isinstance(container.get("id"), (str, int)) and not isinstance(container.get("id"), bool):
            tokens.add(f"lineage:{scope}:id:{container['id']}")
        for field in ("parent_text", "original_text", "canonical_text"):
            if isinstance(container.get(field), str) and container[field].strip():
                tokens.add(lexical_token(container[field]))
    return tokens


def group_partition(groups: dict[str, list[int]], seed: int) -> dict[str, list[int]]:
    """Stable group assignment; never split a component to force row percentages."""
    indices = {name: [] for name in ("train", "calibration", "validation", "test")}
    for key in sorted(groups):
        value = int(hashlib.sha256(f"{seed}:{key}".encode()).hexdigest()[:16], 16) / 2**64
        split = "test" if value < .10 else "validation" if value < .22 else "calibration" if value < .30 else "train"
        indices[split].extend(groups[key])
    for values in indices.values():
        values.sort()
    if any(not values for values in indices.values()):
        raise ValueError("Too few independent groups for four nonempty partitions; supply more data, do not split related rows")
    return indices


def prepare_training(train_paths: list[Path], holdout_paths: list[Path], corpus_path: Path,
                     split_path: Path, report_path: Path, sampling_path: Path,
                     seed: int = 20260918) -> dict:
    records = []
    nodes = []
    token_owner = {}
    dsu = DisjointSet()
    input_manifest = []
    text_labels = collections.defaultdict(set)
    text_nodes = collections.defaultdict(list)
    metadata_fields = collections.Counter()
    train_count = 0
    holdout_node_sources = []
    for is_holdout, paths in ((False, train_paths), (True, holdout_paths)):
        for path in paths:
            rows = read_rows(path)
            input_manifest.append({"path": relative(path), "rows": len(rows), "sha256": sha256_file(path),
                                   "role": "external_holdout" if is_holdout else "training_candidate"})
            for row in rows:
                node = dsu.add()
                tokens = lineage_tokens(row)
                for token in tokens:
                    if token in token_owner:
                        dsu.union(node, token_owner[token])
                    else:
                        token_owner[token] = node
                if is_holdout:
                    holdout_node_sources.append((node, relative(path)))
                else:
                    records.append(row)
                    nodes.append(node)
                    lexical = lexical_token(row["text"])
                    text_labels[lexical].add(row["label"])
                    text_nodes[lexical].append(node)
                    metadata_fields.update(k for k in LINEAGE_FIELDS if k in row)
                    train_count += 1
            print(f"Grouped {'holdout' if is_holdout else 'training'} {relative(path)}: {len(rows)}", flush=True)
    holdout_components = {dsu.find(node) for node, _ in holdout_node_sources}
    training_components = {dsu.find(node) for node in nodes}
    holdout_overlap_by_file = collections.Counter(
        source for node, source in holdout_node_sources if dsu.find(node) in training_components
    )
    conflict_keys = {key for key, labels in text_labels.items() if len(labels) > 1}
    conflict_components = {dsu.find(node) for key in conflict_keys for node in text_nodes[key]}
    excluded = holdout_components | conflict_components
    component_tokens = collections.defaultdict(list)
    for token, node in token_owner.items():
        component_tokens[dsu.find(node)].append(token)
    component_ids = {root: hashlib.sha256("\n".join(sorted(tokens)).encode("utf-8")).hexdigest()
                     for root, tokens in component_tokens.items() if root not in excluded}
    clean = []
    groups = collections.defaultdict(list)
    removed = collections.Counter()
    exact_seen = {}
    for row, node in zip(records, nodes):
        root = dsu.find(node)
        if root in excluded:
            removed["external_holdout_lineage" if root in holdout_components else "conflicting_labels"] += 1
            continue
        text = row["text"].strip()
        exact_key = (text, row["label"])
        if exact_key in exact_seen:
            representative = clean[exact_seen[exact_key]]
            representative["_v18"].setdefault("duplicate_records", []).append({k: v for k, v in row.items() if k != "text"})
            removed["exact_same_label_duplicate"] += 1
            continue
        key = component_ids[root]
        row["_v18"]["lineage_group_sha256"] = key
        exact_seen[exact_key] = len(clean)
        groups[key].append(len(clean))
        clean.append(row)
    indices = group_partition(groups, seed)
    dataset_sha = write_jsonl(corpus_path, clean)
    split_payload = json.dumps(indices, separators=(",", ":"), sort_keys=True).encode("utf-8")
    split_manifest = {
        "schema_version": 1, "product_version": "v18", "seed": seed,
        "method": "declared_lineage_and_normalized_text_connected_components_sha256_assignment",
        "dataset": relative(corpus_path), "dataset_sha256": dataset_sha,
        "rows_total": len(clean), "groups_total": len(groups),
        "target_fractions": {"train": .70, "calibration": .08, "validation": .12, "test": .10},
        "counts": {key: len(values) for key, values in indices.items()},
        "sha256": hashlib.sha256(split_payload).hexdigest(), "indices": indices,
        "input_manifest": input_manifest,
        "test_policy": "Internal heldout diagnostic only; teacher has seen earlier corpus splits. Never use for epoch selection/calibration. External release evaluation remains separate.",
    }
    split_path.parent.mkdir(parents=True, exist_ok=True)
    split_path.write_text(json.dumps(split_manifest, indent=2) + "\n", encoding="utf-8")
    train_groups = {clean[i]["_v18"]["lineage_group_sha256"] for i in indices["train"]}
    language_groups = collections.defaultdict(set)
    for i in indices["train"]:
        language_groups[language(clean[i])].add(clean[i]["_v18"]["lineage_group_sha256"])
    max_language_groups = max(map(len, language_groups.values()))
    weights = []
    for i in indices["train"]:
        lang = language(clean[i])
        multiplier = 1.0 if lang == "unknown" else min(4.0, math.sqrt(max_language_groups / len(language_groups[lang])))
        weights.append(multiplier / len(groups[clean[i]["_v18"]["lineage_group_sha256"]]))
    mean = sum(weights) / len(weights)
    sampling = {
        "schema_version": 1, "dataset_sha256": dataset_sha, "split_sha256": split_manifest["sha256"],
        "enabled_by_default": False, "train_indices": indices["train"],
        "weights": [round(value / mean, 8) for value in weights],
        "policy": "inverse lineage-group size times sqrt language-group imbalance capped at4; unknown language is never boosted",
        "warning": "Optional experiment only; not applied by the trainer automatically. Do not oversample validation/calibration/test or count translations as independent attacks.",
        "language_independent_group_counts": {lang: len(keys) for lang, keys in sorted(language_groups.items())},
    }
    sampling_path.write_text(json.dumps(sampling, separators=(",", ":")) + "\n", encoding="utf-8")
    split_groups = {name: {clean[i]["_v18"]["lineage_group_sha256"] for i in values}
                    for name, values in indices.items()}
    intersections = {f"{first}/{second}": len(split_groups[first] & split_groups[second])
                     for first in indices for second in indices if first < second}
    report = {
        "schema_version": 1, "product_version": "v18", "corpus": relative(corpus_path),
        "dataset_sha256": dataset_sha, "split_manifest": relative(split_path),
        "training_input_rows": train_count, "clean_rows": len(clean), "removed_rows": dict(removed),
        "conflicting_normalized_text_groups": len(conflict_keys),
        "lineage_fields_observed": dict(metadata_fields), "lineage_fields_used": list(LINEAGE_FIELDS),
        "source_and_category_alone_group_rows": False,
        "external_holdout_rows_linked_to_training_by_file": dict(holdout_overlap_by_file),
        "external_holdout_lineage_overlap_after_filter": 0,
        "split_group_intersections": intersections, "independent_groups": len(groups),
        "largest_group_rows": max(map(len, groups.values())),
        "coverage": coverage(clean),
        "splits": {name: coverage([clean[i] for i in values]) for name, values in indices.items()},
        "missing_metadata": {field: sum(not row.get(field) for row in clean)
                             for field in ("language", "source", "family", "provenance")},
        "input_manifest": input_manifest, "optional_training_sampling": relative(sampling_path),
        "limitations": [
            "The existing corpus has sparse explicit template/translation identifiers; semantic siblings without lineage metadata may remain in different groups.",
            "Source and broad attack category are deliberately not treated as a single template; missing family/source remains unknown.",
            "The teacher was previously trained on parts of this corpus; internal student test is not evidence of teacher-independent generalization.",
            "Existing external holdouts have been inspected in prior development; fresh source/family-disjoint release tests are still required.",
            "Removing overlap cannot undo what an existing pretrained/fine-tuned teacher already saw.",
            "Language labels and author provenance are preserved, not independently reviewed; missing labels do not imply English.",
        ],
    }
    report_path.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return report


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--manifest", type=Path, default=ROOT / "models/ml-classifier-v17/dataset_manifest.json")
    parser.add_argument("--comparison-only", action="store_true")
    parser.add_argument("--training-only", action="store_true")
    parser.add_argument("--comparison-output", type=Path, default=ROOT / "artifacts/ml/v18-balanced-comparison-rows.jsonl")
    parser.add_argument("--per-class", type=int, default=2000)
    parser.add_argument("--seed", type=int, default=20260918)
    parser.add_argument("--corpus-output", type=Path, default=ROOT / "datasets/ml-v18-clean-corpus.jsonl")
    parser.add_argument("--split-output", type=Path, default=ROOT / "artifacts/ml/v18-split-indices.json")
    parser.add_argument("--report-output", type=Path, default=ROOT / "artifacts/ml/v18-data-report.json")
    parser.add_argument("--sampling-output", type=Path, default=ROOT / "artifacts/ml/v18-training-sampling.json")
    parser.add_argument("--exclude-rows", type=Path, action="append", default=[],
                        help="Battery JSONL whose groups must not be re-drawn; repeatable. "
                             "Use to build a confirmation set disjoint from an earlier one.")
    args = parser.parse_args()
    if args.per_class < 1:
        parser.error("--per-class must be positive")
    if args.comparison_only and args.training_only:
        parser.error("--comparison-only and --training-only are mutually exclusive")
    manifest = json.loads(args.manifest.read_text(encoding="utf-8"))
    train_paths = [ROOT / name for name in manifest["datasets"]]
    if not args.training_only:
        report = prepare_comparison(train_paths, [ROOT / name for name in DEFAULT_HOLDOUTS],
                                    args.comparison_output, args.per_class, args.seed,
                                    args.exclude_rows)
        print(json.dumps({"output": report["output"], "sha256": report["dataset_sha256"],
                          "rows": report["selected_coverage"]["rows"],
                          "labels": report["selected_coverage"]["labels"]}), flush=True)
    if not args.comparison_only:
        report = prepare_training(train_paths, [ROOT / name for name in DEFAULT_HOLDOUTS + EXTRA_HOLDOUTS],
                                  args.corpus_output, args.split_output, args.report_output,
                                  args.sampling_output, args.seed)
        print(json.dumps({"training_rows": report["clean_rows"], "independent_groups": report["independent_groups"],
                          "removed_rows": report["removed_rows"]}), flush=True)


if __name__ == "__main__":
    main()
