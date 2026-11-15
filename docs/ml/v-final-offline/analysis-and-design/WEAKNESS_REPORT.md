# v-final weakness report — evidence-bounded offline preparation

**Status: Phase 3 experiments incomplete; no newly trained v-final.** This report reuses the saved Phase 1 diagnostic, not a new inference run. Phase 1 recovery acceptance and Phase 2 changed-source review remain separate gates. All expected improvements below are hypotheses, not measured gains.

## What was actually checked

The six-model CSV was checked against the saved report's confusion counts, recall/FPR and complete artifact sizes. Source byte hashes and consolidated slice results are in `artifacts/ml/v-final/offline-preparation/research-resume-1/historical-diagnostic-consolidated.json`. Arithmetic is in `calculated-comparisons.json`. Original reports were not edited.

### Common historical diagnostic (not a release benchmark)

| Model | Precision % | Recall % | F1 % | FPR % | FN / FP | Warm dynamic p50 / p95 / p99 ms | Total MiB |
|---|---:|---:|---:|---:|---:|---|---:|
| v14 | 92.67 | 74.37 | 82.52 | 38.89 | 61 / 14 | 18.38 / 36.53 / 58.35 | 87.52 |
| v15 | 92.19 | 74.37 | 82.33 | 41.67 | 61 / 15 | 16.98 / 36.97 / 58.17 | 87.52 |
| v16 | 90.76 | 70.17 | 79.15 | 47.22 | 71 / 17 | 17.39 / 38.19 / 60.49 | 87.52 |
| v17-minilm | 91.94 | 71.85 | 80.66 | 41.67 | 67 / 15 | 17.41 / 39.37 / 60.69 | 87.52 |
| v17-multilingual | 91.18 | 78.15 | 84.16 | 50.00 | 52 / 18 | 50.76 / 91.38 / 123.04 | 516.15 |
| v18-recovered | 91.19 | 73.95 | 81.67 | 47.22 | 62 / 17 | 8.62 / 14.56 / 19.27 | 198.33 |
| v-final | NOT RUN | NOT RUN | NOT RUN | NOT RUN | NOT RUN | NOT RUN | NOT BUILT |

The common cohort has 274 rows: 238 positive-risk rows (including PII/secrets, not injection alone) and only 36 benign rows. The shared input gate, raw texts and max length 256 are fixed across these arms; each uses its own tokenizer, which is part of the model identity. Scores used batch 16/two CPU threads; timings are 80 separate batch-one observations per padding mode, not throughput divided by batch size. Model/feed/softmax timing excludes tokenization, tenant policy, network and persistence. The machine was Windows 11/Intel Family 6 Model 142 with ORT CPU; these are not T4 or production timings. p99 is exploratory at this sample count. Earlier contended-host measurements are a separate cohort and must not be merged.

v18's complete model includes `model.onnx.data`; its small protobuf header is not its size. Its recovery parity is historical, not certification of the latest recovery source. No live model weights were read or changed for this report.

## Ranked top ten weaknesses

Severity is an engineering judgement. The evidence column is observed; root-cause explanations marked HYPOTHESIS need an ablation.

| Rank | Weakness / severity | Evidence | Root cause / test | Fix strategy | Expected gain / latency cost |
|---|---|---|---|---|---|
| 1 | Missing independent release evidence — critical | This is a development diagnostic; only 36 benign rows. Required long-context, full-policy and GPU paths are absent. | Evaluation coverage gap, not a model score. | Freeze new family-disjoint release set before training or tuning; report undefined metrics as missing. | Enables defensible claims, not a predicted accuracy gain; evaluation cost only. |
| 2 | Teacher-exposed student test — critical | `fresh_fit_overlap_audit.json`: 8,152 of 10,238 v18 internal-test rows occur in teacher training (79.62%). | Student train/test disjointness does not exclude teacher exposure. | Exclude all teacher train/calibration/selection families when constructing release holdout. | No assumed gain; prevents optimistic evaluation. |
| 3 | Whitelisted PII remains effective risk — high | Archived real client postprocessing with mocked HTTP: `tools/v-final/tests/pii-ignore-boundary.test.mts`; `PHASE1_REPORT.md:198–213`. | Text restoration and risk/action reconciliation differ. Not a live API reproduction. | Trusted tenant policy filters exact authorized PII findings before final action; preserve injection/secrets and other PII. | Intended reduction in policy false positives; unmeasured small postprocessing cost. **Production fix not completed.** |
| 4 | Repeated PII may remain unredacted — high | Same report: synchronous guard leaves a second fixture email; evidence deduplication is by value. | Localization/redaction must preserve every occurrence even if evidence is deduplicated. | Redact by complete occurrence spans; regression with repeated allowed and disallowed values. | Privacy correctness; runtime cost must be measured. **Production fix not completed.** |
| 5 | Shared gate discards detections — high | v14 FN: raw argmax 27 → shared gate 61; v17 multilingual 5 → 52. All from the same score cache. | Gate effect is observed; attribution among entropy, label eligibility and thresholds needs isolated ablations. | Report model-vs-gate confusion separately; calibrate and select thresholds only on validation. | HYPOTHESIS: recover some recall without extra encoder work; false positives can increase. |
| 6 | Heavy multilingual model not universally better — high | v17 multilingual recall 78.15%, FPR 50.00%; v14 74.37%, 38.89%. v17 MiniLM is a distinct arm and does not share the heavy model's footprint. | More capacity/token vocabulary and different training are confounded. | Distill a validated teacher into the fast student, include hard negatives; compare at matched FPR. | HYPOTHESIS: better quality/latency trade-off; no promised percentage. |
| 7 | Hindi gains do not imply Hinglish gains — high | Language table below: v17 improves Hindi FN but worsens Hinglish FN versus v14; v18 is worse on Hinglish. | HYPOTHESIS: Romanized/code-mixed coverage gap; tokenizer unknown rate alone cannot explain intent errors. | Separate Hindi/Hinglish slices, native-speaker review, vetted code-mixed augmentation. | HYPOTHESIS: targeted recall improvement; training-only data cost. |
| 8 | Long-context coverage uncertified — high | Every row in this short diagnostic is untruncated; therefore it cannot test a deeply hidden attack. Historical serving default can be 128 despite training at 256. | Prefix-only evaluation and serving configuration differ. | Report processed/unprocessed ranges; test 4k/8k/16k/32k context with bounded windows and explicit review/reject for uncovered content. | More coverage costs more latency; do not call silent truncation an optimization. |
| 9 | Artifact/policy/consumer mismatch — high | Historical default size limit is 536,870,912 bytes; full v17 is 541,224,554. n8n, IDE, streaming and MCP do not all invoke identical augmenters. | Direct Python ONNX success is not signed production acceptance. | Bind whole bundle and label/tokenizer identities; exercise each actual consumer and its effective final action. | Integration correctness; network/policy cost unmeasured. Do not bypass limits. |
| 10 | Root-cause and calibration evidence incomplete — medium/high | No new embedding clustering, manual ambiguity rate, layer FLOPs, RSS/VRAM peak or serving-path GPU profile was produced. | Dataset error, calibration and execution costs remain confounded. | Profile and annotate before adding pruning/retrieval/cascades; record disagreements with adjudicated truth. | Unquantified until measured; avoid complexity based on anecdotes. |

