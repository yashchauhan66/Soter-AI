# SoterLLM v14 — final GPU training structure

**Status:** everything below is built and CPU-proven. Nothing is trained. The GPU
run is yours; this document is the structure for it.

---

## 1. Why v14 exists

v7, v8, v10, v11 and v12 all trained the same thing: a ~330K-parameter MLP head on
top of a **frozen** 22M-parameter `all-MiniLM-L6-v2` encoder.
`scripts/ml/train-soterllm-v10-transfer.py` lines 489–495 set
`requires_grad = False` across every encoder parameter, and each later version
inherited it. Five model versions and roughly a month of iteration, and the
encoder was never trained once.

That is the plateau. Not data volume — the corpus is already 146,757 rows. Not
effort. The representation feeding the classifier was fixed the whole time, and
everything measured since has been the head learning to slice a frozen space.

Freezing was the correct call while training had to run on a CPU: a full
fine-tune there is a multi-day job. A GPU removes the constraint that produced the
decision, so v14 removes the decision.

**What v14 changes**

| | v12 | v14 |
|---|---|---|
| Encoder | frozen, 22M | **trained end-to-end**, 22M–335M, swappable |
| Trainable params | ~330K | ~23M (minilm) to ~335M (electra-large) |
| LR schedule | flat, head only | layer-wise decay + warmup→cosine |
| Precision | fp32 | bf16 / fp16 with unscale-before-clip |
| Epoch choice | last epoch | best epoch under a benign-FPR ceiling |
| `vocab.txt` | **not written** → runtime fail-open | written and asserted |
| ONNX batch axis | v7 froze it at `[1, 9]` | dynamic on batch **and** sequence, proven |
| Calibration split | unrecoverable | persisted with digest |
| Thresholds | 12 of 14 silently inert | inert set computed and reported |

---

## 2. Hard constraints — read before changing anything

**2.1 The encoder must be WordPiece.** Production tokenizes with the in-repo
`BertTokenizer` (`lib/ml/bertTokenizer.ts`) reading `tokenizer_config/vocab.txt`.
There is no SentencePiece and no BPE tokenizer anywhere in the runtime. DeBERTa-v3,
RoBERTa, XLM-R and mDeBERTa will train perfectly on the GPU and then **fail to
load in production**.

Qualifying encoders, all pre-registered in `ENCODERS`:

| key | model | params | hidden |
|---|---|---|---|
| `minilm` | `sentence-transformers/all-MiniLM-L6-v2` | 22M | 384 |
| `distilbert` | `distilbert-base-uncased` | 66M | 768 |
| `bert-base` | `bert-base-uncased` | 110M | 768 |
| `electra-base` | `google/electra-base-discriminator` | 110M | 768 |
| `bge-base` | `BAAI/bge-base-en-v1.5` | 110M | 768 |
| `mbert` | `bert-base-multilingual-cased` | 178M | 768 |
| `electra-large` | `google/electra-large-discriminator` | 335M | 1024 |

`assert_wordpiece()` enforces this **behaviourally**, not by matching names: all
five BERT specials present, ≥1000 `##` continuation pieces, zero `▁` pieces (the
SentencePiece signature), contiguous ids `0..N-1`, no whitespace-bearing tokens.
A misnamed model fails; a correctly-shaped unlisted one passes.

**2.2 Hidden size is free.** Nothing in `lib/` hardcodes 384. The ONNX graph,
calibration format and label map are all dimension-agnostic, so 768 and 1024 are
drop-in. This was verified on the TypeScript side before the trainer was written.

**2.3 The ONNX contract.** Inputs exactly `input_ids` and `attention_mask`, both
int64, **no `token_type_ids`** — the collator drops it deliberately so training
and serving see the same thing. First output named `logits`. Temperature is baked
into the logits at export (`logits / T`), so the runtime must not divide again.

**2.4 Label index order is a contract.** `ALL_LABELS[0]` is `SAFE` and every other
index is load-bearing for `labels.json`. Never reorder; append only.

