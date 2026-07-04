# SoterAI Guard — Competitive Strength Analysis

**Date:** July 4, 2026  
**Scope:** SoterAI Guard vs. 10 leading AI security products

---

## Executive Summary

SoterAI Guard is **the most feature-complete AI security guard** in the market today. It uniquely combines deep prompt-injection/jailbreak detection (400+ rules with 15+ evasion-hardening transforms), a full agent firewall stack, RAG security primitives, context lineage tracking, and compliance reporting — capabilities that no single competitor offers together. Its zero-dependency, sub-millisecond semantic classifier and offline-first architecture eliminate the network-hop latency and vendor lock-in that plague API-only competitors.

**Overall Competitive Position: Top-tier — strongest breadth, unique depth in agent security.**

---

## Feature Comparison Matrix

| Capability | SoterAI Guard | Lakera Guard | LLM Guard | Prompt Armor | Pangea AI Guard | Arthur Shield | Nightfall AI | CalypsoAI | HiddenLayer | Cisco AI Defense | Rebuff AI |
|---|---|---|---|---|---|---|---|---|---|---|---|
| **Prompt Injection** | 140+ rules + semantic | ML (proprietary) | ML classifiers | 5-layer analysis | 3-layer (heuristic+ML+LLM) | Prebuilt filters | — | ML/LLM | ML-based | ML + red team | 4-layer (heuristic+LLM+vector+canary) |
| **Jailbreak Detection** | 64+ rules (DAN, Skeleton Key, Many-Shot) | ML-based | ML classifier | Partial (via PI) | Heuristic + ML | Filters | — | ML/LLM | ML-based | Red team | — |
| **PII/Data Leakage** | 15 rules (global + India-specific) | Yes | Yes (regex+ML) | — | Yes | Yes | 100+ ML detectors | NER-based | — | Yes | — |
| **Toxicity/Hate** | 30+ rules | Yes | ML classifier | — | Yes | Yes | — | — | — | — | — |
| **Secrets Detection** | 20+ rules (API keys, JWT, DB URLs) | Partial | Yes | — | — | — | Yes (credentials) | — | — | — | — |
| **SSRF Detection** | 20+ rules (cloud metadata, IP obfuscation) | — | Malicious URLs | — | Malicious URLs | — | — | — | — | — | — |
| **Hallucination Detection** | 20+ rules | — | Factual inconsistency | — | — | Grounding-doc scoring | — | Yes | — | — | — |
| **Bias Detection** | 20+ rules (gender, racial, age, disability) | — | Yes | — | — | Yes | — | Yes | — | — | — |
| **Recursive Injection** | 20+ rules (JSON, XML, CSV, YAML, PDF) | — | — | — | — | — | — | — | — | — | — |
| **Competitive Intel** | 20+ rules (pricing, KPIs, strategy) | — | — | — | — | — | — | — | — | — | — |
| **Social Engineering** | 18+ rules | — | — | — | — | — | — | — | — | — | — |
| **Embedding Poisoning** | 15+ rules | — | — | — | — | — | — | — | — | — | — |
| **Insecure Deserialization** | 16+ rules (pickle, Java, .NET, PHP) | — | — | — | — | — | — | — | — | — | — |
| **Multilingual Attacks** | 50+ rules (15 languages) | 100+ languages (ML) | — | — | Alt-language (ML) | — | — | — | — | Multilingual red team | — |
| **Output Exfiltration** | Image beacon, link exfil, invisible Unicode | — | — | — | — | — | — | — | — | — | — |
| **Spam/Scam URL** | 7 rules + heuristic | — | — | — | — | — | — | — | — | — | — |
| **System Prompt Leak** | 38 input + 5 output rules | Yes | — | — | Yes | — | — | — | — | — | — |
| **Agent Firewall** | Full (session, action, tool, egress, memory, browser, MCP) | Agent discovery (post-acquisition) | — | — | Agent sensors | Agent discovery | — | Planned | Agentic protection | Agentic guardrails | — |
| **RAG Security** | Trust scoring, canary tokens, per-source guard | — | — | — | — | — | — | — | — | — | — |
| **Context Lineage** | Source registration, flow checking, incident tracking | — | — | — | — | — | — | — | — | — | — |
| **Blast Radius Sim** | Scenario simulation engine | — | — | — | — | — | — | — | — | — | — |
| **Memory Poisoning** | Check, quarantine, safe-store | — | — | — | — | — | — | — | — | Agent memory (partial) | — |
| **MCP Tool Drift** | Server registration, snapshot, drift detection | — | — | — | — | — | — | — | MCP scanning | MCP catalog | — |
| **Inter-Agent Security** | Message check, rogue detection, cascade breaker | — | — | — | — | — | — | — | — | — | — |
| **Model Drift Detection** | Response, safety, performance distribution | — | — | — | — | Yes (monitoring) | — | Observe module | — | — | — |
| **Legal Boundary Guard** | Action-category enforcement | — | — | — | — | — | — | — | — | — | — |
| **Compliance Reports** | OWASP LLM 2025 + OWASP Agentic 2026 | EU AI Act, NIST | — | — | OWASP (8/10) | — | — | Audit trails | MITRE ATLAS | NIST AI-RMF, MITRE ATLAS | — |
| **Evasion Hardening** | 15+ transforms (Unicode, leetspeak, Caesar, base64, confusables, tag chars, variation selectors) | ML-trained | — | Entropy + encoding | — | — | — | — | Adversarial ML | — | — |

