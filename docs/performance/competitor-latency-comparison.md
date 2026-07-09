# Competitor Latency Comparison

> Last updated: 2026-07-06
> Author: SoterAI Engineering
> Status: Living document -- update when new public data becomes available

---

## 1. Methodology Statement

**What "fair comparison" means in this document:**

- We only report latency numbers that we have measured ourselves under controlled conditions, or that are published in official vendor documentation with a clear methodology.
- We do NOT extrapolate, estimate, or infer competitor latency from marketing claims, anecdotal reports, or uncontrolled tests.
- Where a competitor's latency cannot be measured fairly, we write: **UNKNOWN -- no fair public benchmark available**.
- Architectural differences (local vs cloud, regex vs ML, single-file vs repository-wide) are noted because they make direct latency comparisons misleading without context.
- "Faster" does not mean "better" -- a local regex scanner will always beat a cloud ML model on raw latency, but may detect fewer threat classes. We note this explicitly.

---

## 2. SoterAI Baseline Performance

| Metric | Value | Conditions |
|--------|-------|------------|
| In-process `analyzeText` p50 | 4.59 ms | Local, single input, guard-core regex engine |
| In-process `analyzeText` p95 | 7.05 ms | Local, single input, guard-core regex engine |
| In-process `analyzeText` p99 | 10.55 ms | Local, single input, guard-core regex engine |
| HTTP API end-to-end p50 | 891 ms | Includes auth, rate limit, DynamoDB persistence |
| HTTP API end-to-end p95 | 1656 ms | Includes auth, rate limit, DynamoDB persistence |
| VSIX bundle size | 84.5 KB | Packaged VS Code extension |
| Extension bundle size | 159 KB | Full extension with dependencies |
| Architecture | Local-first, zero-dependency, regex-based | No network call for core scanning |

---

## 3. Architecture Comparison

| Product | Execution Model | Network Required for Scan? | Detection Method | Real-time IDE Use? |
|---------|----------------|---------------------------|-----------------|-------------------|
| **SoterAI Guard** | Local process | No (core); Yes (API persistence) | Regex + heuristics | Yes (VS Code) |
| Lakera Guard | Cloud API | Yes | ML models | No (API only) |
| LLM Guard (Protect AI) | Local process | No | ML models (transformers) | No |
| HiddenLayer | Cloud/On-prem | Yes | Proprietary ML | No |
| Prompt Security | Cloud API | Yes | Proprietary ML | No |
| GitGuardian (ggshield) | Hybrid (CLI + cloud) | Yes (sends hashes) | Pattern + cloud verification | Yes (VS Code) |
| Snyk | Hybrid (CLI + cloud) | Yes | SAST/SCA engines | Yes (VS Code) |
| Semgrep | Local CLI | No | Pattern matching (AST-aware) | Yes (VS Code) |
| SonarQube | Local/Cloud | Depends on mode | Java-based analysis | Yes (SonarLint) |
| Socket.dev | Cloud | Yes | Package analysis | Yes (VS Code) |
| TruffleHog | Local CLI | No | Regex + entropy | No (CLI) |
| Gitleaks | Local CLI | No | Regex | No (CLI) |
| GitHub Advanced Security | Cloud (GitHub-native) | Yes | Proprietary | No (GitHub UI) |
| NeMo Guardrails (NVIDIA) | Local + LLM calls | Depends on LLM backend | LLM inference | No |
| Guardrails AI | Local + optional ML | Depends on validators | Mixed (regex + ML) | No |
| Rebuff | Hybrid | Yes (LLM + vector DB) | Multi-layer (heuristic + LLM) | No |
| Garak / PyRIT / Giskard | Local (testing tools) | Depends on target | N/A (red-team tools) | No |

---

## 4. Individual Competitor Assessments

### 4.1 Lakera Guard

| Field | Value |
|-------|-------|
| Product | Lakera Guard |
| Category | AI/LLM security API (prompt injection, PII, content moderation) |
| Public API/CLI/Extension? | Yes (cloud API at api.lakera.ai) |
| Benchmark Method Possible? | Partial -- requires API account |
| Architecture | Cloud |
| Latency Measured? | UNKNOWN -- no fair public benchmark available |
| Pricing/Free Tier | Free tier available (rate-limited) |
| Confidence | LOW |
| Source | https://platform.lakera.ai (docs) |
| Notes | Lakera does not publish latency SLAs or p50/p95/p99 numbers in public documentation. Any measurement would include variable network latency to their API servers, making a fair comparison to SoterAI's local engine impossible without controlling for geography and network conditions. |

---

