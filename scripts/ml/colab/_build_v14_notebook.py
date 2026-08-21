r"""Generate scripts/ml/colab/soterllm-v14-gpu.ipynb.

The notebook is generated rather than hand-edited because hand-editing .ipynb
JSON is how you end up with a file Colab refuses to open. Edit the CELLS list
below and re-run:

    python scripts/ml/colab/_build_v14_notebook.py

Cell bodies are plain (non-f) strings so that braces inside them stay literal.
"""
import json
import os

ROOT = r"C:\Users\USER\OneDrive\Desktop\Ai-Agent-Security-Guard"
OUT = os.path.join(ROOT, "scripts", "ml", "colab", "soterllm-v14-gpu.ipynb")

MD_INTRO = r"""# SoterLLM v14 — full encoder fine-tune (GPU)

**What is different about v14.** v7 through v12 all trained a ~330K-parameter MLP
head on top of a **frozen** 22M-parameter `all-MiniLM-L6-v2` encoder —
`train-soterllm-v10-transfer.py` sets `requires_grad = False` on every encoder
parameter. Five model versions, one month, and the encoder itself was never
trained even once. That is the plateau. It was a rational choice while training
had to fit on a CPU; a GPU removes the constraint that produced it.

So v14 trains the whole thing end to end, with layer-wise LR decay, and lets you
swap the encoder for a larger one.

**The one hard constraint.** Production tokenizes with the in-repo WordPiece
`BertTokenizer` reading `tokenizer_config/vocab.txt` (`lib/ml/onnxBackend.ts`).
There is no SentencePiece or BPE tokenizer anywhere in the runtime. A DeBERTa-v3,
RoBERTa or XLM-R encoder will train perfectly here and then **fail to load in
production**. Cell 3 enforces this behaviourally, not by matching names.

Hidden size is *not* constrained — nothing in `lib/` hardcodes 384 — so 768- and
1024-dim encoders are drop-in.

**Order:** run the cells top to bottom. Cell 5 (encoder bake-off) is optional but
worth the ~25 minutes once, because nobody has ever measured which encoder is
right for this corpus when the encoder is actually trainable.
"""

CELL_GPU = r"""# 1/8  Confirm a GPU is really attached, and read its VRAM before choosing a config.
#      Runtime > Change runtime type > T4 GPU (or better) if this cell exits.
import torch

if not torch.cuda.is_available():
    raise SystemExit(
        "No CUDA device attached. Runtime > Change runtime type > GPU, then re-run.\n"
        "v14 exists to fine-tune the ENCODER end-to-end; on CPU that is a multi-day job, "
        "which is exactly why v7-v12 froze it."
    )

name = torch.cuda.get_device_name(0)
vram_gb = torch.cuda.get_device_properties(0).total_memory / 1024 ** 3
bf16_ok = torch.cuda.is_bf16_supported()

print(f"GPU      : {name}")
print(f"VRAM     : {vram_gb:.1f} GiB")
print(f"torch    : {torch.__version__}  (cuda {torch.version.cuda})")
print(f"bf16     : {bf16_ok}")

# bf16 needs Ampere or newer. A T4 is Turing, so it takes fp16 + GradScaler.
# The trainer unscales before clipping, so fp16 is safe here -- it is not slower,
# just fussier numerically.
AMP = "bf16" if bf16_ok else "fp16"

# Batch sizes are large on purpose. This corpus is SHORT text -- token lengths are
# p50=18, mean 35.8, p90=47 over all 146,757 rows -- so a batch of 32 is roughly
# 600 tokens and leaves a GPU almost entirely idle. Length-grouped batching (on by
# default) keeps padding from undoing that.
ENCODER = "minilm"          # the fast path AND the honest control -- see cell 5
if vram_gb >= 38:
    BATCH, ACCUM, CKPT_FLAG = 256, 1, False
elif vram_gb >= 22:
    BATCH, ACCUM, CKPT_FLAG = 192, 1, False
else:
    BATCH, ACCUM, CKPT_FLAG = 128, 1, False

# Larger batch needs a larger LR. sqrt scaling from the 32-batch baseline of 2e-5
# is the conservative choice (linear scaling overshoots on a fine-tune).
ENCODER_LR = 2e-5 * (BATCH / 32) ** 0.5
HEAD_LR = 1e-3

print(f"\nchosen   : --encoder {ENCODER} --batch-size {BATCH} --grad-accum {ACCUM} --amp {AMP}"
      f" --encoder-lr {ENCODER_LR:.2e}" + ("  --grad-checkpoint" if CKPT_FLAG else ""))
print("\nSwitching to bert-base? Set ENCODER = 'bert-base' and halve BATCH (110M params,")
print("768d). Run minilm first regardless: unfrozen minilm vs v12's FROZEN minilm is the")
print("one comparison that isolates the single variable v14 changes. If that is flat, a")
print("bigger encoder will not rescue it and the ceiling is the corpus, not the model.")
"""