---

## Detailed Competitor Profiles

### 1. Lakera Guard (acquired by Check Point, Sept 2025)
- **Strength:** Massive training dataset (80M+ adversarial prompts from Gandalf), sub-50ms latency, 100+ language coverage, strong enterprise integrations post-acquisition
- **Weakness:** API-only (network hop required), self-reported benchmarks, opaque pricing, no offline/embedded mode
- **vs. SoterAI:** Lakera has better ML-trained multilingual coverage. SoterAI has **far deeper rule coverage** (400+ explicit rules vs. opaque ML), agent firewall, RAG security, lineage tracking, and zero-network-dependency semantic classification

### 2. LLM Guard (Protect AI → Palo Alto Networks)
- **Strength:** Fully open-source (MIT), 35 scanners (15 input + 20 output), self-hosted, no vendor lock-in
- **Weakness:** Self-hosted operational burden, no SaaS option, no latency benchmarks, no agent/RAG security
- **vs. SoterAI:** LLM Guard has more output scanners. SoterAI has **agent firewall, RAG security, evasion hardening, semantic classifier, compliance reports, and context lineage** — none of which LLM Guard offers

### 3. Prompt Armor (Open Source)
- **Strength:** Elegant 5-layer analysis, 24ms latency, 91.7% F1 (ICLR 2026), fully offline, Apache 2.0
- **Weakness:** Prompt injection ONLY — no PII, toxicity, secrets, output, or agent protection
- **vs. SoterAI:** Prompt Armor is a single-purpose tool. SoterAI is a **complete security platform** covering 18 risk types, both directions, plus agent/RAG/lineage

### 4. Pangea AI Guard (acquired by CrowdStrike, Sept 2025)
- **Strength:** 3-layer defense-in-depth, sub-30ms, CrowdStrike threat intel feeds, AIDR platform
- **Weakness:** Absorbed into CrowdStrike Falcon (standalone availability unclear), no hallucination detection, API-only
- **vs. SoterAI:** Pangea has CrowdStrike threat intel and enterprise SOC integration. SoterAI has **deeper rule coverage, agent firewall, RAG security, lineage tracking, blast radius simulation, and works offline**

### 5. Arthur AI Shield
- **Strength:** Hallucination detection with grounding docs, agent discovery/governance (Dec 2025)
- **Weakness:** No public latency benchmarks, opaque enterprise pricing, limited integration ecosystem
- **vs. SoterAI:** Arthur has grounding-based hallucination detection. SoterAI has **broader threat coverage (SSRF, recursive injection, deserialization, social engineering), agent firewall with tool/MCP/memory control, and compliance reporting**

### 6. Nightfall AI
- **Strength:** Best-in-class DLP — 100+ ML detectors, 30+ SaaS integrations, browser/endpoint agents
- **Weakness:** **Not an LLM firewall** — doesn't detect prompt injection, jailbreaks, or hallucination
- **vs. SoterAI:** Completely different product category. Nightfall protects data FROM AI tools; SoterAI protects AI applications FROM attacks. Nightfall's PII detection is stronger (125M-parameter models); SoterAI covers the full AI security stack

### 7. CalypsoAI (acquired by F5, $180M, Sept 2025)
- **Strength:** Red-team module (10K+ attack prompts/month), immutable audit trails, Observe tracing
- **Weakness:** Product roadmap uncertainty post-F5 acquisition, no model file scanning, limited multi-turn depth
- **vs. SoterAI:** CalypsoAI has dedicated red-teaming. SoterAI has **deeper detection rules, agent firewall, RAG canary tokens, lineage tracking, blast radius simulation, and evasion hardening**

### 8. HiddenLayer
- **Strength:** Model supply chain security (35+ file formats, AIBOM), MITRE ATLAS alignment, air-gapped deployment
- **Weakness:** Enterprise-only, no free tier, proprietary lock-in (25 patents)
- **vs. SoterAI:** HiddenLayer focuses on model-level threats (backdoors, trojans, adversarial evasion). SoterAI focuses on **application-level threats (prompt injection through to agent control)**. Complementary, not competitive on model supply chain

### 9. Cisco AI Defense (ex-Robust Intelligence)
- **Strength:** Network-level integration via Cisco SASE, adaptive multi-turn red teaming, MCP catalog governance
- **Weakness:** Heavy Cisco ecosystem dependency, complex deployment, no public latency benchmarks
- **vs. SoterAI:** Cisco has network-layer enforcement and MCP catalog. SoterAI has **deeper application-layer detection (400+ rules), agent firewall with session/tool/memory/browser control, RAG security, context lineage, and blast radius simulation**

