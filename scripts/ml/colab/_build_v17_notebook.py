r"""Generate scripts/ml/colab/soterllm-v17-gpu.ipynb.

    python scripts/ml/colab/_build_v17_notebook.py

Generated, never hand-edited: hand-editing .ipynb JSON is how you get a file
Colab refuses to open. Edit the CELLS below and re-run. Cell bodies are plain
(non-f) strings so braces inside them stay literal; the ONLY interpolated text is
the intro's corpus figures, read from artifacts/ml/v17-corpus-report.json rather
than typed. A hand-typed corpus count in a notebook is a claim nobody re-checks,
and this repo has already shipped one fake number (the "99.29% val F1" that came
out of a leaking random_split).

HOW THIS DIFFERS FROM THE v16 NOTEBOOK, AND WHY

  * TWO training cells, not one. v17 changes the encoder AND the corpus. Two
    changes in one run cannot be attributed, so the notebook trains both arms and
    uses already-trained v14 as the third cell of a 2x2:

                         v14 corpus            v17 corpus
        minilm      v14 (LIVE, measured)     ARM B "control"
        mdistilbert          --              ARM A "candidate"

    ARM B vs v14   -> what the CORPUS did  (encoder held fixed)
    ARM A vs ARM B -> what the ENCODER did (corpus held fixed)

    ARM B is not an optional extra. Without it a v17 win is unattributable and a
    v17 loss is undiagnosable, and it is also the fallback that ships if the
    encoder swap regresses English.

  * The acceptance gate has TWO axes that are reported separately, because the
    requirement on v17 is "beat v14 in non-English WITHOUT losing English" and a
    single blended number can hide half of that.

  * A cased-tokenizer cell that v16 did not need. mDistilBERT is
    do_lower_case=false; v14's golden parity file is UNCASED. Reusing it would
    pass a test the runtime fails, so the notebook regenerates the golden from the
    TRAINED artifact's own tokenizer_config, to its own path.
"""
import json
import os

ROOT = r"C:\Users\USER\OneDrive\Desktop\Ai-Agent-Security-Guard"
OUT = os.path.join(ROOT, "scripts", "ml", "colab", "soterllm-v17-gpu.ipynb")
REPORT = os.path.join(ROOT, "artifacts", "ml", "v17-corpus-report.json")

if not os.path.isfile(REPORT):
    raise SystemExit(
        "[FATAL] artifacts/ml/v17-corpus-report.json not found.\n"
        "        Run: python scripts/ml/verify-v17-corpus.py\n"
        "        The notebook's intro quotes real corpus figures and refuses to\n"
        "        invent them.")

R = json.loads(open(REPORT, encoding="utf-8").read())
INC = R["increment"]
BEFORE, AFTER = R["before"], R["after"]
INC_ROWS = INC["rows"]
INC_NON_EN = sum(v for k, v in INC["languages"].items() if k != "en")
INC_LANGS = len(INC["languages"])
INC_SAFE = INC["labels"].get("SAFE", 0)
INC_MT = INC["labels"].get("MULTI_TURN_ESCALATION", 0)
NEW_LANGS = len(R.get("new_languages", []))
BATTERY_ROWS = R.get("holdouts_checked", {}).get(
    "datasets/v17-multilingual-battery.jsonl", 312)

