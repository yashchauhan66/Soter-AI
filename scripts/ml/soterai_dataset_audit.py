#!/usr/bin/env python3
"""Dataset inventory and leakage-audit helpers for SoterAI ML datasets.

This module is intentionally CPU-safe: it parses JSONL metadata, computes exact
duplicate counts, normalizes the two dataset schemas used in this repository,
and emits compact JSON suitable for the transformation report.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import statistics
import unicodedata
from collections import Counter, defaultdict
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any, Iterable


ML_LABELS = {
    "SAFE",
    "PROMPT_INJECTION",
    "JAILBREAK",
    "SYSTEM_PROMPT_LEAK_ATTEMPT",
    "PII",
    "SECRET",
    "UNSAFE_OUTPUT",
    "RAG_POISONING",
    "DATA_EXFILTRATION_ATTEMPT",
}

FAMILY_TO_LABEL = {
    "direct_prompt_injection": "PROMPT_INJECTION",
    "indirect_prompt_injection": "PROMPT_INJECTION",
    "system_prompt_leak": "SYSTEM_PROMPT_LEAK_ATTEMPT",
    "jailbreak_roleplay_bypass": "JAILBREAK",
    "authority_social_engineering": "PROMPT_INJECTION",
    "secret_exfiltration": "SECRET",
    "pii_leakage": "PII",
    "rag_poisoning": "RAG_POISONING",
    "tool_misuse": "DATA_EXFILTRATION_ATTEMPT",
    "agent_goal_hijacking": "PROMPT_INJECTION",
    "memory_poisoning": "PROMPT_INJECTION",
    "multi_agent_injection": "PROMPT_INJECTION",
    "log_substrate_injection": "PROMPT_INJECTION",
    "obfuscation_encoding": "PROMPT_INJECTION",
    "multilingual_attack": "PROMPT_INJECTION",
    "unsafe_output": "UNSAFE_OUTPUT",
    "tenant_isolation": "DATA_EXFILTRATION_ATTEMPT",
    "audit_tampering": "DATA_EXFILTRATION_ATTEMPT",
    "denial_of_wallet": "UNSAFE_OUTPUT",
    "benign_security_education": "SAFE",
    "borderline_hard_negative": "SAFE",
}


@dataclass
class NormalizedRecord:
    text: str
    label: str
    language: str
    source: str
    split: str | None = None
    record_id: str | None = None
    raw_family: str | None = None


def source_family_for(source: str) -> str:
    """Collapse generated variants to a stable provenance family.

    Prefix/suffix, template, and mutation variants from the same generator must
    not be treated as independent sources during train/validation/test splitting.
    """
    normalized = str(source or "<missing>").strip().lower()
    if not normalized:
        return "<missing>"
    for separator in (":", "/", "\\"):
        if separator in normalized:
            head, tail = normalized.split(separator, 1)
            if head in {
                "template",
                "prefix-suffix",
                "mutation",
                "generated",
                "augment",
                "augmentation",
                "parent",
            }:
                return tail or head
    return normalized


@dataclass
class DatasetSummary:
    file: str
    records: int
    bad_json: int
    missing_text: int
    unknown_labels: int
    exact_duplicate_rows: int
    unique_texts: int
    avg_text_len: float
    max_text_len: int
    labels: dict[str, int]
    languages: dict[str, int]
    sources: dict[str, int]
    splits: dict[str, int]
    top_near_duplicate_groups: list[dict[str, Any]]


def read_jsonl(path: Path) -> Iterable[dict[str, Any]]:
    with path.open("r", encoding="utf-8") as handle:
        for line_no, line in enumerate(handle, start=1):
            if not line.strip():
                continue
            try:
                yield json.loads(line)
            except json.JSONDecodeError as exc:
                yield {"__bad_json__": True, "__line_no__": line_no, "__error__": str(exc)}


def normalize_record(obj: dict[str, Any]) -> NormalizedRecord | None:
    if obj.get("__bad_json__"):
        return None

    text = obj.get("text") or obj.get("prompt") or obj.get("attack_prompt") or obj.get("behavior") or ""
    text = str(text)
    family = obj.get("family")
    raw_label = obj.get("label") or obj.get("category")
    if raw_label is None and family is not None:
        raw_label = FAMILY_TO_LABEL.get(str(family), "<unknown>")
    if raw_label is None and obj.get("record_type") in {"benign", "borderline"}:
        raw_label = "SAFE"
    if raw_label is None and obj.get("expected_guard_action") == "allow":
        raw_label = "SAFE"
    if raw_label is None and obj.get("expected_categories"):
        cats = {str(c).lower() for c in obj["expected_categories"]}
        if "rag_poisoning" in cats:
            raw_label = "RAG_POISONING"
        elif "pii" in cats or "privacy_violation" in cats:
            raw_label = "PII"
        elif "secret_exfiltration" in cats or "credential_exfiltration" in cats:
            raw_label = "SECRET"
        elif "system_prompt_leak" in cats:
            raw_label = "SYSTEM_PROMPT_LEAK_ATTEMPT"
        else:
            raw_label = "PROMPT_INJECTION"
    label = str(raw_label or "<missing>").upper()
    if label == "ATTACK":
        label = "PROMPT_INJECTION"

    source = obj.get("source") or obj.get("mutation_type") or obj.get("parent_id") or "<missing>"
    language = obj.get("language") or "<missing>"
    return NormalizedRecord(
        text=text,
        label=label,
        language=str(language),
        source=str(source),
        split=str(obj["split"]) if obj.get("split") is not None else None,
        record_id=str(obj.get("id") or obj.get("variant_id") or obj.get("parent_id") or ""),
        raw_family=str(family) if family is not None else None,
    )


def group_key_for(text: str) -> str:
    normalized = unicodedata.normalize("NFKD", text.lower())
    normalized = "".join(ch for ch in normalized if not unicodedata.combining(ch))
    normalized = normalized.translate(str.maketrans({"0": "o", "1": "i", "3": "e", "4": "a", "5": "s", "7": "t", "@": "a", "$": "s", "!": "i"}))
    tokens = re.findall(r"[a-z]+", normalized)
    return " ".join(sorted(tokens))


def split_group_key_for(text: str, source: str = "<missing>", record_id: str | None = None) -> str:
    """Return a stable group key used to keep related samples in one split."""
    text_key = group_key_for(text)
    source_key = source_family_for(source)
    parent_key = ""
    if record_id:
        parent_key = re.sub(r"(?:[-_:](?:variant|mutation|aug)?\d+)+$", "", record_id.lower())
    material = "\x1f".join((source_key, parent_key, text_key))
    return hashlib.sha256(material.encode("utf-8")).hexdigest()


def summarize_file(path: Path, root: Path) -> DatasetSummary:
    records = 0
    bad_json = 0
    missing_text = 0
    unknown_labels = 0
    labels: Counter[str] = Counter()
    languages: Counter[str] = Counter()
    sources: Counter[str] = Counter()
    splits: Counter[str] = Counter()
    exact_hashes: Counter[str] = Counter()
    near_groups: defaultdict[str, int] = defaultdict(int)
    lengths: list[int] = []

    for obj in read_jsonl(path):
        if obj.get("__bad_json__"):
            bad_json += 1
            continue
        rec = normalize_record(obj)
        if rec is None:
            continue
        records += 1
        if not rec.text:
            missing_text += 1
        if rec.label not in ML_LABELS:
            unknown_labels += 1
        labels[rec.label] += 1
        languages[rec.language] += 1
        sources[rec.source] += 1
        if rec.split:
            splits[rec.split] += 1
        lengths.append(len(rec.text))
        exact_hashes[hashlib.sha256(rec.text.encode("utf-8")).hexdigest()] += 1
        near_groups[group_key_for(rec.text)] += 1

    duplicate_rows = sum(count for count in exact_hashes.values() if count > 1)
    top_near = [
        {"group_size": size, "group_key": key[:160]}
        for key, size in sorted(near_groups.items(), key=lambda item: item[1], reverse=True)
        if key and size > 1
    ][:10]
    rel = str(path.relative_to(root)) if path.is_relative_to(root) else str(path)
    return DatasetSummary(
        file=rel,
        records=records,
        bad_json=bad_json,
        missing_text=missing_text,
        unknown_labels=unknown_labels,
        exact_duplicate_rows=duplicate_rows,
        unique_texts=len(exact_hashes),
        avg_text_len=round(statistics.mean(lengths), 1) if lengths else 0,
        max_text_len=max(lengths) if lengths else 0,
        labels=dict(labels.most_common()),
        languages=dict(languages.most_common()),
        sources=dict(sources.most_common(12)),
        splits=dict(splits.most_common()),
        top_near_duplicate_groups=top_near,
    )


def discover_jsonl(paths: list[Path]) -> list[Path]:
    files: list[Path] = []
    for candidate in paths:
        if candidate.is_file() and candidate.suffix == ".jsonl":
            files.append(candidate)
        elif candidate.is_dir():
            files.extend(sorted(candidate.rglob("*.jsonl")))
    return sorted(set(files))


def main() -> None:
    parser = argparse.ArgumentParser(description="Audit SoterAI JSONL datasets without training.")
    parser.add_argument("paths", nargs="*", default=["datasets"], help="JSONL files or directories to inspect.")
    parser.add_argument("--out", help="Optional JSON output path.")
    args = parser.parse_args()

    root = Path.cwd()
    files = discover_jsonl([Path(p) for p in args.paths])
    summaries = [asdict(summarize_file(path, root)) for path in files]
    payload = {"generated_by": "scripts/ml/soterai_dataset_audit.py", "dataset_count": len(summaries), "datasets": summaries}
    text = json.dumps(payload, indent=2, ensure_ascii=False)
    if args.out:
        Path(args.out).parent.mkdir(parents=True, exist_ok=True)
        Path(args.out).write_text(text + "\n", encoding="utf-8")
    print(text)


if __name__ == "__main__":
    main()
