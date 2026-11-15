# v-final candidate designs and provisional acceptance criteria

**Status: design-only. Candidate A is recommended for the first experiment, not selected as a release winner. No candidate has measured new quality or latency.** The gates below are proposed engineering acceptance criteria, not promises, user-approved production SLOs or newly measured performance. Freeze them before training/selection; changes require a new preregistration, not retroactive gate relaxation.

## Candidate architectures

| Candidate | Structure / parameter anchor | Expected benefit (HYPOTHESIS) | Principal risk | Latency position (target, NOT measured) |
|---|---|---|---|---|
| A — distilled fast student | MiniLM L6-family encoder, preserve native label map; historical Soter MiniLM reports 23,096,975 parameters. Full fine-tuning baseline versus teacher-logit distillation, verified hard negatives, validation-only temperature and optional INT8. Real final parameter count must be measured from the built model. | Transfer useful teacher signal and repair targeted data gaps without a second online encoder. | English-centric tokenizer may remain weak on Hindi/Hinglish; teacher labels/contamination; quantization changes scores. | Aim for no worse p95 than v14 on identical deployment context; service-local warm CPU p95 allocation 100ms. No extrapolation from A100 vendor results. |
| B — uncertainty cascade | Candidate A plus the separately resident multilingual teacher (historically 135,364,367 parameters), invoked only by a preregistered confidence/coverage rule. | Focus larger capacity on uncertain multilingual/context cases. | Fallback selection bias, attacker-controlled fallback load, queues; a confidently wrong student never escalates. | Must meet the same whole-service gates. Low average fallback rate does not establish p95/p99. Reject if the tail misses gates. |
| C — shared encoder plus multi-heads and retrieval | Candidate A-sized shared encoder with separate intent/span heads and a bounded known-attack index. Added head/index size is NOT MEASURED. Raw detection and tenant-policy outcome remain separate. | Span localization and recall support without a second full encoder. | Annotation burden, multi-task interference, poisoned/stale index, multilingual embedding gaps; new export/serving contract. | Same whole-service targets; index/head costs must fit measured budget, not be assumed free. |

No candidate replaces provenance-bound policy decisions with text-only classification. A raw PII occurrence can be correctly detected while its authorized use should be allowed. The training corpus must not assign contradictory raw-text labels merely because the user's private allow-list changes. Condition a policy target explicitly or apply trusted policy after localization.

## Decision matrix (qualitative engineering judgement)

| Criterion | A | B | C |
|---|---|---|---|
| Quality potential | First baseline; unknown until evaluation | May improve hard cases; routing bias | May improve span/recall tasks; interference risk |
| CPU latency/tail predictability | Simplest single forward | Weakest under fallback bursts | Index lookup makes tails less predictable |
| Resident memory | Lowest starting footprint | Student plus teacher | Student plus heads/index |
| T4 training cost | Lowest initial experiment | Teacher scoring/training extra | Multiple annotations/objectives extra |
| Maintainability | Closest to existing pipeline | Router + two versioned bundles | New heads + index lifecycle |
| Drop-in feasibility | Still requires real Node/API parity/trust tests | Not drop-in | Not drop-in |
| Decision | **First experiment** | Only if A fails quality and measured tail allows | Only if error analysis justifies spans/retrieval |

This ordering prioritizes low deployment complexity and the historical small encoder's footprint. It does not claim A is better on quality. Retain the Pareto frontier and report any slice regression; do not silently choose aggregate accuracy over security-critical recall.

## Latency budget — allocations, not measured component p95s

| Stage | Provisional allocation |
|---|---:|
| Tokenization | 10ms |
| Regex / local detectors | 5ms |
| Encoder and heads | 60ms |
| Calibration / trusted policy / final decision | 10ms |
| Serialization | 5ms |
| Queue/headroom | 10ms |
| **Service-local total allocation** | **100ms** |