MD_INTRO = f"""# SoterLLM v17 — multilingual encoder + corpus rebalance (GPU, TWO arms)

**Read this section before running anything. The two-arm structure is the
experiment, not an extra.**

## What v17 changes

v17 changes **two** things at once — the encoder and the corpus:

1. **Encoder:** `all-MiniLM-L6-v2` (22M, 30,523-token **uncased** vocab) →
   `distilbert-base-multilingual-cased` (135M, 119,547-token **cased** vocab).
2. **Corpus:** v16's ten files **plus one 11th** —
   `datasets/ml-v17-threat-corpus.jsonl`, **{INC_ROWS:,} rows**, of which
   **{INC_NON_EN:,} are natively non-English** across {INC_LANGS} languages,
   **{INC_SAFE:,} are benign controls** and **{INC_MT:,} are
   MULTI_TURN_ESCALATION**. The corpus grows {BEFORE['rows']:,} →
   {AFTER['rows']:,} rows, non-English **{BEFORE['non_english_share_pct']}% →
   {AFTER['non_english_share_pct']}%**, languages
   **{BEFORE['distinct_languages']} → {AFTER['distinct_languages']}**
   ({NEW_LANGS} newly present).

Two simultaneous changes cannot be attributed from one run. So this notebook
trains **both arms**, and leans on v14 — already trained, already live, already
measured — as the third cell of a 2×2:

| | v14 corpus | v17 corpus |
|---|---|---|
| **minilm** | **v14** (LIVE, measured) | **ARM B** — "control" |
| **mdistilbert** | — | **ARM A** — "candidate" |

* **ARM B vs v14** → what the **corpus** did (encoder held fixed)
* **ARM A vs ARM B** → what the **encoder** did (corpus held fixed)

Without ARM B a v17 win is unattributable and a v17 loss is undiagnosable. ARM B
is also the **fallback that ships** if the encoder swap regresses English,
because the one hard requirement on v17 is: **beat v14 in non-English WITHOUT
losing English.**

## The measurement that motivates both

v14 was scored on `datasets/v17-multilingual-battery.jsonl` —
**{BATTERY_ROWS} rows, 39 languages, 8 per language (4 attack / 4 benign)**, held
out, **zero group-key collisions** with training:

| what | v14 |
|---|---|
| recall | **83.33%** (130/156) |
| FPR, all benign rows | 64.1% (100/156) |
| FPR, **unambiguously benign** | **52.1%** (61/117) — **53 of those 61 blocks come from the ML tier** |

The 52.1% is the honest headline: the other 39 benign rows (`legitimate-tool-use`)
assert unverifiable authority and then request egress, so blocking them is
defensible and they are **not** counted as errors.

**The cleanest row has no security vocabulary in it at all** — *"Can you help me
write a polite email to move tomorrow's meeting to Friday afternoon?"* — and is
blocked in **15 of 39 languages, 13 of them by the ML tier.** The only thing that
varies across those rows is the language. That is a **LANGUAGE → ATTACK
shortcut**, and the training corpus explains it: attack share per language in the
base files was **it 100% (199 rows), sv 100% (205), nl 100% (180), de 95.8%
(286), fr 94.5% (220), hinglish 90.7% (2,118)**. Rule 10 of
`_build_v17_corpus.py` caps every language at a **0.70** attack share; 11 of 12
measured-skewed languages now sit at ~0.70, and **hinglish is the one honest
residual at 80.8%** (it needed 630 rows, the per-language cap is 260, and its
bank holds only 320 composable rows — reported, not hidden).

Separately, v14's uncased 30,523-token vocab **shreds 8 of 31 measured scripts**
(gu 83.8% UNK, pa 85.1%, te 78.2%, ml 77.7%, kn 75.6%, th 66.7%).
mDistilBERT-cased takes all 8 to **0.00%**, for 1.3× English fertility (10 → 13
tokens). Those two facts — vocab coverage and corpus presence — are
**confounded** in the battery data. That confound is the entire reason ARM B
exists.

## Hyperparameters are HELD, not tuned

Both arms run at **effective batch 128** and the same sqrt-scaled encoder LR
(**4.0e-5**) — exactly what v14 trained with. ARM A reaches 128 as **64 × 2
grad-accum** purely for VRAM: 135M params with a 119,547-row embedding table does
not fit a 16 GiB T4 at batch 128. Gradient accumulation is arithmetically
identical here — there is no BatchNorm in a transformer and LayerNorm is
per-sample — so the optimization trajectory is preserved.

> **Honest limit.** Holding LR fixed across a 22M and a 135M model holds the
> **rule** constant, not the **optimum**. A base-size encoder may prefer a lower
> LR. So "ARM A vs ARM B" **bounds** the encoder effect under a shared recipe; it
> does **not** prove that a best-tuned mDistilBERT equals this one. State that
> alongside any result; do not quietly drop it.

## The hard production constraint, unchanged

Production tokenizes with the in-repo WordPiece `BertTokenizer` off
`tokenizer_config/vocab.txt` (`lib/ml/onnxBackend.ts`). There is **no**
SentencePiece or BPE tokenizer in production: XLM-R or DeBERTa-v3 would train
fine here and then **fail to load in prod** — which does not error, it silently
turns the ML tier **dark**. mDistilBERT is WordPiece, and cell 3 enforces that
behaviourally rather than by name.

It is however **cased**, which v14 was not. That has already been de-risked
locally: `lib/ml/bertTokenizer.ts` was measured **33/33 byte-exact** against
HuggingFace on the cased path, covering Gujarati, Punjabi, Telugu, Malayalam,
Kannada, Thai, Tamil, Nepali, Arabic, Hebrew, Greek, Cyrillic, Korean and the
Turkish dotted/dotless-I trap. Cell 7 regenerates the cased golden from the
**trained artifact's own** `tokenizer_config` so the export is what gets proven.

## v14 stays live

v14 is the bar, on both axes, and v16 came back NO-GO (paired attacks-only
McNemar 21 vs 9, p=0.0428 **for v14**). Both arms write to their own directories.
Nothing here is a deploy decision — the gate is paired McNemar per axis, after
the download. Run the cells top to bottom.
"""

