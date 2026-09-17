#!/usr/bin/env python3
r"""One-command v17 training run on ANY Linux GPU box. No notebook involved.

    python run_v17_anywhere.py                  # ARM A: mdistilbert (the v17 candidate)
    python run_v17_anywhere.py --arm control    # ARM B: minilm  (the control)
    python run_v17_anywhere.py --arm both       # A then B, sequentially
    python run_v17_anywhere.py /path/to/bundle.zip --epochs 3

WHAT v17 CHANGES, AND WHY THERE ARE TWO ARMS

v17 changes TWO things at once -- the encoder and the corpus -- and two changes
in one run cannot be attributed. So it trains two arms and leans on v14, which
is already trained, as the third cell of a 2x2:

                         v14 corpus            v17 corpus
    minilm          v14 (LIVE, measured)    ARM B "control"
    mdistilbert            --               ARM A "candidate"

    ARM B vs v14  ->  what the CORPUS did   (encoder held fixed)
    ARM A vs ARM B->  what the ENCODER did  (corpus held fixed)

Without ARM B, a v17 win is unattributable and a v17 loss is undiagnosable. It
is not an optional extra; it is half the experiment. ARM B is also the fallback
that ships if the encoder swap regresses English, because the one hard
requirement on v17 is: beat v14 in non-English WITHOUT losing English.

THE MEASUREMENT THAT MOTIVATES BOTH

    v14 scored on datasets/v17-multilingual-battery.jsonl (312 rows, 39 langs,
    held out, 0 group-key collisions with training):
        recall 83.33%
        FPR    52.1% on 117 unambiguously-benign rows -- 53 of 61 blocks from
               the ML tier, i.e. reachable by training data

    The cleanest row has no security vocabulary in it at all -- "help me write a
    polite email to move tomorrow's meeting" -- and is blocked in 15 of 39
    languages. That is a LANGUAGE -> ATTACK shortcut, and the training corpus
    explains it: it/sv/nl were 100% attack rows, de 95.8%, fr 94.5%,
    hinglish 90.7%. Rule 10 in _build_v17_corpus.py caps every language at 0.70.

    Separately, v14's 30,523-token uncased vocab shreds 8 of 31 scripts
    (gu 83.8% UNK, pa 85.1%, te 78.2%). mDistilBERT-cased takes all 8 to 0.00%.
    Those two facts are CONFOUNDED in the battery data, which is the whole
    reason ARM B exists.

HYPERPARAMETERS ARE HELD, NOT TUNED

Both arms run at EFFECTIVE batch 128 and the same sqrt-scaled encoder LR
(4.0e-5), which is exactly what v14 trained with. ARM A gets there as 64 x 2
grad-accum rather than 128 x 1 purely for VRAM: 135M params with a 119,547-row
embedding table does not fit a 16 GiB T4 at batch 128. Gradient accumulation is
arithmetically identical here -- there is no BatchNorm in a transformer, and
LayerNorm is per-sample -- so the optimization trajectory is preserved.

    HONEST LIMIT: holding LR fixed across a 22M and a 135M model holds the RULE
    constant, not the OPTIMUM. A base-size encoder may prefer a lower LR. So
    "ARM A vs ARM B" bounds the encoder effect under a shared recipe; it does
    not prove the best-tuned mdistilbert equals this one. Say that, do not
    quietly drop it.

Deliberately written in Python rather than as a shell script: this file is
authored on Windows and run on Linux, and a .sh with CRLF endings dies with an
opaque "bad interpreter: /usr/bin/env bash^M". Python 3 reads CRLF fine, so the
failure class is removed rather than documented.

This script only assumes: python3, pip, a CUDA torch, and the bundle zip.
"""
from __future__ import annotations

import argparse
import hashlib
import subprocess
import sys
import zipfile
from pathlib import Path
from typing import NoReturn

BUNDLE_NAME = "soterai-v17-train-bundle.zip"
TRAINER_REL = "scripts/ml/train-soterllm-v14-fullft.py"   # v17 reuses the v14 trainer

