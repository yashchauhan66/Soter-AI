# SoterAI ML Model Transformation Report

Status: baseline discovery and reproducibility scaffolding initialized  
Date: 2026-07-26  
Branch: main  
HEAD at start: 59714827c32c43317ac1f2ae0e72579880e3aed6  
Evidence level: local code inspection, local benchmark rerun, dataset metadata audit, current-source market scan. No new full training was run locally.

## 1. Operating Constraints

Meaningful training, fine-tuning, architecture search, hyperparameter search, and large-scale embedding generation must run in Google Colab with GPU or TPU acceleration. This local pass used only repository inspection, code editing, dataset metadata auditing, and benchmark/evaluation runs. No model artifact was overwritten, no dataset was deleted, no production configuration was changed, and no deployment/push was performed.

The working tree was already heavily modified before this pass. Existing modified/untracked files were treated as user-owned and preserved.

## 2. Current ML System Inventory

The shipped production guard path is a hybrid deterministic system:

| Surface | Primary files | Current behavior |
| --- | --- | --- |
| Production text guard | `lib/guard/analyze.ts` | Runs rule/signature detectors for input/output risks, then optionally applies deterministic semantic feature hashing as a recall booster. |
| Guard-core package | `packages/guard-core/src/DecisionEngine.ts`, `packages/guard-core/src/detectors/*` | Rule-based local scan engine with detector versions, evidence minimization, redaction, caching, and policy scoring. |
| Semantic recall booster | `lib/guard/semanticClassifier.ts`, `lib/guard/semanticSeeds.ts` | Dependency-free feature hashing over words/bigrams/char n-grams, centroid comparison, HUMAN_REVIEW routing when semantic-only. |
| ML workflow registry | `lib/ml/*` | Registry, rollout, thresholds, evaluation, and fallback abstractions. Default backend is heuristic, not a neural artifact. |
| External ML option | `lib/ml/training.ts` | `ExternalApiBackend` can call a configured ML API. Raw text should already be redacted before persistence/external evaluation. |
| Model artifacts | `models/ml-classifier-v3`, `models/ml-classifier-v4`, `tmp/soterllm-honest-verify`, `tmp/soterai-ml-classifier-v3-new-20260720132624` | Local PyTorch artifacts exist. Complete ONNX/tokenizer/metrics bundles were observed under `tmp/*`, but no production ONNX backend file is present in `lib/ml`. |

Current label schema observed in training artifacts and registry:

`SAFE`, `PROMPT_INJECTION`, `JAILBREAK`, `SYSTEM_PROMPT_LEAK_ATTEMPT`, `PII`, `SECRET`, `UNSAFE_OUTPUT`, `RAG_POISONING`, `DATA_EXFILTRATION_ATTEMPT`.

## 3. Dataset Inventory

Primary ML JSONL files under `datasets/` are parseable and large enough for controlled experiments. The largest observed version is `datasets/ml-augmented-v6.jsonl` with 79,580 records.

Key local audit findings:

| Dataset | Records | Exact duplicate rows | Main labels | Language/provenance finding |
| --- | ---: | ---: | --- | --- |
| `datasets/ml-augmented-v6.jsonl` | 79,580 | 7,994 | SAFE 22,816; three labels 9,578 each; others 5,026-6,191 | 69,984 `en`; 7,980 missing language; 1,583 hinglish; sparse other languages. |
| `datasets/ml-augmented-v5.jsonl` | 78,527 | 7,994 | Similar to v6 with fewer SAFE rows | 7,980 missing language. |
| `datasets/ml-augmented-v4.jsonl` | 75,359 | 7,994 | Prior training source in artifacts | 7,980 missing language. |
| `datasets/ml-v4-probe-subsample.jsonl` | 14,400 | 110 | Balanced 1,600 per label | Mostly English; 693 missing language. |
| `datasets/external/harmbench.jsonl` | 400 | 12 | ATTACK 400, mapped for future evaluation only | English; source missing. |
| `datasets/external/jailbreakbench.jsonl` | 200 | 0 | ATTACK 100, SAFE 100 | English; source missing. |
| `datasets/security-dataset/soter_security_dataset_v1.jsonl` | 300 | 0 after schema normalization | 21 security families | Separate schema uses `attack_prompt`, `family`, `expected_guard_action`; not directly in ML label format. |
| `datasets/security-dataset/soter_mutations_v2.jsonl` | 1,324 | 0 after schema normalization | Mutation variants | Separate schema uses `attack_prompt`, `mutation_type`, expected categories. |

