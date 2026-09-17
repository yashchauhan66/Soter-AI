# SoterLLM v15 — Colab training handoff

**What v15 is.** One experiment with one moving part. v15 takes v14's trainer,
v14's encoder (`all-MiniLM-L6-v2`, WordPiece), and v14's exact hyperparameters,
and retrains over v14's exact 146,757-row corpus **plus one 9th file**,
`datasets/ml-v15-threat-corpus.jsonl` — 1,155 hand-authored rows, 355 of them
native Russian and Hinglish, targeting the two languages the v14 weakness report
found failing *confidently* (a wrong `SAFE` no threshold can recover). Encoder,
batch, LR, epochs, augmentation: all held fixed, so if the model moves, the
corpus increment moved it.

This is deliberately **not** a bigger model and **not** an encoder bake-off.
v14's round settled that three ways — unfrozen vs frozen minilm was ~flat, the
v14-vs-v12 paired test came back p=0.512, and tokenizer damage turned out
uncorrelated with which languages actually fail. The lever is native data in two
cells, not architecture. See `memory/v15-ultra-hardening-2026-09-06.md` and
`artifacts/ml/V15-WEAKNESS-REPORT.md`.

v14 stays live throughout. v15 writes to its own directory; deploying it is an
`.env` swap at the very end, gated by the v14-vs-v15 McNemar test — never by the
in-distribution numbers the run prints.

For the deep mechanics (six-gate rationale, checkpointing, what each artifact
file is), the v14 doc still applies verbatim except for the deltas below:
`docs/ml/v14-gpu-training-structure.md`.

---

## Stage A — build the upload bundle (local, Windows) — already done

```powershell
python scripts/ml/colab/_build_v15_bundle.py
```

Produces `soterai-v15-train-bundle.zip` at the repo root:

| | |
|---|---|
| size | 7.70 MB |
| members | 12 (trainer + `soter_augment.py` + `run_v15_anywhere.py` + 9 datasets) |
| dataset rows | 147,912 (146,757 v14 + 1,155 v15) |
| sha256 | `bf8d4e0c5b46ea17fd1c6f1a01052d2444102b630c4f7f7096f69c96e71f20d1` |

The builder verifies the zip by **extracting** it to a temp dir and re-reading,
not by `namelist()` — PowerShell's `Compress-Archive` writes backslash separators
that Linux `extractall()` treats as literal filenames, and Windows' own
`extractall` silently repairs them, so a `namelist()` check would pass on the
very machine that creates the bug. This builder uses Python `zipfile` with
forward slashes and proves it Linux-safe. If you edit any dataset, rebuild; the
sha256 above binds the exact bytes.

## Stage B — train on a GPU

Pick one. All three run the identical command; they differ only in host.

### B1 — Colab (the default)
1. Open `scripts/ml/colab/soterllm-v15-gpu.ipynb` in Colab.
2. **Runtime → Change runtime type → T4 GPU** (or better). A T4 is enough —
   minilm at batch 128 is tiny.
3. Run cells top to bottom. Cell 2 prompts you to upload
   `soterai-v15-train-bundle.zip` (or pick it up from Drive if you put it there).
4. Cell 4 mounts Drive so a runtime recycle mid-run doesn't lose the work; the
   run checkpoints each epoch and `--resume` picks up after a disconnect.
5. Cell 6 verifies the artifact is complete and downloads
   `soterai-v15-artifact.zip`.

Expect roughly an hour per epoch on a T4; 3 epochs is the target. The trainer
prints an ETA after 40 steps — if it's unaffordable, kill it there.

### B2 — Kaggle
Same notebook works; upload the bundle as a Kaggle dataset and adjust cell 2's
path, or use the v14 Kaggle builder pattern (`_build_v14_kaggle_notebook.py`) as
a template if you want a dedicated one.