CELL_GPU = r"""# 1/8  Confirm a GPU, read its VRAM, and PIN both arms to v14's regime.
#      Runtime > Change runtime type > T4 GPU (or better) if this cell exits.
import torch

if not torch.cuda.is_available():
    raise SystemExit(
        "No CUDA device attached. Runtime > Change runtime type > GPU, then re-run.\n"
        "v17 fine-tunes the ENCODER end to end exactly as v14 did. Measured CPU cost for "
        "minilm on this corpus is 2.6 h/epoch; mdistilbert is ~6x the parameters, so a CPU "
        "run of ARM A is a multi-DAY job, not a slow afternoon."
    )

name = torch.cuda.get_device_name(0)
vram_gb = torch.cuda.get_device_properties(0).total_memory / 1024 ** 3
bf16_ok = torch.cuda.is_bf16_supported()

print(f"GPU      : {name}")
print(f"VRAM     : {vram_gb:.1f} GiB")
print(f"torch    : {torch.__version__}  (cuda {torch.version.cuda})")
print(f"bf16     : {bf16_ok}")

# --- EFFECTIVE batch is pinned to 128 for BOTH arms -------------------------------
# v14 trained at batch 128 / encoder-lr 4e-5 (models/ml-classifier-v14/training_stats.json).
# v17's whole point is a comparison against it, so the effective batch is fixed rather
# than scaled to whatever GPU you drew. ARM A splits it 64 x 2 because 135M params with a
# 119,547-row embedding table does not fit a 16 GiB T4 at 128 -- and grad accumulation is
# arithmetically identical for a transformer (no BatchNorm; LayerNorm is per-sample).
EFFECTIVE = 128

ARMS = {
    "candidate": {"encoder": "mdistilbert", "out_name": "ml-classifier-v17",
                  "batch": 64, "accum": 2, "min_vram": 12.0,
                  "why": "the v17 candidate: 119,547-token cased multilingual vocab"},
    "control":   {"encoder": "minilm", "out_name": "ml-classifier-v17-minilm",
                  "batch": 128, "accum": 1, "min_vram": 6.0,
                  "why": "the control: v14's exact encoder, so ARM B vs v14 isolates the corpus"},
}

# bf16 needs Ampere+. v14 trained in bf16; a T4 is Turing, so it takes fp16 + GradScaler.
# The trainer unscales before clipping, so fp16 is safe -- a hair more numeric noise than
# v14 had, unavoidable on Turing and far smaller than the changes being measured.
AMP = "bf16" if bf16_ok else "fp16"

# sqrt scaling off the 32-batch 2e-5 baseline, applied to the EFFECTIVE batch. At 128 this
# is 4.0e-5, the exact value v14 used, so the formula and the pin agree by construction.
# Linear scaling overshoots on a fine-tune.
ENCODER_LR = 2e-5 * (EFFECTIVE / 32) ** 0.5
HEAD_LR = 1e-3

print(f"\namp        : {AMP}")
print(f"encoder-lr : {ENCODER_LR:.3e}   head-lr {HEAD_LR:.0e}   (v14's exact values)")
for arm, spec in ARMS.items():
    b, a = spec["batch"], spec["accum"]
    assert b * a == EFFECTIVE, f"{arm} does not reach effective {EFFECTIVE}"
    fit = "ok" if vram_gb >= spec["min_vram"] else f"TIGHT (wants ~{spec['min_vram']:.0f} GiB)"
    print(f"  ARM {arm:<10} {spec['encoder']:<12} {b:>3} x {a} = {b*a}   VRAM {fit}")

if vram_gb < ARMS["candidate"]["min_vram"]:
    print("\n[WARN] ARM candidate may OOM on this GPU. If it does: HALVE its batch and")
    print("       DOUBLE its accum (32 x 4) so the effective batch stays 128 -- that is what")
    print("       keeps the two arms comparable. Try --grad-checkpoint first (cell 5).")
"""

CELL_BUNDLE = r"""# 2/8  Get soterai-v17-train-bundle.zip into /content and unpack it.
#      Built locally by scripts/ml/colab/_build_v17_bundle.py, which verifies the zip by
#      EXTRACTING it to a temp dir: PowerShell's Compress-Archive writes backslash
#      separators that Linux extractall() treats as part of the filename, so you would
#      silently get one junk file named "scripts\ml\train-...py" and a baffling
#      missing-dataset error hours later. (Windows' own extractall repairs backslashes,
#      so a namelist() check passes on the very machine that creates the bug.)
import hashlib
import os
import zipfile
from pathlib import Path

BUNDLE = "soterai-v17-train-bundle.zip"
WORK = Path("/content/soter-v17")
WORK.mkdir(parents=True, exist_ok=True)
os.chdir(WORK)

src = next((c for c in (WORK / BUNDLE,
                        Path("/content") / BUNDLE,
                        Path("/content/drive/MyDrive") / BUNDLE) if c.exists()), None)
if src is None:
    from google.colab import files
    src = WORK / next(iter(files.upload()))     # pick soterai-v17-train-bundle.zip

print(f"bundle : {src}")
print(f"sha256 : {hashlib.sha256(src.read_bytes()).hexdigest()[:16]}...  "
      f"({src.stat().st_size / 1048576:.1f} MB)")

with zipfile.ZipFile(src) as z:
    bad = [n for n in z.namelist() if "\\" in n]
    if bad:
        raise SystemExit(f"backslash paths in zip -- rebuild with _build_v17_bundle.py: {bad[:3]}")
    z.extractall(WORK)

# 11 files, in the load order the trainer will see. The first 10 are v16's exact corpus.
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
    "datasets/ml-v17-threat-corpus.jsonl",        # <- the v17 increment
]
INCREMENT = DATASETS[-1]

missing = [r for r in ["scripts/ml/train-soterllm-v14-fullft.py",
                       "scripts/ml/soter_augment.py", *DATASETS]
           if not (WORK / r).is_file()]
if missing:
    raise SystemExit(f"did not extract to real paths: {missing[:3]}")

rows = 0
for rel in DATASETS:
    n = sum(1 for _ in (WORK / rel).open(encoding="utf-8"))
    rows += n
    print(f"  {n:>7,}  {rel}")
print(f"  {rows:>7,}  TOTAL rows")

# The increment IS the experiment, and its whole point is native non-Latin text. A
# transfer through a text-mode channel would delete that signal while leaving the row
# count intact -- so check the bytes, not just the lines.
inc = WORK / INCREMENT
n_inc = sum(1 for _ in inc.open(encoding="utf-8"))
n_utf8 = sum(1 for line in inc.open(encoding="utf-8") if any(ord(c) > 127 for c in line))
print(f"\nincrement : {n_inc:,} rows, {n_utf8:,} carrying non-ASCII text "
      f"({100 * n_utf8 / max(1, n_inc):.1f}%)")
if n_utf8 == 0:
    raise SystemExit("increment has NO non-ASCII rows -- the file was mangled in transfer")
# MEASURED at build time: 2,953/3,871 = 76.3%. It is NOT ~99% despite 99.4% of the rows
# being non-English, because de/fr/it/nl/sv/id/ms/tl/pl/cs/ro/sw are Latin-script and often
# pure ASCII. The floor sits well below the measured value: it catches a mangled or stale
# file without firing on ordinary drift.
if n_utf8 < 0.5 * n_inc:
    raise SystemExit(f"only {100 * n_utf8 / n_inc:.1f}% non-ASCII; the build measured 76.3%. "
                     "Wrong, truncated or text-mode-mangled file.")
print("This is the ONLY file v16 never trained on. It is a small share of the corpus on")
print("purpose: variety, not volume, is what this corpus responds to (settled in v14's round).")
"""