**2.5 `max_length` must match `.env`.** `--max-length` (default 256) has to equal
`ML_ONNX_MAX_LENGTH`. A mismatch does not error — it silently changes what the
model sees versus what it was trained on.

**2.6 Unsigned means dark, not broken.** `onnxBackend._init()` refuses to
deserialize unless the artifact exists, a signed manifest covers it, the signer
chains to the trust root, the provenance source is allowlisted and the scan is
clean. On failure `augmentWithMl` fails **open** — no error surfaces, the ML tier
just stops contributing. An unsigned v14 will look deployed and do nothing.

---

## 3. What is delivered

| file | role |
|---|---|
| `scripts/ml/train-soterllm-v14-fullft.py` | the trainer (1,865 lines) |
| `scripts/ml/colab/soterllm-v14-gpu.ipynb` | 9-cell Colab GPU notebook |
| `scripts/ml/colab/soterllm-v14-kaggle.ipynb` | 9-cell Kaggle notebook — the Colab fallback (§4.3) |
| `scripts/ml/colab/run_v14_anywhere.py` | no-notebook runner for terminal-only GPU hosts (§4.3) |
| `scripts/ml/colab/_build_v14_notebook.py` | regenerates the Colab notebook |
| `scripts/ml/colab/_build_v14_kaggle_notebook.py` | regenerates the Kaggle notebook |
| `scripts/ml/colab/_build_v14_bundle.py` | builds + extraction-verifies the upload zip (11 members) |
| `scripts/ml/_probe-v14-runtime.ts` | loads an artifact through the real production backend |
| `docs/ml/v14-gpu-training-structure.md` | this document |

Both notebooks are **generated, never hand-edited** — hand-editing `.ipynb` JSON is
how you produce a file the host refuses to open. Each generator round-trips the
JSON and `compile()`s every code cell; the Kaggle one additionally asserts that no
`google.colab` import or `/content` path leaked across.

**Corpus (all 8 files, 146,757 rows):**

| rows | file |
|---|---|
| 120,620 | `datasets/ml-augmented-v8-final.jsonl` |
| 8,500 | `datasets/ml-v8-targeted-fix.jsonl` |
| 8,000 | `datasets/ml-v10-advanced-attacks.jsonl` |
| 5,000 | `datasets/ml-v10-targeted-fix.jsonl` |
| 1,212 | `datasets/ml-v11-weak-fix.jsonl` |
| 1,000 | `artifacts/ml-v2/v12-toxicity-fix.jsonl` |
| 2,019 | `datasets/ml-v13-meta-instructional.jsonl` ← never trained on |
| 406 | `datasets/ml-v13-attack-gaps.jsonl` ← never trained on |

The two v13 corpora were built for the two gaps that are actually measured:
benign meta-instructional over-defense (~40% FPR) and prefix-priming recall
(81.5%). They have been sitting untrained since 2026-08-20.

---

## 4. Run order

### Stage A — local, before Colab (~2 min)

```powershell
# 1. Pipeline smoke test. 3 minutes on CPU. Proves the plumbing, not the model.
python scripts/ml/train-soterllm-v14-fullft.py --sample --epochs 2 --encoder minilm `
    --batch-size 8 --max-steps 25 --amp off --num-workers 0 `
    --output-dir models/ml-classifier-v14-smoke

# 2. Build the upload bundle (NEVER Compress-Archive -- see §7.4)
python scripts/ml/colab/_build_v14_bundle.py
```

Expected from step 1 — already verified on this machine:

```
vocab.txt              30,522 tokens                     <- v12's fail-open bug, fixed
ONNX parity            worst max|diff| = 3.34e-06        <- across (1,14) (3,14) (2,14)
split persisted        sha256 9566feed7d42855e           <- v12's unrecoverable split, fixed
epoch selection        NO_EPOCH_MET_FPR_CEILING<=0.0300__fell_back_to_min_fpr
wall clock             3.1 min on cpu
```

