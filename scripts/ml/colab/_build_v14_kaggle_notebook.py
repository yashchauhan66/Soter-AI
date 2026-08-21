r"""Generate scripts/ml/colab/soterllm-v14-kaggle.ipynb.

The Kaggle sibling of _build_v14_notebook.py, for when Colab will not cooperate.
Same trainer, same bundle, same acceptance gate -- only the host differs.

Why Kaggle is the right fallback rather than "try Colab again":
  * Save Version > "Save & Run All (Commit)" runs the notebook SERVER-SIDE and
    headless. Closing the browser, losing wifi or sleeping the laptop cannot kill
    it. That is Colab's usual failure mode, removed rather than worked around.
  * P100 16GB or T4 x2, 30 GPU-hours/week, 12h per session -- more than a 3-epoch
    minilm run needs.
  * /kaggle/working is persisted as the notebook version's output, so there is no
    Drive-mount step and nothing to lose when the runtime ends.

Generated, not hand-edited -- hand-editing .ipynb JSON is how you get a file the
host refuses to open. Edit the CELLS below and re-run:

    python scripts/ml/colab/_build_v14_kaggle_notebook.py

Cell bodies are plain (non-f) strings so braces inside them stay literal.
"""
import json
import os

ROOT = r"C:\Users\USER\OneDrive\Desktop\Ai-Agent-Security-Guard"
OUT = os.path.join(ROOT, "scripts", "ml", "colab", "soterllm-v14-kaggle.ipynb")

MD_INTRO = r"""# SoterLLM v14 — full encoder fine-tune (Kaggle GPU)

Same trainer and same acceptance gate as the Colab notebook. Use this one when
Colab will not cooperate.

### Set this up first — four clicks, in this order

1. **Upload the bundle as a Dataset.** `+ Create > New Dataset`, upload
   `soterai-v14-train-bundle.zip`, make it **Private**. Then in this notebook:
   `Add Input > Datasets >` your dataset.
   *Kaggle usually auto-extracts an uploaded zip*, so you may find loose files
   rather than the archive. Cell 2 handles both — you do not need to care which.
2. **Accelerator → GPU.** Right sidebar `Settings > Accelerator > GPU P100`
   (or `T4 x2`). Cell 1 refuses to continue without one. GPU needs a
   phone-verified account.
3. **Internet → On.** `Settings > Internet`. Required — the run pip-installs
   `onnxruntime` and downloads encoder weights from Hugging Face. Kaggle
   defaults this **off** on some accounts and the failure looks like an
   unrelated network error.
4. **Run it headless.** Top right: `Save Version > Save & Run All (Commit)`.
   This is the whole reason to be here: the run executes server-side, so closing
   the browser or losing wifi cannot kill it. Watch progress under the
   notebook's *Logs*, and collect artifacts from the *Output* tab afterwards.

Interactive `Run All` also works and is better for the first pass, since a
misconfiguration surfaces in seconds rather than at the end of a queued commit.

### What is different about v14

v7 through v12 all trained a ~330K-parameter MLP head on top of a **frozen** 22M
`all-MiniLM-L6-v2` encoder — `train-soterllm-v10-transfer.py` sets
`requires_grad = False` on every encoder parameter. Five model versions, one
month, and the encoder itself was never trained once. That is the plateau, and it
was a rational choice while training had to fit on a CPU. A GPU removes the
constraint that produced it, so v14 trains end to end with layer-wise LR decay.

### The one hard constraint

Production tokenizes with the in-repo WordPiece `BertTokenizer` reading
`tokenizer_config/vocab.txt` (`lib/ml/onnxBackend.ts`). There is no SentencePiece
or BPE tokenizer anywhere in the runtime, so a DeBERTa-v3, RoBERTa or XLM-R
encoder trains perfectly here and then **fails to load in production**. Cell 3
enforces this behaviourally, not by matching model names.

Hidden size is *not* constrained — nothing in `lib/` hardcodes 384 — so 768- and
1024-dim encoders are drop-in.
"""