CELL_PREFLIGHT = r"""# 3/8  Deps, then a REAL preflight so a wrong encoder fails in 30 seconds, not in 3 hours.
#
#      onnxruntime is the one that matters: it is what the ONNX parity gate uses. Without
#      it the run still completes and KEEPS its weights -- the trainer saves
#      pytorch_model.bin BEFORE the gate on purpose -- but the artifact lands
#      PARITY_UNVERIFIED and you close the gate locally with --verify-only.
!pip install -q onnxruntime onnx scipy scikit-learn

import importlib.util
import json as _json
import sys

sys.path.insert(0, str(WORK / "scripts" / "ml"))   # before exec: the trainer imports soter_augment
spec = importlib.util.spec_from_file_location(
    "trainer", WORK / "scripts/ml/train-soterllm-v14-fullft.py")
trainer = importlib.util.module_from_spec(spec)
sys.modules["trainer"] = trainer
spec.loader.exec_module(trainer)

import onnxruntime
import transformers
from transformers import AutoTokenizer

print(f"transformers {transformers.__version__} | onnxruntime {onnxruntime.__version__}")
print(f"labels: {len(trainer.ALL_LABELS)} -- this index order is a runtime contract, never reorder it")

# THE HARD CONSTRAINT, checked behaviourally for BOTH arms before either trains.
# lib/ml/onnxBackend.ts tokenizes with the in-repo WordPiece BertTokenizer off
# tokenizer_config/vocab.txt; there is no SentencePiece or BPE tokenizer in production.
# assert_wordpiece checks for ## continuation pieces, the ABSENCE of SentencePiece's
# U+2581, contiguous ids and the five BERT specials. Naming a model "bert-something"
# does not pass it. A failure here would otherwise surface as a silently dark ML tier.
TOKS = {}
for arm, s in ARMS.items():
    model_id = trainer.ENCODERS.get(s["encoder"], s["encoder"])
    tok = AutoTokenizer.from_pretrained(model_id)
    TOKS[arm] = tok
    ok = trainer.assert_wordpiece(tok, model_id)
    lower = getattr(tok, "do_lower_case", None)
    print(f"\n[ok] ARM {arm:<10} {model_id}")
    print(f"     WordPiece-compatible: {ok} | vocab {len(tok.get_vocab()):,} | "
          f"do_lower_case={lower}")

# The cased/uncased split between the arms is the one thing that does NOT cancel out
# downstream: v14's golden parity file is uncased, and ARM A is cased. Printed here so the
# fact is on the record before training, not discovered at the parity gate.
print("\nARM candidate is CASED -> it needs its OWN golden parity file (cell 7).")
print("ARM control is UNCASED like v14 -> it reuses the existing golden.")

# Per-language UNK coverage on the increment, both encoders, same rows. This is the
# measurement v17's encoder swap was chosen on -- 8 of 31 scripts above 5% UNK on v14's
# vocab -- so it is re-checked here on the ACTUAL corpus about to be trained.
# Informational, not a gate: v14's round measured tokenizer damage against per-language
# failure and found them uncorrelated (Chinese ~60% [UNK] and still rescued at 100%).
seen = {}
with open(WORK / INCREMENT, encoding="utf-8") as fh:
    for line in fh:
        r = _json.loads(line)
        lang = r.get("language", "?")
        if lang in seen or not any(ord(c) > 127 for c in r["text"]):
            continue
        seen[lang] = r["text"]

def unk_pct(tok, text):
    ids = tok(text, add_special_tokens=False)["input_ids"]
    if not ids:
        return 0.0
    return 100 * sum(1 for i in ids if i == tok.unk_token_id) / len(ids)

print(f"\nper-language [UNK] rate on the increment ({len(seen)} non-ASCII languages):")
print(f"  {'lang':<10} {'minilm':>8} {'mdistil':>8}   (informational, not a gate)")
worse = 0
for lang, text in sorted(seen.items()):
    a = unk_pct(TOKS["control"], text)
    b = unk_pct(TOKS["candidate"], text)
    if b > a:
        worse += 1
    flag = "  <-- shredded by minilm" if a >= 50 and b < 5 else ""
    print(f"  {lang:<10} {a:7.1f}% {b:7.1f}%{flag}")
print(f"\n{worse} language(s) tokenize WORSE under mdistilbert. Non-Latin scripts should")
print("collapse to 0.0% -- that is the measured basis for the swap, re-confirmed on this file.")
"""