That last line is the point of the smoke test: selection **announces** when no
epoch cleared the ceiling instead of quietly shipping the least-bad one. The smoke
model's F1 0.5944 / benign FPR 0.5909 are meaningless — ~3K rows, 25 steps. They
prove the pipeline runs; they are not a model result.

Bundle output: `soterai-v14-train-bundle.zip`, 7.6 MB, 10 members.

### Stage B — Colab (the GPU run)

Upload `soterai-v14-train-bundle.zip` and `scripts/ml/colab/soterllm-v14-gpu.ipynb`,
set **Runtime → Change runtime type → GPU**, then run the cells in order:

| cell | does | time |
|---|---|---|
| 1 | assert GPU, read VRAM, choose encoder/batch/AMP | instant |
| 2 | unpack bundle, verify no backslash paths, count rows | ~30 s |
| 3 | install onnxruntime, WordPiece preflight on the chosen encoder | ~1 min |
| 4 | mount Drive so a runtime recycle does not kill the run | ~20 s |
| 5 | **optional** encoder bake-off, 3 candidates | ~25 min |
| 6 | the real run | see below |
| 7 | verify artifact completeness, package, download | ~2 min |

Wall clock for cell 6, at `max_length` 256 over 146K rows. **These are upper
bounds measured before length-grouped batching existed** — see §4.1, which cut
padded tokens per epoch by 8.74×:

| encoder | T4 (16 GB) | A100 (40 GB) |
|---|---|---|
| `minilm` | ~35 min/epoch | ~12 min/epoch |
| `distilbert` | ~55 min/epoch | ~18 min/epoch |
| `bert-base` | ~100 min/epoch | ~30 min/epoch |
| `electra-large` | OOM | ~90 min/epoch, `--grad-checkpoint` required |

4 epochs is the default. Layer-wise LR decay plus warmup→cosine converges inside
that; more epochs mostly buys train-set overfit.

Two things protect a long run: `--checkpoint` writes `checkpoint.pt` each epoch
(re-run cell 6 with `--resume` after a disconnect), and every epoch's weights are
kept on CPU so selection can pick a non-final epoch.

### 4.1 Wall clock — the measured levers

The corpus is short text with a fat tail. Token lengths over all 146,757 rows
(bert-base WordPiece):

| p50 | mean | p90 | p95 | p99 | max |
|---|---|---|---|---|---|
| 18 | 35.8 | 47 | 130 | **452** | 512 |

With shuffled batches of 32, almost every batch catches one 400+ token row and the
collator pads all 32 rows up to it:

| batching | padded tokens / epoch |
|---|---|
| shuffled | 3,685,728 |
| length-grouped | 421,504 |

**8.74× of the compute was padding rather than data.** `LengthGroupedBatchSampler`
(default on; `--no-length-grouped` to disable) shuffles, cuts into megabatches,
sorts only *within* a megabatch, then shuffles batch order — HF's
`group_by_length` approach. `set_epoch` re-seeds each epoch so batch composition
still changes and this does not degrade into sorted training. The trainer prints
the achieved ratio every run, so it is never a silent claim.

Padded-token count is a proxy, so the wall clock was measured directly too — same
seed, same 4,000-row sample, 40 steps per arm, grouping the only difference:

| batching | ms/step | min/epoch |
|---|---|---|
| length-grouped | **1,828** | 1.2 |
| shuffled | 8,919 | 5.9 |

**4.88× faster wall clock**, against a 5.88× token reduction on that same sample.
The gap is the point: grouping does not change the *step count*, so fixed
per-step overhead does not shrink and the time gain is always somewhat below the
token gain. Measured on CPU; on a GPU the fixed overhead is a larger share of each
step, so expect the ratio to compress further.

Levers, in measured order of effect:

| lever | effect | cost |
|---|---|---|
| length-grouped batching | **4.88× measured wall clock** (8.74× fewer padded tokens) | none, on by default |
| `--encoder minilm` over `bert-base` | ~5× fewer FLOPs | capacity — but see §6 |
| larger `--batch-size` (128–256) | at p50=18 tokens, batch 32 leaves a GPU idling | scale LR by √ratio |
| `--epochs 3` | −25% | usually none; cosine converges inside 3 |
| `--amp bf16` / `fp16` | 2–3× | none on Ampere+ |
| `--max-length 128` | little, now that padding is grouped | truncation 3.14% → 5.01%, **and must match `.env`** |

