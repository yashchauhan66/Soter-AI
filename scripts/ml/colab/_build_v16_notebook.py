r"""Generate scripts/ml/colab/soterllm-v16-gpu.ipynb.

The notebook is generated rather than hand-edited because hand-editing .ipynb
JSON is how you end up with a file Colab refuses to open. Edit the CELLS list
below and re-run:

    python scripts/ml/colab/_build_v16_notebook.py

Cell bodies are plain (non-f) strings so that braces inside them stay literal.
The ONLY interpolated text is the intro's corpus figures, and they are read from
artifacts/ml/v16-corpus-report.json rather than typed in -- a hand-typed corpus
count in a notebook is a claim nobody re-checks, and this repo has already
shipped one fake number (the "99.29% val F1" that came from a leaking split).

v16 vs the v15 notebook, deliberately:
  * Same trainer, same encoder, same pinned hyperparameters. The single moving
    part is still the corpus: 10 files instead of 9.
  * The acceptance gate is measured against **v14, not v15**. v15 came back
    NO-GO (crossdist FPR 5.66% > the 5.6% bar, and paired attack McNemar
    b=21/c=8, p=0.0241 in v14's favour), so v14 is what is live and v14 is the
    bar v16 has to clear.
  * A new gate step re-scores the 70-row probe battery, which is the instrument
    v16's increment was designed against. It is small -- every number off it
    must be quoted with its denominator.
"""
import json
import os

ROOT = r"C:\Users\USER\OneDrive\Desktop\Ai-Agent-Security-Guard"
OUT = os.path.join(ROOT, "scripts", "ml", "colab", "soterllm-v16-gpu.ipynb")
REPORT = os.path.join(ROOT, "artifacts", "ml", "v16-corpus-report.json")

if not os.path.isfile(REPORT):
    raise SystemExit(
        "[FATAL] artifacts/ml/v16-corpus-report.json not found.\n"
        "        Run: python scripts/ml/verify-v16-corpus.py\n"
        "        The notebook's intro quotes real corpus figures and refuses to\n"
        "        invent them.")

R = json.loads(open(REPORT, encoding="utf-8").read())
INC = R["increment"]
BEFORE, AFTER = R["before"], R["after"]
INC_ROWS = INC["rows"]
INC_NON_EN = sum(v for k, v in INC["languages"].items() if k != "en")
INC_LANGS = len(INC["languages"])
INC_MT = INC["labels"].get("MULTI_TURN_ESCALATION", 0)
INC_SAFE = INC["labels"].get("SAFE", 0)