CELL_OUTDIR = r"""# 4/8  Where the runs write.
#      Colab recycles the runtime and wipes /content, and TWO full fine-tunes back to back
#      is long enough that this happens for real. On Drive both checkpoint.pt (written each
#      epoch) and the final artifacts survive it, at the cost of some I/O per epoch.
#      Note the paths: v14's directory is never touched, so rollback stays an env swap.
from pathlib import Path

try:
    from google.colab import drive
    drive.mount("/content/drive")
    BASE = Path("/content/drive/MyDrive/soterai/models")
    RESUMABLE = True
except Exception as exc:
    print(f"Drive not mounted ({exc}).")
    print("Falling back to /content -- if the runtime recycles mid-run, THE RUN IS LOST.")
    print("With two arms to train that is a materially worse bet than it was for v16.")
    BASE = WORK / "models"
    RESUMABLE = False

for arm, s in ARMS.items():
    s["out"] = BASE / s["out_name"]
    s["out"].mkdir(parents=True, exist_ok=True)
    print(f"ARM {arm:<10} -> {s['out']}")
print(f"\nresumable : {RESUMABLE}")
if RESUMABLE:
    print("            --checkpoint writes checkpoint.pt per epoch; add --resume to the arm's")
    print("            call and re-run its cell after a disconnect to pick up where it stopped.")
"""

CELL_TRAIN_FN = r"""# 5/8  The training function, shared by both arms so they CANNOT drift apart.
#
#      Everything except --encoder / --output-dir / --batch-size / --grad-accum is identical
#      between the arms by construction. If the two arms differed in a hyperparameter,
#      "ARM A vs ARM B" would stop measuring the encoder, and that is the kind of drift a
#      copy-pasted second cell invites.
#
#      The one v17-specific line is --train-datasets. The trainer's built-in default is
#      v14's 8-file corpus; passing all 11 explicitly is what makes this v17. Miss it and
#      you silently drop the v15, v16 AND v17 increments -- and still get healthy-looking
#      metrics, which is the trap.
import subprocess
import sys
import time

GRAD_CHECKPOINT = False    # flip to True if ARM candidate OOMs: ~30% slower, big VRAM drop

def train(arm, resume=False):
    s = ARMS[arm]
    cmd = [sys.executable, "scripts/ml/train-soterllm-v14-fullft.py",
           "--train-datasets", *DATASETS,
           "--encoder", s["encoder"],
           "--output-dir", str(s["out"]),
           "--epochs", "3",                      # v14 selected epoch 3
           "--batch-size", str(s["batch"]),
           "--grad-accum", str(s["accum"]),
           "--amp", AMP,
           "--encoder-lr", f"{ENCODER_LR:.3e}",
           "--head-lr", str(HEAD_LR),
           "--layer-decay", "0.9",
           "--warmup-frac", "0.06",
           "--fpr-ceiling", "0.03",
           "--num-workers", "2",
           "--augment"]
    if GRAD_CHECKPOINT:
        cmd.append("--grad-checkpoint")
    if RESUMABLE:
        cmd.append("--checkpoint")
    if resume:
        cmd.append("--resume")

    print("=" * 78)
    print(f"ARM {arm.upper()}  --  encoder {s['encoder']}")
    print(f"  {s['why']}")
    print(f"  batch {s['batch']} x accum {s['accum']} = effective {s['batch'] * s['accum']}"
          f"   encoder-lr {ENCODER_LR:.3e}   amp {AMP}")
    print("=" * 78)
    print(" ".join(cmd), "\n", flush=True)

    t0 = time.time()
    rc = subprocess.run(cmd, cwd=WORK, check=False).returncode
    mins = (time.time() - t0) / 60
    print(f"\nARM {arm} exit {rc}  ({mins:.1f} min)")
    if rc != 0:
        print("Non-zero exit. Read the traceback BEFORE re-running: the trainer fails loudly")
        print("on purpose (leak assertion, non-WordPiece tokenizer, missing dataset). If it")
        print("OOMed, set GRAD_CHECKPOINT=True above, or halve batch and DOUBLE accum so the")
        print("effective batch stays 128 -- otherwise the arms stop being comparable.")
    return rc

print("Wall clock: length-grouped batching is ON by default and pads ~8.7x fewer tokens")
print("than shuffled batches (token lengths p50=18 / p90=47 / p99=452, so ~89% of naive")
print("compute is padding). The trainer prints an ETA after 40 steps -- if it is")
print("unaffordable, kill the cell THERE, not three hours in. ARM candidate is ~6x the")
print("parameters of ARM control, so budget accordingly.")
"""

CELL_TRAIN_A = r"""# 6a/8  ARM A -- THE CANDIDATE (mdistilbert). Full corpus, no --sample.
#        Run this first: it is the arm that can fail (OOM, cased-tokenizer surprises), and
#        finding that out before spending ARM B's hours is worth the ordering.
rc_a = train("candidate")
# After a disconnect with Drive mounted:  rc_a = train("candidate", resume=True)
"""

CELL_TRAIN_B = r"""# 6b/8  ARM B -- THE CONTROL (minilm). Same corpus, v14's encoder.
#
#        DO NOT SKIP THIS CELL. It is half the experiment:
#          * ARM B vs v14 isolates what the CORPUS did (encoder held fixed);
#          * ARM A vs ARM B then isolates what the ENCODER did (corpus held fixed).
#        Without it, a v17 win is unattributable and a v17 loss is undiagnosable. It is
#        also the English-safe fallback that ships if the encoder swap regresses English.
#        It is the cheaper of the two arms -- 22M params against 135M.
rc_b = train("control")
"""

