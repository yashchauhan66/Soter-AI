# v19 — Phase 0/1 findings and data plan

Status: Phase 0 (baseline freeze) partly done, Phase 1 (forensics) done from cached evidence.
Date: 2026-10-17. Commit: `24da9ce9` (branch `soterai-lite`).
Every number below is `[MEASURED]` in this session unless tagged otherwise. Reproduce commands are given.

---

## 1. Baselines as they actually behave

| Measurement | Result | Command |
|---|---|---|
| README audit (rules only, `analyzeText`) | 1104/1122 = 98.40%, blind 16/26 = 61.54%, FPR 0/322 | `npx tsx scripts/readme-recall-audit.ts` |
| Same corpora with v14 (real path) | 1117/1122, **blind 25/26**, FPR 0/322 | `npx tsx scripts/ml/readme-corpora-ablation.ts --model-dir models/ml-classifier-v14` |
| Attack text overlap with v14's 8 training files | **0** at exact / normalized / Jaccard≥0.5 | `python -I scripts/ml/audit-readme-corpora-contamination.py --corpora .tmp/readme-corpora.jsonl --manifest models/ml-classifier-v14/dataset_manifest.json` |
| Rules-only latency (3,200 rows) | p50 2.03 / p95 3.44 / p99 5.37 ms | `npx tsx scripts/ml/bench-pipeline-latency.ts --rules-only --corpus public` |
| Rules + v14 latency (1,200 rows) | p50 103.7 / p95 160.1 / p99 239.0 ms | `npx tsx scripts/ml/bench-pipeline-latency.ts --model-dir models/ml-classifier-v14 --corpus public --limit 1200` |

The README's recall/FPR/latency numbers are all rules-tier numbers: `scripts/readme-recall-audit.ts`
and `phase-9-run-public-benchmark.js:61` only call `analyzeText`, which never invokes `augmentWithMl`.

### 1.1 `dynamicPadding` is documented but never implemented

`lib/ml/onnxBackend.ts:91-110` documents the option as "Default on … measured p50 152.91 → 26.80 ms".
No commit on any branch (`origin/main`, `security-hardening`, `release/n8n-0.8.7`, HEAD) consumes it —
`git log --all -G "this\.options\.dynamicPadding"` is empty. Production pads **every** request to 256
tokens (`probe-ml-latency-anatomy.ts`: seq_len 256 on 400/400 rows). `tests/ml/onnx-runtime-contract.test.ts`
is 1/8 passing at HEAD because it tests this missing code. Every ML p95 in
`artifacts/ml/acceptance-report-2026-09-2x.json` came from a Python harness that assumed the option
worked, so those p95s understate production.

Latency anatomy (v14, 400 rows, batch 1): session.run p50 110.6 ms, tokenize 0.16 ms, semantic gate
1.55 ms. Thread counts are not the lever (intra 2 ≈ default, intra 1 slower, intra 4 no gain).

## 2. The dev battery is mostly training data

`artifacts/ml/v18-balanced-comparison-rows.jsonl` (4,000 rows) vs the corpora a new model would train on
(`scripts/ml/audit-battery-vs-training.py`):

- **3,277/4,000 rows exact in training (81.9%)**, 3,287 normalized.
- By source: quickium 1020/1020 = 100%, deepset 106/106, multiling 182/182, jbclass 119/119, dolly 747/747,
  spml 438/438, all moss-cap levels 100%, gandalf 31/32, inthewild 204/212.
- **None of it is in v14's own 8 training files.** The hits come from `external-real-v4.jsonl` (3,057 rows),
  `external-train-v1/v2/v3.jsonl`.

Consequences:
1. v14/v17's battery metrics (.8975/.1635, .8815/.1360) are largely in-distribution; they are a
   regression baseline, not a generalisation measure.
2. **v19 must dedupe its training data against any battery it is evaluated on**, or its numbers are fake.
3. Only **713 battery rows are clean** (v15-test-battery 274, v17-multilingual-battery 312, v16-probe 70,
   inthewild partial) — too few for a dev set. v19 needs a new dev set too.

## 3. Weakness register (from cached per-row scores; no model loaded)

Source: `scripts/ml/forensics-v14-vs-v17.py` → `artifacts/ml/forensics-v14-v17-2026-10-17.json`.
Decision layer is the shared contract in `scripts/ml/compare-v18-bases.py` (imported, not copied).
Verdicts reproduce the September report exactly: v14 .8975/.1635, v17-minilm .8485/.1425,
v17-multilingual .8815/.1360 at `shared_input_gate`.