# The full v17 corpus, in load order. The first 10 are v16's exact corpus; the
# 11th is the v17 increment. Passed explicitly with --train-datasets because the
# trainer's built-in default is the 8-file v14 set -- without this you would
# silently omit the v15, v16 AND v17 rows and retrain v14 under a new name.
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
    "datasets/ml-v16-threat-corpus.jsonl",
    "datasets/ml-v17-threat-corpus.jsonl",          # <- the v17 increment
]

INCREMENT = DATASETS[-1]

# Both arms, as data. Effective batch is 128 for both (see module docstring).
ARMS = {
    "candidate": {
        "encoder": "mdistilbert",
        "out": "ml-classifier-v17",
        "batch": 64,
        "accum": 2,
        "why": "the v17 candidate: 119,547-token cased multilingual WordPiece vocab",
        "min_vram": 12.0,
    },
    "control": {
        "encoder": "minilm",
        "out": "ml-classifier-v17-minilm",
        "batch": 128,
        "accum": 1,
        "why": "the control: v14's exact encoder, so ARM B vs v14 isolates the corpus",
        "min_vram": 6.0,
    },
}


def die(msg: str) -> NoReturn:
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
        "        Build it locally with:  python scripts/ml/colab/_build_v17_bundle.py\n"
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
            die(f"backslash paths in the zip; rebuild with _build_v17_bundle.py: {bad[:3]}")
        z.extractall(work)
    for rel in (TRAINER_REL, "scripts/ml/soter_augment.py", INCREMENT):
        if not (work / rel).is_file():
            die(f"bundle did not extract to real paths: missing {rel}")

    rows = 0
    for rel in DATASETS:
        p = work / rel
        n = sum(1 for _ in p.open(encoding="utf-8"))
        rows += n
        print(f"  {n:>7,}  {rel}")
    print(f"  {rows:>7,}  TOTAL rows")
    if rows == 0:
        die("staged 0 dataset rows -- the bundle is incomplete, stop before burning GPU time")

    # The increment is the whole experiment; prove it survived transfer intact.
    # A zip copied through a text-mode channel loses non-ASCII bytes, and this is
    # the one file where that would quietly delete the multilingual signal.
    inc = work / INCREMENT
    n_inc = sum(1 for _ in inc.open(encoding="utf-8"))
    n_utf8 = sum(1 for line in inc.open(encoding="utf-8") if any(ord(c) > 127 for c in line))
    print(f"\nincrement: {n_inc:,} rows, {n_utf8:,} carrying non-ASCII text "
          f"({100 * n_utf8 / max(1, n_inc):.1f}%)")
    if n_utf8 == 0:
        die("the v17 increment has NO non-ASCII rows. Its entire purpose is native "
            "multilingual data, so the file was mangled in transfer. Re-copy the bundle.")
    # MEASURED at build time: 2,953/3,871 = 76.3% of the increment carries
    # non-ASCII text. It is NOT ~99% even though 99.4% of the rows are non-English,
    # because de/fr/it/nl/sv/id/ms/tl/pl/cs/ro/sw and friends are Latin-script and
    # often pure ASCII. The floor is set well below the measured value so it catches
    # a mangled or stale file without firing on ordinary drift.
    if n_utf8 < 0.5 * n_inc:
        die(f"only {100 * n_utf8 / n_inc:.1f}% of the increment carries non-ASCII text; "
            "the build measured 76.3%. Wrong, truncated or text-mode-mangled file.")


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


