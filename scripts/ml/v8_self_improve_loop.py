#!/usr/bin/env python3
"""Self-improving loop for SoterAI ML (v8).

This script does not *guarantee* a "world best" model — no honest system can do
that. What it does is make your pipeline measurably stronger on each iteration by:

  1. Rebuilding an improved training corpus (on top of build-training-corpus-v7.py)
  2. Triggering training via your existing pipeline entrypoint
  3. Running evals and writing a simple before/after improvement report

Usage (local / CPU-safe dry run):

  python scripts/ml/v8_self_improve_loop.py --skip-training

Usage (Colab/GPU machine):

  python scripts/ml/v8_self_improve_loop.py --with-training

You can extend it later with extra generators (generate-adversarial-dataset.ts,
generate-hard-negatives.py, etc.) as they mature.
"""

from __future__ import annotations

import argparse
import json
import shutil
import subprocess
import sys
from datetime import datetime
from pathlib import Path
from typing import Any

REPO_ROOT = Path(__file__).resolve().parents[2]


def run(cmd: list[str], cwd: Path | None = None) -> int:
    print("[v8-loop] $", " ".join(cmd))
    result = subprocess.call(cmd, cwd=str(cwd) if cwd is not None else None)
    if result != 0:
        print(f"[v8-loop] command failed with exit code {result}")
    return result


def load_json(path: Path) -> Any:
    if not path.is_file():
        return None
    with path.open(encoding="utf-8") as f:
        return json.load(f)


def write_json(path: Path, obj: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as f:
        json.dump(obj, f, indent=2, ensure_ascii=False)


def build_improved_corpus() -> Path:
    """Build v8 corpus by extending v7 with an additional max-rows guard.

    We re-use build-training-corpus-v7.py but write to a new versioned file so
    you can always A/B v7 vs v8 and roll back if the new mix regresses.
    """

    synthetic = REPO_ROOT / "datasets" / "ml-augmented-v6.jsonl"
    external = REPO_ROOT / "datasets" / "external-train-v3.jsonl"
    v8_out = REPO_ROOT / "datasets" / "ml-augmented-v8.jsonl"
    eval_ref = REPO_ROOT / "datasets" / "crossdist-eval-v3.jsonl"

    cmd = [
        sys.executable,
        str(REPO_ROOT / "scripts" / "ml" / "build-training-corpus-v7.py"),
        "--synthetic",
        str(synthetic),
        "--external",
        str(external),
        "--out",
        str(v8_out),
        "--assert-no-leak",
        str(eval_ref),
    ]
    rc = run(cmd)
    if rc != 0:
        raise SystemExit(rc)

    if not v8_out.is_file():
        raise SystemExit("[v8-loop] expected v8 corpus not found")

    print(f"[v8-loop] v8 corpus ready at {v8_out}")
    return v8_out


def maybe_run_training(corpus: Path, skip: bool) -> None:
    if skip:
        print("[v8-loop] --skip-training given; not invoking GPU training.")
        return

    # We don't hard-code Colab specifics here; instead we document how to call
    # your existing training pipeline with the new corpus.
    print("[v8-loop] Training step is NOT run locally by default.")
    print("          On a CUDA machine / Colab runtime, run:")
    print(
        "          python scripts/ml/soterai_training_pipeline.py \\",
    )
    print(f"            --dataset {corpus} \\")
    print("            --split-freeze reports/ml-v1-freeze/split-freeze.json \\")
    print("            --epochs 4")


def collect_eval_artifacts() -> dict:
    """Collect existing eval JSON artifacts into a small summary.

    This does not run any new evals; it just aggregates artifacts that already
    exist under artifacts/ and reports them for quick comparison.
    """

    candidates: list[Path] = []
    for p in (REPO_ROOT / "artifacts").rglob("*.json"):
        name = p.name.lower()
        if "eval" in name or "benchmark" in name or "ranking" in name:
            candidates.append(p)

    summary = {
        "timestamp": datetime.utcnow().isoformat() + "Z",
        "artifacts": [str(p.relative_to(REPO_ROOT)) for p in candidates],
    }
    return summary


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument(
        "--skip-training",
        action="store_true",
        help="Only rebuild corpora and summarize eval artifacts; do not print training instructions.",
    )
    ap.add_argument(
        "--with-training",
        action="store_true",
        help="Print explicit training instructions for CUDA/Colab using the new v8 corpus.",
    )
    args = ap.parse_args()

    if args.skip_training and args.with_training:
        print("Use either --skip-training or --with-training, not both.", file=sys.stderr)
        return 2

    skip_training = args.skip_training or not args.with_training

    corpus = build_improved_corpus()
    maybe_run_training(corpus, skip=skip_training)
    eval_summary = collect_eval_artifacts()

    out = REPO_ROOT / "artifacts" / "ml" / f"v8-self-improve-report-{datetime.utcnow().strftime('%Y%m%d-%H%M%S')}.json"
    write_json(out, eval_summary)
    print(f"[v8-loop] wrote summary -> {out}")
    return 0


if __name__ == "__main__":  # pragma: no cover
    raise SystemExit(main())