| ID | Weakness | Evidence | Severity | Root cause | Proposed fix | Verification |
|---|---|---|---|---|---|---|
| W1 | Dev/eval set is 82% training data | 3277/4000 exact matches; quickium 100% | Critical | Corpora assembled from the same sources as eval | New dev set + dedupe gate against battery in the v19 pipeline | split script refuses a corpus that overlaps the battery |
| W2 | Short inputs are the worst slice | ≤64 tokens: v14 recall .838 / FPR .067; 65–128: .823 / .415 | Critical | Model trained on longer templates; short paraphrases out of distribution | Length-stratified training mix; paraphrase-only short attacks; hard negatives near the boundary | per-length recall/FPR on dev, ≥ v14 in every bucket |
| W3 | Long benign text is flagged heavily | >254 tokens: FPR .530 (v14), .520 (v17-ml) | Critical | Truncation + long prose distribution not in training | Long benign documents in training; head+tail scoring | long-benign FPR ≤ v14 |
| W4 | The `v17-multilingual-battery` family is unsolved | 312 rows: v14 recall .603, **v17-ml .295**, FPR .468/.135 | Critical | Battery authored to probe multilingual blind spots; appears in neither training set | Include the family (cleaned) in training; re-test on a *held-out* member of the family | recall ≥ .80 on held-out members |
| W5 | Both models miss 105 attacks outright | both-miss: PI 31, JB 17, SPL 15, TOOL 14, MTE 9; 36 English, 29 non-English-ish | High | Attacks phrased outside template space: multi-turn consent, review/summary injection, role-play in Bengali, exfil webhook in Spanish | Author new source families from the both-miss patterns, in-language; never train on the dev rows themselves | both-miss count on a fresh set |
| W6 | No model beats the union | 63 attacks caught by neither rules nor model; rules alone catch 888 | High | Rules and model share vocabulary cues; model adds mostly at margins | Cascade-aware training: drop rows the rules already catch from loss (or down-weight); focus capacity on rule-released rows | recall on rule-released rows only |
| W7 | Multilingual FPR is unmeasurable | 1762/2000 benign rows are English; other 38 languages ~4.4 rows each | Critical (for any language claim) | Battery composition | New benign composition: ≥ 300 rows in each of hi, Hinglish, bn, ar, es, de, fr, pt, ru, zh, ja, ko | per-language FPR with usable CIs |
| W8 | v17-multilingual cannot ship | model.onnx 516.2 MB vs 512 MiB gate | High | Full 119k vocab embedding | Student with a pruned vocabulary, or int8 | artifact loads under `SOTERAI_MODEL_MAX_BYTES` |
| W9 | Latency baseline is not what the docs say | real-path p95 160 ms vs documented 26.80/17.83 ms | High | dynamicPadding never implemented; README latency is rules-only | Decide baseline (deployed v14) and optionally land the padding fix as its own PR | `bench-pipeline-latency.ts` on the final artifact |
| W10 | The ML tier can only add FPs; ML-alone FPR 17.5% | prior measurement (see memory: AC6) | Critical | Escalate-only architecture: rules FPs are never released | Product decision outside the model; model-side: precision at the operating point | FPR on new benign set |

## 4. Data plan

Four disjoint pools, enforced mechanically by `scripts/ml/build-v19-splits.py`:

| Pool | Content | Rule |
|---|---|---|
| TRAIN | local corpora + new authored rows, deduped, template-group split | never contains dev or sealed rows |
| DEV | new 4,000-row battery (author now; not v14's dev set) | used for iteration, allowed to be seen |
| SEALED | ≥1,200 attacks + ≥4,000 benign, author-independently, plus public benchmarks | scored once per finalist; hashed |
| REGRESSION | README corpora + v14's dev battery | reporting only; contamination stated |

Split rules: dedupe exact/normalized; **group by template family** (not random rows), so paraphrases of
one template land in one split; group key = normalized first 6 words + label; refuse to emit a split that
shares a template family with the sealed set.

## 5. Open questions for the user (blocking for Phase 4 only)

1. **Generator for new data.** `env` has only this session's own Anthropic credentials. From Colab, the user
   supplies an API key (Colab Secrets). Which provider? (Anthropic / OpenAI / Gemini / local model on the GPU.)
2. **GPU tier** — T4 / L4 / A100 / Pro+ — sets notebook batch sizes.
3. **Production CPU** for the latency budget.