def probe_gpu(force_cpu: bool, arms: list[str]) -> dict:
    """Report the GPU and pick AMP. Effective batch stays PINNED at 128 (see main)."""
    try:
        import torch
    except ImportError:
        die("torch is not installed. Install a CUDA build for this host first "
            "(https://pytorch.org/get-started/locally/).")

    if force_cpu or not torch.cuda.is_available():
        if not force_cpu:
            print("\n[WARN] No CUDA device visible.")
            print("       v17 trains the ENCODER end to end like v14/v15/v16. Measured CPU cost")
            print("       for minilm on this corpus (batch 32): 2.6 h/epoch full fine-tune.")
            print("       mdistilbert is ~6x the parameters -- a CPU run of ARM A is a")
            print("       multi-DAY job, not a slow afternoon. Use a GPU.")
            die("no GPU; refusing to silently start a multi-hour CPU run")
        print("device : cpu (forced)")
        return {"amp": "off", "vram": 0.0}

    name = torch.cuda.get_device_name(0)
    vram = torch.cuda.get_device_properties(0).total_memory / 1024 ** 3
    bf16 = torch.cuda.is_bf16_supported()
    print(f"device : {name}  |  {vram:.1f} GiB  |  torch {torch.__version__} "
          f"(cuda {torch.version.cuda})  |  bf16 {bf16}")
    for arm in arms:
        need = ARMS[arm]["min_vram"]
        if vram < need:
            print(f"[WARN] ARM {arm} ({ARMS[arm]['encoder']}) wants ~{need:.0f} GiB; this host has "
                  f"{vram:.1f}. If it OOMs, halve --batch-size and DOUBLE --grad-accum")
            print("       so the effective batch stays 128 -- that keeps the arms comparable.")
    # bf16 (Ampere+) is what v14 trained with; a T4 is Turing -> fp16 + GradScaler.
    # The trainer unscales before clipping, so fp16 is safe -- just a hair of extra
    # numeric noise vs v14's bf16, unavoidable on Turing.
    return {"amp": "bf16" if bf16 else "fp16", "vram": vram}


