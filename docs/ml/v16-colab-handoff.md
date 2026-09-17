# SoterLLM v16 — Colab training handoff

**What v16 is.** One experiment with one moving part. v16 takes v14's trainer,
v14's encoder (`all-MiniLM-L6-v2`, WordPiece), and v14's exact hyperparameters,
and retrains over the same 9-file corpus v15 trained on **plus one 10th file**,
`datasets/ml-v16-threat-corpus.jsonl` — 4,100 rows of native multilingual,
multi-turn and agentic attack data, each family paired with benign controls in
the same language and register. Encoder, batch, LR, epochs, augmentation: all
held fixed, so if the model moves, the corpus increment moved it.

**The bar is v14, not v15.** v15 was a **NO-GO** and never deployed: its
crossdist FPR came in at 5.66% against a 5.6% ceiling, and the paired attack
McNemar landed b=21 / c=8, p=0.0241 — *in v14's favour*. v14 is live. Every
gate below therefore compares **v14 vs v16**. A v15-vs-v16 comparison is
informative for diagnosing whether the increment did what it was written to do,
but it is not the ship decision.

---

## What the increment was built against (a measurement, not a guess)

v15 scored on the 70-row held-out probe battery
(`datasets/v16-probe-battery.jsonl`, 56 attacks / 14 benign, seen by no model):

| | v15 (rules + ML) | rules only |
|---|---|---|
| attack recall | **89.29% (50/56)** | 62.50% (35/56) |
| benign FPR | **28.57% (4/14)** | 21.43% (3/14) |

The ML tier carries +26.79 recall points, so it is doing real work — but the
failures were not spread evenly:

- **Weakest labels** — MULTI_TURN_ESCALATION 5/8 (62.5%), DATA_EXFILTRATION_ATTEMPT 3/4,
  TOOL_CALL_ABUSE 3/4, JAILBREAK 6/7.
- **Weakest languages** — ja 2/3 (66.7%), ru 6/8 (75%), hinglish 6/8 (75%), against
  en 25/26 (96.2%). zh 3/3, ar 1/1, es 5/5, hi 2/2.
- **3 of the 4 false positives were benign security-education rows** — v15 blocks
  people who merely *discuss* attacks. The 4th was a benign Hinglish multi-turn
  coding question flagged JAILBREAK.
- **3 of the 6 misses were false-prior-consent MULTI_TURN** in ru / hinglish / ja
  ("we already discussed this", "you promised 15 turns ago") — one family, three
  languages. The increment authors that family in all 8.

**Corpus root cause.** MULTI_TURN_ESCALATION was 1,303 of 147,912 rows (0.88%),
and native non-English ~3.1%. Those are the two numbers the increment moves.

### What the increment actually changed

| metric | v15 corpus | v16 corpus | delta |
|---|---|---|---|
| total rows | 147,912 | 152,012 | +4,100 |
| MULTI_TURN_ESCALATION | 1,303 (0.881%) | 2,084 (1.371%) | **+781 (+0.490 pts)** |
| non-English share | 3.123% | 5.137% | **+2.014 pts** |
| SAFE share | 33.598% | 33.389% | −0.209 pts |

Increment composition — 4,100 rows, **3,040 attacks / 1,060 benign (25.9%)**,
**495 distinct categories**, 2,771 rows carrying non-ASCII text:

```
1060 SAFE                        243 JAILBREAK
 781 MULTI_TURN_ESCALATION       242 MODEL_EXTRACTION
 518 PROMPT_INJECTION            208 SYSTEM_PROMPT_LEAK_ATTEMPT
 259 TOOL_CALL_ABUSE             176 RAG_POISONING / SECRET / PII (each)
 258 DATA_EXFILTRATION_ATTEMPT     3 ENCODING_OBFUSCATION
```

