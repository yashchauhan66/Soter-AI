# v14 / v17 comparison and v18 implementation plan

Written before implementation on 2026-09-18. Compute: local CPU evaluation; user has Colab for GPU training. Existing checkpoints and unrelated working-tree changes must be preserved.

## Objective and evidence standard

Build a candidate with stronger multilingual attack detection and practical CPU latency. No finite training set covers every possible attack. A market-leading claim requires an independently held-out, like-for-like competitor evaluation; neither validation F1 nor authored regressions establishes it.

The three existing candidates are v14 MiniLM (91.8 MB), v17 MiniLM (91.8 MB), and v17 multilingual DistilBERT (541.2 MB). Existing English production-gate results are close. Both v17 arms sharply reduce multilingual false alarms relative to v14. Multilingual v17 has the strongest same-split validation but its final ranking is unresolved: the old 13,000-row comparison applied different abstention budgets and a decision path different from production.

## Ordered execution

1. **Complete a fair comparison before selecting the training teacher.** Audit existing artifacts and rescore identical held-out rows with shared decision settings. Preserve provenance, label order, model hashes, denominators and language/category slices. Distinguish model-only decisions from the combined production guard. Report recall/FPR together; descriptive threshold sweeps on test data must not become deployment calibration. Record hardware and inference-only timing separately from end-to-end latency.
2. **Select the base and record weaknesses.** Compare v14 and both v17 arms at the same operating point, inspect misses/false alarms and token coverage. Multilingual v17 is the provisional teacher because it preserves multilingual vocabulary; v14 and v17 MiniLM remain fast baselines. Do not promote a deployment model solely for validation F1.
3. **Finish the proven latency implementation.** Wire the existing dynamic-padding option into actual runtime tensor shapes, including sliding windows; keep a fixed-padding escape hatch. Derive default sequence length from artifact metadata instead of a filename substring. Add targeted parity and coverage tests and measure actual deployed-runtime latency. Do not widen security gates based on the small multilingual battery alone.
4. **Implement a compact multilingual student training route for Colab.** Preserve teacher tokenizer coverage. Use a smaller multilingual student with supervised classification plus temperature-scaled teacher distillation; make architecture/initialization and parameter count explicit. Retain calibrated ONNX export and strict artifact provenance. Fix concrete trainer correctness defects (dropped accumulation tail, version metadata, silently ignored data). Do not claim unrun GPU training has produced improved weights.
5. **Add strict data preparation and coverage auditing.** Reject malformed/missing/unknown labels, prevent train/calibration/test leakage across source families/translations where metadata exists, audit the full training corpus against external holdouts, preserve language/source fields. Report attack/benign balance and actual coverage for priority languages: English, Hindi/Hinglish, Spanish, Portuguese, French, German, Arabic, Chinese, Japanese, Korean, Russian, Indonesian, Bengali, Tamil, Telugu, Turkish and Vietnamese. Coverage gaps remain explicit; repeated templates are not independent attacks. Existing evaluation examples must not be added to training to improve their scores.
6. **Execute local verification and prepare the Colab deliverable.** Run comparison and targeted tests, build a runnable training notebook/config/bundle, validate all referenced paths and smoke-test training logic locally where feasible. Keep the shipped production model unchanged until trained candidate passes release gates.

## Candidate release gates

- Separate training, calibration and untouched release evaluation. Hash checkpoints, tokenizer and data manifests.
- Compare at common settings and calibration-selected false-positive budgets; publish counts, uncertainty and per-language/source/family results. Include benign security discussions, legitimate tool use, quoted attacks and code.
- Measure direct/indirect injection, jailbreak, system prompt leakage, tool misuse, exfiltration, memory/RAG poisoning, encoding/Unicode evasion and multi-turn attacks using the relevant runtime context. Text classification alone does not verify tool authorization or stateful protection.
- A student must match the chosen teacher within a predeclared tolerance on held-out attacks without a material FPR regression, and improve CPU p50/p95 on representative input lengths. Numerical targets are acceptance criteria, not achieved results.
- INT8 remains an experimental candidate: existing naive quantization loses attack recall. Require per-language/per-category decision regression checks before adoption. Keep an FP32 fallback.
- Never publish, deploy, replace checkpoints or claim a superior trained v18 model until the actual Colab training and independent evaluation complete.

## Known constraints

Local Python has ML dependencies but no GPU has yet been verified. Colab access was stated by the user; this session has no authenticated Colab execution tool. Prepare and test everything possible locally, then identify the exact remaining GPU run if direct execution is unavailable. Existing reports and partial score files are inputs to audit, not assumed truth.