### 4.2 LLM Guard (Protect AI)

| Field | Value |
|-------|-------|
| Product | LLM Guard |
| Category | Open-source LLM security scanners |
| Public API/CLI/Extension? | Yes (open-source Python, pip install) |
| Benchmark Method Possible? | Yes -- can install and benchmark locally |
| Architecture | Local (but uses ML transformer models) |
| Latency Measured? | UNKNOWN -- not benchmarked under controlled conditions |
| Pricing/Free Tier | Free (open-source, Apache 2.0) |
| Confidence | LOW |
| Source | https://github.com/protectai/llm-guard |
| Notes | LLM Guard uses transformer-based ML models for detection. Its latency profile is fundamentally different from regex-based scanning: first inference is slow (model loading), subsequent calls depend on input length and GPU availability. A direct ms-to-ms comparison would be misleading without noting that LLM Guard may detect semantic attacks that regex cannot. |

---

### 4.3 HiddenLayer

| Field | Value |
|-------|-------|
| Product | HiddenLayer |
| Category | Enterprise AI security platform |
| Public API/CLI/Extension? | No |
| Benchmark Method Possible? | No |
| Architecture | Cloud / On-premises |
| Latency Measured? | UNKNOWN -- no public API, CLI, or extension available for benchmarking |
| Pricing/Free Tier | Enterprise sales only |
| Confidence | NOT_APPLICABLE |
| Source | https://hiddenlayer.com |
| Notes | No public interface exists for independent latency measurement. Enterprise-only product with no trial or free tier accessible for benchmarking. |

---

### 4.4 Prompt Security (SentinelOne)

| Field | Value |
|-------|-------|
| Product | Prompt Security |
| Category | Enterprise prompt security |
| Public API/CLI/Extension? | No (enterprise cloud) |
| Benchmark Method Possible? | No |
| Architecture | Cloud |
| Latency Measured? | UNKNOWN -- enterprise cloud product with no public benchmark |
| Pricing/Free Tier | Enterprise sales only |
| Confidence | NOT_APPLICABLE |
| Source | https://www.prompt.security |
| Notes | No publicly available API or CLI for independent testing. Marketing materials do not include latency specifications. |

---

### 4.5 GitGuardian (ggshield)

| Field | Value |
|-------|-------|
| Product | GitGuardian / ggshield |
| Category | Secret detection CLI/API |
| Public API/CLI/Extension? | Yes (ggshield CLI, VS Code extension) |
| Benchmark Method Possible? | Partial |
| Architecture | Hybrid (local pattern matching + cloud verification) |
| Latency Measured? | UNKNOWN -- not benchmarked under controlled conditions |
| Pricing/Free Tier | Free tier (limited scans/month) |
| Confidence | LOW |
| Source | https://github.com/GitGuardian/ggshield |
| Notes | ggshield CLI latency includes a mandatory network round-trip to GitGuardian's cloud API for secret verification. This makes direct latency comparison to SoterAI's fully-local engine structurally unfair. Additionally, ggshield focuses exclusively on secret detection, while SoterAI covers prompt injection, PII, and broader AI security threats. Any comparison should note both the network overhead difference and the coverage domain difference. |

---

### 4.6 Snyk

| Field | Value |
|-------|-------|
| Product | Snyk |
| Category | Developer security (SAST, SCA, secrets, IaC) |
| Public API/CLI/Extension? | Yes (CLI, VS Code extension) |
| Benchmark Method Possible? | Partial |
| Architecture | Hybrid (local + cloud) |
| Latency Measured? | UNKNOWN -- not benchmarked under controlled conditions |
| Pricing/Free Tier | Free tier available |
| Confidence | LOW |
| Source | https://snyk.io |
| Notes | Snyk covers SAST, SCA, container, and IaC scanning -- a fundamentally different security domain from AI/prompt security. Its VS Code extension activation time and scan latency are measurable in principle, but the comparison would be apples-to-oranges: Snyk analyzes dependency trees and code patterns for known CVEs, while SoterAI scans text for prompt injection and AI-specific threats. |

---

### 4.7 Semgrep

| Field | Value |
|-------|-------|
| Product | Semgrep |
| Category | SAST (static analysis, pattern matching) |
| Public API/CLI/Extension? | Yes (open-source CLI, VS Code extension) |
| Benchmark Method Possible? | Yes -- fully local, well-documented |
| Architecture | Local |
| Latency Measured? | UNKNOWN -- not benchmarked under controlled conditions for this document |
| Pricing/Free Tier | Free (open-source CLI); paid cloud platform |
| Confidence | LOW |
| Source | https://github.com/semgrep/semgrep |
| Notes | Semgrep is the closest architectural analog to SoterAI's guard-core: both use local pattern-matching engines. However, Semgrep operates on ASTs (abstract syntax trees) for code, while SoterAI operates on raw text for AI security patterns. Semgrep's published benchmarks show sub-second scans for single files with small rulesets, but scanning entire repositories with large rulesets can take minutes. A fair comparison would need to control for: number of rules, input size, and what constitutes a "scan unit." |