Dataset risks:

| Weakness | Evidence | Severity | Customer Impact | Required Fix | Verification |
| --- | --- | ---: | --- | --- | --- |
| Exact duplicates in augmented corpus | v4-v6 each show 7,994 duplicate rows | High | Inflated validation/test metrics if duplicates cross splits | Deduplicate before split and keep provenance manifest | Dataset audit plus split manifest with zero shared hashes |
| Likely template/synthetic dominance | Top sources include `prefix-suffix:*`, `leet:*`, `benign-variation:*`; many source fields missing | High | Model may learn generator templates instead of real attacks | Source-aware split; independent holdout with non-template external/customer-like data | Per-source metrics and final holdout exclusion from tuning |
| Sparse multilingual coverage | v6 has only tiny es/fr/de/pt/hi/ja counts beyond English/Hinglish | Medium/High | Weak non-English generalization claims | Add real multilingual data or narrow claims to tested languages | Per-language macro F1 and confidence intervals |
| Security dataset schema mismatch | `security-dataset/*` does not use `text`/`label` fields | Medium | Useful records can be silently skipped by naive loaders | Normalize schema in reusable loader | Loader unit/smoke audit shows nonzero usable records |
| No proven independent holdout | Existing artifacts report validation split, not a locked untouched holdout | High | Production readiness claims are not fully supported | Create dev, locked test, final holdout with group/source separation | Immutable split manifests and report sign-off |

## 4. Baseline Metrics

Local command: `npm run benchmark:honest`

| Metric | Result |
| --- | ---: |
| Corpus | 1,218 cases: 108 attacks, 1,110 benign |
| ROC-AUC | 0.9974 |
| Recall at 1% FPR | 100.00%, achieved FPR 0.81% |
| Recall at 0.1% FPR | 56.48%, achieved FPR 0.09% |
| Production mitigation recall | 100.00% |
| Production precision | 92.31% |
| Production F1 | 0.9600 |
| Production FPR/FNR | 0.81% / 0.00% |
| Hard block or review rate | 63.89% |
| Latency | latest rerun: p50 3.81 ms, p95 6.51 ms, p99 11.70 ms, max 439.35 ms |
| Multi-turn benchmark | 10 sessions; 100% recall; 0% FPR; mean catch turn 3.00 |

Local command: `npm run eval:classifiers`

| View | Result |
| --- | --- |
| Phase 5 rule classifier | Precision 1.0, recall 1.0, F1 1.0, calibration error 0.1407; one label mismatch: `jb-hi-7` expected JAILBREAK but predicted PROMPT_INJECTION. |
| Phase 6 heuristic backend | Accuracy 0.8542, calibration error 0.3085; weak labels: RAG_POISONING 0/3, SECRET 2/3, JAILBREAK 8/10, SYSTEM_PROMPT_LEAK_ATTEMPT 6/7. |
| Guard red-team benchmark | 70/70 passed; no misses. |

Previously generated artifact evidence, not rerun locally:

| Artifact | Dataset/config | Reported result | Evidence limitation |
| --- | --- | --- | --- |
| `tmp/soterai-ml-classifier-v3-new-20260720132624` | `/content/soterai/datasets/ml-augmented-v4.jsonl`, 5 epochs, batch 64, seed 42 | Accuracy 0.9929, macro F1 0.9927, weighted F1 0.9930 | Training was artifact-observed, not rerun in this pass. Validation split only. |
| `tmp/soterllm-honest-verify` | `/content/soterai/datasets/ml-augmented-v4.jsonl`, 5 epochs, batch 64, seed 42 | Accuracy 0.9920, macro F1 0.9915, weighted F1 0.9921 | Same limitation; no independent final holdout evidence. |

