# v-final research brief and adoption plan

**Offline decision brief; no Soter improvement measured.** Model cards/paper abstracts below were retrieved, while many publisher and runtime-documentation bodies were blocked by the retrieval service. Indexed-only references establish the paper/title lookup, **not** a verified experimental claim. No blocked page is represented as a paper we read. The source ledger and raw retrieval failures are preserved in `artifacts/ml/v-final/offline-preparation/research-resume-1/`.

## Current guard-model landscape

- **Llama Prompt Guard 2:** the card describes 22M and 86M variants, a binary explicit-attack objective, modified tokenizer, synthetic/red-team data and an energy-based benign penalty. Both have 512-token contexts; it specifically warns of a larger multilingual gap for the smaller model.[1] The same fetched 22M page labels the table column **backbone parameters**, while its repository metadata reports 70.83M total parameters; do not use “22M” as a verified total footprint. Its advertised 19.3ms versus 92.4ms latency is an **A100/512-token vendor benchmark**, not Soter CPU/T4 p95.[1]
- **Qwen3Guard:** the official card describes 0.6B/4B/8B variants and a token-level streaming head, with tokenizer-aligned incremental inputs.[10] This is a safety-moderation target, not demonstrated equivalence to Soter prompt-injection detection. Candidate teacher/reference only; remote model code requires separate inspection and authorization.
- **ShieldGemma:** its card describes English decoder-only models of 2B/9B/27B for four harm categories.[15] Harm moderation is not the same task as detecting instruction-boundary violations; do not import those scores into Soter's comparison.
- **ProtectAI DeBERTa-v3-base prompt-injection-v2:** its card explicitly states English-only scope, no jailbreak detection, possible system-prompt false positives and archived/unmaintained status.[18] It is a research comparator, not a drop-in multilingual policy model. The card's “No License (public domain)” phrase is not legal evidence that an unlicensed dataset is usable.
- **Soter comparison:** use `HISTORICAL_COMPARISON.md` for the measured local cohort. None of these external model-card benchmarks used that cohort/hardware/preprocessing. No cross-vendor ranking is justified; externally reported “SOTA” is not independently reproduced here.

## Evidence that can actually support adoption

Guo et al. report temperature scaling as an effective calibration method on their studied datasets; this supports testing a validation-only calibration stage, not assuming Soter calibration is solved.[52] Wortsman et al. report that weight averaging of compatible fine-tuned models can improve quality without ensemble inference cost; transfer to this security task is unmeasured.[81] Narasimhan et al. evaluate speculative cascades with generative T5/Gemma models; those gains cannot be copied to a one-pass encoder detector.[99] OpenVINO's retrieved official release notes describe a separate optimized runtime ecosystem; a listed capability is not a measured gain on this host or the production host.[106]

## Complete technique decision matrix

Every definition/cost/fit decision is an **engineering proposal/HYPOTHESIS**, not a performance promise. “Indexed only” or “body blocked” means a source-body evidence gap remains. “ADOPT” means put the safety/process contract into the experiment; it does **not** authorize deployment or assert implementation.