---

### 4.8 SonarQube / SonarCloud

| Field | Value |
|-------|-------|
| Product | SonarQube / SonarCloud |
| Category | Code quality + security |
| Public API/CLI/Extension? | Yes (SonarScanner CLI, SonarLint extension) |
| Benchmark Method Possible? | Partial |
| Architecture | Local analysis + cloud reporting (or self-hosted server) |
| Latency Measured? | UNKNOWN -- different product category, no direct comparison attempted |
| Pricing/Free Tier | Community Edition (free), paid tiers available |
| Confidence | NOT_APPLICABLE |
| Source | https://www.sonarsource.com |
| Notes | SonarQube is a Java-based code quality platform. Its analysis time depends on project size, language, and rule count. It is not an AI security tool and does not detect prompt injection, making latency comparison not meaningful for SoterAI's use case. |

---

### 4.9 Socket.dev

| Field | Value |
|-------|-------|
| Product | Socket.dev |
| Category | Supply chain security |
| Public API/CLI/Extension? | Yes (VS Code extension, GitHub app) |
| Benchmark Method Possible? | Partial |
| Architecture | Cloud |
| Latency Measured? | UNKNOWN -- different focus area, no benchmark attempted |
| Pricing/Free Tier | Free tier available |
| Confidence | NOT_APPLICABLE |
| Source | https://socket.dev |
| Notes | Socket.dev analyzes npm/PyPI packages for supply chain attacks. It operates at the package level, not the text/prompt level. The security domains do not overlap with SoterAI's AI security focus. |

---

### 4.10 TruffleHog

| Field | Value |
|-------|-------|
| Product | TruffleHog |
| Category | Secret scanning |
| Public API/CLI/Extension? | Yes (open-source CLI, Go binary) |
| Benchmark Method Possible? | Yes -- fully local, open-source |
| Architecture | Local |
| Latency Measured? | UNKNOWN -- not benchmarked under controlled conditions for this document |
| Pricing/Free Tier | Free (open-source); enterprise version available |
| Confidence | LOW |
| Source | https://github.com/trufflesecurity/trufflehog |
| Notes | TruffleHog is a dedicated secret scanner using regex + entropy analysis. It is architecturally comparable (local, pattern-based) but covers a different threat domain (secrets vs prompt injection). Its Go implementation is likely fast for single-file scans, but its primary use case is scanning git history (many commits), which is a different workload than real-time keystroke analysis. |

---

### 4.11 Gitleaks

| Field | Value |
|-------|-------|
| Product | Gitleaks |
| Category | Secret scanning |
| Public API/CLI/Extension? | Yes (open-source CLI, Go binary) |
| Benchmark Method Possible? | Yes -- fully local, open-source |
| Architecture | Local |
| Latency Measured? | UNKNOWN -- not benchmarked under controlled conditions for this document |
| Pricing/Free Tier | Free (open-source, MIT) |
| Confidence | LOW |
| Source | https://github.com/gitleaks/gitleaks |
| Notes | Same architectural category as TruffleHog. Go-based regex scanner for secrets. Could be benchmarked on single-file latency, but the threat domain (leaked credentials) differs from SoterAI's focus (AI security, prompt injection, PII in AI contexts). |

---

### 4.12 GitHub Advanced Security

| Field | Value |
|-------|-------|
| Product | GitHub Advanced Security (GHAS) |
| Category | Code scanning, secret scanning, Dependabot |
| Public API/CLI/Extension? | No (GitHub-native integration) |
| Benchmark Method Possible? | No |
| Architecture | Cloud (GitHub infrastructure) |
| Latency Measured? | UNKNOWN -- GitHub-native integration, no standalone latency benchmark possible |
| Pricing/Free Tier | Free for public repos; paid for private repos |
| Confidence | NOT_APPLICABLE |
| Source | https://github.com/features/security |
| Notes | GHAS runs as part of GitHub's CI/CD infrastructure. Its "latency" is measured in minutes (time to complete a code scanning workflow), not milliseconds. It is not a real-time scanner and cannot be compared to SoterAI's keystroke-level analysis. |

---