Two non-levers, both checked: capping rows-per-group saves nothing (group
redundancy is only 1.14×), and `--max-length` barely matters once padding is
grouped.

**If it is still slow, check `device` in the trainer header.** On CPU, minilm is
**2.6 h/epoch measured on the full corpus** (4,635 steps at 2,047 ms, batch 32,
grouping on) and bert-base roughly 5× that — no flag fixes the absence of a GPU,
though `--unfreeze-top 3` takes minilm to 1.6 h/epoch (§4.3). A T4 is ~10 min and
~30 min/epoch respectively. The trainer also projects the full run from its first
40 steps:

```
[eta] 2047 ms/step, 4635 steps/epoch -> 2.6 h/epoch; this run 2 min for 1 epochs (capped at 45 by --max-steps)
```

so an unaffordable configuration is visible in the first minute rather than three
hours in. Note that `steps/epoch` and the per-epoch figure are always the *real*
ones: `--max-steps` caps what the run does, and is reported separately, because an
earlier version folded the cap into the per-epoch number and understated a real
epoch by ~90×.

### 4.2 Fastest genuinely useful run

```bash
python scripts/ml/train-soterllm-v14-fullft.py --encoder minilm \
    --output-dir models/ml-classifier-v14 --epochs 3 \
    --batch-size 128 --encoder-lr 4e-5 --head-lr 1e-3 \
    --amp bf16 --num-workers 2 --augment --checkpoint
```

`minilm` is not just the cheap pick — unfrozen minilm against v12's frozen minilm
is the one comparison that isolates the single variable v14 changes. Run it first
even if you intend to train `bert-base`, because if it is flat, a bigger encoder
will not rescue it and the real ceiling is the corpus.

### 4.3 If Colab will not work

Colab is a convenience, not a dependency. Everything below runs the same trainer
against the same bundle and is judged by the same acceptance gate (§5); only the
host changes.

| host | GPU | cost | use | the thing that bites |
|---|---|---|---|---|
| **Kaggle** | P100 16GB or T4×2 | free, 30 GPU-h/wk | `soterllm-v14-kaggle.ipynb` | `Settings > Internet` defaults **off** on some accounts, and the failure reads as an unrelated network error. GPU needs a phone-verified account. 12h/session. |
| **RunPod / Vast.ai** | 3090 / 4090 / A100 | ~$0.20–0.40/h, so **under \$1** for a 3-epoch minilm run | `run_v14_anywhere.py` | Terminal only — no notebook exists to fail. Billed while idle, so stop the pod. |
| **Lightning AI Studios** | T4 / A10G | free monthly hours | `run_v14_anywhere.py` | Free hours are consumed by the *machine*, not the job; switch to CPU when not training. |
| **SageMaker Studio Lab** | T4 | free | either | ~4h sessions, so `--checkpoint` and `--resume` are mandatory, not optional. |
| **this laptop, CPU** | none | free | `--unfreeze-top 3` | Measured 4.8 h for 3 epochs — one overnight run, no GPU needed. `--amp` must stay `off`. See below. |

**Why Kaggle first.** `Save Version > Save & Run All (Commit)` executes the whole
notebook **server-side and headless**. Closing the browser, losing wifi or sleeping
the laptop cannot kill it — which is Colab's usual failure mode, removed rather
than worked around. Progress appears under *Logs*; artifacts under *Output*.

Two Kaggle-specific traps the notebook already handles, both of which otherwise
waste a whole session:

* Uploading `soterai-v14-train-bundle.zip` to a Dataset **often auto-extracts it**,
  so `/kaggle/input` may hold a loose file tree rather than the archive. Cell 2
  accepts either shape.
* `/kaggle/input` is **read-only**. The tree must be copied into
  `/kaggle/working` before training, because the trainer writes alongside its
  inputs.