CELL_PACKAGE = r"""# 7/8  Verify BOTH artifacts, regenerate the CASED golden, package, download.
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
    "pytorch_model.bin",                       # needed for --verify-only and any re-export
]

zips = []
for arm, s in ARMS.items():
    OUTDIR = s["out"]
    print("=" * 78)
    print(f"ARM {arm.upper()}  {OUTDIR}")
    print("=" * 78)
    if not (OUTDIR / "training_stats.json").is_file():
        print(f"[skip] no training_stats.json -- ARM {arm} has not completed. Re-run its cell.")
        continue

    missing = [r for r in REQUIRED if not (OUTDIR / r).is_file()]
    if missing:
        raise SystemExit(f"INCOMPLETE artifact for ARM {arm}, do not ship: {missing}")
    for r in REQUIRED:
        print(f"  {(OUTDIR / r).stat().st_size:>12,}  {r}")

    stats = json.loads((OUTDIR / "training_stats.json").read_text())
    m, sel = stats["final_metrics"], stats["epoch_selection"]
    print(f"\nencoder        : {stats['base_model']}  ({stats['architecture']['hidden_size']}d)")
    print(f"selected epoch : {sel['selected_epoch']}  by rule: {sel['rule']}")
    print(f"macro F1       : {m['f1_macro']:.4f}")
    print(f"attack recall  : {m['attack_recall']:.4f}")
    print(f"benign FPR     : {m['benign_fpr']:.4f}   (ceiling {sel['fpr_ceiling']})")
    print(f"vocab.txt      : {stats['tokenizer']['vocab_txt_tokens']} tokens")

    # The manifest must show 11 datasets. If it shows 8, --train-datasets was dropped and
    # this is v14 retrained under a new name -- which prints perfectly healthy metrics
    # right here and would sail through everything except this check.
    man = json.loads((OUTDIR / "dataset_manifest.json").read_text())
    datasets = man.get("datasets", [])
    rpf = man.get("rows_per_file", {})
    print(f"\ndatasets in manifest: {len(datasets)}")
    for d in datasets:
        # rows_per_file is a {path: count} dict, not a list -- iterating it yields path
        # strings, and formatting one with `:,` is what broke v16's packaging cell after
        # an otherwise successful run.
        n = rpf.get(d, 0) if isinstance(rpf, dict) else 0
        print(f"  {int(n):>7,}  {d}")
    if len(datasets) != 11:
        raise SystemExit(f"Expected 11 datasets, got {len(datasets)}. ARM {arm} is NOT v17.")
    if any(int(rpf.get(d, 0)) <= 0 for d in datasets):
        raise SystemExit(f"ARM {arm}: a manifest dataset loaded zero rows; do not package it.")

    parity = stats.get("onnx_parity", {})
    if parity.get("verified"):
        print(f"\nONNX parity    : OK, worst max|diff| = {parity['worst_max_abs_logit_diff']:.2e}")
    else:
        print(f"\nONNX parity    : UNVERIFIED ({parity.get('reason')})")
        print("                 close it locally: python scripts/ml/train-soterllm-v14-fullft.py \\")
        print(f"                     --verify-only models/{s['out_name']}")
    if (OUTDIR / "PARITY_UNVERIFIED.json").exists():
        print("[!] PARITY_UNVERIFIED.json present. Do not sign or deploy until it is gone.")

    audit = json.loads((OUTDIR / "calibration.json").read_text()).get("threshold_audit", {})
    if audit.get("inert_thresholds"):
        print(f"\n[note] {len(audit['inert_thresholds'])} per-label threshold(s) unreachable "
              f"(below the {audit.get('argmax_floor', 0):.4f} argmax floor):")
        print(f"       {audit['inert_thresholds']}")
        print(f"       {audit.get('consequence', '')}")

    ZIP = Path("/content") / f"soterai-{s['out_name']}-artifact.zip"
    with zipfile.ZipFile(ZIP, "w", zipfile.ZIP_DEFLATED) as z:
        for p in sorted(OUTDIR.rglob("*")):
            if p.is_file() and p.name != "checkpoint.pt":      # 1-2 GB, not needed locally
                z.write(p, p.relative_to(OUTDIR).as_posix())
    zips.append(ZIP)
    print(f"\n[ok] {ZIP}  ({ZIP.stat().st_size / 1048576:.1f} MB)")

print("\nThese are IN-DISTRIBUTION validation numbers for both arms. They are a training")
print("signal, NOT the deploy gate. The gate is paired McNemar per axis, after the download.")

# --- the cased golden, generated from the TRAINED artifact's own tokenizer_config -------
# Not from the HF hub id: what has to be proven is that the EXPORT matches, and the export
# is what production will read. --out is mandatory -- the default path is v14's UNCASED
# golden, which is the live model's only parity evidence, and overwriting it with cased ids
# fails nothing visibly while retiring that evidence.
cand = ARMS["candidate"]
if (cand["out"] / "tokenizer_config/vocab.txt").is_file():
    import subprocess as _sp
    print("\n" + "=" * 78)
    print("regenerating the CASED golden from ARM candidate's exported tokenizer")
    print("=" * 78, flush=True)
    _sp.run([sys.executable, "scripts/ml/dump-hf-tokenization.py",
             "--tokenizer-dir", str(cand["out"] / "tokenizer_config"),
             "--out", "scripts/ml/_hf-tokenization-golden-cased.json"],
            cwd=WORK, check=False)
    g = WORK / "scripts/ml/_hf-tokenization-golden-cased.json"
    if g.is_file():
        gz = Path("/content") / "soterai-v17-cased-golden.zip"
        with zipfile.ZipFile(gz, "w", zipfile.ZIP_DEFLATED) as z:
            z.write(g, "scripts/ml/_hf-tokenization-golden-cased.json")
        zips.append(gz)
        print(f"[ok] {gz} -- unzip into the repo root, then run the parity check locally")
        print("     (it needs lib/ml/bertTokenizer.ts, which is not in this bundle).")

from google.colab import files
for z in zips:
    files.download(str(z))
"""