CELL_GPU = r"""# 1/8  Confirm a GPU is really attached, and read its VRAM before choosing a config.
#      No GPU? Right sidebar: Settings > Accelerator > GPU P100 (or T4 x2).
import torch

if not torch.cuda.is_available():
    raise SystemExit(
        "No CUDA device attached. Settings > Accelerator > GPU P100, then re-run.\n"
        "v14 exists to fine-tune the ENCODER end to end; on CPU that is measured at "
        "~3.1 h/epoch for minilm and ~15 h for bert-base, which is exactly why v7-v12 "
        "froze it."
    )

name = torch.cuda.get_device_name(0)
vram_gb = torch.cuda.get_device_properties(0).total_memory / 1024 ** 3
bf16_ok = torch.cuda.is_bf16_supported()

print(f"GPU      : {name}  (x{torch.cuda.device_count()})")
print(f"VRAM     : {vram_gb:.1f} GiB")
print(f"torch    : {torch.__version__}  (cuda {torch.version.cuda})")
print(f"bf16     : {bf16_ok}")

# bf16 needs Ampere or newer. Kaggle's P100 is Pascal and the T4 is Turing, so in
# practice this lands on fp16 + GradScaler. The trainer unscales before clipping,
# so fp16 is safe here -- it is not slower, just fussier numerically.
AMP = "bf16" if bf16_ok else "fp16"

# Batch sizes are large on purpose. This corpus is SHORT text -- token lengths are
# p50=18, mean 35.8, p90=47 over all 146,757 rows -- so a batch of 32 is roughly
# 600 tokens and leaves a GPU almost entirely idle. Length-grouped batching (on by
# default) is what keeps padding from undoing that.
ENCODER = "minilm"          # the fast path AND the honest control -- see cell 5
if vram_gb >= 38:
    BATCH, ACCUM, CKPT_FLAG = 256, 1, False
elif vram_gb >= 22:
    BATCH, ACCUM, CKPT_FLAG = 192, 1, False
else:
    BATCH, ACCUM, CKPT_FLAG = 128, 1, False   # P100 16GB / single T4 land here

# Larger batch needs a larger LR. sqrt scaling from the 32-batch baseline of 2e-5
# is the conservative choice; linear scaling overshoots on a fine-tune.
ENCODER_LR = 2e-5 * (BATCH / 32) ** 0.5
HEAD_LR = 1e-3

print(f"\nchosen   : --encoder {ENCODER} --batch-size {BATCH} --grad-accum {ACCUM} --amp {AMP}"
      f" --encoder-lr {ENCODER_LR:.2e}" + ("  --grad-checkpoint" if CKPT_FLAG else ""))

# Kaggle gives "T4 x2" but the trainer is single-device by design: DataParallel
# would change the effective batch and the loss reduction silently, and none of
# the calibration or threshold fitting downstream was measured under it. One T4 is
# plenty for a 3-epoch minilm run, so this is a deliberate non-use of the 2nd GPU.
if torch.cuda.device_count() > 1:
    print(f"\n[note] {torch.cuda.device_count()} GPUs visible; the trainer uses ONE on purpose.")
    print("       Not a misconfiguration -- see the comment above.")
"""