### 4.13 NeMo Guardrails (NVIDIA)

| Field | Value |
|-------|-------|
| Product | NeMo Guardrails |
| Category | LLM guardrails framework |
| Public API/CLI/Extension? | Yes (open-source Python) |
| Benchmark Method Possible? | Partial -- but latency dominated by LLM inference |
| Architecture | Local framework + LLM inference calls |
| Latency Measured? | UNKNOWN -- architecture uses LLM inference, not comparable to regex scanning |
| Pricing/Free Tier | Free (open-source, Apache 2.0) |
| Confidence | NOT_APPLICABLE |
| Source | https://github.com/NVIDIA/NeMo-Guardrails |
| Notes | NeMo Guardrails uses LLM calls (e.g., to GPT-4 or local models) to evaluate whether inputs/outputs violate defined rails. Its latency is dominated by LLM inference time (typically 200ms-2000ms+ per call depending on model and provider). Comparing this to SoterAI's regex engine would be technically accurate but misleading: NeMo can understand semantic intent, while regex cannot. Different tools for different threat models. |

---

### 4.14 Guardrails AI

| Field | Value |
|-------|-------|
| Product | Guardrails AI |
| Category | LLM output validation |
| Public API/CLI/Extension? | Yes (open-source Python) |
| Benchmark Method Possible? | Partial -- depends on which validators are used |
| Architecture | Local framework + optional ML validators |
| Latency Measured? | UNKNOWN -- mixed architecture, not benchmarked |
| Pricing/Free Tier | Free (open-source) |
| Confidence | LOW |
| Source | https://github.com/guardrails-ai/guardrails |
| Notes | Guardrails AI is a validation framework with pluggable validators. Some validators are regex-based (fast), others use ML models (slow). Overall latency depends entirely on which validators are configured. Not directly comparable without specifying an identical detection task. |

---

### 4.15 Rebuff

| Field | Value |
|-------|-------|
| Product | Rebuff |
| Category | Prompt injection detection |
| Public API/CLI/Extension? | Yes (open-source Python) |
| Benchmark Method Possible? | Partial -- requires LLM API keys |
| Architecture | Hybrid (heuristics + LLM + vector DB) |
| Latency Measured? | UNKNOWN -- multi-layer approach with LLM calls, fundamentally different latency profile |
| Pricing/Free Tier | Free (open-source); requires OpenAI API key |
| Confidence | LOW |
| Source | https://github.com/protectai/rebuff |
| Notes | Rebuff uses a multi-layer detection approach: (1) heuristic checks, (2) LLM-based classification, (3) vector similarity search against known attacks. Layers 2 and 3 add significant latency (hundreds of ms to seconds). The heuristic layer alone might be comparable to SoterAI, but Rebuff's value proposition is the combined multi-layer approach. |

---

### 4.16 Garak / PyRIT / Giskard

| Field | Value |
|-------|-------|
| Product | Garak, PyRIT, Giskard |
| Category | Red-teaming / evaluation frameworks |
| Public API/CLI/Extension? | Yes (open-source Python) |
| Benchmark Method Possible? | Not applicable |
| Architecture | Testing tools (not runtime guards) |
| Latency Measured? | NOT APPLICABLE -- these are evaluation tools, not runtime scanners |
| Pricing/Free Tier | Free (open-source) |
| Confidence | NOT_APPLICABLE |
| Source | Various GitHub repositories |
| Notes | These are offensive testing and evaluation frameworks used to probe LLM applications for vulnerabilities. They are not runtime guards and do not operate in the request path. Latency comparison is not meaningful -- they are complementary tools, not competitors in the runtime security space. |

---

## 5. Structural Advantages of SoterAI's Architecture

SoterAI's local-first, regex-based architecture provides genuine advantages in specific dimensions:

1. **Zero network latency for core scanning**: The guard-core engine runs entirely in-process. No HTTP call, no DNS resolution, no TLS handshake. This is a structural guarantee, not a benchmark result.

2. **Deterministic performance**: Regex-based scanning has predictable, bounded execution time. There is no model loading, no GPU contention, no batch queue. p99 remains within 2.3x of p50.

3. **Minimal bundle size**: At 84.5 KB (VSIX) / 159 KB (extension), SoterAI imposes negligible overhead on IDE startup and memory. ML-based alternatives typically require 50MB-500MB+ of model weights.

4. **No external dependencies for scanning**: Works offline, in air-gapped environments, and without API keys for the core detection engine.

5. **Privacy by default**: Text never leaves the local machine for scanning purposes. Cloud-based competitors must transmit potentially sensitive content to remote servers.

---

