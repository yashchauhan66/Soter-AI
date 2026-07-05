# Detector Improvement Plan

## Common detector contract

Every detector should expose `id`, semantic version, normalized input version, supported directions/languages, finding category, calibrated confidence, severity, bounded non-sensitive evidence, offsets on normalized and original text, latency, and feature-flag state. Detector changes must produce a benchmark diff.

| Detector/area | Current evidence | Upgrade | Tests and release gate | Priority |
|---|---|---|---|---|
| Normalization | Unicode/obfuscation tests exist | One canonical pipeline for NFKC, bidi controls, zero-width, confusables, encoding layers with provenance | Metamorphic equivalence and benign multilingual preservation | P0/P1 |
| Prompt injection | Rules + semantic tier | Direct/indirect/source-aware classifier; instruction/data boundary features | Independent holdout; ≥ agreed recall at ≤1% FPR | P1 |
| Jailbreak | Rules; small subset recall 36.36% | Role-play, persona, refusal suppression, multilingual and adaptive paraphrase tier | JailbreakBench/HarmBench-style licensed corpus plus benign safety discussion | P0/P1 |
| Multi-turn/crescendo | State tracking; 60% recall on 5 attacks | Intent drift, cumulative evidence, decay and session graph | ≥100 attack/benign sequences; time-to-detect and FP rate | P0/P1 |
| System prompt leak | Rules and safe-log tests | Semantic extraction intent + output overlap fingerprint | Canaries, paraphrases, translation, legitimate documentation negatives | P1 |
| Secrets | Provider patterns | Versioned provider registry, entropy + context, checksum where available | Realistic synthetic positives and source-code/config negatives | P1 |
| General PII | Regex/context | Entity fusion, locale/context, per-type confidence | Redaction precision/recall and offset correctness | P1 |
| India PII | Aadhaar/PAN/GSTIN/UPI etc. | Checksum/format/context and Hindi/Hinglish phrasing | Synthetic valid/invalid sets; no real personal data | P1 |
| Unsafe output | Sink/code/phishing rules | Require output context: HTML, SQL, shell, Markdown, email, code | Sink-specific vulnerable/safe pairs | P1 |
| Exfiltration | Output + semantic egress | Combine source classification, destination trust, transform and intent | Paraphrase/summary/partial-join corpus | P1 |
| RAG poisoning | Document/RAG modules | Chunk provenance, trust weighting, instruction segmentation, rescan | Poisoned PDFs/HTML/images and clean technical docs | P1 |
| Tool/MCP injection | Tool/action modules | Description/schema/output scans + chain semantics + signed identity | Malicious tool server, rug pull, tool shadowing, cross-tool exfil | P1 |
| Hallucination/grounding | Heuristics | Claim extraction and source entailment with calibrated abstention | Citation precision and unsupported-claim rate | P2 |
| Toxicity/bias | Basic detectors | Use-case/language calibration and review policy | Disaggregated benchmark, reclaimed-language negatives | P2 |
| SSRF | Text detector | Treat generated URLs as tainted; enforce at network call | IPv4/IPv6, DNS rebinding, redirects, metadata endpoints | P0 |

## Evaluation protocol

1. Freeze training/tuning, validation and untouched holdout partitions by hash.
2. Track provenance and license for each case; never include customer content without authorization and minimization.
3. Report precision, recall, F1, ROC-AUC where appropriate, recall at 1% and 0.1% FPR, per-category recall, bypass rate, redaction accuracy, and latency percentiles.
4. Report sample counts and confidence intervals; suppress sweeping conclusions from tiny categories.
5. Run metamorphic attacks: translation, spacing, Unicode, encoding, paraphrase, fragmentation, multi-turn and content-channel relocation.
6. Require human review of false positives/negatives before promotion.
7. New hard blocks begin in monitor mode and require an explicit policy opt-in until gates pass.

## Immediate benchmark target

The current transparent result—84.26% recall at 0.54% FPR—is a baseline. The next milestone is not “100%.” It is a reproducible holdout with at least 500 diverse attack cases, at least 2,000 benign cases, no critical family below 90% recall, overall critical-family recall ≥95% at ≤1% FPR, and multi-turn recall ≥90% at ≤1% benign-session escalation. Targets may be revised with customer harm analysis and published methodology.