By language: en 910, ru 461, hinglish 461, zh 459, hi 453, ja 453, es 453, ar 450.
The label × language matrix is fully populated in all 8 languages — v15's
increment had `en = 0` holes in PII, SECRET, RAG_POISONING and
SYSTEM_PROMPT_LEAK_ATTEMPT.

ENCODING_OBFUSCATION is deliberately capped at 3 rows. That label is saturated at
2,186 rows already; the standing rule is variety, not volume, and it was left
untouched when every other cap was raised.

### Design rules the composer enforces

Each is a lesson already paid for in this repo, encoded in
`scripts/ml/_build_v16_corpus.py` rather than left to authoring discipline:

1. **Teach the pattern, not the topic.** Rows encode manipulation *structure*;
   payloads stay abstract. Topic keywords are what drives over-defense — a bare
   `"article about"` suppressor once cleared 10 genocide-denial attacks.
2. **Native, not translated.** Non-English is authored in-language; composition
   joins only complete standalone sentences, so ru/ja/zh/ar/hi concatenation
   stays grammatical instead of producing translationese word-salad.
3. **Benign controls ship with every attack family, in the same languages.**
4. **Continuity is not the signal.** Every extra "as we agreed" attack is matched
   by an "as we agreed" *benign* row (`CAP_BENIGN_CONTINUITY` is pinned to
   `CAP_MT_FPC`). Without this the model learns that referring to earlier turns
   is itself an attack — probe FP #4 exactly.
5. **Authority claim is not the signal.** A capped slice of benign rows carries an
   attacker-style pretext ("I'm the developer", "this is a sandbox") in front of
   a legitimate request, because real developers say those things. Disclosed
   judgment call, capped at `BENIGN_PRETEXT_CAP = 9` per language.
6. **Three structurally distinct MULTI_TURN families** — false-prior-consent,
   crescendo, context-reset — not one template with synonyms.
7. **OOD preservation.** v15's gate-3 failure was English PROMPT_INJECTION on the
   OOD corpus (−10 of 943). English PI breadth is held high (`CAP_PI_EN_FRAMED
   = 150`, plus 80 override + 70 indirect-carrier seed rows) so the new
   multilingual mass cannot pull the English decision boundary the way v15's
   increment did.

---

## Stage A — build the upload bundle (local, Windows) — already done

```powershell
python scripts/ml/_build_v16_corpus.py      # compose the increment
python scripts/ml/verify-v16-corpus.py      # leak guard + dedup + audit  (MUST pass)
python scripts/ml/colab/_build_v16_notebook.py
python scripts/ml/colab/_build_v16_bundle.py
```

Produces `soterai-v16-train-bundle.zip` at the repo root:

| | |
|---|---|
| size | 7.93 MB |
| members | 13 (trainer + `soter_augment.py` + `run_v16_anywhere.py` + 10 datasets) |
| dataset rows | 152,012 (147,912 v15 corpus + 4,100 v16) |
| sha256 | `dceecd1a32e49551bf24d4900c832f89a4d7b4cd05b5744af16ab2a2cb80543a` |

Three gates run before those bytes exist, and all three are hard failures:

- **`verify-v16-corpus.py`** — exits 2 on any `group_key_for()` collision with the
  four held-out instruments (`v16-probe-battery`, `v15-test-battery`,
  `crossdist-eval-v3`, `_v15-tranches-scoreset`), drops rows already present in
  the 9 v15 files, and writes `artifacts/ml/v16-corpus-report.json`. Current run:
  **4,100 in / 4,100 kept, zero drops, zero collisions.**
- **The bundle builder refuses to pack** unless that report exists, says
  `holdout_collisions == 0`, **and** its `increment_rows_kept` still matches the
  file on disk — which catches an increment edited *after* it was verified. It
  then re-checks the increment against all four instruments a second time with an
  independent normaliser. A bundle is the last point at which a probe row can be
  stopped from reaching a GPU; after upload there is no gate left.