## 6. Structural Limitations of SoterAI's Architecture

Intellectual honesty requires acknowledging where the local-regex approach has inherent limitations:

1. **No semantic understanding**: Regex cannot detect novel prompt injection attacks that use semantic manipulation without matching known patterns. ML-based competitors (Lakera, NeMo, Rebuff) can potentially catch attacks that no regex rule covers.

2. **Pattern maintenance burden**: New attack patterns require new regex rules. ML models can generalize from training data to novel attacks (with varying reliability).

3. **False positive/negative tradeoff**: Regex patterns are brittle -- tightening them increases false negatives, loosening them increases false positives. ML classifiers can navigate this tradeoff with more nuance.

4. **Limited context window**: SoterAI analyzes individual text inputs. It does not (currently) consider multi-turn conversation context, which some attacks exploit.

5. **No behavioral analysis**: SoterAI does not monitor LLM outputs or model behavior -- it only inspects inputs. Some competitors (HiddenLayer, Guardrails AI) also validate outputs.

---

## 7. Honest Verdict

### What the data actually shows:

- SoterAI's in-process scanning is fast: sub-11ms at p99 for local text analysis.
- SoterAI's HTTP API latency (891ms p50) is dominated by infrastructure overhead (auth, rate limiting, database writes), not by the scanning engine itself.
- We cannot make valid latency claims against any competitor because we have not conducted controlled benchmarks against them.
- Architectural differences make most comparisons misleading even if we had the numbers.

### The only defensible performance claims:

1. "SoterAI's local scanning engine operates at single-digit millisecond latency (p50=4.59ms, p95=7.05ms, p99=10.55ms) with zero network dependency."
2. "SoterAI's VS Code extension adds less than 160 KB to the IDE installation."
3. "SoterAI's scanning is deterministic and does not require GPU resources, ML model downloads, or API keys."

### Claims that require qualification:

- "Faster than Lakera/HiddenLayer/etc." -- CANNOT claim without controlled benchmarks. The comparison is also apples-to-oranges (local regex vs cloud ML).
- "Most performant AI security tool" -- CANNOT claim. We have not benchmarked alternatives.

---

## 8. What SoterAI Should NOT Claim

The following claims would be misleading or unsubstantiated:

| Claim | Why It Is Problematic |
|-------|----------------------|
| "Fastest AI security scanner on the market" | We have not benchmarked competitors. Even if true on latency, it ignores detection quality. |
| "10x faster than Lakera Guard" | No controlled benchmark exists. Network vs local is not a fair comparison. |
| "Sub-millisecond detection" | Our measured p50 is 4.59ms, not sub-millisecond. |
| "Enterprise-grade performance" | Undefined term. Our p95 API latency of 1656ms may not meet enterprise SLA expectations. |
| "Zero false positives" | No scanner achieves this. We have not published false positive rate data. |
| "Better than ML-based detection" | Faster, yes (structurally). Better detection quality -- unproven and likely untrue for novel attacks. |
| "Replaces Lakera/HiddenLayer/etc." | Different architecture, potentially different detection coverage. Cannot claim equivalence without detection-quality benchmarks. |

---

## 9. Future Work

To make this document more useful, the following controlled benchmarks should be conducted:

1. **Semgrep single-rule latency**: Benchmark a single Semgrep rule against a single SoterAI pattern on identical input text. This is the most architecturally fair comparison available.

2. **TruffleHog/Gitleaks single-file scan**: Measure time to scan a single file for secrets. Note: different threat domain, but validates our performance claims against similar architectures.

3. **LLM Guard local inference**: Measure LLM Guard's latency on the same prompt injection inputs SoterAI detects. Note: requires GPU for fair ML comparison.

4. **Lakera Guard API (if/when benchmarked)**: If Lakera publishes latency SLAs or we conduct controlled API benchmarks with proper methodology (multiple regions, statistical significance, disclosed conditions), update this document.

5. **Detection quality comparison**: Latency is only half the story. A detection-quality benchmark (precision, recall, F1 on a standard prompt injection dataset) would provide the full picture.

---

## 10. Document Governance

- This document must be updated whenever new controlled benchmarks are conducted.
- No latency number may be added for a competitor without: (a) documented methodology, (b) statistical significance (minimum 1000 runs), (c) disclosed test conditions (hardware, network, input size).
- Marketing materials derived from this document must include the "Structural Limitations" caveats.
- Any claim of "faster than X" requires a link to the specific benchmark run with reproducible methodology.

---

*This document prioritizes intellectual honesty over marketing advantage. Accurate performance claims build long-term credibility; inflated claims create liability.*