CELL_BUNDLE = r"""# 2/8  Locate the bundle under /kaggle/input and stage it in /kaggle/working.
#
#      Two shapes are supported because Kaggle decides, not you: uploading
#      soterai-v14-train-bundle.zip to a Dataset OFTEN auto-extracts it, so the
#      input may be the archive OR the already-unpacked tree. Guessing wrong here
#      is the single most likely way to waste a session, so both are handled.
import hashlib
import os
import shutil
import zipfile
from pathlib import Path

INPUT = Path("/kaggle/input")
WORK = Path("/kaggle/working/soter-v14")
WORK.mkdir(parents=True, exist_ok=True)
os.chdir(WORK)

TRAINER_REL = "scripts/ml/train-soterllm-v14-fullft.py"

if not INPUT.exists() or not any(INPUT.iterdir()):
    raise SystemExit(
        "/kaggle/input is empty. Add Input > Datasets > (your private dataset "
        "containing soterai-v14-train-bundle.zip). See the intro cell, step 1."
    )

zips = sorted(INPUT.rglob("soterai-v14-train-bundle.zip"))
trainers = sorted(INPUT.rglob("train-soterllm-v14-fullft.py"))

if zips:
    src = zips[0]
    print(f"found archive : {src}")
    print(f"sha256        : {hashlib.sha256(src.read_bytes()).hexdigest()[:16]}...  "
          f"({src.stat().st_size / 1048576:.1f} MB)")
    with zipfile.ZipFile(src) as z:
        # PowerShell's Compress-Archive writes backslash separators that
        # extractall() treats as part of the FILENAME, silently producing one file
        # literally named "scripts\ml\train-...py". _build_v14_bundle.py builds with
        # forward slashes and verifies by extracting; this re-checks at the far end.
        bad = [n for n in z.namelist() if "\\" in n]
        if bad:
            raise SystemExit(f"backslash paths in zip -- rebuild with _build_v14_bundle.py: {bad}")
        z.extractall(WORK)
elif trainers:
    # Kaggle auto-extracted the upload. Copy the tree in rather than running from
    # /kaggle/input, which is READ-ONLY -- the trainer writes alongside its inputs.
    root = trainers[0].parents[2]          # .../scripts/ml/trainer.py -> dataset root
    print(f"found unpacked tree : {root}  (Kaggle auto-extracted the zip)")
    for item in root.iterdir():
        dest = WORK / item.name
        if dest.exists():
            continue
        if item.is_dir():
            shutil.copytree(item, dest)
        else:
            shutil.copy2(item, dest)
else:
    raise SystemExit(
        "Neither soterai-v14-train-bundle.zip nor train-soterllm-v14-fullft.py found "
        f"under /kaggle/input. Present: {[p.name for p in INPUT.iterdir()]}"
    )

missing = [r for r in (TRAINER_REL, "scripts/ml/soter_augment.py") if not (WORK / r).is_file()]
if missing:
    raise SystemExit(f"staged tree is incomplete: {missing}")

rows = 0
for p in sorted(WORK.glob("datasets/*.jsonl")) + sorted(WORK.glob("artifacts/ml-v2/*.jsonl")):
    n = sum(1 for _ in p.open(encoding="utf-8"))
    rows += n
    print(f"  {n:>7,}  {p.relative_to(WORK)}")
print(f"  {rows:>7,}  TOTAL rows")
if rows == 0:
    raise SystemExit("staged 0 dataset rows -- the dataset upload is incomplete, stop here")
print("\nml-v13-meta-instructional.jsonl and ml-v13-attack-gaps.jsonl have never been trained on.")
print("They target the two measured gaps: benign meta-instructional FPR, and prefix-priming recall.")
"""

CELL_PREFLIGHT = r"""# 3/8  Deps, then a REAL preflight so a wrong encoder fails in 30 seconds, not in 2 hours.
#
#      onnxruntime is the one that matters: it is what the parity gate uses. Without
#      it the run still completes and KEEPS ITS WEIGHTS -- the trainer saves
#      pytorch_model.bin before the gate on purpose -- but the artifact lands
#      PARITY_UNVERIFIED and you close the gate locally with --verify-only.
#
#      If this cell fails on network, Internet is off: Settings > Internet > On.
!pip install -q onnxruntime onnx scipy scikit-learn

import importlib.util
import sys

sys.path.insert(0, str(WORK / "scripts" / "ml"))      # before exec: the trainer imports soter_augment
spec = importlib.util.spec_from_file_location("v14", WORK / "scripts/ml/train-soterllm-v14-fullft.py")
v14 = importlib.util.module_from_spec(spec)
sys.modules["v14"] = v14
spec.loader.exec_module(v14)

import onnxruntime
import transformers

print(f"transformers {transformers.__version__} | onnxruntime {onnxruntime.__version__}")
print(f"labels: {len(v14.ALL_LABELS)} -- this index order is a runtime contract, never reorder it")

# The hard constraint. lib/ml/onnxBackend.ts tokenizes with the in-repo WordPiece
# BertTokenizer off tokenizer_config/vocab.txt; there is no SentencePiece or BPE
# tokenizer in production. assert_wordpiece is BEHAVIOURAL -- it checks for ##
# continuation pieces, the absence of the SentencePiece U+2581 marker, contiguous
# ids and the five BERT specials. Naming a model "bert-something" does not pass it.
from transformers import AutoTokenizer

model_id = v14.ENCODERS.get(ENCODER, ENCODER)
tok = AutoTokenizer.from_pretrained(model_id)
print(f"\n[ok] {model_id} is WordPiece-compatible: {v14.assert_wordpiece(tok, model_id)}")
"""