- **The zip is verified by extraction**, not `namelist()`. PowerShell's
  `Compress-Archive` writes backslash separators that Linux `extractall()` treats
  as literal one-segment filenames — and Windows' own `extractall` silently
  repairs them, so a `namelist()` check passes on the very machine that creates
  the bug. This builder uses Python `zipfile` with forward slashes, extracts to a
  temp dir, re-reads, and confirms the 2,771 non-ASCII rows survived the round
  trip.

If you edit any dataset, rebuild — the sha256 above binds the exact bytes.

## Stage B — train on a GPU

Pick one. All three run the identical pinned command; they differ only in host.

### B1 — Colab (the default)
1. Open `scripts/ml/colab/soterllm-v16-gpu.ipynb` in Colab (8 cells).
2. **Runtime → Change runtime type → T4 GPU** (or better). A T4 is enough —
   minilm at batch 128 is tiny.
3. Run top to bottom. Cell 3 takes the bundle upload; cell 4 is the preflight.
4. Cell 5 mounts Drive so a runtime recycle doesn't lose the run; it checkpoints
   each epoch and `--resume` picks up after a disconnect.
5. Cell 7 packages and downloads `soterai-v16-artifact.zip`.

Two things the notebook does that are worth knowing about:

- The **preflight prints per-language WordPiece `[UNK]` coverage** on the
  increment. This is **informational, not a gate** — v14 established that
  tokenizer damage is uncorrelated with which languages actually fail. Read it,
  don't act on it.
- The **packaging cell asserts `len(manifest["datasets"]) == 10`**. If it shows 8,
  `--train-datasets` was dropped and you just retrained v14 under a new name —
  which would still print perfectly healthy metrics right there. That assert is
  the only thing standing between a dropped flag and a wasted GPU-hour.

Expect roughly an hour per epoch on a T4; 3 epochs is the target. The trainer
prints an ETA after 40 steps — if it's unaffordable, kill it there, not three
hours in.

### B2 — Kaggle
Same notebook; upload the bundle as a Kaggle dataset and adjust the bundle cell's
path.

### B3 — a rented box with no notebook UI
Copy the bundle over and run the no-notebook runner (it ships *inside* the bundle):
```bash
python run_v16_anywhere.py soterai-v16-train-bundle.zip
```
It stages the bundle (refusing backslash zips), **refuses to continue if the
increment has zero non-ASCII rows** — the signature of a bundle mangled by a
text-mode transfer, which would silently delete the entire multilingual signal —
installs missing deps, probes the GPU, and runs the identical pinned command. It
refuses to start a silent multi-hour CPU run without `--cpu`.

It is Python rather than a shell script on purpose: this file is authored on
Windows and run on Linux, and a `.sh` with CRLF endings dies with an opaque
`bad interpreter: /usr/bin/env bash^M`.

## Stage C — accept or reject (local, back on your machine)

Unzip the artifact into `models/ml-classifier-v16/`, then run **in order**:

```bash
# 0. Only if the run reported ONNX parity UNVERIFIED (no onnxruntime in the image)
python scripts/ml/train-soterllm-v14-fullft.py --verify-only models/ml-classifier-v16

# 1. Sign it. augmentWithMl fails OPEN on an unsigned artifact — an unsigned model
#    does not error, it silently turns the whole ML tier dark.
npx tsx scripts/ml/sign-model-artifact.ts --model models/ml-classifier-v16/model.onnx \
    --source local-training --builder-id soterai://local/v16

# 2. Prove the production loader accepts it (gate, labels, calibration, vocab.txt,
#    tokenizer, session, decide) — the exact path a request takes.
npx tsx scripts/ml/_probe-v14-runtime.ts models/ml-classifier-v16

# 3. THE GATE — v14 vs v16 on the SAME rows, McNemar.
npx tsx scripts/ml/compare-models.ts --file datasets/v15-test-battery.jsonl \
    --a models/ml-classifier-v14 --b models/ml-classifier-v16 \
    --out artifacts/ml/v14-vs-v16-battery.json
npx tsx scripts/ml/compare-models.ts --file artifacts/ml/_v15-tranches-scoreset.jsonl \
    --a models/ml-classifier-v14 --b models/ml-classifier-v16 \
    --out artifacts/ml/v14-vs-v16-tranches.json

# 4. No-regression on ordinary traffic — paired McNemar on the OOD corpus.
#    This is the gate v15 failed. Twice.
npx tsx scripts/ml/compare-models.ts --file datasets/crossdist-eval-v3.jsonl \
    --a models/ml-classifier-v14 --b models/ml-classifier-v16 \
    --out artifacts/ml/v14-vs-v16-crossdist.json
#    For the headline-comparable 97.52%/5.56% number, point .env's ML_ONNX_* at v16:
npx tsx scripts/ml/eval-crossdist-production.ts --limit 4250

# 5. The probe battery v16 was built to move. score-battery.ts runs the FULL
#    pipeline, so it reads the model from .env — point .env at v16 first.
npx tsx scripts/ml/score-battery.ts --file datasets/v16-probe-battery.jsonl \
    --out artifacts/ml/v16-probe-v16.json
#    Then the paired comparison against the stored v15 arm:
python scripts/ml/compare-probe-arms.py \
    --a artifacts/ml/v16-probe-v15.json --a-name v15 \
    --b artifacts/ml/v16-probe-v16.json --b-name v16
```

`compare-probe-arms.py` is the instrument that makes step 5 falsifiable. It
refuses to compare two arms that scored different files or different row counts,
prints per-label and per-language recall with `caught/attacks` denominators,
stars the cells the increment was explicitly written against, does a **row-level
diff** off the `-misses.jsonl` / `-fps.jsonl` sidecars, and runs **McNemar's exact
binomial** (not chi-square — the approximation is invalid below ~25 discordant
pairs). It reports regressions with the same prominence as fixes, because a
retrain that trades ja for ru is not a win and without a paired view it looks
like one. It also warns if the rules-only arm moved between runs, which would
mean the rules tier was edited and this is no longer a clean model-vs-model
comparison.

### Acceptance gate — v16 replaces v14 only if **all seven** hold

| # | Gate | Bar |
|---|------|-----|
| 1 | Battery McNemar (3) | v16 **not significantly worse** than v14; ideally b/c lopsided in v16's favour |
| 2 | Multilingual recall | ru, hinglish, ja attack recall rise on battery + tranches, **no benign-FPR rise** on those sets |
| 3 | **No OOD regression (4)** | v16 loses ≤ noise vs v14; headline **≥97.10% recall at ≤5.6% FPR** (`--limit 4250`). **This is the gate v15 failed, twice** — 5.66% FPR, and paired attack McNemar b=21/c=8 p=0.0241 against it |
| 4 | No label collapse | no label drops toward zero recall in validation |
| 5 | Ordinary-benign FPR | crossdist FPR (v14 = **51/918 benign**, 5.56%) does not regress materially |
| 6 | Health + suite green | test suite passes, guard health OK — **never actually run for v15; run it this time** |
| 7 | Probe battery (5) | targeted cells move and **nothing regresses**. Quote every figure as `x/y` |

**If gate 1 comes back p > 0.05, that is a real result, not a failure to argue
around.** 4,100 rows is 2.7% of the corpus — three times v15's 0.8% share, and
aimed at a label that was 0.88% — so it is a genuinely larger lever than v15's.
But if it still doesn't move, the finding is that the ceiling is not where we
thought, and the answer is a further-scaled increment, not a bigger model. Keep
v16 as a checkpoint, leave v14 live, and do not ship noise as an improvement.

Gate 3 is the historically dangerous one twice over: v6 once lifted a target
metric while quietly regressing the core hybrid 100% → 95.8%, and v15 died here.
Always verify crossdist at `--limit 4250` — the default 1200 is a *different* row
set (the limit is a stride, not a head), so its numbers don't compare.