**The no-notebook route.** `scripts/ml/colab/run_v14_anywhere.py` ships *inside*
the bundle, so one upload is enough on hosts with no convenient second transfer:

```bash
python scripts/ml/colab/run_v14_anywhere.py            # bundle zip in the CWD
python scripts/ml/colab/run_v14_anywhere.py --dry-run  # stage and print, run nothing
python scripts/ml/colab/run_v14_anywhere.py --unfreeze-top 3 --cpu
```

It reads real VRAM to pick batch size and AMP, scales the encoder LR by √(batch/32),
refuses to start a silent multi-hour CPU run without `--cpu`, and packages the
artifact for transfer back. It is deliberately **Python rather than a shell
script**: this repo is authored on Windows, and a `.sh` with CRLF endings dies on
Linux with an opaque `bad interpreter: /usr/bin/env bash^M`. Same failure class as
the `Compress-Archive` backslash rule — removed instead of documented.

**Training on this laptop.** No GPU is present (Intel 4-core, `torch 2.12.1+cpu`),
so this is the slow path, but it is no longer impractical now that padding is
grouped. `--unfreeze-top N` trains only the top N encoder blocks and freezes the
embeddings plus the lower blocks. Measured on the **full corpus** (minilm, batch 32,
`--amp off`, 4,635 steps/epoch, nothing else running):

| config | trainable params | ms/step | h/epoch | 3 epochs |
|---|---|---|---|---|
| full fine-tune | 23,096,975 | 2,047 | 2.6 | **7.8 h** |
| `--unfreeze-top 3` | 5,854,991 | 1,205 | 1.6 | **4.8 h** |

**1.70× faster for 25% of the trainable parameters** — which puts a real 3-epoch
CPU fine-tune inside a single overnight window. (An earlier 4,000-row sample gave
1.42×; the full corpus has a longer tail — p90 52 vs 41 tokens — so both arms slow
down and the backward-pass saving becomes a larger share of the step. Prefer the
full-corpus figure: it is the one a real run pays.)

The gain is still modest by construction, and it is worth knowing why: the forward
pass traverses all six blocks regardless, so only the backward pass shortens. The
large win is elsewhere — freezing the 30,522 × 384 embedding matrix removes 11.7M
parameters of AdamW state and the biggest gradient tensor in the graph, which is
what makes the memory footprint drop far more than the clock does.

This is **not** `--freeze-encoder`. That flag reproduces v12 exactly: nothing in
the encoder moves, which is the ceiling v14 exists to break. With `--unfreeze-top`
the encoder still adapts — just less of it — so the result is a real fine-tune and
`training_stats.json` records it honestly as `partial_finetune_topN_blocks`. Using
the two flags together is a hard error rather than a silent precedence rule (both
guards verified at runtime, exit 1).

The overnight local run, in full — no Colab, no Kaggle, no GPU:

```bash
python scripts/ml/train-soterllm-v14-fullft.py \
    --encoder minilm --unfreeze-top 3 \
    --epochs 3 --batch-size 32 --amp off \
    --augment --output-dir models/ml-classifier-v14
```

Watch the `[eta]` line in the first minute and confirm it says ~1.6 h/epoch before
walking away. `--amp off` is not optional on CPU. Two caveats specific to this
route, both real:

* **`--encoder minilm` must be passed explicitly.** The default is `bert-base`,
  chosen for the GPU path, and on CPU it is roughly 5× the cost — an unflagged
  4-epoch CPU run is a multi-day job. The trainer now warns about exactly this when
  it detects `device=cpu` with neither freeze flag set.
* A partial fine-tune is a **weaker** result than the full one the GPU path buys.
  It is the honest fallback when no GPU is reachable, not the preferred
  configuration, and §5's acceptance gate still applies unchanged — if it does not
  beat v12, it does not ship.

### Stage C — local, after the download