CELL_OUTDIR = r"""# 4/8  Where the run writes.
#
#      /kaggle/working is persisted as this notebook version's Output, so unlike
#      Colab there is no Drive to mount and nothing to lose when the session ends.
#      --checkpoint is still passed: a 12h session cap is a real limit, and resuming
#      a committed run beats restarting one.
import shutil
from pathlib import Path

OUT = Path("/kaggle/working/models/ml-classifier-v14")
OUT.mkdir(parents=True, exist_ok=True)
RESUMABLE = True

# Kaggle caps /kaggle/working at ~20GB and counts it toward the version output.
free_gb = shutil.disk_usage("/kaggle/working").free / 1024 ** 3
print(f"output    : {OUT}")
print(f"free space: {free_gb:.1f} GiB")
if free_gb < 5:
    print("[WARN] under 5 GiB free. checkpoint.pt is ~1-2 GB for bert-base; cell 7 excludes")
    print("       it from the artifact zip, but the run still needs room to write it.")
print("resumable : True -- checkpoint.pt is written each epoch. If a session hits the")
print("            12h cap, add --resume in cell 6 and commit again.")
"""

CELL_BAKEOFF = r"""# 5/8  OPTIONAL encoder bake-off. ~25 min for four candidates on a P100.
#
#      Worth running once. Every model version so far trained a head over a frozen
#      MiniLM, so this repo has NEVER measured which encoder is right when the
#      encoder is actually trainable. 3 epochs on a 24K stratified subset ranks
#      candidates; it does not produce final numbers and it is NOT the gate.
RUN_BAKEOFF = True

# (label, encoder, extra flags). The FIRST row is the control that matters most:
# minilm with the encoder FROZEN is exactly what v7-v12 did. Comparing it against
# row 2 -- the same encoder, unfrozen -- isolates the single variable v14 changes.
# Without that row you cannot tell whether a gain came from unfreezing or from a
# bigger model, which is the question this whole round exists to answer.
CANDIDATES = [
    ("minilm-FROZEN (v12 control)", "minilm", ["--freeze-encoder"]),
    ("minilm", "minilm", []),
    ("distilbert", "distilbert", []),
    ("bert-base", "bert-base", []),
]

import json
import subprocess
import sys

if RUN_BAKEOFF:
    table = []
    for label, enc, extra in CANDIDATES:
        d = WORK / ("models/bakeoff-" + label.split()[0] + ("-frozen" if extra else ""))
        print(f"\n{'=' * 62}\nbake-off: {label}\n{'=' * 62}", flush=True)
        subprocess.run(
            [sys.executable, "scripts/ml/train-soterllm-v14-fullft.py",
             "--encoder", enc, "--output-dir", str(d),
             "--sample", "--sample-size", "24000", "--epochs", "3",
             "--batch-size", str(BATCH), "--grad-accum", str(ACCUM),
             "--amp", AMP, "--num-workers", "2"] + extra,
            cwd=WORK, check=False)
        stats = d / "training_stats.json"
        if stats.exists():
            s = json.loads(stats.read_text())
            m = s["final_metrics"]
            table.append((label, s["architecture"]["hidden_size"], m["f1_macro"],
                          m["attack_recall"], m["benign_fpr"], s["wall_clock_seconds"] / 60))
        else:
            print(f"[WARN] {label} produced no training_stats.json -- that is NO RESULT, not a loss")

    print(f"\n{'candidate':<30}{'hidden':>7}{'F1':>9}{'atk_rec':>9}{'benign_FPR':>12}{'min':>7}")
    for label, hid, f1, rec, fpr, mins in sorted(table, key=lambda r: -r[2]):
        print(f"{label:<30}{hid:>7}{f1:>9.4f}{rec:>9.4f}{fpr:>12.4f}{mins:>7.1f}")

    print("\nRead benign_FPR first, then F1. Precision is the documented weak axis:")
    print("36% false positives on benign-confusable rows, ~40% on meta-instructional benign,")
    print("while the deployed system already catches 95% of the hard attack set. An encoder")
    print("that buys recall by spending precision is a regression here, not a win.")
    print("\nThen read row 1 against row 2. If unfreezing minilm barely moves either metric,")
    print("the ceiling is the CORPUS, not the encoder -- and the honest move is to say so")
    print("rather than train something bigger.")
"""

