#!/usr/bin/env python3
r"""One-command v16 training run on ANY Linux GPU box. No notebook involved.

    python run_v16_anywhere.py                       # bundle zip in the CWD
    python run_v16_anywhere.py /path/to/bundle.zip
    python run_v16_anywhere.py --epochs 3

v16 is NOT a new model architecture. It is v14's trainer
(scripts/ml/train-soterllm-v14-fullft.py) run over the same 9-dataset corpus v15
trained on PLUS one 10th file, datasets/ml-v16-threat-corpus.jsonl -- a native
multilingual / multi-turn / agentic increment written against a MEASURED
weakness profile, not a guess:

    v15 on the 70-row held-out probe battery: recall 89.29%, FPR 28.57%
      weakest labels : MULTI_TURN 62.5% (5/8), DATA_EXFIL 75%, TOOL_CALL_ABUSE 75%
      weakest langs  : ja 67% (2/3), ru 75% (6/8), hinglish 75% (6/8) vs en 96% (25/26)
      3 of 4 false positives were benign SECURITY-EDUCATION rows -- v15 blocks
      people *discussing* attacks; the 4th was a benign Hinglish multi-turn
      coding question flagged JAILBREAK.

    Corpus root cause: MULTI_TURN_ESCALATION was 1,303/147,912 = 0.88% of the
    corpus and native non-English ~3.1%. The increment raises both, and pairs
    every attack family with benign controls in the SAME language and the SAME
    register so the model learns the attack pattern rather than the topic, the
    language, or the mere presence of continuity language.

Everything else -- the encoder (minilm), the hyperparameters, the augmentation --
is pinned to what v14 and v15 trained with, so the comparison isolates the single
variable that changed: the corpus increment.

Use this when a notebook host is the problem rather than the GPU: Colab refusing
to open, Kaggle's editor misbehaving, or a rented box with no notebook UI at all.

Deliberately written in Python rather than as a shell script: this file gets
authored on Windows and run on Linux, and a .sh with CRLF line endings dies with
an opaque "bad interpreter: /usr/bin/env bash^M". Python 3 reads CRLF source
fine, so the entire failure class is removed rather than documented.

This script only assumes: python3, pip, a CUDA torch, and the bundle zip.
"""
from __future__ import annotations

import argparse
import hashlib
import subprocess
import sys
import zipfile
from pathlib import Path

BUNDLE_NAME = "soterai-v16-train-bundle.zip"
TRAINER_REL = "scripts/ml/train-soterllm-v14-fullft.py"   # v16 reuses the v14 trainer