```bash
# 0. ONLY if the notebook reported parity UNVERIFIED (Colab image lacked onnxruntime)
python scripts/ml/train-soterllm-v14-fullft.py --verify-only models/ml-classifier-v14

# 1. Sign it, or the ML tier silently goes dark (§2.6)
npx tsx scripts/ml/sign-model-artifact.ts --model models/ml-classifier-v14/model.onnx \
    --source local-training --builder-id soterai://local/v14

# 2. Prove the real production loader accepts it
npx tsx scripts/ml/_probe-v14-runtime.ts models/ml-classifier-v14
```

Then the gate in §5.

---

## 5. Acceptance gate

v14 replaces v12 only if **all six** pass. Anything less is a checkpoint worth
keeping, not a deploy. Point the model-path env at `models/ml-classifier-v14`
before each harness, so the numbers are comparable to how v12 was measured.

**1. Meta-instructional benign FPR drops.** This is the whole reason for the round.

```bash
npx tsx scripts/ml/measure-veto-fix.ts --tag v14
```

82 held-out rows (`datasets/meta-instructional-benign-heldout.jsonl`) through the
real `augmentWithMl` path. Escalation must fall well below v12's ~40–46%.

**2. No core recall regression.** The trap that has already bitten once.

```bash
npx tsx scripts/ml/eval-crossdist-production.ts \
    --file datasets/crossdist-eval-v3.jsonl --limit 4250
```

End-to-end recall within noise of v12's **97.10%** on PII / PROMPT_INJECTION /
SPLA / JAILBREAK, FPR at or under v12's **~5.2–5.6%**. `--limit 4250` is not
optional: the default 1200 is a different row set and its numbers do not compare.
v6 once lifted its target metric while quietly regressing the core hybrid from
100% to 95.8%, and had to be rolled back.

**3. Injection recall protected.** PROMPT_INJECTION and
SYSTEM_PROMPT_LEAK_ATTEMPT recall must not drop.

**4. Per-label validation holds.** `models/ml-classifier-v14/eval_results.json`
per-label recall must not regress against v12:

| label | v12 recall | v12 precision |
|---|---|---|
| ENCODING_OBFUSCATION | 0.7637 | 0.9925 |
| MODEL_EXTRACTION | 0.8065 | 0.9969 |
| TOXICITY_HARASSMENT | 0.9059 | 0.9928 |
| TOOL_CALL_ABUSE | 0.9234 | 0.9688 |
| PROMPT_INJECTION | 0.9756 | 0.9332 |
| JAILBREAK | 0.9767 | 0.9848 |

The first two are the standing weak spots. Note these are in-distribution
validation numbers on v12's own split — useful as a floor, not as evidence of
field performance.

**5. Attack-gap recall up, benign-confusable FP down.**

```bash
npx tsx scripts/ml/measure-attack-gap-baseline.ts
```

Against v12's measured baseline on the 406-row hard set:

| family | v12 | v14 must |
|---|---|---|
| prefix_injection | 81.5% detected | **rise above** |
| ATTACK overall | 95.0% (362/381) | **rise above** |
| contrastive_benign | **36% false-positive** (9/25) | **fall below** |

persona_roleplay and encoding_obfuscation are already ~100% via **rules**, so ML
gains there show up as the tier catching them standalone (defence in depth), not
as a system-level number.

**6. Health and suite green.**

```bash
npx tsx scripts/ml/check-ml-health.ts --require    # exit 0 on BOTH env files
npm test
```

Re-baseline the suite **before** the run (the v13 handoff recorded 1039 pass / 0
fail) so a pre-existing failure is not attributed to v14.

### Deploy, only after 1–6

```bash
# .env and .env.production
ML_ONNX_MODEL_PATH=models/ml-classifier-v14/model.onnx
ML_ONNX_LABELS_PATH=models/ml-classifier-v14/labels.json
ML_ONNX_CALIBRATION_PATH=models/ml-classifier-v14/calibration.json
ML_ONNX_MAX_LENGTH=256          # MUST equal --max-length from the run
```

Re-run the health gate after the swap, then commit. Keep v12 on disk — rollback
should stay a one-line env change.

