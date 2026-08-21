#!/usr/bin/env python3
r"""One-command v14 training run on ANY Linux GPU box. No notebook involved.

    python run_v14_anywhere.py                       # bundle zip in the CWD
    python run_v14_anywhere.py /path/to/bundle.zip
    python run_v14_anywhere.py --encoder bert-base --epochs 3

Use this when a notebook host is the problem rather than the GPU: Colab refusing
to open, Kaggle's editor misbehaving, or a rented box that has no notebook UI at
all. It is the only route onto terminal-only hosts, which are also the cheapest --
a 3-epoch minilm run is well under an hour of a consumer GPU.

Deliberately written in Python rather than as a shell script: this file gets
authored on Windows and run on Linux, and a .sh with CRLF line endings dies with
an opaque "bad interpreter: /usr/bin/env bash^M". Python 3 reads CRLF source
fine, so the entire failure class is removed rather than documented.

Verified hosts are listed in docs/ml/v14-gpu-training-structure.md section 4.3.
This script only assumes: python3, pip, a CUDA torch, and the bundle zip.
"""
from __future__ import annotations

import argparse
import hashlib
import os
import shutil
import subprocess
import sys
import zipfile
from pathlib import Path

BUNDLE_NAME = "soterai-v14-train-bundle.zip"
TRAINER_REL = "scripts/ml/train-soterllm-v14-fullft.py"


def die(msg: str) -> "NoReturn":  # noqa: F821
    print(f"\n[FATAL] {msg}", file=sys.stderr)
    raise SystemExit(2)


def find_bundle(explicit: str | None) -> Path:
    if explicit:
        p = Path(explicit).expanduser()
        if not p.is_file():
            die(f"{p} does not exist")
        return p
    here = Path.cwd()
    for cand in [here / BUNDLE_NAME, *sorted(here.rglob(BUNDLE_NAME))]:
        if cand.is_file():
            return cand
    die(
        f"{BUNDLE_NAME} not found in {here} or below.\n"
        "        Build it locally with:  python scripts/ml/colab/_build_v14_bundle.py\n"
        "        then copy it here (scp, or the host's file upload)."
    )


def stage(bundle: Path, work: Path) -> None:
    """Unpack the bundle, refusing the backslash-path failure mode outright."""
    work.mkdir(parents=True, exist_ok=True)
    print(f"bundle : {bundle}")
    print(f"sha256 : {hashlib.sha256(bundle.read_bytes()).hexdigest()[:16]}...  "
          f"({bundle.stat().st_size / 1048576:.1f} MB)")
    with zipfile.ZipFile(bundle) as z:
        # PowerShell's Compress-Archive writes "scripts\ml\x.py" as a LITERAL
        # filename on Linux -- extractall does not treat backslash as a separator.
        # The result is one junk file in the CWD and a run that fails much later
        # with a confusing missing-dataset error, so it is caught here.
        bad = [n for n in z.namelist() if "\\" in n]
        if bad:
            die(f"backslash paths in the zip; rebuild with _build_v14_bundle.py: {bad[:3]}")
        z.extractall(work)
    for rel in (TRAINER_REL, "scripts/ml/soter_augment.py"):
        if not (work / rel).is_file():
            die(f"bundle did not extract to real paths: missing {rel}")

    rows = 0
    for p in sorted(work.glob("datasets/*.jsonl")) + sorted(work.glob("artifacts/ml-v2/*.jsonl")):
        n = sum(1 for _ in p.open(encoding="utf-8"))
        rows += n
        print(f"  {n:>7,}  {p.relative_to(work)}")
    print(f"  {rows:>7,}  TOTAL rows")
    if rows == 0:
        die("staged 0 dataset rows -- the bundle is incomplete, stop before burning GPU time")


def ensure_deps() -> None:
    """Install only what is missing. Hosts vary wildly in what is preinstalled."""
    need = []
    for mod, pkg in (("onnxruntime", "onnxruntime"), ("onnx", "onnx"),
                     ("scipy", "scipy"), ("sklearn", "scikit-learn"),
                     ("transformers", "transformers")):
        try:
            __import__(mod)
        except ImportError:
            need.append(pkg)
    if not need:
        print("deps   : already present")
        return
    print(f"deps   : installing {' '.join(need)}")
    subprocess.run([sys.executable, "-m", "pip", "install", "-q", *need], check=True)