MD_INTRO = f"""# SoterLLM v16 — targeted-weakness retrain (GPU)

**What v16 changes, and nothing else.** v16 is v14's trainer, v14's encoder
(`all-MiniLM-L6-v2`, WordPiece), and v14's exact hyperparameters, run over the
same 9-file corpus v15 used **plus one 10th file** —
`datasets/ml-v16-threat-corpus.jsonl`, **{INC_ROWS:,} rows**, of which
**{INC_NON_EN:,} are natively non-English** across {INC_LANGS} languages,
**{INC_MT:,} are MULTI_TURN_ESCALATION**, and **{INC_SAFE:,} are benign controls**.
That is the whole experiment. Everything else is held fixed on purpose so the
result is falsifiable: if the model moves, the corpus increment moved it.

**The increment was written against a measurement, not a hunch.** v15 was scored
on a held-out 70-row red-team probe battery (56 attacks / 14 benign) built from
published-technique families it had never seen:

| what | v15 |
|---|---|
| overall recall | **89.29%** (50/56) |
| overall FPR | **28.57%** (4/14) |
| MULTI_TURN_ESCALATION | 62.5% (5/8) |
| DATA_EXFILTRATION_ATTEMPT | 75% |
| TOOL_CALL_ABUSE | 75% |
| recall — en | 96% (25/26) |
| recall — ru / hinglish | 75% (6/8) each |
| recall — ja | 67% (2/3) |

Those denominators are small and are quoted here so nobody later reports "89%"
as if it came off ordinary traffic. Two root causes were then confirmed in the
corpus itself: MULTI_TURN_ESCALATION was **1,303 / 147,912 = 0.88%** of all
training rows, and native non-English was **~3.1%**. The increment moves both —
MULTI_TURN **{BEFORE['multi_turn_share_pct']}% → {AFTER['multi_turn_share_pct']}%**,
non-English **{BEFORE['non_english_share_pct']}% → {AFTER['non_english_share_pct']}%**
— on a corpus that grows {BEFORE['rows']:,} → {AFTER['rows']:,} rows.

**The other half of the finding is over-defense, and it shaped the data more than
the recall gap did.** 3 of v15's 4 probe false positives were benign
*security-education* rows: people asking what prompt injection is, or how to
explain it to a team. The 4th was a benign Hinglish multi-turn coding question
flagged JAILBREAK. So the increment deliberately does **not** just add attacks:

* every attack family is paired with **benign controls in the same language and
  the same register**, so the model cannot learn "non-English = suspicious";
* MULTI_TURN is authored in **three structurally distinct families**
  (false-prior-consent, crescendo, context-reset) rather than one template, and
  is paired with a large **benign-continuity** block that uses identical
  continuity language ("as we agreed", "continuing from before") with innocuous
  asks — otherwise the model learns *continuity language = attack*, which is
  exactly probe FP #4;
* authority claims ("I'm the developer", "compliance signed off") appear in
  benign rows too, capped, so the claim itself is not the signal.

This is why the increment is a few thousand rows and not tens of thousands.
Variety, not volume, is the lever this corpus responds to — v14's round settled
that three independent ways (unfrozen ≈ frozen minilm, v14-vs-v12 McNemar
p=0.512, tokenizer damage uncorrelated with which languages actually fail).

**The hard constraint is unchanged.** Production tokenizes with the in-repo
WordPiece `BertTokenizer` off `tokenizer_config/vocab.txt`
(`lib/ml/onnxBackend.ts`). Keep the encoder `minilm`. A SentencePiece/BPE encoder
(XLM-R, DeBERTa-v3) trains fine here and then **fails to load in production** —
which does not error, it silently turns the ML tier dark. Cell 3 enforces this
behaviourally.

**v14 stays live, and v14 — not v15 — is the bar.** v15 was a NO-GO: crossdist
FPR came in at 5.66% against a 5.6% ceiling, and the paired attack McNemar was
b=21 / c=8, p=0.0241 *in v14's favour*. So v16 writes to its own directory and
is gated against v14. Run the cells top to bottom.
"""

CELL_GPU = r"""# 1/7  Confirm a GPU is attached, read its VRAM, and PIN the config to v14's.
#      Runtime > Change runtime type > T4 GPU (or better) if this cell exits.
import torch

if not torch.cuda.is_available():
    raise SystemExit(
        "No CUDA device attached. Runtime > Change runtime type > GPU, then re-run.\n"
        "v16 fine-tunes the ENCODER end-to-end exactly as v14 did; on CPU that is a "
        "multi-hour job (measured 4.8 h for 3 epochs), which is the whole reason you are "
        "in Colab rather than running it locally."
    )

name = torch.cuda.get_device_name(0)
vram_gb = torch.cuda.get_device_properties(0).total_memory / 1024 ** 3
bf16_ok = torch.cuda.is_bf16_supported()

print(f"GPU      : {name}")
print(f"VRAM     : {vram_gb:.1f} GiB")
print(f"torch    : {torch.__version__}  (cuda {torch.version.cuda})")
print(f"bf16     : {bf16_ok}")

# --- config PINNED to v14, not derived from VRAM -----------------------------
# v14 trained at batch 128 / encoder-lr 4e-5 (models/ml-classifier-v14/training_stats.json).
# v16's entire purpose is a single-variable comparison against it, so these are
# fixed rather than scaled to whatever GPU you drew. minilm at batch 128 is tiny
# -- seq lengths are p50=18 tokens over the whole corpus -- so it fits any GPU
# that can run v14, T4 included; there is no VRAM tier that needs a smaller batch.
ENCODER = "minilm"          # settled in v14's round; do not swap (see intro)
BATCH = 128
ACCUM = 1
CKPT_FLAG = False           # unnecessary for a 22M-param encoder at this batch

# bf16 needs Ampere+. v14 trained in bf16; a T4 is Turing, so it takes fp16 +
# GradScaler. The trainer unscales before clipping, so fp16 is safe -- the only
# effect is a hair more numeric noise than v14 had, unavoidable on Turing and far
# smaller than the corpus change being measured.
AMP = "bf16" if bf16_ok else "fp16"

# sqrt scaling off the 32-batch 2e-5 baseline. At batch 128 this is 4.0e-5 -- the
# exact value v14 used -- so the formula and the pin agree by construction.
ENCODER_LR = 2e-5 * (BATCH / 32) ** 0.5
HEAD_LR = 1e-3

print(f"\npinned   : --encoder {ENCODER} --batch-size {BATCH} --grad-accum {ACCUM} --amp {AMP}"
      f" --encoder-lr {ENCODER_LR:.2e} --head-lr {HEAD_LR:.0e}")
print("           (batch/LR match v14 exactly; only the corpus differs)")
if bf16_ok:
    print("           bf16 available -> byte-for-byte the same AMP mode as v14.")
else:
    print("           T4/Turing -> fp16; a minor numeric difference from v14's bf16, expected.")
"""