---

## 6. Encoder bake-off

Nobody has measured which encoder is right for this corpus, because until now the
encoder was never trainable. Cell 5 trains 2–3 candidates for 3 epochs on a 24K
stratified subset (`--sample --sample-size 24000`) and prints a ranking table.

**Read `benign_FPR` first, then `f1_macro`.** Precision is the documented weak
axis: 36% FP on benign-confusable rows, ~40% on meta-instructional benign, while
the deployed system already catches 95% of the hard attack set. An encoder that
buys recall by spending precision is a regression here, not a win.

Suggested order: `bert-base` (the default and the safe pick), `distilbert` (half
the cost, usually within a point), `minilm` (the v12 encoder — the honest control
for "did unfreezing help, or did the bigger encoder help?"). Running `minilm`
unfrozen is the single most informative comparison available, because it isolates
the one variable v14 actually changes.

Bake-off numbers rank candidates. They are not the acceptance gate.

---

## 7. Defects v14 fixes (each was real, each is now proven)

**7.1 `vocab.txt` was never written.** `save_pretrained` does not emit `vocab.txt`
for fast tokenizers, so v12 shipped without it. The runtime threw on load, failed
**open**, and the ML tier went dark. v14 writes it explicitly, asserts contiguous
ids and no whitespace tokens, and writes `newline=""` with explicit `\n` so the
line index — which **is** the token id (`parseVocabTxt`, `bertTokenizer.ts:292`) —
survives Windows.

**7.2 The ONNX graph could not batch.** v7 exported from a `[1, 9]` dummy, freezing
both axes. v14 exports from `[2, max_length]` so an accidentally-static batch axis
fails at export time, and `verify_onnx_parity` then checks three real cases —
`batch1_padded`, `batch3_padded`, `batch2_dynamic_len` — against PyTorch at 1e-3.
Measured worst delta: **3.34e-06**.

**7.3 12 of 14 thresholds were dead.** v12 clamped per-label thresholds into
`[0.05, 0.5]`, but the argmax of a 14-class softmax is ≥ 1/14 = 0.0714. So every
threshold at 0.05 could never reject anything — and worse, `clearsLabelThreshold`
prefers *any* finite per-label threshold, so each dead threshold also switched off
the global 0.5 confidence floor for its label. Only PROMPT_INJECTION (0.3244) and
SYSTEM_PROMPT_LEAK_ATTEMPT (0.5) were live.

v14 computes `argmax_floor`, lists the inert set in `threshold_audit`, and states
the consequence in the artifact. Default policy `legacy` reproduces v12 exactly so
v14-vs-v12 isolates the encoder change; `--threshold-policy omit-inert` drops
unreachable thresholds so the global floor governs instead — that is **stricter**
and must be measured before it is used.

**7.4 The calibration split was unrecoverable.** v12 used `list(set())` plus
per-process string hash randomisation, so the split could not be reproduced and
the missing entropy fields had to be back-fitted from a substitute split biased
tighter than truth (`manifest_split_reproduced: false` records this). v14 uses
`sorted(set())`, persists `split_indices.json` with seed, counts, digest and full
index lists, and fits entropy on the true split
(`reference: "true-calibration-split"`, `manifest_split_reproduced: true`).

**7.5 Parity ran before the weights were saved.** Found while reasoning about the
Colab flow: `verify_onnx_parity` imports `onnxruntime`, and Colab images often
lack it — a 2-hour GPU run would finish training and then crash on the import,
destroying the weights. v14 writes `pytorch_model.bin`, `labels.json` and
`calibration.json` **before** the gate, degrades gracefully when `onnxruntime` is
absent, drops a `PARITY_UNVERIFIED.json` marker, and closes the gate later via
`--verify-only`.

**7.6 Leak-free augmentation ordering.** 3 of the 9 surface-form transforms
(homoglyph, spaced, typo) change the `group_key_for` key, so augmenting before
splitting would leak siblings across splits — exactly the bug that made an earlier
99.29% validation F1 fake. v14 augments the **train split only, after** the split,
and asserts every generated row's parent group is already inside the train split
(a stray triggers `SystemExit`).