| Technique | What to test / evidence | Cost / latency fit (HYPOTHESIS) | Decision |
|---|---|---|---|
| Knowledge distillation | Match teacher probabilities/features with student training loss; keep teacher exposure out of holdout. TinyBERT (indexed only).[55] | Training teacher-score cost; student serving unchanged. | TEST FIRST |
| INT8 quantization | Compare dynamic INT8 with FP32 after calibration; quantization is not guaranteed faster. ORT documentation (body blocked).[39] | Kernel/provider and accuracy dependent. | TEST FIRST |
| INT4 quantization | Weight-only low-bit candidate; verify supported operators and accumulation. TensorRT quantization documentation (body blocked).[104] | Kernel/export risk; may not benefit this small encoder. | DEFER |
| Structured pruning | Remove heads/width/layers with retraining, not just zero weights. DynaBERT (indexed only).[124] | Training/search cost and export changes. | TEST LATER |
| Early exit | Exit at an intermediate classifier only with validated uncertainty policy. DeeBERT (indexed only).[121] | Branching complicates ONNX and worst-case latency. | DEFER |
| Two-stage cascade | Student gates genuinely uncertain cases to verified heavy model; bound fallback rate. Faster Cascades discusses deferral rules.[99] | Adds second inference and queue tail. | TEST AFTER A |
| Speculative routing | Evaluate overlap of student/verifier work only if fallback dominates latency. Faster Cascades concerns generative T5/Gemma experiments.[99] | Not a demonstrated speedup for a one-pass security classifier. | REJECT FOR FIRST RELEASE |
| ONNX Runtime | Export fixed contract, shape matrix and numerical parity; count external weights. Local historical export evidence; ORT docs body blocked.[39] | Existing serving integration; real Node path still required. | ADOPT CONTRACT; TEST EXPORT |
| TensorRT | GPU-only alternative with explicit supported precision and shape engine. NVIDIA documentation (body blocked).[104] | Additional serving artifact/toolchain. | DEFER CPU PRODUCT |
| OpenVINO | Intel deployment alternative, compare samehost whole requests. Retrieved official release notes.[106] | Different provider/toolchain; no measured Soter gain. | TEST IF INTEL TARGET |
| Sequence length reduction | Use actual-length batches; shorten only if required coverage retained. Prompt Guard specifies 512-token window; local padding comparison.[1] | Fewer processed tokens can lower cost but miss hidden attacks. | ADOPT DYNAMIC PADDING; TEST COVERAGE |
| Token-level versus sequence-level heads | Sequence head for injection intent, optional token head for PII spans; targets separate. Qwen3Guard Stream has token-level classification.[10] | Span annotations and head loss/serving contract. | SEQUENCE FIRST; TOKEN HEAD TEST |
| LoRA | Train low-rank adapters on a frozen backbone rather than full weights. Microsoft LoRA repository (indexed only).[109] | Training-state saving; merge/parity required. | TEST ONLY IF MEMORY-BOUND |
| QLoRA | Quantized base with low-rank fine-tuning; not a default serving recipe. QLoRA NeurIPS (indexed only).[57] | Extra low-bit training dependencies. | DEFER SMALL STUDENT |
| Full fine-tuning | Update the whole small encoder; use it as the simplest training baseline. Project historical MiniLM architecture. | Optimizer memory but simplest comparison. | BASELINE |
| Hard-negative mining | Mine benign near-misses and training-split failures; human-check new labels. Prompt Guard describes synthetic/red-team training data.[1] | Data review/training cost, not additional inference. | ADOPT |
| Curriculum learning | Compare mixed training with staged easy-to-hard batches. Curriculum Learning (indexed only).[127] | Extra experiment and order bias. | TEST, NOT DEFAULT |
| Adversarial training / red-team loop | Use bounded labelled detector examples; recheck labels after mutations. TextAttack (indexed only); Prompt Guard red-team data.[63][1] | Training/annotation cost; do not optimize against release holdout. | ADOPT BOUNDED DATA LOOP |
| Contrastive learning | Add training-time embedding separation, preserving semantically matched hard negatives. Supervised Contrastive Learning (indexed only).[118] | Batches/projection head/training cost. | TEST LATER |
| Class-balanced loss | Compare class weights/effective-number weighting with unweighted loss. Class-Balanced Loss (indexed only).[115] | No extra encoder inference; calibration may shift. | TEST |
| Focal loss | Downweight easy training examples; measure benign-tail harm and calibration. Focal Loss (indexed only).[112] | No extra encoder inference; additional hyperparameter. | TEST |
| Temperature scaling | Fit one temperature on calibration partition, once; never double-scale baked logits. Guo et al. retrieved abstract.[52] | Small postprocessing cost; thresholds still separate. | ADOPT VALIDATION-ONLY |
| Multi-task learning | Separate injection/jailbreak intent, PII spans and policy outcome targets. Qwen token heads; multi-task loss paper indexed only.[10][139] | Annotation/loss balancing; label interference risk. | TEST CANDIDATE C |
| Model merging / souping | Average compatible checkpoints only; same architecture/base/label/tokenizer and validation selection. Model soups retrieved paper abstract.[81] | Several training runs; single-model inference. | OPTIONAL AFTER THREE SEEDS |
| Verified synthetic data | Require provenance, adjudication and teacher-family exclusion; keep rejected samples logged. Prompt Guard describes synthetic injections.[1] | Teacher generation/verification budget. | ADOPT WITH REVIEW |
| Back-translation | Translate then return to source language; verify intent/labels and preserve family grouping. Monolingual-data NMT paper (indexed only; transfer unproven).[130] | Translation plus native-language review. | TEST HINDI/HINGLISH SEPARATELY |
| Mutation / obfuscation augmentation | Bound unicode/casing/spacing/encoding changes and ensure true meaning still matches label. Prompt Guard tokenizer-resistance description.[1] | Training/data cost; naive normalization can erase evidence. | ADOPT VERIFIED VARIANTS |
| Privacy-aware active learning | Sample uncertain consented traffic with minimization, retention limits and adjudication. Active Learning survey (indexed only; privacy design is proposal).[133] | Secure human review/storage; no raw secrets in logs. | SHADOW-ONLY FIRST |
| Rationale distillation | Use reviewed explanations as auxiliary training targets; infer labels without generating explanations. Distilling Step-by-Step (indexed only).[60] | Teacher annotation/training cost; security transfer unproven. | TEST AFTER LOGIT KD |
| Known-attack retrieval memory | Treat nearest patterns as supporting evidence, not an automatic safe/unsafe oracle. RAG paper identified; not evidence for Soter classifier gains.[137] | Index lookup, poisoning/staleness and tenant isolation. | TEST CANDIDATE C |
| Light-model ensemble | Combine calibrated probabilities on aligned labels from independent small models. Model soups distinguishes ensembles from weight averaging.[81] | Multiple forwards increase latency/memory. | DEFER; COMPARE SOUP |