CELL_BUNDLE = r"""# 2/7  Get soterai-v16-train-bundle.zip into /content and unpack it.
#      Built locally by scripts/ml/colab/_build_v16_bundle.py, which verifies the
#      zip by EXTRACTING it: PowerShell's Compress-Archive writes backslash
#      separators that extractall() treats as part of the filename, so you would
#      silently get one file literally named "scripts\ml\train-...py" in the CWD.
import hashlib
import os
import zipfile
from pathlib import Path

BUNDLE = "soterai-v16-train-bundle.zip"
WORK = Path("/content/soter-v16")
WORK.mkdir(parents=True, exist_ok=True)
os.chdir(WORK)

src = next((c for c in (WORK / BUNDLE,
                        Path("/content") / BUNDLE,
                        Path("/content/drive/MyDrive") / BUNDLE) if c.exists()), None)
if src is None:
    from google.colab import files
    src = WORK / next(iter(files.upload()))     # pick soterai-v16-train-bundle.zip

print(f"bundle : {src}")
print(f"sha256 : {hashlib.sha256(src.read_bytes()).hexdigest()[:16]}...  "
      f"({src.stat().st_size / 1048576:.1f} MB)")

with zipfile.ZipFile(src) as z:
    bad = [n for n in z.namelist() if "\\" in n]
    if bad:
        raise SystemExit(f"backslash paths in zip -- rebuild with _build_v16_bundle.py: {bad}")
    z.extractall(WORK)

missing = [r for r in ("scripts/ml/train-soterllm-v14-fullft.py",
                       "scripts/ml/soter_augment.py",
                       "datasets/ml-v15-threat-corpus.jsonl",
                       "datasets/ml-v16-threat-corpus.jsonl") if not (WORK / r).is_file()]
if missing:
    raise SystemExit(f"did not extract to real paths: {missing}")

rows = 0
for p in sorted(WORK.glob("datasets/*.jsonl")) + sorted(WORK.glob("artifacts/ml-v2/*.jsonl")):
    n = sum(1 for _ in p.open(encoding="utf-8"))
    rows += n
    print(f"  {n:>7,}  {p.relative_to(WORK)}")
print(f"  {rows:>7,}  TOTAL rows")

# The increment IS the experiment. Its whole point is native non-Latin text, so a
# transfer that mangled the encoding would delete the signal while leaving the row
# count intact -- check the bytes, not just the lines.
inc = WORK / "datasets/ml-v16-threat-corpus.jsonl"
n_inc = sum(1 for _ in inc.open(encoding="utf-8"))
n_utf8 = sum(1 for line in inc.open(encoding="utf-8") if any(ord(c) > 127 for c in line))
print(f"\nml-v16-threat-corpus.jsonl : {n_inc:,} rows, {n_utf8:,} with non-ASCII text")
if n_utf8 == 0:
    raise SystemExit("increment has no non-ASCII rows -- the file was mangled in transfer")
print("This is the ONLY file v15 never trained on. It is a small share of the corpus")
print("on purpose: variety, not volume, is what this corpus responds to.")
"""