---

## 8. When a gate fails

| failure | read it as | next lever |
|---|---|---|
| Gate 1 fails, 2–6 pass | encoder capacity did not fix over-defense | more contrastive benign data, not thresholds — the veto cannot fix this (margin −0.10→0.00 costs ~3,178 attacks / 19.55%) |
| Gate 2 fails | classic precision/recall trade, the v6 trap | reject; try lower `--encoder-lr` (1e-5) or 3 epochs before re-running |
| Gate 5 recall up, FP also up | over-defense, not learning | raise `--augment-benign-rate`, or re-weight benign in the loss |
| No epoch clears `--fpr-ceiling` | selection says so loudly | do **not** ship the fallback; treat as a data problem |
| Bake-off: `minilm` unfrozen ≈ `bert-base` | the frozen encoder was the ceiling, size was not | keep `minilm`, save 3× the latency |
| Bake-off: all candidates ≈ v12 | the ceiling is the corpus, not the encoder | stop training; the next lever is data or an `llmJudge` tier |

That last row matters. If unfreezing the encoder changes little, the honest
conclusion is that the corpus is the ceiling — and the right move is to say so,
not to run a bigger model.

---

## 9. What this document does not claim

- **Nothing here is a measured v14 result.** Every number above is either a v12
  baseline or a smoke-test pipeline proof. v14 has not been trained.
- v14 is not asserted to be better than v12. The gate exists precisely because
  full fine-tuning is expected to help and expectation is not evidence.
- No "best" or "100%" claim. On the only same-rows comparison run,
  **ProtectAI DeBERTa beats SoterAI** on shared rows (83.20% / 3.92% vs
  74.57% / 5.23%); SoterAI wins on latency. Contamination of ProtectAI's training
  set is unknown and must be stated alongside any such comparison.
- **Lakera is NOT MEASURED** and must stay that way in any ranking: it is closed
  and API-only, there is no key in `.env` and no downloadable weights. No Lakera
  number may be emitted.
- Roughly 62 of the 89 crossdist "misses" are label noise, so crossdist deltas
  under a few points are not signal.
- The private signing key (`.soterai/model-signing/operator-signing-key.pem`)
  must never be committed. The trust store holds public keys only.

---

## 10. Command reference

```bash
# smoke (CPU, 3 min)
python scripts/ml/train-soterllm-v14-fullft.py --sample --epochs 2 --encoder minilm \
    --batch-size 8 --max-steps 25 --amp off --num-workers 0 \
    --output-dir models/ml-classifier-v14-smoke

# bake-off candidate (GPU, ~8 min)
python scripts/ml/train-soterllm-v14-fullft.py --encoder distilbert --sample \
    --sample-size 24000 --epochs 3 --batch-size 32 --amp bf16 --num-workers 2 \
    --output-dir models/bakeoff-distilbert

# the real run (GPU)
python scripts/ml/train-soterllm-v14-fullft.py --encoder bert-base \
    --output-dir models/ml-classifier-v14 --epochs 4 --batch-size 32 --grad-accum 1 \
    --amp bf16 --encoder-lr 2e-5 --head-lr 1e-3 --layer-decay 0.9 --warmup-frac 0.06 \
    --fpr-ceiling 0.03 --num-workers 2 --augment --checkpoint

# resume after a Colab disconnect
... same command ... --resume

# close the parity gate locally
python scripts/ml/train-soterllm-v14-fullft.py --verify-only models/ml-classifier-v14

# v12-style control (frozen encoder) -- the ablation, not the point
python scripts/ml/train-soterllm-v14-fullft.py --freeze-encoder --encoder minilm ...
```

Flags worth knowing: `--layer-decay 1.0` disables layer-wise decay;
`--grad-checkpoint` trades ~30% step time for much lower VRAM;
`--amp off` for numerical debugging; `--max-steps N` caps steps per epoch;
`--num-workers 0` on Windows (spawn re-imports the module).