### B3 — a rented box with no notebook UI
Copy the bundle over and run the no-notebook runner (it's inside the bundle too):
```bash
python run_v15_anywhere.py soterai-v15-train-bundle.zip
```
It stages the bundle (refusing backslash zips), installs missing deps, probes the
GPU, and runs the identical pinned command. It refuses to start a silent
multi-hour CPU run without `--cpu`.

## Stage C — accept or reject (local, back on your machine)

Unzip the artifact into `models/ml-classifier-v15/`, then run **in order**:

```bash
# 0. Only if the run reported ONNX parity UNVERIFIED (no onnxruntime in the image)
python scripts/ml/train-soterllm-v14-fullft.py --verify-only models/ml-classifier-v15

# 1. Sign it. augmentWithMl fails OPEN on an unsigned artifact — an unsigned model
#    does not error, it silently turns the whole ML tier dark.
npx tsx scripts/ml/sign-model-artifact.ts --model models/ml-classifier-v15/model.onnx \
    --source local-training --builder-id soterai://local/v15

# 2. Prove the production loader accepts it (gate, labels, calibration, vocab.txt,
#    tokenizer, session, decide) — the exact path a request takes.
npx tsx scripts/ml/_probe-v14-runtime.ts models/ml-classifier-v15

# 3. THE GATE — v14 vs v15 on the SAME rows, McNemar. Decides whether v15 ships.
#    a) clean held-out battery (274 rows, 15 languages, seen by neither model)
npx tsx scripts/ml/compare-models.ts --file datasets/v15-test-battery.jsonl \
    --a models/ml-classifier-v14 --b models/ml-classifier-v15 \
    --out artifacts/ml/v14-vs-v15-battery.json
#    b) tranche scoreset — the confidently-blind ru/hinglish cells v15 targets
npx tsx scripts/ml/compare-models.ts --file artifacts/ml/_v15-tranches-scoreset.jsonl \
    --a models/ml-classifier-v14 --b models/ml-classifier-v15 \
    --out artifacts/ml/v14-vs-v15-tranches.json

# 4. No-regression on ordinary traffic — paired McNemar on the OOD corpus.
npx tsx scripts/ml/compare-models.ts --file datasets/crossdist-eval-v3.jsonl \
    --a models/ml-classifier-v14 --b models/ml-classifier-v15 \
    --out artifacts/ml/v14-vs-v15-crossdist.json
#    For the headline-comparable 97.52%/5.56% number, point .env's ML_ONNX_* at v15
#    and run:  npx tsx scripts/ml/eval-crossdist-production.ts --limit 4250
```

### Acceptance gate

v15 replaces v14 only if **all** hold:

| # | Gate | Bar |
|---|------|-----|
| 1 | Battery McNemar (3a) | v15 **not significantly worse**; ideally b/c lopsided in v15's favour, driven by ru + hinglish |
| 2 | Multilingual recall | ru and hinglish attack recall rise on battery + tranches, **no benign-FPR rise** on those sets |
| 3 | No OOD regression (4) | v15 loses ≤ noise vs v14; headline ≥97.10% recall at ≤5.6% FPR (`--limit 4250`) |
| 4 | No label collapse | no label drops toward zero recall in validation |
| 5 | Ordinary-benign FPR | crossdist FPR (**51/918 benign** at v14's 5.56%) does not regress materially |
| 6 | Health + suite green | test suite passes, guard health OK |

**If gate 1 comes back p > 0.05 ("no significant difference"), that is a real
result, not a failure to argue around.** It would mean 1,155 rows (~0.8% of the
corpus) was too small to move a 23M-param fine-tune — exactly the "corpus is the
ceiling" finding, now with a known remedy (the weakness report's arithmetic:
~1,394 rows for 1% ru+hinglish, ~2,915 for 2%). Keep v15 as a checkpoint, leave
v14 live, and the next increment is more native ru/hinglish, not a bigger model.
Do not ship noise as an improvement.

Gate 3 is the historically dangerous one: v6 once lifted a target metric and
quietly regressed the core hybrid 100% → 95.8%. Always verify crossdist at
`--limit 4250` — the default 1200 is a *different* row set (the limit is a stride,
not a head), so its numbers don't compare.

**Denominators are mandatory.** The adversarial-hard-negative FPRs (52.17% on the
tranches, 77.78% on the battery) are measured on 24–46 deliberately-confusable
rows and are **not** deploy metrics — never quote them without the denominator.
Ordinary-traffic FPR is gate 5's: v14 is **5.56% = 51/918 benign rows** in the
`--limit 4250` sample. (The 6,424-benign denominator in the gate-widening work is
a *different* corpus — `artifacts/ml/_gate-fpcost-corpus.jsonl`, the full crossdist
benign pool — and does not apply to this 5.56%.)

### Deploy — only after all six gates pass

```bash
# .env and .env.production
ML_ONNX_MODEL_PATH=models/ml-classifier-v15/model.onnx
ML_ONNX_LABELS_PATH=models/ml-classifier-v15/labels.json
ML_ONNX_CALIBRATION_PATH=models/ml-classifier-v15/calibration.json
ML_ONNX_MAX_LENGTH=256        # MUST equal --max-length from the run
```

Keep v14 on disk — rollback is an env swap, and you want that to stay true.

---

## Deltas vs the v14 process (so the v14 doc still reads true)

- **9th dataset.** The run passes `--train-datasets` with all 9 files explicitly.
  The trainer's built-in default is v14's 8-file set, so *without* this flag Colab
  silently retrains v14 under a new name and never sees the v15 rows.
- **Output dir** `models/ml-classifier-v15`; v14's directory is never touched.
- **Batch/LR pinned** to v14's trained values (128 / 4e-5) rather than derived
  from VRAM, so the comparison has one moving part. On a T4 the v14 notebook's
  VRAM formula would have chosen the same 128 anyway; on a bigger GPU it would
  have diverged, which is why v15 pins.
- **No bake-off cell.** The encoder question is closed (see top). Re-ranking would
  burn ~25 min of GPU to re-answer it.
- **Signing builder-id** is `soterai://local/v15`.

## Two open judgment calls — decide with the v15 numbers, don't bundle silently

Both are gate-config trades measured in the weakness report, independent of which
model is live. Surface them alongside the v15 results:

1. **AP=0.75 abstention-review bar** (`SOTERAI_ML_ABSTAIN_REVIEW_AP`, default
   0.80). Lowering to 0.75 buys +5 attacks for +9 HUMAN_REVIEWs per 6,424
   requests — and this path caps at HUMAN_REVIEW, it can **never** BLOCK. Not a
   Pareto win; the owner's call. Leaving it at 0.80 is defensible.
2. **DATA_EXFILTRATION_ATTEMPT gate admission.** At scale it's +0 attacks / +1 FP
   (HOLD), and unlike TOOL_CALL_ABUSE (already admitted, crossdist-verified
   neutral) it is **not** rollback-neutral — v7 can emit index 8. The v15 rows
   added 2 fresh confidently-correct-but-gated DATA_EXFIL cases; weigh them here.