## 5. Architecture and Data Flow

```text
request text
  -> surface/direction selection
  -> rule detectors in lib/guard/analyze.ts
     -> prompt injection, jailbreak, system prompt leakage, PII, secrets,
        toxicity, multilingual, recursive injection, SSRF, social engineering,
        embedding poisoning, insecure deserialization, data exfiltration, etc.
  -> semanticClassifier only if no rule security finding exists
  -> scoreRisk and decideGuardAction
  -> redactText / rewriteRiskyText when applicable
  -> advisory metadata
  -> caller receives action, riskScore, riskTypes, findings, safeText/redactedText
  -> optional ML registry/rollout path can record or call heuristic/external backend
```

Important integration finding: the fine-tuned MiniLM/ONNX artifacts are not the default runtime model in `lib/guard/analyze.ts`. The default `lib/ml` backend wraps the heuristic guard behavior unless `ML_BACKEND=external-api` and `ML_API_URL` are configured.

## 6. Success Function

Proposed model/system selection score:

`Model Score = 0.35 Quality + 0.20 Critical Recall + 0.15 Calibration + 0.15 Robustness + 0.10 Efficiency + 0.05 Operational Reliability`

Rationale:

| Component | Weight | Why |
| --- | ---: | --- |
| Quality | 0.35 | Macro/weighted F1 and per-label precision determine everyday correctness. |
| Critical recall | 0.20 | Missed prompt injection, secrets, PII, RAG poisoning, and exfiltration can create high-severity incidents. |
| Calibration | 0.15 | Thresholds and abstention are unreliable without meaningful confidence. |
| Robustness | 0.15 | Attackers transform wording, language, encoding, and context. |
| Efficiency | 0.10 | SoterAI is an inline guard; p95 latency and memory matter. |
| Operational reliability | 0.05 | Versioning, fallback, rollback, and monitoring prevent model regressions from becoming outages. |

## 7. Market and Research Comparison

Current sources checked on 2026-07-26:

| Target | Source | Intended task | Direct comparison status |
| --- | --- | --- | --- |
| OpenAI `omni-moderation-latest` | https://developers.openai.com/api/docs/models/omni-moderation-latest | Harmful content moderation for text/images; calibrated category scores | Not directly comparable until SoterAI is evaluated on the same moderation taxonomy. |
| Azure AI Content Safety | https://learn.microsoft.com/en-us/azure/ai-services/content-safety/overview | Harm category moderation with severity levels and multilingual support | Not directly comparable; useful commercial baseline for harm moderation, not prompt-injection-specific. |
| Meta Llama Prompt Guard 2 | https://developer.meta.com/ai/docs/model-cards-and-prompt-formats/prompt-guard/ | Prompt injection and jailbreak detection | Comparable if run locally/API in SoterAI harness on the same prompt-injection/jailbreak sets. |
| Protect AI DeBERTa prompt-injection v2 | https://huggingface.co/protectai/deberta-v3-base-prompt-injection-v2 | Binary prompt-injection classifier | Comparable for English prompt-injection subset; not full SoterAI taxonomy. |
| Check Point / Lakera Guardrails | https://docs.lakera.ai/docs/prompt-defense | Real-time prompt-attack and jailbreak defense | Directionally comparable; local PINT-style artifact exists for Lakera Guard, but SoterAI must be run in same harness. |
| AWS Bedrock Guardrails | https://docs.aws.amazon.com/bedrock/latest/userguide/guardrails.html | Harm filters, prompt attack detection, PII filters, denied topics, grounding checks | Comparable only per guardrail category and same dataset. |
| Google Model Armor | https://docs.cloud.google.com/model-armor/overview | Prompt injection, jailbreak, harmful-content and sensitive-data filters | Comparable only through same-harness API evaluation. |
| NVIDIA NeMo Guardrails | https://docs.nvidia.com/nemo/guardrails/home | Programmable guardrails around LLM apps | Architectural comparison, not a single classifier benchmark. |
| JailbreakBench | https://jailbreakbench.github.io/ and https://arxiv.org/abs/2404.01318 | Open robustness benchmark for jailbreak attacks/defenses | Use as external benchmark; current local data has a vendored subset only. |
| HarmBench | https://arxiv.org/abs/2402.04249 | Standardized red-teaming/evaluation framework | Use as external benchmark; current local data has a 400-record JSONL. |