CELL_BUNDLE = r"""# 2/8  Get soterai-v14-train-bundle.zip into /content and unpack it.
#      Built locally by scripts/ml/colab/_build_v14_bundle.py, which verifies the
#      zip by EXTRACTING it: PowerShell's Compress-Archive writes backslash
#      separators that extractall() treats as part of the filename, so you would
#      silently get one file literally named "scripts\ml\train-...py" in the CWD.
import hashlib
import os
import zipfile
from pathlib import Path

BUNDLE = "soterai-v14-train-bundle.zip"
WORK = Path("/content/soter-v14")
WORK.mkdir(parents=True, exist_ok=True)
os.chdir(WORK)

src = next((c for c in (WORK / BUNDLE,
                        Path("/content") / BUNDLE,
                        Path("/content/drive/MyDrive") / BUNDLE) if c.exists()), None)
if src is None:
    from google.colab import files
    src = WORK / next(iter(files.upload()))     # pick soterai-v14-train-bundle.zip

print(f"bundle : {src}")
print(f"sha256 : {hashlib.sha256(src.read_bytes()).hexdigest()[:16]}...  "
      f"({src.stat().st_size / 1048576:.1f} MB)")

with zipfile.ZipFile(src) as z:
    bad = [n for n in z.namelist() if "\\" in n]
    if bad:
        raise SystemExit(f"backslash paths in zip -- rebuild with _build_v14_bundle.py: {bad}")
    z.extractall(WORK)

missing = [r for r in ("scripts/ml/train-soterllm-v14-fullft.py",
                       "scripts/ml/soter_augment.py") if not (WORK / r).is_file()]
if missing:
    raise SystemExit(f"did not extract to real paths: {missing}")

rows = 0
for p in sorted(WORK.glob("datasets/*.jsonl")) + sorted(WORK.glob("artifacts/ml-v2/*.jsonl")):
    n = sum(1 for _ in p.open(encoding="utf-8"))
    rows += n
    print(f"  {n:>7,}  {p.relative_to(WORK)}")
print(f"  {rows:>7,}  TOTAL rows")
print("\nml-v13-meta-instructional.jsonl and ml-v13-attack-gaps.jsonl have never been trained on.")
print("They target the two measured gaps: benign meta-instructional FPR, and prefix-priming recall.")
"""

CELL_PREFLIGHT = r"""# 3/8  Deps, then a REAL preflight so a wrong encoder fails in 30 seconds, not in 2 hours.
#
#      onnxruntime is the one that matters: it is what the parity gate uses. Without
#      it the run still completes and keeps its weights -- the trainer saves
#      pytorch_model.bin BEFORE the gate on purpose -- but the artifact lands
#      PARITY_UNVERIFIED and you close the gate locally with --verify-only.
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
#      Colab recycles the runtime and wipes /content, and a full fine-tune is long
#      enough that this happens for real. On Drive, both checkpoint.pt (written each
#      epoch) and the final artifacts survive it, at the cost of some I/O per epoch.
from pathlib import Path

try:
    from google.colab import drive
    drive.mount("/content/drive")
    OUT = Path("/content/drive/MyDrive/soterai/models/ml-classifier-v14")
    RESUMABLE = True
except Exception as exc:
    print(f"Drive not mounted ({exc}).")
    print("Falling back to /content -- if the runtime recycles mid-run, THE RUN IS LOST.")
    OUT = WORK / "models/ml-classifier-v14"
    RESUMABLE = False

OUT.mkdir(parents=True, exist_ok=True)
print(f"output    : {OUT}")
print(f"resumable : {RESUMABLE}")
if RESUMABLE:
    print("            --checkpoint writes checkpoint.pt here each epoch; re-run cell 6")
    print("            with --resume after a disconnect and it picks up where it stopped.")
"""