def probe_gpu(force_cpu: bool) -> dict:
    """Choose batch size / AMP from real VRAM rather than a guess."""
    try:
        import torch
    except ImportError:
        die("torch is not installed. Install a CUDA build for this host first "
            "(https://pytorch.org/get-started/locally/).")

    if force_cpu or not torch.cuda.is_available():
        if not force_cpu:
            print("\n[WARN] No CUDA device visible.")
            print("       v14 exists to train the ENCODER end to end. Measured CPU cost on the")
            print("       full corpus (minilm, batch 32): 2.6 h/epoch full fine-tune, or")
            print("       1.6 h/epoch with --unfreeze-top 3 -- 4.8 h for 3 epochs, which fits")
            print("       one overnight run and still trains the encoder. bert-base is ~5x that.")
            print("       Pass --cpu to proceed, ideally with --unfreeze-top 3.")
            die("no GPU; refusing to silently start a multi-hour CPU run")
        print("device : cpu (forced)")
        return {"batch": 32, "accum": 1, "amp": "off", "grad_ckpt": False, "encoder_lr": 2e-5}

    name = torch.cuda.get_device_name(0)
    vram = torch.cuda.get_device_properties(0).total_memory / 1024 ** 3
    bf16 = torch.cuda.is_bf16_supported()
    print(f"device : {name}  |  {vram:.1f} GiB  |  torch {torch.__version__} "
          f"(cuda {torch.version.cuda})  |  bf16 {bf16}")

    # This corpus is SHORT text (p50=18 tokens, p90=47 over 146,757 rows), so a
    # batch of 32 is ~600 tokens and leaves any modern GPU idle. Large batches are
    # the second wall-clock lever after length-grouped batching.
    if vram >= 38:
        batch, grad_ckpt = 256, False
    elif vram >= 22:
        batch, grad_ckpt = 192, False
    elif vram >= 14:
        batch, grad_ckpt = 128, False
    else:
        batch, grad_ckpt = 64, False
    # sqrt scaling off the 32-batch 2e-5 baseline; linear overshoots on a fine-tune.
    return {"batch": batch, "accum": 1, "amp": "bf16" if bf16 else "fp16",
            "grad_ckpt": grad_ckpt, "encoder_lr": 2e-5 * (batch / 32) ** 0.5}


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("bundle", nargs="?", default=None, help=f"path to {BUNDLE_NAME}")
    ap.add_argument("--work", default="./soter-v14", help="staging dir (default: ./soter-v14)")
    ap.add_argument("--encoder", default="minilm",
                    help="minilm is both the fast path and the honest control vs v12 (default)")
    ap.add_argument("--epochs", type=int, default=3)
    ap.add_argument("--batch-size", type=int, default=None, help="override the VRAM-derived value")
    ap.add_argument("--unfreeze-top", type=int, default=None,
                    help="train only the top N encoder blocks; the cheap path on weak hardware")
    ap.add_argument("--cpu", action="store_true", help="proceed without a GPU (slow; see --unfreeze-top)")
    ap.add_argument("--bakeoff", action="store_true",
                    help="rank encoders on a 24K subset first instead of the full run")
    ap.add_argument("--dry-run", action="store_true", help="stage and print the command, run nothing")
    args = ap.parse_args()

    work = Path(args.work).expanduser().resolve()
    print("=" * 70)
    print("SoterLLM v14 portable runner")
    print("=" * 70)

    stage(find_bundle(args.bundle), work)
    ensure_deps()
    cfg = probe_gpu(args.cpu)
    batch = args.batch_size or cfg["batch"]
    if args.batch_size:
        cfg["encoder_lr"] = 2e-5 * (batch / 32) ** 0.5

    out = work / "models" / "ml-classifier-v14"
    out.mkdir(parents=True, exist_ok=True)

    cmd = [sys.executable, TRAINER_REL,
           "--encoder", args.encoder,
           "--output-dir", str(out),
           "--epochs", str(args.epochs),
           "--batch-size", str(batch),
           "--grad-accum", str(cfg["accum"]),
           "--amp", cfg["amp"],
           "--encoder-lr", f"{cfg['encoder_lr']:.3e}",
           "--head-lr", "1e-3",
           "--layer-decay", "0.9",
           "--warmup-frac", "0.06",
           "--fpr-ceiling", "0.03",
           "--num-workers", "2",
           "--augment",
           "--checkpoint"]        # cheap insurance; --resume picks it up
    if cfg["grad_ckpt"]:
        cmd.append("--grad-checkpoint")
    if args.unfreeze_top:
        cmd += ["--unfreeze-top", str(args.unfreeze_top)]
    if args.bakeoff:
        cmd += ["--sample", "--sample-size", "24000"]

    print(f"\n$ cd {work}")
    print("$ " + " ".join(cmd) + "\n", flush=True)
    if args.dry_run:
        print("[dry-run] nothing executed")
        return 0

    # The trainer prints an ETA after 40 steps. On a metered host that is the
    # number to act on -- kill it there, not three hours in.
    rc = subprocess.run(cmd, cwd=work, check=False).returncode
    if rc != 0:
        print(f"\n[FAIL] trainer exited {rc}. Read the traceback above before re-running: it "
              "fails loudly on purpose (leak assertion, non-WordPiece tokenizer, missing data).")
        return rc

    # Package for transfer back. checkpoint.pt is excluded: 1-2 GB and useless off-host.
    zip_path = work / "soterai-v14-artifact.zip"
    with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as z:
        for p in sorted(out.rglob("*")):
            if p.is_file() and p.name != "checkpoint.pt":
                z.write(p, p.relative_to(out).as_posix())
    print(f"\n[ok] {zip_path}  ({zip_path.stat().st_size / 1048576:.1f} MB)")

    if (out / "PARITY_UNVERIFIED.json").is_file():
        print("\n[!] PARITY_UNVERIFIED.json present -- onnxruntime was missing here.")
        print("    Weights are safe. Close the gate locally after transfer:")
        print("    python scripts/ml/train-soterllm-v14-fullft.py --verify-only models/ml-classifier-v14")

    print("\nNext: copy that zip back, unpack into models/ml-classifier-v14/, then follow")
    print("the numbered steps in docs/ml/v14-gpu-training-structure.md (Stage C). Signing")
    print("is not optional -- an unsigned artifact makes augmentWithMl fail OPEN, which")
    print("turns the ML tier dark silently rather than erroring.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