CELL_RUN = r"""# 6/8  THE REAL RUN.
#
#      Full corpus, no --sample.
#
#      Two things dominate wall clock here, both measured on this corpus:
#        1. Padding. Token lengths are p50=18 / p90=47 but p99=452, so shuffled
#           batches of 32 pad 3,685,728 tokens per epoch where length-grouped
#           batches pad 421,504 -- 8.7x of the compute was padding, not data. A
#           direct A/B measured 4.88x faster wall clock. --length-grouped is ON by
#           default and prints the ratio it actually achieved.
#        2. Encoder size. minilm is ~5x fewer FLOPs than bert-base.
#
#      3 epochs, not 4: warmup->cosine converges inside 3, and epoch selection keeps
#      every epoch's weights anyway. The trainer prints an ETA after 40 steps -- if
#      that number does not fit Kaggle's 12h session cap, stop and lower the config
#      then, rather than losing a queued commit at hour 12.
import subprocess
import sys

cmd = [sys.executable, "scripts/ml/train-soterllm-v14-fullft.py",
       "--encoder", ENCODER,
       "--output-dir", str(OUT),
       "--epochs", "3",
       "--batch-size", str(BATCH),
       "--grad-accum", str(ACCUM),
       "--amp", AMP,
       "--encoder-lr", f"{ENCODER_LR:.3e}",
       "--head-lr", str(HEAD_LR),
       "--layer-decay", "0.9",
       "--warmup-frac", "0.06",
       "--fpr-ceiling", "0.03",
       "--num-workers", "2",
       "--augment",
       "--checkpoint"]
if CKPT_FLAG:
    cmd.append("--grad-checkpoint")
# cmd.append("--resume")      # <- uncomment if a previous session hit the 12h cap

print(" ".join(cmd), "\n", flush=True)
rc = subprocess.run(cmd, cwd=WORK, check=False).returncode
print(f"\nexit code {rc}")
if rc != 0:
    print("Non-zero exit. Read the traceback above BEFORE re-running: the trainer fails")
    print("loudly on purpose (leak assertion, non-WordPiece tokenizer, missing dataset).")
"""

