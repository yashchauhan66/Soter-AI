"""Import public third-party benchmark datasets into datasets/external/*.jsonl.

Sources expected on disk:
  - JailbreakBench HF dataset clone:
      tmp/hf-jbb-behaviors-*/data/harmful-behaviors.csv
      tmp/hf-jbb-behaviors-*/data/benign-behaviors.csv
  - HarmBench GitHub clone:
      tmp/harmbench-*/data/behavior_datasets/harmbench_behaviors_text_all.csv

The output schema matches lib/benchmarks/externalDatasets.ts.
"""

from __future__ import annotations

import csv
import json
from pathlib import Path


ROOT = Path.cwd()
TMP = ROOT / "tmp"
OUT = ROOT / "datasets" / "external"


def latest_dir(pattern: str) -> Path:
    matches = sorted(TMP.glob(pattern), key=lambda p: p.stat().st_mtime, reverse=True)
    if not matches:
        raise FileNotFoundError(f"No directory matching tmp/{pattern}")
    return matches[0]


def write_jsonl(path: Path, rows: list[dict[str, str]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8", newline="\n") as handle:
        for row in rows:
            handle.write(json.dumps(row, ensure_ascii=False) + "\n")


def import_jailbreakbench() -> int:
    source_dir = latest_dir("hf-jbb-behaviors-*")
    rows: list[dict[str, str]] = []
    for split, label in [("harmful", "ATTACK"), ("benign", "SAFE")]:
        csv_path = source_dir / "data" / f"{split}-behaviors.csv"
        with csv_path.open("r", encoding="utf-8-sig", newline="") as handle:
            reader = csv.DictReader(handle)
            for row in reader:
                goal = (row.get("Goal") or "").strip()
                if not goal:
                    continue
                rows.append(
                    {
                        "id": f"jbb-{split}-{row.get('Index', len(rows))}",
                        "text": goal,
                        "label": label,
                        "category": row.get("Category", "unknown"),
                        "language": "en",
                    }
                )
    write_jsonl(OUT / "jailbreakbench.jsonl", rows)
    return len(rows)


def import_harmbench() -> int:
    source_dir = latest_dir("harmbench-*")
    csv_path = source_dir / "data" / "behavior_datasets" / "harmbench_behaviors_text_all.csv"
    rows: list[dict[str, str]] = []
    with csv_path.open("r", encoding="utf-8-sig", newline="") as handle:
        reader = csv.DictReader(handle)
        for index, row in enumerate(reader):
            behavior = (row.get("Behavior") or "").strip()
            if not behavior:
                continue
            rows.append(
                {
                    "id": row.get("BehaviorID") or f"harmbench-{index}",
                    "text": behavior,
                    "label": "ATTACK",
                    "category": row.get("SemanticCategory") or row.get("FunctionalCategory") or "unknown",
                    "language": "en",
                }
            )
    write_jsonl(OUT / "harmbench.jsonl", rows)
    return len(rows)


def main() -> None:
    jbb_count = import_jailbreakbench()
    hb_count = import_harmbench()
    print(f"Wrote datasets/external/jailbreakbench.jsonl ({jbb_count} rows)")
    print(f"Wrote datasets/external/harmbench.jsonl ({hb_count} rows)")


if __name__ == "__main__":
    main()