Local PINT-style competitor artifacts were parsed into `docs/SOTERAI-ML-COMPETITOR-GAP-MATRIX.md`.

| Local competitor artifact | Balanced score | Prompt-injection recall | Jailbreak recall | Document attack recall | Hard-negative accuracy |
| --- | ---: | ---: | ---: | ---: | ---: |
| Lakera Guard | 95.22% | 89.69% | 100.00% | 84.00% | 98.33% |
| Bedrock Guardrails | 89.24% | 70.85% | 97.30% | 68.00% | 99.44% |
| Azure Content Safety | 89.12% | 64.57% | 94.59% | 78.00% | 98.44% |
| Protect AI | 79.14% | 86.55% | 86.49% | 56.00% | 90.11% |
| Llama Prompt Guard 2 | 78.76% | 57.40% | 91.89% | 62.00% | 98.67% |
| Google Model Armor | 70.07% | 33.63% | 67.57% | 22.00% | 98.22% |

Gap table:

| Dimension | SoterAI Baseline | Competitor/Model Best | Gap | Target |
| --- | ---: | ---: | --- | --- |
| Macro F1 | 0.9927 artifact validation; production F1 0.9600 on local guard benchmark | Not directly comparable | Need same harness | >= current on locked holdout with confidence interval |
| Minority-class recall | Heuristic backend now 1.00 on Phase 5 after mapping fixes | Not directly comparable | Still needs locked holdout | >= 0.90 on locked per-label holdout |
| Calibration | Heuristic calibration error now 0.2094 on Phase 5 | Not directly comparable | Confidence still undercalibrated | ECE <= 0.08 on validation/test |
| Multilingual performance | Sparse measured coverage | Lakera/Azure claim multilingual support directionally | Insufficient evidence | Per-language eval for English, Hindi, Hinglish, and selected high-volume languages |
| Robustness | Good local template benchmark; duplicate/template risk | Public benchmarks evolving | Need independent external evaluation | Run JailbreakBench/HarmBench/PINT-like harness |
| p95 latency | 6.51 ms analyzer-only on latest rerun | Not directly comparable | Need neural runtime benchmark | p95 target defined by product tier |
| Production integration | Strong rule fallback; neural artifact not wired by default | Varies | ONNX/runtime parity missing | Versioned artifact loading, checksum, health check, fallback |

## 8. Implemented in This Pass

New reusable assets:

| File | Purpose |
| --- | --- |
| `scripts/ml/soterai_dataset_audit.py` | Normalizes both repository dataset schemas, counts labels/languages/sources, exact duplicates, and near-duplicate groups. |
| `scripts/ml/soterai_training_pipeline.py` | Colab-first transformer training pipeline with fail-fast accelerator checks, deterministic seeds, group-aware splits, checkpointing, early stopping, metrics, and durable Drive output. |
| `scripts/ml/soterai_competitor_gap_matrix.py` | Parses local PINT-style competitor artifacts and generates a maintained market gap matrix without inventing SoterAI same-harness results. |
| `scripts/ml/soterai-pint-eval.ts` | PINT-format evaluator for SoterAI `analyzeText`; reads PINT YAML/JSON/JSONL and reports balanced category/label score plus misses. |
| `notebooks/SOTERAI_ML_TRAINING_COLAB.ipynb` | Requested Colab notebook that mounts Drive, installs pinned dependencies, verifies accelerator, audits data, and launches the reusable training module. |
| `lib/ml/training.ts` | Improved heuristic backend label selection: priority-based label selection, RAG-poisoning contextual relabeling, and SECRET-over-PII handling. |
| `lib/classifiers/multilingual.ts` | Added a high-confidence Hinglish jailbreak signal for obedience-over-rules attacks. |
| `tests/classifiers/heuristic-ml-backend.test.ts` | Regression coverage for RAG poisoning, secret-vs-PII priority, and Hinglish jailbreak label selection. |