CELL_PREFLIGHT = r"""# 3/7  Deps, then a REAL preflight so a wrong encoder fails in 30 seconds, not in 2 hours.
#
#      onnxruntime is the one that matters: it is what the parity gate uses. Without
#      it the run still completes and keeps its weights -- the trainer saves
#      pytorch_model.bin BEFORE the gate on purpose -- but the artifact lands
#      PARITY_UNVERIFIED and you close the gate locally with --verify-only.
!pip install -q onnxruntime onnx scipy scikit-learn

import importlib.util
import sys

sys.path.insert(0, str(WORK / "scripts" / "ml"))      # before exec: the trainer imports soter_augment
spec = importlib.util.spec_from_file_location("trainer", WORK / "scripts/ml/train-soterllm-v14-fullft.py")
trainer = importlib.util.module_from_spec(spec)
sys.modules["trainer"] = trainer
spec.loader.exec_module(trainer)

import onnxruntime
import transformers

print(f"transformers {transformers.__version__} | onnxruntime {onnxruntime.__version__}")
print(f"labels: {len(trainer.ALL_LABELS)} -- this index order is a runtime contract, never reorder it")

# The hard constraint. lib/ml/onnxBackend.ts tokenizes with the in-repo WordPiece
# BertTokenizer off tokenizer_config/vocab.txt; there is no SentencePiece or BPE
# tokenizer in production. assert_wordpiece is BEHAVIOURAL -- it checks for ##
# continuation pieces, the absence of the SentencePiece U+2581 marker, contiguous
# ids and the five BERT specials. Naming a model "bert-something" does not pass it.
from transformers import AutoTokenizer

model_id = trainer.ENCODERS.get(ENCODER, ENCODER)
tok = AutoTokenizer.from_pretrained(model_id)
print(f"\n[ok] {model_id} is WordPiece-compatible: {trainer.assert_wordpiece(tok, model_id)}")

# minilm's vocab is English-centric, and v16 feeds it a lot of ru/zh/ja/ar. That is
# expected and is NOT a reason to swap the encoder: v14's round measured tokenizer
# damage against per-language failure and found them uncorrelated (Chinese is ~60%
# [UNK] and still rescues at 100%). Printed so the number is on the record rather
# than rediscovered as a surprise mid-gate.
import unicodedata
samples = []
with open(WORK / "datasets/ml-v16-threat-corpus.jsonl", encoding="utf-8") as fh:
    for line in fh:
        import json as _json
        r = _json.loads(line)
        if any(ord(c) > 127 for c in r["text"]):
            samples.append(r)
seen = {}
for r in samples:
    lang = r.get("language", "?")
    if lang in seen:
        continue
    ids = tok(r["text"], add_special_tokens=False)["input_ids"]
    unk = sum(1 for i in ids if i == tok.unk_token_id)
    seen[lang] = (len(ids), unk)
print("\nper-language WordPiece coverage on the increment (informational, not a gate):")
for lang, (n, unk) in sorted(seen.items()):
    print(f"  {lang:<10} {n:>4} pieces, {unk:>3} [UNK] ({100*unk/max(1,n):5.1f}%)")
"""