### 10. Rebuff AI (Protect AI)
- **Strength:** Self-hardening vector DB, canary token verification, open-source
- **Weakness:** Prototype-grade, prompt injection only, no production guarantees, uncertain maintenance
- **vs. SoterAI:** Rebuff is a prototype. SoterAI is a **production-grade platform** with 18 risk types, 5 actions, SDK with 30+ methods, and framework integrations

---

## SoterAI Guard — Unique Competitive Advantages

### 1. Deepest Rule Coverage in the Market
- **400+ detection rules** across 20+ detectors — no competitor comes close to this explicit, auditable rule depth
- Every rule is inspectable (not a black-box ML model), which matters for compliance and debugging

### 2. Only Product with Full Agent Firewall
- Session management, action checking, tool-use screening, data egress control, memory poisoning detection, browser form checking, MCP tool scanning
- No competitor offers this complete agent security stack

### 3. Only Product with RAG Security Primitives
- Document trust scoring, canary token creation/leak detection, per-source guarding
- Competitors either ignore RAG or treat it as a prompt-injection subproblem

### 4. Context Lineage Tracking (Unique)
- Source registration, flow checking, incident tracking across the data supply chain
- No competitor offers this capability

### 5. Blast Radius Simulation (Unique)
- Scenario-based simulation of compromise impact
- No competitor offers this capability

### 6. Zero-Dependency Semantic Classification
- 512-dim feature-hashed embeddings, sub-millisecond, no network call, no external model
- Most competitors either skip semantic analysis or require an API call

### 7. Evasion Hardening Depth
- 15+ transforms including invisible Unicode (tag characters, variation selectors), confusable mapping, Caesar cipher brute-force, base64/hex/binary/Morse decoding
- Only Prompt Armor (entropy analysis) and Lakera (ML-trained) attempt comparable evasion resistance

### 8. India-Specific Compliance
- Dedicated India PII detector (Aadhaar, PAN, GSTIN, UPI, IFSC, etc.)
- No competitor offers region-specific PII detection at this granularity

---

## SoterAI Guard — Areas for Improvement

| Gap | Competitors Who Do It Better | Priority |
|---|---|---|
| **ML-trained multilingual detection** | Lakera (100+ languages via ML), Cisco (multilingual red team) | HIGH — 15 languages via regex is good but ML would catch novel patterns |
| **Model supply chain security** | HiddenLayer (35+ file formats, AIBOM, trojan detection) | MEDIUM — different threat surface, but enterprises want it |
| **Dedicated red-teaming module** | CalypsoAI (10K attacks/month), Cisco (adaptive red team) | MEDIUM — would validate guard strength continuously |
| **Third-party threat intel feeds** | Pangea/CrowdStrike, Cisco, HiddenLayer | MEDIUM — enriches detection with real-world attack data |
| **SaaS DLP integrations** | Nightfall (30+ integrations: Slack, GitHub, Google Drive) | LOW — different product category, but enterprises ask for it |
| **Published latency benchmarks** | Lakera (<50ms), Pangea (<30ms), Prompt Armor (24ms) | HIGH — SoterAI is fast but needs published numbers |
| **Grounding-based hallucination** | Arthur Shield (document grounding) | LOW — rule-based hallucination detection is a good start |

---

## Market Positioning Map

```
                    NARROW SCOPE ←————————————→ BROAD SCOPE
                         │                          │
   ENTERPRISE      HiddenLayer          Cisco AI Defense
   (complex,       (model supply        (network + app layer)
    expensive)      chain only)
                                         Lakera Guard
                         CalypsoAI       (broad but ML-only)
                         (proxy model)
                                         ★ SoterAI Guard ★
                         Arthur Shield   (broadest scope +
                         (firewall +     agent + RAG + lineage)
                          hallucination)
                                         Pangea/CrowdStrike
                                         (guard + SOC)
   DEVELOPER       Rebuff AI            LLM Guard
   (simple,        (PI only,            (open source, 35 scanners)
    affordable)     prototype)
                    Prompt Armor
                    (PI only, fast)      Nightfall (DLP only)
                         │                          │
```

---

## Verdict

**SoterAI Guard occupies a unique position:** it is the only product that combines deep, auditable rule-based detection (400+ rules), a complete agent firewall, RAG security, context lineage tracking, blast radius simulation, and compliance reporting in a single SDK — with zero external dependencies and sub-millisecond semantic classification.

The closest competitors are:
1. **Lakera Guard** — comparable breadth but ML-only (black box), API-dependent, no agent firewall
2. **Pangea AI Guard** — similar layered approach but now locked inside CrowdStrike Falcon
3. **Cisco AI Defense** — strongest enterprise play but heavy ecosystem dependency

**SoterAI Guard's moat is its combination of depth + breadth + independence.** No competitor matches all three.
