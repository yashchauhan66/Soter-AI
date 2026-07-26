#!/usr/bin/env python3
"""Robust Colab launcher for SoterAI classifier training.

Runs a strong preset first, saves complete logs to Drive, and retries with
safer memory presets when the first attempt exits non-zero.
"""

from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
import time
from pathlib import Path


def tail(text: str, max_lines: int = 120) -> str:
    lines = text.splitlines()
    return "\n".join(lines[-max_lines:])


def run_attempt(name: str, cmd: list[str], log_dir: Path) -> int:
    log_dir.mkdir(parents=True, exist_ok=True)
    log_path = log_dir / f"{int(time.time())}-{name}.log"
    print(f"\n=== SoterAI training attempt: {name} ===")
    print("command:", " ".join(cmd))
    print("log:", log_path)
    proc = subprocess.run(cmd, text=True, stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
    log_path.write_text(proc.stdout, encoding="utf-8")
    print(tail(proc.stdout))
    print(f"exit_code: {proc.returncode}")
    return proc.returncode


def print_environment(dataset: str, output_root: str) -> None:
    payload = {
        "python": sys.version,
        "cwd": os.getcwd(),
        "dataset_exists": Path(dataset).exists(),
        "dataset_bytes": Path(dataset).stat().st_size if Path(dataset).exists() else None,
        "output_root": output_root,
    }
    try:
        import google.protobuf
        import numpy
        import sklearn
        import torch
        import transformers

        payload.update(
            {
                "torch": torch.__version__,
                "cuda": torch.cuda.is_available(),
                "cuda_device": torch.cuda.get_device_name(0) if torch.cuda.is_available() else None,
                "transformers": transformers.__version__,
                "protobuf": google.protobuf.__version__,
                "sklearn": sklearn.__version__,
                "numpy": numpy.__version__,
            }
        )
    except Exception as exc:
        payload["environment_import_error"] = repr(exc)
    print(json.dumps({"runner_environment": payload}, indent=2))


def require_cuda_runtime() -> None:
    """Reject local/CPU launches before starting retry attempts."""
    try:
        import torch
    except ImportError as exc:
        raise SystemExit("PyTorch is unavailable. Use the Colab training notebook and install the Colab requirements.") from exc
    if not torch.cuda.is_available():
        raise SystemExit(
            "CUDA GPU is required. Training is intentionally Colab-GPU-only; CPU and TPU retries are disabled. "
            "In Colab select Runtime > Change runtime type > T4 GPU (or another CUDA GPU)."
        )


def main() -> None:
    parser = argparse.ArgumentParser(description="Run SoterAI Colab training with safe retries.")
    parser.add_argument("--dataset", required=True)
    parser.add_argument("--split-freeze", required=True)
    parser.add_argument("--output-root", required=True)
    parser.add_argument("--seed", default="42")
    args = parser.parse_args()

    output_root = Path(args.output_root)
    log_dir = output_root / "_training-logs"
    require_cuda_runtime()
    print_environment(args.dataset, args.output_root)
    script = "scripts/ml/soterai_training_pipeline.py"
    common = [
        sys.executable,
        "-u",
        script,
        "--dataset",
        args.dataset,
        "--split-freeze",
        args.split_freeze,
        "--output-root",
        args.output_root,
        "--learning-rate",
        "2e-5",
        "--seed",
        str(args.seed),
    ]

    attempts = [
        [
            "deberta-v3-base-t4-safe",
            common
            + [
                "--base-model",
                "microsoft/deberta-v3-base",
                "--epochs",
                "4",
                "--batch-size",
                "8",
                "--gradient-accumulation-steps",
                "8",
                "--max-length",
                "256",
            ],
        ],
        [
            "deberta-v3-base-low-memory",
            common
            + [
                "--base-model",
                "microsoft/deberta-v3-base",
                "--epochs",
                "4",
                "--batch-size",
                "4",
                "--gradient-accumulation-steps",
                "16",
                "--max-length",
                "192",
            ],
        ],
        [
            "minilm-fast-fallback",
            common
            + [
                "--base-model",
                "sentence-transformers/all-MiniLM-L6-v2",
                "--epochs",
                "5",
                "--batch-size",
                "32",
                "--gradient-accumulation-steps",
                "2",
                "--max-length",
                "192",
            ],
        ],
        [
            "bert-tiny-guaranteed-fallback",
            common
            + [
                "--base-model",
                "prajjwal1/bert-tiny",
                "--epochs",
                "4",
                "--batch-size",
                "64",
                "--gradient-accumulation-steps",
                "1",
                "--max-length",
                "128",
            ],
        ],
    ]

    for name, cmd in attempts:
        rc = run_attempt(name, cmd, log_dir)
        if rc == 0:
            print(f"\nSUCCESS: {name}")
            return

    raise SystemExit(f"All training attempts failed. Check logs in {log_dir}")


if __name__ == "__main__":
    main()