CELL_PACKAGE = r"""# 7/8  Verify the artifact is complete, then package it into /kaggle/working.
#
#      No files.download() here -- on Kaggle you collect artifacts from the
#      notebook's Output tab (or the Data pane after a commit), which is also why
#      the zip lands directly in /kaggle/working rather than a temp dir.
import json
import zipfile
from pathlib import Path

REQUIRED = [
    "model.onnx",                              # the graph, temperature already baked in
    "labels.json",                             # index -> label, the runtime contract
    "calibration.json",                        # temperature + per-label thresholds + OOD entropy
    "tokenizer_config/vocab.txt",              # v12 shipped WITHOUT this and failed open in prod
    "tokenizer_config/tokenizer_config.json",
    "training_stats.json",
    "eval_results.json",
    "dataset_manifest.json",
    "split_indices.json",                      # v12's calibration split was unrecoverable
    "pytorch_model.bin",                       # needed for --verify-only and any future re-export
]

missing = [r for r in REQUIRED if not (OUT / r).is_file()]
if missing:
    raise SystemExit(f"INCOMPLETE artifact, do not ship: {missing}")

for r in REQUIRED:
    print(f"  {(OUT / r).stat().st_size:>12,}  {r}")

stats = json.loads((OUT / "training_stats.json").read_text())
m, sel = stats["final_metrics"], stats["epoch_selection"]
print(f"\nencoder        : {stats['base_model']}  ({stats['architecture']['hidden_size']}d)")
print(f"method         : {stats['method']}")
print(f"selected epoch : {sel['selected_epoch']}  by rule: {sel['rule']}")
print(f"macro F1       : {m['f1_macro']:.4f}")
print(f"attack recall  : {m['attack_recall']:.4f}")
print(f"benign FPR     : {m['benign_fpr']:.4f}   (ceiling {sel['fpr_ceiling']})")
print(f"vocab.txt      : {stats['tokenizer']['vocab_txt_tokens']} tokens")

parity = stats.get("onnx_parity", {})
if parity.get("verified"):
    print(f"ONNX parity    : OK, worst max|diff| = {parity['worst_max_abs_logit_diff']:.2e}")
else:
    print(f"ONNX parity    : UNVERIFIED ({parity.get('reason')})")
    print("                 close it locally: python scripts/ml/train-soterllm-v14-fullft.py \\")
    print("                     --verify-only models/ml-classifier-v14")

if (OUT / "PARITY_UNVERIFIED.json").exists():
    print("\n[!] PARITY_UNVERIFIED.json is present. Do not sign or deploy until it is gone.")

audit = json.loads((OUT / "calibration.json").read_text()).get("threshold_audit", {})
if audit.get("inert_thresholds"):
    print(f"\n[note] {len(audit['inert_thresholds'])} per-label threshold(s) are unreachable "
          f"(below the {audit.get('argmax_floor', 0):.4f} argmax floor):")
    print(f"       {audit['inert_thresholds']}")
    print(f"       {audit.get('consequence', '')}")

ZIP = Path("/kaggle/working/soterai-v14-artifact.zip")
with zipfile.ZipFile(ZIP, "w", zipfile.ZIP_DEFLATED) as z:
    for p in sorted(OUT.rglob("*")):
        if p.is_file() and p.name not in ("checkpoint.pt",):      # 1-2 GB, not needed locally
            z.write(p, p.relative_to(OUT).as_posix())
print(f"\n[ok] {ZIP}  ({ZIP.stat().st_size / 1048576:.1f} MB)")
print("\nDownload it from the Output tab (interactive) or the version's Data pane (commit).")
print("If the run was committed, the Output tab is the only place it exists -- the")
print("session filesystem is gone by then.")
"""