CELL_OUTDIR = r"""# 4/7  Where the run writes.
#      Colab recycles the runtime and wipes /content, and a full fine-tune is long
#      enough that this happens for real. On Drive, both checkpoint.pt (written each
#      epoch) and the final artifacts survive it, at the cost of some I/O per epoch.
#      Note the v16 path: v14's directory is left untouched so rollback stays an env swap.
from pathlib import Path

try:
    from google.colab import drive
    drive.mount("/content/drive")
    OUT = Path("/content/drive/MyDrive/soterai/models/ml-classifier-v16")
    RESUMABLE = True
except Exception as exc:
    print(f"Drive not mounted ({exc}).")
    print("Falling back to /content -- if the runtime recycles mid-run, THE RUN IS LOST.")
    OUT = WORK / "models/ml-classifier-v16"
    RESUMABLE = False

OUT.mkdir(parents=True, exist_ok=True)
print(f"output    : {OUT}")
print(f"resumable : {RESUMABLE}")
if RESUMABLE:
    print("            --checkpoint writes checkpoint.pt here each epoch; re-run cell 5")
    print("            with --resume after a disconnect and it picks up where it stopped.")
"""

CELL_RUN = r"""# 5/7  THE REAL RUN.  Full corpus, no --sample.
#
#      The one v16-specific line is --train-datasets. The trainer's built-in
#      default is v14's 8-file corpus; passing all 10 files explicitly is what makes
#      this v16 rather than a v14 rerun. Miss it and you silently drop BOTH the v15
#      and v16 increments. Order matches v15's load order so the group-aware split
#      stays stable.
#
#      Wall clock is dominated by padding and encoder size, both measured: token
#      lengths are p50=18 / p90=47 but p99=452, so length-grouped batching (ON by
#      default) pads ~8.7x fewer tokens than shuffled batches of 32. The trainer
#      prints an ETA after 40 steps -- if it is unaffordable, kill the cell then,
#      not three hours in. On a T4 this corpus at batch 128 runs on the order of an
#      hour per epoch; 3 epochs is the target (v14 selected epoch 3).
import subprocess
import sys

# v15's exact corpus (first 9) + the v16 increment (10th), in load order.
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
    "datasets/ml-v16-threat-corpus.jsonl",       # <- the v16 increment
]
for d in DATASETS:
    if not (WORK / d).is_file():
        raise SystemExit(f"missing dataset {d} -- re-run cell 2 (the bundle did not fully extract)")

cmd = [sys.executable, "scripts/ml/train-soterllm-v14-fullft.py",
       "--train-datasets", *DATASETS,
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

CELL_PACKAGE = r"""# 6/7  Verify the artifact is complete, then package and download it.
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

# Sanity: the manifest must show 10 datasets. If it shows 8, --train-datasets was
# dropped and you just retrained v14 under a new name -- which would still print
# perfectly healthy metrics right here.
man = json.loads((OUT / "dataset_manifest.json").read_text())
datasets = man.get("datasets", [])
rows_per_file = man.get("rows_per_file", {})
print(f"\ndatasets in manifest: {len(datasets)}")
for d in datasets:
    # The trainer persists rows_per_file as {dataset_path: row_count}, not a list.
    # Iterating the dict directly returns path strings -- formatting one with `:,`
    # caused the old packaging cell to fail after an otherwise successful run.
    n = rows_per_file.get(d, 0) if isinstance(rows_per_file, dict) else 0
    print(f"  {int(n):>7,}  {d}")
if len(datasets) != 10:
    raise SystemExit("Expected 10 datasets. This artifact is NOT v16 -- re-run cell 5.")
if any(int(rows_per_file.get(d, 0)) <= 0 for d in datasets):
    raise SystemExit("One or more manifest datasets loaded zero rows; do not package this artifact.")

print("\nThese are IN-DISTRIBUTION validation numbers. They are a training signal, not")
print("the deploy gate -- the gate is the v14-vs-v16 McNemar test in the next section.")

parity = stats.get("onnx_parity", {})
if parity.get("verified"):
    print(f"ONNX parity    : OK, worst max|diff| = {parity['worst_max_abs_logit_diff']:.2e}")
else:
    print(f"ONNX parity    : UNVERIFIED ({parity.get('reason')})")
    print("                 close it locally: python scripts/ml/train-soterllm-v14-fullft.py \\")
    print(f"                     --verify-only models/ml-classifier-v16")