## Prioritised adoption plan

**P0 — correctness before weights.** Finish recovery/inference acceptance; freeze target schema and independent families; resolve effective whitelist action and occurrence-complete redaction in the real consumer. Keep raw model detection and trusted policy action separately measurable. Do not lower trust/resource gates.

**P1 — smallest useful experiment.** Train the existing-size MiniLM student with a full-fine-tuning baseline, verified hard negatives, a separately evaluated distillation variant and validation-only temperature scaling. Compare FP32 against one supported INT8 path. Preserve all seeds and failures. Expected gains remain unverified.

**P2 — data and context.** Compare verified Hindi/Hinglish/multilingual, indirect/tool-use, rationale and obfuscation additions one at a time; evaluate bounded long-context windows as a different explicit serving configuration. Use teacher labels only where vetted. Do not call inferred attack intent a PII-presence label.

**P3 — only if Phase 3 proves a need.** Test cascade CIs and fallback tails; multi-head/retrieval; contrastive or focal/class-balanced loss; compatible model soup. Defer INT4/pruning/early exits and extra runtimes until profiling identifies an actual bottleneck. Speculative decoding is not the first optimization for this classifier.

## Research acceptance and gaps

- Named technique coverage is machine-checked in `technique-coverage.json`; coverage is not experimental validation.
- Citation identity/URL checks can pass even when publisher bodies were blocked. `--evidence` must remain failed for indexed-only sources rather than attaching fabricated quotes.
- No claimed Soter accuracy/speed improvement, external benchmark reproduction or complete current-state-of-the-art survey is certified.
- Revisit blocked primary papers/runtime documentation before selecting their optional methods; assess dataset licenses per source, teacher-training exposure and actual native export support.

## Sources