**Denominators are mandatory.** The adversarial-hard-negative FPRs — 52.17% on
the tranches (24/46), 77.78% and 80.56% on the battery (29/36), 28.57% on the
probe (4/14) — are measured on deliberately-confusable rows and are **not** deploy
metrics. Never quote them without the denominator. Ordinary-traffic FPR is gate
5's: **5.56% = 51/918 benign rows** in the `--limit 4250` sample.

**"Beats Lakera" / "world best" is not a printable claim.** Lakera is API-only and
unmeasurable from here, and PINT-style scores don't transfer across corpora.
Report measured deltas, with denominators, against v14.

### Deploy — only after all seven gates pass

```bash
# .env and .env.production
ML_ONNX_MODEL_PATH=models/ml-classifier-v16/model.onnx
ML_ONNX_LABELS_PATH=models/ml-classifier-v16/labels.json
ML_ONNX_CALIBRATION_PATH=models/ml-classifier-v16/calibration.json
ML_ONNX_MAX_LENGTH=256        # MUST equal --max-length from the run
```

Keep v14 on disk — rollback is an env swap, and you want that to stay true.
Note the standing trap: **weights alone are not deployable.** v14's round proved
it — a label map with more entries than the 9-value Prisma enum makes
`loadLabelMap` throw and the tier goes silently dark. Step 2 above is what
catches that.

---

## Deltas vs the v15 process

- **10th dataset.** The run passes `--train-datasets` with all 10 files
  explicitly. The trainer's built-in default is v14's **8**-file set, so without
  this flag Colab silently omits both the v15 *and* v16 rows and retrains v14
  under a new name. The notebook asserts the manifest length for this reason.
- **Output dir** `models/ml-classifier-v16`; v14's and v15's directories are never
  touched.
- **The increment is a separate 10th file**, not merged into
  `ml-v15-threat-corpus.jsonl`, so "the corpus is the only change" stays literally
  true and the v15/v16 increments never conflate.
  `scripts/ml/assemble-v15-corpus.py` is **not** used for v16: its `--test-out`
  defaults to `datasets/v15-test-battery.jsonl`, which is one of the four held-out
  instruments. `verify-v16-corpus.py` is the v16 equivalent.
- **Batch/LR stay pinned** to v14's trained values (128 / 4.0e-5, from sqrt
  scaling off the 32-batch 2e-5 baseline) rather than derived from VRAM, so the
  comparison keeps one moving part.
- **Encoder stays `minilm`.** This is a hard production constraint, not a
  preference: SentencePiece/BPE encoders (DeBERTa, RoBERTa) train fine and then
  **fail to load in prod**, which darkens the ML tier silently. WordPiece only.
- **A 7th gate** — the probe battery — and gate 6 is no longer optional.
- **Signing builder-id** is `soterai://local/v16`.

## Two open judgment calls — decide with the v16 numbers, don't bundle silently

Both are gate-config trades measured in the weakness report, independent of which
model is live. Surface them alongside the v16 results:

1. **AP=0.75 abstention-review bar** (`SOTERAI_ML_ABSTAIN_REVIEW_AP`, default
   0.80). Lowering to 0.75 buys +5 attacks for +9 HUMAN_REVIEWs per 6,424
   requests — and this path caps at HUMAN_REVIEW, it can **never** BLOCK. Not a
   Pareto win; the owner's call. Leaving it at 0.80 is defensible.
2. **DATA_EXFILTRATION_ATTEMPT gate admission.** At scale it's +0 attacks / +1 FP
   (HOLD), and unlike TOOL_CALL_ABUSE (already admitted, crossdist-verified
   neutral) it is **not** rollback-neutral — v7 can emit index 8. The v16
   increment adds 258 DATA_EXFIL rows across 8 languages and the probe cell was
   3/4; re-weigh this once gate 7 has a number.