if (OUT / "PARITY_UNVERIFIED.json").exists():
    print("\n[!] PARITY_UNVERIFIED.json is present. Do not sign or deploy until it is gone.")

audit = json.loads((OUT / "calibration.json").read_text()).get("threshold_audit", {})
if audit.get("inert_thresholds"):
    print(f"\n[note] {len(audit['inert_thresholds'])} per-label threshold(s) are unreachable "
          f"(below the {audit.get('argmax_floor', 0):.4f} argmax floor):")
    print(f"       {audit['inert_thresholds']}")
    print(f"       {audit.get('consequence', '')}")

ZIP = Path("/content") / "soterai-v16-artifact.zip"
with zipfile.ZipFile(ZIP, "w", zipfile.ZIP_DEFLATED) as z:
    for p in sorted(OUT.rglob("*")):
        if p.is_file() and p.name not in ("checkpoint.pt",):      # 1-2 GB, and not needed locally
            z.write(p, p.relative_to(OUT).as_posix())
print(f"\n[ok] {ZIP}  ({ZIP.stat().st_size / 1048576:.1f} MB)")

from google.colab import files
files.download(str(ZIP))
"""

MD_AFTER = r"""## After the download

Unzip into `models/ml-classifier-v16/` in the repo, then run these **in order**.
None of the in-distribution numbers above is a deploy decision.

**The bar is v14, not v15.** v15 trained fine and still came back NO-GO: crossdist
FPR 5.66% against a 5.6% ceiling, and paired attack McNemar b=21 / c=8, p=0.0241
*in v14's favour*. v14 is what is live. So every comparison below is v14-vs-v16,
and v15 is included only as a third arm to show whether the increment fixed what
v15 got wrong.

```bash
# 0. Only if the notebook reported ONNX parity UNVERIFIED (no onnxruntime in the image)
python scripts/ml/train-soterllm-v14-fullft.py --verify-only models/ml-classifier-v16

# 1. Sign it. augmentWithMl fails OPEN on an unsigned artifact -- so an unsigned
#    model does not error, it silently turns the whole ML tier dark.
npx tsx scripts/ml/sign-model-artifact.ts --model models/ml-classifier-v16/model.onnx \
    --source local-training --builder-id soterai://local/v16

# 2. Prove the production loader accepts it (gate, labels, calibration, vocab.txt,
#    tokenizer, session, decide) -- the exact path a request takes.
npx tsx scripts/ml/_probe-v14-runtime.ts models/ml-classifier-v16

# 3. THE GATE: v14 vs v16 on the SAME rows, with McNemar.
#      a) the clean battery (274 rows, 15 languages)
npx tsx scripts/ml/compare-models.ts --file datasets/v15-test-battery.jsonl \
    --a models/ml-classifier-v14 --b models/ml-classifier-v16 \
    --out artifacts/ml/v14-vs-v16-battery.json
#      b) the tranche scoreset -- the confidently-blind ru/hinglish cells
npx tsx scripts/ml/compare-models.ts --file artifacts/ml/_v15-tranches-scoreset.jsonl \
    --a models/ml-classifier-v14 --b models/ml-classifier-v16 \
    --out artifacts/ml/v14-vs-v16-tranches.json

# 4. No-regression on ordinary traffic. Paired McNemar on the OOD corpus catches
#    any row v16 lost that v14 caught, regardless of the absolute number:
npx tsx scripts/ml/compare-models.ts --file datasets/crossdist-eval-v3.jsonl \
    --a models/ml-classifier-v14 --b models/ml-classifier-v16 \
    --out artifacts/ml/v14-vs-v16-crossdist.json
#    For the headline-comparable 97.52%/5.56% number, point .env's ML_ONNX_* at v16
#    and run:  npx tsx scripts/ml/eval-crossdist-production.ts --limit 4250

# 5. THE INSTRUMENT v16 WAS BUILT AGAINST: re-score the 70-row probe battery.
#    v15 scored recall 89.29% (50/56) / FPR 28.57% (4/14) on it (rules-only was
#    62.5% / 21.43%, so the ML tier is carrying +26.79 pts of that recall).
#    score-battery.ts runs the FULL pipeline, so it reads the model from .env --
#    point ML_ONNX_* at v16 for this run, then back at v14 for the baseline arm.
npx tsx scripts/ml/score-battery.ts --file datasets/v16-probe-battery.jsonl \
    --out artifacts/ml/v16-probe-v16.json
#    Compare against the v15 arm already on disk: artifacts/ml/v16-probe-v15.json
#    (+ -misses.jsonl / -fps.jsonl, which name the exact 6 misses and 4 FPs).
```