def train_arm(arm: str, work: Path, cfg: dict, args) -> int:
    spec = ARMS[arm]
    batch = spec["batch"] if args.batch_size is None else args.batch_size
    accum = spec["accum"] if args.grad_accum is None else args.grad_accum
    effective = batch * accum
    # sqrt scaling off the 32-batch 2e-5 baseline, applied to the EFFECTIVE batch:
    # at 128 this is 4.0e-5, exactly what v14 trained with. Linear scaling
    # overshoots on a fine-tune.
    encoder_lr = 2e-5 * (effective / 32) ** 0.5

    out = work / "models" / spec["out"]
    out.mkdir(parents=True, exist_ok=True)

    print()
    print("=" * 70)
    print(f"ARM {arm.upper()}  --  encoder {spec['encoder']}")
    print(f"  {spec['why']}")
    print(f"  batch {batch} x accum {accum} = effective {effective}   encoder-lr {encoder_lr:.3e}")
    if effective != 128:
        print(f"  [!] effective batch {effective} != 128. This arm no longer matches v14's")
        print("      regime, so a difference vs v14 is no longer attributable to the")
        print("      corpus or the encoder alone. Record it with the result.")
    print("=" * 70, flush=True)

    cmd = [sys.executable, TRAINER_REL,
           "--train-datasets", *DATASETS,
           "--encoder", spec["encoder"],
           "--output-dir", str(out),
           "--epochs", str(args.epochs),
           "--batch-size", str(batch),
           "--grad-accum", str(accum),
           "--amp", cfg["amp"],
           "--encoder-lr", f"{encoder_lr:.3e}",
           "--head-lr", "1e-3",
           "--layer-decay", "0.9",
           "--warmup-frac", "0.06",
           "--fpr-ceiling", "0.03",
           "--num-workers", "2",
           "--augment",
           "--checkpoint"]        # cheap insurance; --resume picks it up
    if args.unfreeze_top:
        cmd += ["--unfreeze-top", str(args.unfreeze_top)]
    if args.grad_checkpoint:
        cmd.append("--grad-checkpoint")

    print(f"$ cd {work}")
    print("$ " + " ".join(cmd) + "\n", flush=True)
    if args.dry_run:
        print("[dry-run] nothing executed")
        return 0

    # The trainer prints an ETA after 40 steps. On a metered host that is the
    # number to act on -- kill it there, not three hours in.
    rc = subprocess.run(cmd, cwd=work, check=False).returncode
    if rc != 0:
        print(f"\n[FAIL] ARM {arm} exited {rc}. Read the traceback above before re-running: it "
              "fails loudly on purpose (leak assertion, non-WordPiece tokenizer, missing data).")
        return rc

    zip_path = work / f"soterai-{spec['out']}-artifact.zip"
    with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as z:
        for p in sorted(out.rglob("*")):
            if p.is_file() and p.name != "checkpoint.pt":
                z.write(p, p.relative_to(out).as_posix())
    print(f"\n[ok] ARM {arm} -> {zip_path}  ({zip_path.stat().st_size / 1048576:.1f} MB)")

    if (out / "PARITY_UNVERIFIED.json").is_file():
        print("\n[!] PARITY_UNVERIFIED.json present -- onnxruntime was missing here.")
        print("    Weights are safe. Close the gate locally after transfer:")
        print(f"    python {TRAINER_REL} --verify-only models/{spec['out']}")
    return 0


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("bundle", nargs="?", default=None, help=f"path to {BUNDLE_NAME}")
    ap.add_argument("--work", default="./soter-v17", help="staging dir (default: ./soter-v17)")
    ap.add_argument("--arm", choices=["candidate", "control", "both"], default="candidate",
                    help="candidate=mdistilbert (v17), control=minilm (isolates the corpus), "
                         "both=run them in sequence. Read the module docstring before "
                         "skipping the control -- without it a result is unattributable.")
    ap.add_argument("--epochs", type=int, default=3, help="v14 selected epoch 3; matches it")
    ap.add_argument("--batch-size", type=int, default=None,
                    help="override the per-arm default (64 candidate / 128 control). If you "
                         "change this, change --grad-accum too so effective batch stays 128")
    ap.add_argument("--grad-accum", type=int, default=None,
                    help="override the per-arm default (2 candidate / 1 control)")
    ap.add_argument("--unfreeze-top", type=int, default=None,
                    help="train only the top N encoder blocks; the cheap path on weak hardware")
    ap.add_argument("--grad-checkpoint", action="store_true",
                    help="trade ~30%% speed for a large VRAM drop; try before lowering batch")
    ap.add_argument("--cpu", action="store_true", help="proceed without a GPU (see probe_gpu)")
    ap.add_argument("--dry-run", action="store_true", help="stage and print the commands, run nothing")
    args = ap.parse_args()

    work = Path(args.work).expanduser().resolve()
    arms = ["candidate", "control"] if args.arm == "both" else [args.arm]

    print("=" * 70)
    print("SoterLLM v17 portable runner  (v14 trainer + the v17 corpus + encoder swap)")
    print("=" * 70)

    stage(find_bundle(args.bundle), work)
    ensure_deps()
    cfg = probe_gpu(args.cpu, arms)

    if args.arm == "candidate":
        print("\n[note] Running the CANDIDATE only. A win here is NOT attributable to the")
        print("       encoder until ARM control has run on the same corpus -- and ARM")
        print("       control is also the English-safe fallback. Plan to run --arm both.")

    for arm in arms:
        rc = train_arm(arm, work, cfg, args)
        if rc != 0:
            return rc

    print("\n" + "=" * 70)
    print("Next: copy the artifact zip(s) back, unpack into models/<name>/, then:")
    print("  1. sign  -- NOT optional. An unsigned artifact makes augmentWithMl fail")
    print("     OPEN, turning the ML tier dark silently rather than erroring.")
    print("  2. regenerate the CASED tokenizer golden from the TRAINED artifact's own")
    print("     tokenizer_config (not from the HF hub id -- this is what proves the export")
    print("     matches), then re-run parity against THAT golden:")
    print("       python scripts/ml/dump-hf-tokenization.py \\")
    print("         --tokenizer-dir models/ml-classifier-v17/tokenizer_config \\")
    print("         --out scripts/ml/_hf-tokenization-golden-cased.json")
    print("       npx tsx scripts/ml/verify-tokenizer-parity.ts \\")
    print("         --model-dir models/ml-classifier-v17 \\")
    print("         --golden scripts/ml/_hf-tokenization-golden-cased.json")
    print("     Both --out and --golden are REQUIRED. v14's golden is UNCASED and is the")
    print("     live model's only parity evidence; the default paths on both sides point at")
    print("     it, so omitting either flag either retires that evidence or compares two")
    print("     different tokenizers. ARM control (minilm) is uncased -- it keeps the")
    print("     existing golden and needs no regeneration.")
    print("  3. score BOTH axes and report both:")
    print("       non-English: datasets/v17-multilingual-battery.jsonl  (v14 = 83.33% / 52.1% FPR)")
    print("       English    : datasets/crossdist-eval-v3.jsonl         (v14 is LIVE -- no regression allowed)")
    print("  4. the gate is paired McNemar vs v14 on each axis separately.")
    print("=" * 70)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
