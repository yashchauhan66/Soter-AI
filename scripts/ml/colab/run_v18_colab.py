#!/usr/bin/env python3
"""Validate the prepared bundle, then run the compact multilingual student trainer."""
import argparse
import hashlib
import json
from pathlib import Path
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[3]


def file_hash(path):
    h = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def command(output, epochs, batch_size, amp, resume):
    cmd = [sys.executable, str(ROOT / "scripts/ml/train-soterllm-v14-fullft.py"),
           "--encoder", "mdistilbert", "--teacher-dir", str(ROOT / "models/ml-classifier-v17"),
           "--student-hidden-size", "384", "--student-layers", "3", "--student-init", "teacher-slice",
           "--distill-alpha", "0.5", "--distill-temperature", "2.0", "--product-version", "v18-student-candidate",
           "--train-datasets", str(ROOT / "datasets/ml-v18-clean-corpus.jsonl"),
           "--split-file", str(ROOT / "artifacts/ml/v18-split-indices.json"),
           "--output-dir", str(output), "--epochs", str(epochs), "--batch-size", str(batch_size),
           "--grad-accum", "4", "--encoder-lr", "4e-5", "--head-lr", "3e-4",
           "--amp", amp, "--max-length", "256", "--fpr-ceiling", "0.03", "--target-fpr", "0.01", "--checkpoint"]
    if resume:
        cmd.append("--resume")
    return cmd


def protect_output(output, resume):
    if any((output / name).exists() for name in ("training_stats.json", "checkpoint.pt")) and not resume:
        raise ValueError("Output contains training progress. Use a new output directory or --resume; existing progress will not be overwritten.")
    if resume and not (output / "checkpoint.pt").is_file():
        raise ValueError("Cannot resume: checkpoint.pt is missing from the output directory.")


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--preflight", action="store_true")
    p.add_argument("--epochs", type=int, default=5)
    p.add_argument("--batch-size", type=int, default=16)
    p.add_argument("--output-dir", type=Path, default=ROOT / "models/ml-classifier-v18-student")
    p.add_argument("--resume", action="store_true", help="Resume checkpoint.pt in the output directory")
    args = p.parse_args()
    if min(args.epochs, args.batch_size) < 1:
        p.error("epochs and batch-size must be positive")
    manifest_path = ROOT / "v18-bundle-manifest.json"
    if not manifest_path.is_file():
        raise SystemExit("Run from the extracted v18 bundle; its hash manifest is required.")
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    for relative, expected in manifest["files"].items():
        candidate = (ROOT / relative).resolve()
        if not candidate.is_relative_to(ROOT.resolve()) or not candidate.is_file():
            raise SystemExit(f"Bundle file missing or unsafe: {relative}")
        if file_hash(candidate) != expected:
            raise SystemExit(f"Bundle hash mismatch: {relative}")
    print(f"Verified {len(manifest['files'])} bundle files.", flush=True)
    print("Candidate target: 3 layers x 384 hidden channels; teacher multilingual vocabulary retained.")
    print("Training/calibration/validation/test are separate. A held-out external release test is still required.")
    if args.preflight:
        print("Preflight passed. No training or downloads performed.")
        return
    protect_output(args.output_dir, args.resume)
    import torch
    if not torch.cuda.is_available():
        raise SystemExit("Enable a Colab GPU runtime. Full student distillation is not launched on CPU.")
    amp = "bf16" if torch.cuda.is_bf16_supported() else "fp16"
    cmd = command(args.output_dir.resolve(), args.epochs, args.batch_size, amp, args.resume)
    print(json.dumps({"gpu": torch.cuda.get_device_name(0), "amp": amp, "command": cmd}), flush=True)
    subprocess.run(cmd, cwd=ROOT, check=True)
    subprocess.run([sys.executable, str(ROOT / "scripts/ml/train-soterllm-v14-fullft.py"),
                    "--verify-only", str(args.output_dir.resolve()), "--max-length", "256"],
                   cwd=ROOT, check=True)
    print("Student trained and ONNX parity checked. This is a candidate, not an approved production replacement.")


if __name__ == "__main__":
    main()