MD_AFTER = r"""## After the download — TWO arms, TWO axes

Unzip each artifact into `models/<name>/` in the repo (`ml-classifier-v17` and
`ml-classifier-v17-minilm`), and the golden zip into the repo root. None of the
in-distribution numbers above is a deploy decision.

**The bar is v14, on both axes, and v14 is live.** v16 trained cleanly and still
came back NO-GO: canonical attacks-only McNemar **21 vs 9, p=0.0428 in v14's
favour**. Assume the same is possible here.

```bash
# 0. Only if the notebook reported ONNX parity UNVERIFIED (no onnxruntime in the image)
python scripts/ml/train-soterllm-v14-fullft.py --verify-only models/ml-classifier-v17
python scripts/ml/train-soterllm-v14-fullft.py --verify-only models/ml-classifier-v17-minilm

# 1. Sign BOTH. augmentWithMl fails OPEN on an unsigned artifact -- an unsigned model does
#    not error, it silently turns the whole ML tier dark.
npx tsx scripts/ml/sign-model-artifact.ts --model models/ml-classifier-v17/model.onnx \
    --source local-training --builder-id soterai://local/v17
npx tsx scripts/ml/sign-model-artifact.ts --model models/ml-classifier-v17-minilm/model.onnx \
    --source local-training --builder-id soterai://local/v17-minilm

# 2. THE CASED TOKENIZER GATE -- do this before any scoring, because every number below
#    is meaningless if production tokenizes differently from training.
#    Both flags are REQUIRED: the defaults on both sides point at v14's UNCASED golden.
npx tsx scripts/ml/verify-tokenizer-parity.ts \
    --model-dir models/ml-classifier-v17 \
    --golden scripts/ml/_hf-tokenization-golden-cased.json
#    ARM control is uncased like v14 and reuses the existing golden:
npx tsx scripts/ml/verify-tokenizer-parity.ts --model-dir models/ml-classifier-v17-minilm

# 3. Prove the production loader accepts each one (gate, labels, calibration, vocab.txt,
#    tokenizer, session, decide) -- the exact path a real request takes.
npx tsx scripts/ml/_probe-v14-runtime.ts models/ml-classifier-v17
npx tsx scripts/ml/_probe-v14-runtime.ts models/ml-classifier-v17-minilm

# 4. AXIS 1 -- NON-ENGLISH. The instrument v17 was built against.
#    v14 baseline on this file: recall 83.33% (130/156), FPR 52.1% (61/117 unambiguously
#    benign, 53 of those from the ML tier). score/eval read the model from .env, so point
#    ML_ONNX_* at each arm in turn.
npx tsx scripts/ml/eval-crossdist-production.ts \
    --file datasets/v17-multilingual-battery.jsonl --limit 400 \
    --out artifacts/ml/v17-multilingual-battery-armA.json \
    --dump-misses artifacts/ml/v17-battery-armA-misses.jsonl \
    --dump-fps artifacts/ml/v17-battery-armA-fps.jsonl
#    ... repeat with ML_ONNX_* pointed at ml-classifier-v17-minilm -> -armB.json
python scripts/ml/_battery_breakdown.py      # re-splits unambiguous vs arguable-label rows

# 5. AXIS 2 -- ENGLISH. No regression permitted. Paired McNemar catches any row an arm
#    lost that v14 caught, regardless of the absolute number:
npx tsx scripts/ml/compare-models.ts --file datasets/crossdist-eval-v3.jsonl \
    --a models/ml-classifier-v14 --b models/ml-classifier-v17 \
    --out artifacts/ml/v14-vs-v17-crossdist.json
npx tsx scripts/ml/compare-models.ts --file datasets/crossdist-eval-v3.jsonl \
    --a models/ml-classifier-v14 --b models/ml-classifier-v17-minilm \
    --out artifacts/ml/v14-vs-v17minilm-crossdist.json
#    For the headline-comparable 97.52%/5.56% number, point .env's ML_ONNX_* at the arm
#    and run:  npx tsx scripts/ml/eval-crossdist-production.ts --limit 4250

# 6. The standing regression batteries, both arms, so a multilingual win that quietly
#    costs English or MULTI_TURN is visible rather than inferred:
npx tsx scripts/ml/compare-models.ts --file datasets/v15-test-battery.jsonl \
    --a models/ml-classifier-v14 --b models/ml-classifier-v17 \
    --out artifacts/ml/v14-vs-v17-battery.json
npx tsx scripts/ml/score-battery.ts --file datasets/v16-probe-battery.jsonl \
    --out artifacts/ml/v16-probe-v17.json
```

### The 2×2 read-out — fill this in before deciding anything

|  | non-English recall / FPR | English (crossdist) McNemar vs v14 |
|---|---|---|
| **v14** (live) | 83.33% / 52.1% (61/117) | — (baseline) |
| **ARM B** minilm + v17 corpus | | |
| **ARM A** mdistilbert + v17 corpus | | |

* **ARM B vs v14** = the corpus effect.
* **ARM A vs ARM B** = the encoder effect, **bounded under a shared recipe** (see
  the intro's honest limit: the LR was held, not re-tuned for a 135M model).

### Acceptance gate

v17 replaces v14 only if **all** of these hold **for the arm being shipped**. If
the non-English McNemar comes back p > 0.05, that is a real finding, not a failure
to explain away — the arm is a checkpoint to keep and v14 stays live. Do not ship
noise as an improvement.

| # | Gate | Bar |
|---|------|-----|
| 1 | **Cased tokenizer parity** (step 2) | byte-exact against a golden generated from **that artifact's own** tokenizer_config. Non-negotiable, and it comes first. |
| 2 | **Non-English FPR** (step 4) | 52.1% (61/117) falls **materially**, by paired McNemar on the unambiguously-benign rows |
| 3 | **Non-English recall** (step 4) | ≥ v14's 83.33% (130/156) — an FPR win paid for in recall is not a win |
| 4 | **English no-regression** (step 5) | McNemar shows the arm loses ≤ noise vs v14; headline stays **≥97.10% recall at ≤5.6% FPR** (`--limit 4250`). **This is the gate v15 failed, twice.** |
| 5 | **Ordinary-benign FPR** | crossdist FPR (**51/918 benign** = v14's 5.56%) does not regress materially |
| 6 | **No label collapse** | no label drops toward zero recall in validation; MULTI_TURN does not regress below v14 |
| 7 | **Attribution stated** | ARM B ran, and the corpus/encoder split is reported. A v17 number without ARM B is not reportable. |
| 8 | **Suite + health green** | test suite passes, guard health OK — **never actually run for v15; run it this time** |

Gate 4 is the one that has bitten twice: v6 lifted a target metric and quietly
regressed the core hybrid 100% → 95.8% (rolled back), and v15 missed the FPR
ceiling by 0.06 points. Always verify at `--limit 4250` — the default 1200 is a
different row set and its numbers do not compare.

**Denominators, always.** The battery is 312 rows / 39 languages, 8 per language:
a seed instrument, wide and shallow, because per-language collapse shows up in the
first few rows of a language or not at all. `52.1%` is `61/117`. The 39
`legitimate-tool-use` rows are **paired-behaviour probes, not errors** — they
assert unverifiable authority and then request egress. Adversarial-hard-negative
FPRs (52.17% on the tranches, 77.78% on the v15 battery, 28.57% on the v16 probe)
are **not** deploy metrics and must never be quoted without their small
denominators. Ordinary-traffic FPR is gate 5's: v14 is **5.56% = 51/918**.

**What may not be claimed, whatever the numbers say:** nothing about being "world
best" or beating Lakera. Lakera is a closed API and was never measured here; the
ProtectAI comparison segfaulted and is incomplete. Report measured deltas against
v14, with denominators, and stop there.

### Then, and only then

```bash
# .env and .env.production -- ONE arm, whichever cleared the gate
ML_ONNX_MODEL_PATH=models/ml-classifier-v17/model.onnx
ML_ONNX_LABELS_PATH=models/ml-classifier-v17/labels.json
ML_ONNX_CALIBRATION_PATH=models/ml-classifier-v17/calibration.json
ML_ONNX_MAX_LENGTH=256        # MUST equal --max-length from the run
```

Keep v14 on disk. Rolling back is an env swap and you want that to stay true.
Two open gate-config judgment calls are deliberately **not** bundled into this
deploy — the AP=0.75 abstention trade (+attacks for +HUMAN_REVIEWs, never a block)
and the `DATA_EXFILTRATION` gate admission. Surface them with the v17 numbers and
decide separately.

One item is **known outstanding** and is not a gate: the ML tier trains 14 labels
while `INPUT_RELIABLE_LABELS` allowlists 9 (`lib/guard/mlAugment.ts`). That
asymmetry should be re-measured against v17's weights rather than inherited from
v14's — a label that was unreliable on an English-centric encoder is not
automatically unreliable on a multilingual one.
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
        code(CELL_TRAIN_FN),
        code(CELL_TRAIN_A),
        code(CELL_TRAIN_B),
        code(CELL_PACKAGE),
        md(MD_AFTER),
    ],
    "metadata": {
        "accelerator": "GPU",
        "colab": {"name": "soterllm-v17-gpu.ipynb", "provenance": [], "toc_visible": True},
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

# The 11-dataset count is asserted in the packaging cell and listed in the bundle cell.
# They are written in two different places, so check they agree -- an 8/10/11 mismatch is
# exactly the "silently retrained v14" failure the assert exists to catch.
body = "".join("".join(c["source"]) for c in NOTEBOOK["cells"] if c["cell_type"] == "code")
assert body.count("datasets/ml-v17-threat-corpus.jsonl") >= 1
assert "len(datasets) != 11" in body, "packaging cell must assert 11 datasets"
assert 'train("control")' in body, "ARM B (control) cell is missing -- it is half the experiment"

print(f"[ok] {OUT}")
print(f"     {len(NOTEBOOK['cells'])} cells, {os.path.getsize(OUT) / 1024:.1f} KB, "
      f"every code cell compiles")
print(f"     intro quotes the LIVE guard report: increment {INC_ROWS:,} rows, "
      f"{INC_NON_EN:,} non-English across {INC_LANGS} languages")
print(f"     corpus {BEFORE['rows']:,} -> {AFTER['rows']:,} rows, non-English "
      f"{BEFORE['non_english_share_pct']}% -> {AFTER['non_english_share_pct']}%, "
      f"languages {BEFORE['distinct_languages']} -> {AFTER['distinct_languages']}")
print("     two arms: ARM A candidate (mdistilbert) + ARM B control (minilm), both at "
      "effective batch 128")