### Acceptance gate

v16 replaces v14 only if **all** of these hold. If gate 1 comes back "no
significant difference" (p > 0.05), that is a real finding, not a failure to
explain away — v16 is a checkpoint to keep, and v14 stays live. Do not ship noise
as an improvement.

| # | Gate | Bar |
|---|------|-----|
| 1 | Battery McNemar (step 3a) | v16 **not significantly worse** than v14; ideally b/c lopsided in v16's favour |
| 2 | Multilingual recall | ru, hinglish, ja, zh, ar attack recall rise on battery + tranches, with **no benign-FPR rise** on those sets |
| 3 | No OOD regression (step 4) | McNemar shows v16 loses ≤ noise vs v14; headline stays **≥97.10% recall at ≤5.6% FPR** (`--limit 4250`). **This is the gate v15 failed, twice.** |
| 4 | No label collapse | no label drops toward zero recall in validation |
| 5 | Ordinary-benign FPR | crossdist FPR (**51/918 benign** at v14's 5.56%) does not regress materially |
| 6 | Health + suite green | test suite passes, guard health OK — **never actually run for v15; run it this time** |
| 7 | Probe battery (step 5) | MULTI_TURN recall up from 5/8, and the security-education FPs (3 of 4) gone, **without** losing attacks. Quote every number as `x/y`. |

Gate 3 is the one that has bitten twice: v6 lifted a target metric and quietly
regressed the core hybrid 100% → 95.8% (rolled back), and v15 missed the FPR
ceiling by 0.06 points. Always verify at `--limit 4250` — the default 1200 is a
different row set and its numbers do not compare.

Gate 7's denominators are small by construction (56 attacks / 14 benign). It is a
diagnostic that says *whether the thing v16 targeted moved*, not a headline. The
adversarial-hard-negative FPRs (52.17% on the tranches, 77.78% on the battery,
28.57% on the probe) are **not** deploy metrics and must never be quoted without
their denominator: they are measured on 14–46 deliberately-confusable rows.
Ordinary-traffic FPR is gate 5's: v14 is **5.56% = 51/918 benign rows** in the
`--limit 4250` sample.

### Then, and only then

```bash
# .env and .env.production
ML_ONNX_MODEL_PATH=models/ml-classifier-v16/model.onnx
ML_ONNX_LABELS_PATH=models/ml-classifier-v16/labels.json
ML_ONNX_CALIBRATION_PATH=models/ml-classifier-v16/calibration.json
ML_ONNX_MAX_LENGTH=256        # MUST equal --max-length from the run
```

Keep v14 on disk. Rolling back is an env swap, and you want that to stay true.
Two open gate-config judgment calls are deliberately **not** bundled into this
deploy — the AP=0.75 abstention trade (+attacks for +HUMAN_REVIEWs, never a
block) and the DATA_EXFILTRATION gate admission — surface them with the v16
numbers and decide separately.
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
        code(CELL_RUN),
        code(CELL_PACKAGE),
        md(MD_AFTER),
    ],
    "metadata": {
        "accelerator": "GPU",
        "colab": {"name": "soterllm-v16-gpu.ipynb", "provenance": [], "toc_visible": True},
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
print(f"     intro quotes the LIVE guard report: increment {INC_ROWS:,} rows, "
      f"{INC_NON_EN:,} non-English, MULTI_TURN "
      f"{BEFORE['multi_turn_share_pct']}% -> {AFTER['multi_turn_share_pct']}%")