# The full v16 corpus, in load order. The first 9 are v15's exact corpus; the
# 10th is the v16 increment. Passed explicitly with --train-datasets because the
# trainer's built-in default is the 8-file v14 set -- without this you would
# silently omit BOTH the v15 and v16 rows and retrain v14 under a new name.
DATASETS = [
    "datasets/ml-augmented-v8-final.jsonl",
    "datasets/ml-v8-targeted-fix.jsonl",
    "datasets/ml-v10-advanced-attacks.jsonl",
    "datasets/ml-v10-targeted-fix.jsonl",
    "datasets/ml-v11-weak-fix.jsonl",
    "artifacts/ml-v2/v12-toxicity-fix.jsonl",
    "datasets/ml-v13-meta-instructional.jsonl",
    "datasets/ml-v13-attack-gaps.jsonl",
    "datasets/ml-v15-threat-corpus.jsonl",
    "datasets/ml-v16-threat-corpus.jsonl",          # <- the v16 increment
]


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
        "        Build it locally with:  python scripts/ml/colab/_build_v16_bundle.py\n"
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
            die(f"backslash paths in the zip; rebuild with _build_v16_bundle.py: {bad[:3]}")
        z.extractall(work)
    for rel in (TRAINER_REL, "scripts/ml/soter_augment.py", DATASETS[-1]):
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

    # The increment is the whole experiment; prove it survived transfer intact.
    # A zip copied through a text-mode channel loses non-ASCII bytes, and this is
    # the one file where that would quietly delete the multilingual signal.
    inc = work / DATASETS[-1]
    n_inc = sum(1 for _ in inc.open(encoding="utf-8"))
    n_utf8 = sum(1 for line in inc.open(encoding="utf-8") if any(ord(c) > 127 for c in line))
    print(f"\nincrement: {n_inc:,} rows, {n_utf8:,} carrying non-ASCII text "
          f"({100 * n_utf8 / max(1, n_inc):.1f}%)")
    if n_utf8 == 0:
        die("the v16 increment has NO non-ASCII rows. Its entire purpose is native "
            "multilingual data, so the file was mangled in transfer. Re-copy the bundle.")


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
    """Report the GPU and pick AMP. Batch stays PINNED (see main) so v16 matches v14/v15."""
    try:
        import torch
    except ImportError:
        die("torch is not installed. Install a CUDA build for this host first "
            "(https://pytorch.org/get-started/locally/).")

    if force_cpu or not torch.cuda.is_available():
        if not force_cpu:
            print("\n[WARN] No CUDA device visible.")
            print("       v16 trains the ENCODER end to end like v14/v15. Measured CPU cost on")
            print("       the full corpus (minilm, batch 32): 2.6 h/epoch full fine-tune, or")
            print("       1.6 h/epoch with --unfreeze-top 3 -- 4.8 h for 3 epochs. bert-base ~5x.")
            print("       Pass --cpu to proceed, ideally with --unfreeze-top 3.")
            die("no GPU; refusing to silently start a multi-hour CPU run")
        print("device : cpu (forced)")
        return {"amp": "off", "grad_ckpt": False, "bf16": False}

    name = torch.cuda.get_device_name(0)
    vram = torch.cuda.get_device_properties(0).total_memory / 1024 ** 3
    bf16 = torch.cuda.is_bf16_supported()
    print(f"device : {name}  |  {vram:.1f} GiB  |  torch {torch.__version__} "
          f"(cuda {torch.version.cuda})  |  bf16 {bf16}")
    if vram < 6:
        print("[WARN] <6 GiB VRAM. minilm at batch 128 (seq p50=18 tokens) is small, but if you")
        print("       OOM, lower --batch-size -- and know it slightly breaks the exact v14 match.")
    # bf16 (Ampere+) is what v14 trained with; a T4 is Turing -> fp16 + GradScaler.
    # The trainer unscales before clipping, so fp16 is safe -- just a hair of extra
    # numeric noise vs v14's bf16, unavoidable on Turing.
    return {"amp": "bf16" if bf16 else "fp16", "grad_ckpt": False, "bf16": bf16}


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("bundle", nargs="?", default=None, help=f"path to {BUNDLE_NAME}")
    ap.add_argument("--work", default="./soter-v16", help="staging dir (default: ./soter-v16)")
    ap.add_argument("--encoder", default="minilm",
                    help="minilm matches v14/v15 exactly -- keep it unless you know why (default)")
    ap.add_argument("--epochs", type=int, default=3, help="v14 selected epoch 3; matches it")
    ap.add_argument("--batch-size", type=int, default=128,
                    help="PINNED to 128 to reproduce v14's regime; overriding breaks the exact match")
    ap.add_argument("--unfreeze-top", type=int, default=None,
                    help="train only the top N encoder blocks; the cheap path on weak hardware")
    ap.add_argument("--cpu", action="store_true", help="proceed without a GPU (slow; see --unfreeze-top)")
    ap.add_argument("--dry-run", action="store_true", help="stage and print the command, run nothing")
    args = ap.parse_args()

    work = Path(args.work).expanduser().resolve()
    print("=" * 70)
    print("SoterLLM v16 portable runner  (v14 trainer + the v16 corpus increment)")
    print("=" * 70)

    stage(find_bundle(args.bundle), work)
    ensure_deps()
    cfg = probe_gpu(args.cpu)

    batch = args.batch_size
    # sqrt scaling off the 32-batch 2e-5 baseline; at batch 128 this is 4.0e-5,
    # exactly what v14 trained with. Linear scaling overshoots on a fine-tune.
    encoder_lr = 2e-5 * (batch / 32) ** 0.5

    out = work / "models" / "ml-classifier-v16"
    out.mkdir(parents=True, exist_ok=True)

    cmd = [sys.executable, TRAINER_REL,
           "--train-datasets", *DATASETS,
           "--encoder", args.encoder,
           "--output-dir", str(out),
           "--epochs", str(args.epochs),
           "--batch-size", str(batch),
           "--grad-accum", "1",
           "--amp", cfg["amp"],
           "--encoder-lr", f"{encoder_lr:.3e}",
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
    zip_path = work / "soterai-v16-artifact.zip"
    with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as z:
        for p in sorted(out.rglob("*")):
            if p.is_file() and p.name != "checkpoint.pt":
                z.write(p, p.relative_to(out).as_posix())
    print(f"\n[ok] {zip_path}  ({zip_path.stat().st_size / 1048576:.1f} MB)")

    if (out / "PARITY_UNVERIFIED.json").is_file():
        print("\n[!] PARITY_UNVERIFIED.json present -- onnxruntime was missing here.")
        print("    Weights are safe. Close the gate locally after transfer:")
        print("    python scripts/ml/train-soterllm-v14-fullft.py --verify-only models/ml-classifier-v16")

    print("\nNext: copy that zip back, unpack into models/ml-classifier-v16/, then run the")
    print("Stage-C steps. Signing is NOT optional -- an unsigned artifact makes")
    print("augmentWithMl fail OPEN, turning the ML tier dark silently rather than erroring.")
    print("The gate is v14-vs-v16 McNemar (v14 is LIVE; v15 was a NO-GO), plus the")
    print("70-row probe battery re-score that v16 was built to move.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