CELL_BAKEOFF = r"""# 5/8  OPTIONAL encoder bake-off. ~25 min for three candidates on a T4.
#
#      Worth running once. Every model version so far trained a head over a frozen
#      MiniLM, so this repo has NEVER measured which encoder is right when the
#      encoder is trainable. 3 epochs on a 24K stratified subset ranks candidates;
#      it does not produce final numbers, and it is not the acceptance gate.
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
        print(f"\n{'=' * 62}\nbake-off: {label}\n{'=' * 62}")
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
#      Two things dominate wall clock here, both measured:
#        1. Padding. Token lengths are p50=18 / p90=47 but p99=452, so shuffled
#           batches of 32 pad 3,685,728 tokens per epoch where length-grouped
#           batches pad 421,504 -- 8.7x of the compute was padding, not data.
#           --length-grouped is ON by default and prints the ratio it achieved.
#        2. Encoder size. minilm is ~5x fewer FLOPs than bert-base.
#
#      3 epochs, not 4: warmup->cosine converges inside 3, and epoch selection
#      keeps every epoch's weights anyway, so a shorter run costs you nothing but
#      the chance to overfit. The trainer prints an ETA after 40 steps -- if that
#      number is unaffordable, kill the cell then rather than three hours in.
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
       "--augment"]
if CKPT_FLAG:
    cmd.append("--grad-checkpoint")
if RESUMABLE:
    cmd.append("--checkpoint")
    # cmd.append("--resume")    # <- uncomment after a disconnect, then re-run this cell

print(" ".join(cmd), "\n")
rc = subprocess.run(cmd, cwd=WORK, check=False).returncode
print(f"\nexit code {rc}")
if rc != 0:
    print("Non-zero exit. Check the traceback above BEFORE re-running: the trainer fails")
    print("loudly on purpose (leak assertion, non-WordPiece tokenizer, missing dataset).")
"""

CELL_PACKAGE = r"""# 7/8  Verify the artifact is complete, then package and download it.
#      Every file below is one the production loader or the signing step needs.
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
    print(f"                     --verify-only models/ml-classifier-v14")

if (OUT / "PARITY_UNVERIFIED.json").exists():
    print("\n[!] PARITY_UNVERIFIED.json is present. Do not sign or deploy until it is gone.")

audit = json.loads((OUT / "calibration.json").read_text()).get("threshold_audit", {})
if audit.get("inert_thresholds"):
    print(f"\n[note] {len(audit['inert_thresholds'])} per-label threshold(s) are unreachable "
          f"(below the {audit.get('argmax_floor', 0):.4f} argmax floor):")
    print(f"       {audit['inert_thresholds']}")
    print(f"       {audit.get('consequence', '')}")

ZIP = Path("/content") / "soterai-v14-artifact.zip"
with zipfile.ZipFile(ZIP, "w", zipfile.ZIP_DEFLATED) as z:
    for p in sorted(OUT.rglob("*")):
        if p.is_file() and p.name not in ("checkpoint.pt",):      # 1-2 GB, and not needed locally
            z.write(p, p.relative_to(OUT).as_posix())
print(f"\n[ok] {ZIP}  ({ZIP.stat().st_size / 1048576:.1f} MB)")

from google.colab import files
files.download(str(ZIP))
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

Full detail, including what to do when a gate fails:
`docs/ml/v14-gpu-training-structure.md`.
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
        "colab": {"name": "soterllm-v14-gpu.ipynb", "provenance": [], "toc_visible": True},
        "kernelspec": {"display_name": "Python 3", "name": "python3"},
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
assert len(back["cells"]) == len(NOTEBOOK["cells"])
for cell in back["cells"]:
    assert cell["source"], "empty cell"
    if cell["cell_type"] == "code":
        compile("".join(cell["source"]).replace("!pip", "#pip"), "<cell>", "exec")

print(f"[ok] {OUT}")
print(f"     {len(NOTEBOOK['cells'])} cells, {os.path.getsize(OUT) / 1024:.1f} KB, "
      f"every code cell compiles")
