# SoterAI Vendor-Neutral Competitor Evaluation Specification

**Date:** 2026-07-31
**Status:** PREPARED — requires external compute + witnessed execution before any comparative claim is made
**Purpose:** Ensure any cross-vendor technical claim passes rigorous public scientific scrutiny and satisfies the SoterAI rules of evidence: a claim of superiority is never made without a same-corpus, boundary-normalized, independently witnessed evaluation.

---

## 1. Scope and non-goals

**In scope:**
- Detection and enforcement quality against identical adversarial corpora
- Latency and resource cost under identical payload sizes, concurrency, and hardware conditions
- Enforcement surfaces: inline gateway, MCP proxy, browser/IDE extension, model-file scanning

**Out of scope (no claim is made on these):**
- Managed-service deployment breadth, SLOs, or customer evidence
- Network/endpoint interception architecture parity
- Any vendor capability not tested under identical conditions

---

## 2. Corpus specification

### 2.1 Corpus build rules
- Source: public, documented, non-production corpora only. No customer data, no scraped payloads.
- Size: minimum 500 attack samples per category (injection, jailbreak, prompt-exfil, credential leakage, PII) and 500 benign samples, balanced.
- Immutability: corpus is frozen before any model training or tuning. SHA-256 of the frozen corpus manifest is recorded and published in the evaluation report.
- Blinding: corpus authors and labelers do not know vendor identities; evaluators do not know which samples are attack vs. benign.

### 2.2 Language and content slices
- English (control)
- Hindi (Devanagari script)
- Hinglish (Hindi-English code-mixed)
- Transliterated Hindi (Latin script)
- Mixed script

### 2.3 Label taxonomy
All labels use the SOTERAI-ML-TAXONOMY-v1 standard. Attack labels carry severity and family metadata.

---

## 3. Normalization boundary

| Component | Rule | Verification |
|---|---|---|
| Input normalization | Single canonical NFKC + invisible-strip + confusable mapping pipeline | Same code path run by all vendors |
| Encoding | No base64/hex/leet decoding is performed before the corpus is hashed and frozen | Corpus inspection log |
| Tokenization | Tokenizer parity is verified against the frozen corpus hash | `scripts/ml/verify-tokenizer-parity.ts` |
| Prompt boundary | Each vendor receives exactly the same byte sequence per sample | Hash audit log |

---

## 4. Enforcement mode equivalence

Each vendor is run in the same enforcement mode:

| Surface | SoterAI mode | Competitor equivalent | Recording |
|---|---|---|---|
| LLM prompt injection | Hosted gateway `BLOCK`/`REDACT`/`ALLOW` | Equivalent blocking decision | Decision log + latency |
| MCP tool call | Pre-execution non-execution proof | Equivalent capability (prompt/tool interception) | Non-execution gate |
| Content output | Pre-release redaction + block | Equivalent DLP/blocking surface | Evidence log |
| Model-file scan | Static structured scan, no deserialization | Equivalent static inspection only | Tool output |
| Streaming | Mid-stream cancel on violation | Equivalent streaming enforcement | Trace |

---

## 5. Latency and resource protocol

### 5.1 Hardware controls
- Same physical machine class (minimum 4 core / 8 thread, 16 GB RAM, equivalent CPU).
- CPU pinning not required; background load is recorded and reported.
- Same Node version across all runs (recorded in report).

### 5.2 Measurement
- Minimum 300 iterations per scenario per vendor.
- Warm-up: 20 iterations before timed samples.
- Percentiles: p50, p95, p99 for both wall-clock (client-perceived) and enforcement overhead.
- Payloads: identical byte counts across vendors for each scenario.
- Cold and warm cache states are separate scenarios and reported separately.

### 5.3 Latency boundary
The comparison boundary is the enforcement decision, not downstream model latency. Both paths (direct vs. gateway/proxy/enforcement) are measured in the same way for all vendors.

---

## 6. Independent witness protocol

1. Corpus is frozen and corpus hash published before any evaluation begins.
2. Evaluator is external to both vendors. Evaluator does not have source access to any vendor's detection rules during scoring.
3. Every evaluation run produces an attested result JSON signed by both the evaluator and the corpus frozen hash.
4. Any vendor objection to a label decision is recorded and stored with the evaluation report.
5. No vendor may tune parameters after seeing evaluation samples.

---

## 7. Statistical analysis

| Metric | Method |
|---|---|
| Precision, recall, F1 | Standard formulas; reported per label and per language slice with 95% Wilson confidence intervals |
| FPR / FNR | Threshold sweep; operating point chosen at fixed budget |
| Latency | Bootstrap 95% CI on p50/p95/p99; minimum 300 samples per scenario |
| Calibration error | ECE on probability outputs; reliability diagram |
| Significance | McNemar test for paired detection differences; Bonferroni correction for multiple comparisons |

No aggregate score is reported until all slices meet minimum sample size (≥ 100 per slice).

---

## 8. Artifacts required for release

- [ ] Frozen corpus SHA-256 manifest
- [ ] Blinded corpus bundle with no vendor-identifying metadata
- [ ] Independent evaluator signed attestation
- [ ] Per-scenario result JSON (latency, throughput, CPU, memory, decisions)
- [ ] Full statistical report with confidence intervals
- [ ] Statement of any objections and their resolution

---

## 9. Publication gate

A comparative claim (stronger / parity / weaker) may only be published in `docs/SOTERAI-FINAL-TECHNICAL-COMPETITOR-COMPARISON.md` or marketing material after:

1. The frozen corpus hash appears verbatim in the report.
2. An independent evaluator attestation references the corpus hash.
3. The statistical report is complete with confidence intervals.
4. No open objections exist that materially change the conclusion.
5. Any result that cannot be reproduced on demand by another independent evaluator using the documented protocol is stated as an open caveat.

---

*Prepared for external execution. No local classification or training is run on this machine.*