[1] https://huggingface.co/meta-llama/Llama-Prompt-Guard-2-22M — meta-llama/Llama-Prompt-Guard-2-22M
[10] https://huggingface.co/Qwen/Qwen3Guard-Stream-0.6B — Qwen/Qwen3Guard-Stream-0.6B - Hugging Face
[15] https://huggingface.co/google/shieldgemma-2b — google/shieldgemma-2b · Hugging Face
[18] https://huggingface.co/protectai/deberta-v3-base-prompt-injection-v2 — protectai/deberta-v3-base-prompt-injection-v2
[39] https://onnxruntime.ai/docs/performance/model-optimizations/quantization.html — Quantize ONNX models | onnxruntime
[52] https://proceedings.mlr.press/v70/guo17a.html — On Calibration of Modern Neural Networks
[55] https://aclanthology.org/2020.findings-emnlp.372 — TinyBERT: Distilling BERT for Natural Language Understanding
[57] https://proceedings.neurips.cc/paper_files/paper/2023/hash/1feb87871436031bdc0f2beaa62a049b-Abstract-Conference.html — QLoRA: Efficient Finetuning of Quantized LLMs - NeurIPS
[60] https://aclanthology.org/2023.findings-acl.507 — Distilling Step-by-Step! Outperforming Larger Language ...
[63] https://aclanthology.org/2020.emnlp-demos.16 — TextAttack: A Framework for Adversarial Attacks, Data Augmentation, and Adversarial Training in NLP
[81] https://proceedings.mlr.press/v162/wortsman22a.html — Model soups: averaging weights of multiple fine-tuned models ...
[99] https://research.google/pubs/faster-cascades-via-speculative-decoding — Faster Cascades via Speculative Decoding - Google Research
[104] https://docs.nvidia.com/deeplearning/tensorrt/latest/inference-library/quantized-types-explicit-quantization.html — Explicit Quantization — NVIDIA TensorRT
[106] https://docs.openvino.ai/2026/about-openvino/release-notes-openvino.html — OpenVINO Release Notes — OpenVINO™ documentation — Version (2026)
[109] https://github.com/microsoft/LoRA — GitHub - microsoft/LoRA: Code for loralib, an implementation of "LoRA: Low-Rank Adaptation of Large Language Models"
[112] https://openaccess.thecvf.com/content_iccv_2017/html/Lin_Focal_Loss_for_ICCV_2017_paper.html — Focal Loss for Dense Object - ICCV 2017 Open Access Repository
[115] https://openaccess.thecvf.com/content_CVPR_2019/papers/Cui_Class-Balanced_Loss_Based_on_Effective_Number_of_Samples_CVPR_2019_paper.pdf — Class-Balanced Loss Based on Effective Number of Samples
[118] https://proceedings.neurips.cc/paper_files/paper/2020/file/d89a66c7c80a29b1bdbab0f2a1a94af8-Paper.pdf — Supervised Contrastive Learning - NeurIPS
[121] https://aclanthology.org/2020.acl-main.204 — Dynamic Early Exiting for Accelerating BERT Inference
[124] https://proceedings.neurips.cc/paper/2020/hash/6f5216f8d89b086c18298e043bfe48ed-Abstract.html — DynaBERT: Dynamic BERT with Adaptive Width and Depth
[127] https://icml.cc/2009/papers/119.pdf — Curriculum Learning
[130] https://aclanthology.org/P16-1009 — Improving Neural Machine Translation Models with Monolingual Data
[133] https://research.cs.wisc.edu/techreports/viewreport.php?report=1648 — Active Learning Literature Survey
[137] https://proceedings.neurips.cc/paper/2020/hash/6b493230205f780e1bc26945df7481e5-Abstract.html — Retrieval-Augmented Generation for Knowledge ... - NeurIPS
[139] https://openaccess.thecvf.com/content_cvpr_2018/html/Kendall_Multi-Task_Learning_Using_CVPR_2018_paper.html — Multi-Task Learning Using Uncertainty to Weigh