External network gets a provisional separate 50ms allowance; client-observed warm p95 target is 150ms. Measure joint request latency directly: quantiles do not add. Long-context 4k–32k cases require separate length-stratified traces and an explicit bounded-window budget; the 100ms short-input target is not a promise for 32k input. If coverage cannot fit the budget, return an explicit review/reject outcome rather than certify silently unscanned text. CPU and T4 measurements, batch 1, declared realistic batch/concurrency, cold load, tokenizer time, queue time, RSS/VRAM and p50/p95/p99 are all mandatory reports. A CPU-only pass cannot establish a GPU result.

## Numeric release proposal

Machine-readable form: `artifacts/ml/v-final/offline-preparation/research-resume-1/provisional-design-gates.json`.

1. **All required slices and languages:** direct/indirect injection, obfuscation, multilingual/code-mixed (explicit Hindi and Hinglish plus English, Spanish, French, German, Arabic, Chinese), multi-turn/many-shot/long-context, agent/tool-use, PII/secrets/policy, benign hard negatives, reasoning-heavy and long-tail recall. Report precision/recall/F1/FPR/FNR/PR-AUC/ECE on the defined target. Attack-only cohorts have undefined FPR, not zero.
2. **Coverage floor:** at least 200 positive and 200 benign rows per required evaluable slice, with family/source support recorded. This is only a minimum, not a claim of adequate power. If confidence intervals are too wide, collect more independent data and report inconclusive; do not relax the test after seeing results.
3. **Recall:** point estimate at least both v14 and v17 multilingual on each required slice; paired family-bootstrap 95% lower confidence bound on the recall difference at least −0.01 for a non-inferiority claim. This is **not strict superiority**. Claim improvement only if the appropriately multiplicity-adjusted paired lower bound is above zero, with predeclared primary hypotheses.
4. **False positives and calibration:** point FPR no worse than v14; paired 95% upper bound of FPR difference at most +0.005; global representative-benign FPR at most 0.02; ECE at most 0.05. Disclose binning convention, support and target. The current 36-benign diagnostic cannot validate this.
5. **Latency:** service-local warm CPU batch-one p95 ≤100ms and p99 ≤200ms, and p95 no worse than v14 under the identical host, runtime, input distribution, batch/concurrency and policy route. Client end-to-end p95 target ≤150ms is separate and needs actual network measurements. Report cold and GPU performance even if no absolute GPU gate is yet approved.
6. **Reproducibility:** at least three distinct fixed seeds, mean ± sample standard deviation, individual per-seed failures, source/data/model/tokenizer/calibration/split/hardware fingerprints, and an ablation matrix. Never compare a best seed with baseline means without disclosure.
7. **Safety/correctness hard gates:** no unreviewed data license; no discovered cross-partition family/teacher leakage; all required policy and repeated-PII regressions pass in actual named serving consumers; complete bundle trust and numerical parity hold; missing/corrupt evidence means **NOT PASS**.

The relative quality gates apply at preregistered operating points: fix semantics and preprocessing across arms, retain native tokenizer identities, select thresholds on calibration only, and freeze them before holdout scoring. Do not force different model vocabularies into one tokenizer. Cluster bootstrap by family/source with paired predictions; test selection/seeds are not extra independent observations.

## Training / ablation plan

Train seed set 17, 29 and 43 as a proposed fixed set. Save configuration, last/best/periodic checkpoints, optimizer/scheduler/scaler/RNG states and data order for resumability. Start with a small throughput pilot on the actual T4; derive time estimates from observed steps/second and dataset counts. No credible hour estimate exists before that pilot.

Use identical partitions for: plain supervised baseline; +teacher distillation; +vetted hard negatives; +language/mutation data; +temperature calibration; INT8 versus FP32. Later isolate class-balanced/focal, rationale, contrastive, multi-head, retrieval, cascade and soup effects only if justified. Publish every row as NOT RUN until it executes. Calibration/threshold tuning must never consume test labels. Mining loop consumes training/development errors, not release errors; if the release holdout guides another iteration, retire it and use a fresh holdout.

## Decision and dependencies

Proceed with offline implementation and tests only while genuine model/resource gates block local execution. The original models, datasets, deployment and thresholds stay unchanged. Follow the execution notebook/runbook only after its own code review and environment checks. Real training, fresh full evaluation, production policy fixes and serving-path latency are remaining work, not completed by this document.