MD_AFTER = r"""## After the download

Unzip into `models/ml-classifier-v14/` in the repo, then run these **in order**.
Nothing about the run above is a deploy decision — the in-distribution validation
numbers are a training signal, not the gate.

```bash
# 0. Only if the notebook reported ONNX parity UNVERIFIED (no onnxruntime in the image)
python scripts/ml/train-soterllm-v14-fullft.py --verify-only models/ml-classifier-v14

# 1. Sign it. The runtime supply-chain gate refuses to deserialize an unsigned
#    artifact -- and augmentWithMl fails OPEN, so an unsigned model does not error,
#    it just silently turns the whole ML tier dark.
npx tsx scripts/ml/sign-model-artifact.ts --model models/ml-classifier-v14/model.onnx \
    --source local-training --builder-id soterai://local/v14

# 2. Prove the production loader accepts it (gate, labels, calibration, vocab.txt,
#    tokenizer, session, decide) -- the exact path a request takes.
npx tsx scripts/ml/_probe-v14-runtime.ts models/ml-classifier-v14

# 3. The honest out-of-distribution number. Note this script and not a training
#    metric: analyzeText() is synchronous and never calls augmentWithMl, so every
#    crossdist number produced before 2026-08-08 measured RULES ONLY.
npx tsx scripts/ml/eval-crossdist-production.ts

# 4. The two gap metrics v13's corpora were built to move.
npx tsx scripts/ml/measure-attack-gap-baseline.ts
```

### Acceptance gate

v14 replaces v12 only if all six hold. Anything less is a checkpoint worth
keeping, not a deploy.

| # | Gate | Bar |
|---|------|-----|
| 1 | Meta-instructional benign FPR | materially below v12's ~40% |
| 2 | No core recall regression | ≥97.10% recall at 5.2–5.6% FPR, `--limit 4250` |
| 3 | Injection recall protected | no drop vs v12 on the injection slice |
| 4 | Per-label validation holds | no label collapses to zero recall |
| 5 | Attack-gap set | prefix-priming recall >81.5%, ATTACK overall >95.0%, contrastive-benign FP <36% |
| 6 | Health + suite green | 1039 pass / 0 fail, guard health OK |

Gate 2 is the one that has bitten before: v6 lifted a target metric and quietly
regressed the core hybrid from 100% to 95.8%, and had to be rolled back. Always
verify at `--limit 4250` — the default 1200 is a different row set and its numbers
do not compare.

### Then, and only then

```bash
# .env and .env.production
ML_ONNX_MODEL_PATH=models/ml-classifier-v14/model.onnx
ML_ONNX_LABELS_PATH=models/ml-classifier-v14/labels.json
ML_ONNX_CALIBRATION_PATH=models/ml-classifier-v14/calibration.json
ML_ONNX_MAX_LENGTH=256        # MUST equal --max-length from the run
```

Keep v12 on disk. Rolling back is an env swap, and you want that to stay true.

Full detail, including the other hosts if Kaggle also fails:
`docs/ml/v14-gpu-training-structure.md` §4.3.
"""


def md(source: str) -> dict:
    return {"cell_type": "markdown", "metadata": {}, "source": source.splitlines(keepends=True)}


def code(source: str) -> dict:
    return {"cell_type": "code", "execution_count": None, "metadata": {}, "outputs": [],
            "source": source.rstrip("\n").splitlines(keepends=True)}


NOTEBOOK = {
    "cells": [
        md(MD_INTRO),
        code(CELL_GPU),
        code(CELL_BUNDLE),
        code(CELL_PREFLIGHT),
        code(CELL_OUTDIR),
        code(CELL_BAKEOFF),
        code(CELL_RUN),
        code(CELL_PACKAGE),
        md(MD_AFTER),
    ],
    "metadata": {
        "accelerator": "GPU",
        "kaggle": {"accelerator": "nvidiaTeslaT4", "dataSources": [], "isGpuEnabled": True,
                   "isInternetEnabled": True, "language": "python", "sourceType": "notebook"},
        "kernelspec": {"display_name": "Python 3", "language": "python", "name": "python3"},
        "language_info": {"name": "python"},
    },
    "nbformat": 4,
    "nbformat_minor": 0,
}

with open(OUT, "w", encoding="utf-8", newline="\n") as fh:
    json.dump(NOTEBOOK, fh, indent=1, ensure_ascii=False)
    fh.write("\n")

# Round-trip: a notebook that will not re-parse is worse than no notebook.
with open(OUT, encoding="utf-8") as fh:
    back = json.load(fh)
assert back["metadata"]["accelerator"] == "GPU"
assert back["metadata"]["kaggle"]["isGpuEnabled"] is True
assert back["metadata"]["kaggle"]["isInternetEnabled"] is True, "Internet off breaks pip + HF"
assert len(back["cells"]) == len(NOTEBOOK["cells"])
for cell in back["cells"]:
    assert cell["source"], "empty cell"
    if cell["cell_type"] == "code":
        compile("".join(cell["source"]).replace("!pip", "#pip"), "<cell>", "exec")

# No google.colab anywhere -- that import is the whole reason this file exists.
blob = "".join("".join(c["source"]) for c in back["cells"])
assert "google.colab" not in blob, "google.colab leaked into the Kaggle notebook"
assert "/content" not in blob, "Colab /content path leaked into the Kaggle notebook"

print(f"[ok] {OUT}")
print(f"     {len(NOTEBOOK['cells'])} cells, {os.path.getsize(OUT) / 1024:.1f} KB, "
      f"every code cell compiles, no google.colab / /content leakage")