## Language examples: observed errors, not performance promises

| Language | Positive / benign support | v14 FN / FP | v17 multilingual FN / FP | v18 FN / FP |
|---|---:|---:|---:|---:|
| en | 92 / 23 | 30 / 6 | 23 / 12 | 21 / 9 |
| hi | 10 / 1 | 4 / 1 | 1 / 0 | 0 / 0 |
| hinglish | 12 / 3 | 3 / 1 | 4 / 1 | 6 / 2 |
| ar | 13 / 1 | 5 / 1 | 3 / 1 | 7 / 1 |
| zh | 15 / 3 | 3 / 1 | 1 / 1 | 1 / 2 |
| fr | 15 / 2 | 1 / 1 | 4 / 0 | 5 / 1 |
| de | 17 / 1 | 0 / 1 | 3 / 1 | 5 / 1 |
| es | 15 / 1 | 2 / 1 | 4 / 1 | 6 / 0 |

These counts come from `recheck-six/report.json`, `arms.<model>.slices.language`. One benign Hindi/Arabic/German example cannot establish a language-level FPR. Zero observed false positives does not mean zero underlying risk. Unknown language is not relabeled English. Source labels may be noisy; an adjudicated label-noise percentage is **NOT RUN**.

## Why the heavy arm is heavy — established versus unmeasured

The stored inventory reports 23,096,975 trainable parameters for v14/MiniLM versus 135,364,367 for v17 multilingual; complete ONNX bytes differ by 5.90×. On the same saved diagnostic, dynamic p95 differs by 2.50×. These are footprint and timing observations, not causal layer attribution. v15/v16 retain v14's recorded width/size; claims that their weights themselves became larger are unsupported. The saved recovered student is faster in this diagnostic yet has larger complete bytes than MiniLM: parameter count alone does not predict latency.

Required profile: tokenize → embedding → each transformer block → head → calibration → policy → serialization, plus cold load, RSS/VRAM peak and host contention. Run at batch 1 and declared realistic batch/concurrency, fixed and dynamic length, CPU and T4. Report operator FLOPs with the actual shape and profiler convention; no FLOP number is guessed here. A production p95 cannot be computed by summing independent component p95 values.

## Error clustering and label audit to execute after gates

1. Preserve case ID, family, source/license, truth, model scores and policy-conditioned action; keep raw PII out of shared logs.
2. Cluster false negatives and positives separately using an approved embedding model; also assign manual attack/policy taxonomy. Record model revision, normalization, distance, cluster settings and outliers.
3. Sample each large cluster plus rare families for independent adjudication; report agreement and a reviewed denominator rather than a fabricated noise rate.
4. Compare raw classifier, calibrated score, label gate, regex and final policy outcome on identical rows. Do not mix new and historical identities.
5. Mine only development/training failures. Never add release-test examples or teacher-exposed relatives to training.

**Not executed here:** embedding clustering, manual adjudication, fresh six-arm full harness, causal architecture/precision ablations, production profiling. The existing zero exact/current-normalized overlap for the separate 4,000-row battery is not semantic decontamination; the broader prospective-pool overlap is not proof that the existing models trained on that battery.

## Decision

Keep v14 deployment unchanged. Candidate A in `CANDIDATE_DESIGNS.md` is a first experiment, not a selected winner. Fix and verify serving policy independently; train only after trustworthy evaluation/data gates. There is no evidence that v-final is the strongest model at the required latency because v-final has not been trained or evaluated.