The training module intentionally fails before full training if no GPU/TPU is available unless `--smoke-only` is passed.

## 9. Verification Log for This Pass

| Command | Result | Evidence |
| --- | --- | --- |
| `npm run benchmark:honest` | PASS | Refreshed production guard benchmark: 1,218 cases, ROC-AUC 0.9974, mitigation recall 100.00%, precision 92.31%, latest p95 6.51 ms. |
| `npm run eval:classifiers` | PASS | Phase 5 rule metrics and Phase 6 heuristic backend metrics captured; heuristic backend weaknesses recorded. |
| `python -m py_compile scripts/ml/soterai_dataset_audit.py scripts/ml/soterai_training_pipeline.py` | PASS | Python syntax/import compilation passed. |
| `python scripts/ml/soterai_dataset_audit.py datasets/external --out tmp/soterai-ml-dataset-audit-smoke.json` | PASS | Audited 2 external JSONL datasets; wrote local smoke artifact under `tmp/`. |
| `node -e "JSON.parse(...SOTERAI_ML_TRAINING_COLAB.ipynb...)"` | PASS | Notebook JSON is valid. |
| `python scripts/ml/soterai_training_pipeline.py --dataset datasets/external/jailbreakbench.jsonl --smoke-only` | PASS | CPU-only environment reported; 200 usable records loaded; no training performed. |
| `python scripts/ml/soterai_training_pipeline.py --dataset datasets/external/jailbreakbench.jsonl` | Expected failure | Full training failed before training with: `No GPU or TPU accelerator is available. Stop: full SoterAI training must run on Colab GPU/TPU.` |
| `npx tsx --test tests/classifiers/heuristic-ml-backend.test.ts` | PASS | 3/3 focused ML-label regression tests passed. |
| `npm run eval:classifiers` after heuristic fixes | PASS | Phase 6 heuristic backend improved from 85.42% accuracy / 0.3085 calibration error to 100.00% accuracy / 0.2094 calibration error on Phase 5. |
| `python scripts/ml/soterai_competitor_gap_matrix.py` | PASS | Generated `docs/SOTERAI-ML-COMPETITOR-GAP-MATRIX.md` and `tmp/soterai-ml-competitor-gap-matrix.json`. |
| `npx tsx scripts/ml/soterai-pint-eval.ts --input tmp/pint-benchmark-20260720135111/benchmark/data/example-dataset.yaml --out tmp/soterai-pint-example-results.json` | PASS | PINT adapter smoke-tested on bundled 8-case example data; balanced score 1.0, no misses. This is not a full PINT benchmark score. |

## 10. Completion Gate Status

| Gate | Status | Evidence |
| --- | --- | --- |
| Data integrity | Partial | Metadata audit done; duplicates and schema mismatch identified; final holdout not yet created. |
| Model quality | Partial | Existing local and artifact metrics recorded; no same-harness competitor run yet. |
| Robustness | Partial | Internal and vendored external data exists; external benchmark protocol not locked. |
| Efficiency | Partial | Analyzer latency measured; neural artifact runtime latency not measured. |
| Reproducibility | Partial | Colab notebook/module created; clean Colab run not executed in this pass. |
| Production integration | Partial | Existing registry/fallback found; ONNX artifact not wired into runtime by default. |
| Competitive evidence | Partial | Sources identified, local competitor matrix generated, SoterAI PINT adapter implemented; full same-dataset PINT comparison still required. |
| Honest evidence | In progress | No unsupported production-ready claim made; limitations recorded. |

## 11. Exact Next Action

Run the SoterAI PINT evaluator on the full PINT benchmark dataset if/when the dataset is available, then run the new Colab notebook on a GPU/TPU runtime using `datasets/ml-augmented-v6.jsonl`, persist the `experiment_summary.json` to Google Drive, and import the resulting metrics into this report. Before promoting any model, create a locked independent holdout with source/group separation and run SoterAI, Llama Prompt Guard 2, and Protect AI DeBERTa through the same evaluation harness.
