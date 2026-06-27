<div align="center">
  <img src="https://raw.githubusercontent.com/yashchauhan66/Ai-Security-Guard/main/public/logo.png" alt="SoterAI Logo" width="280" />
  
  # SoterAI — Open-Source AI Security Command Layer
  
  **Protect your chatbots, RAG apps, and AI agents from prompt injection, jailbreaks, data leakage, and agent abuse — defense-in-depth with F1=1.0000 adversarial benchmark.**
  
  <p align="center">
    <a href="https://github.com/yashchauhan66/Ai-Security-Guard"><img src="https://img.shields.io/github/stars/yashchauhan66/Ai-Security-Guard?style=for-the-badge&logo=github&logoColor=white&label=⭐%20Star%20us" alt="GitHub Stars" /></a>
    <a href="https://www.producthunt.com"><img src="https://img.shields.io/badge/Launching%20June%2030-Product%20Hunt-da552f?style=for-the-badge&logo=producthunt&logoColor=white" alt="Launching June 30 on Product Hunt" /></a>
    <a href="https://soterai.publicvm.com"><img src="https://img.shields.io/badge/Live%20Demo-soterai.publicvm.com-31d7c8?style=for-the-badge&logo=vercel&logoColor=white" alt="Live Demo" /></a>
    <a href="https://soterai.publicvm.com/playground"><img src="https://img.shields.io/badge/Try%20Playground-00dc82?style=for-the-badge&logo=react&logoColor=white" alt="Playground" /></a>
    <a href="https://soterai.publicvm.com/docs"><img src="https://img.shields.io/badge/Docs-31d7c8?style=for-the-badge&logo=gitbook&logoColor=white" alt="Documentation" /></a>
  </p>
  
  <p align="center">
    <img src="https://img.shields.io/badge/F1%3D1.0000-00c8c8?style=flat-square&logo=checkmarx&logoColor=white" alt="F1=1.0000" />
    <img src="https://img.shields.io/badge/dynamic/json?color=00dc82&label=Benchmark&query=%24.overall.f1_score&suffix=%20F1&url=https%3A%2F%2Fsoterai.publicvm.com%2Fapi%2Fbenchmark%2Fbadge&style=flat-square&logo=test&logoColor=white" alt="Benchmark F1" />
    <img src="https://img.shields.io/badge/97%2F97%20attacks%20detected-00dc82?style=flat-square&logo=shield&logoColor=white" alt="97/97 Attacks" />
    <img src="https://img.shields.io/badge/0%25%20false%20positives-00dc82?style=flat-square&logo=check&logoColor=white" alt="0% False Positives" />
    <img src="https://img.shields.io/badge/891ms%20HTTP%20p50-00c8c8?style=flat-square&logo=zap&logoColor=white" alt="891ms HTTP p50 in the recorded internal benchmark" />
    <img src="https://img.shields.io/github/actions/workflow/status/yashchauhan66/Ai-Security-Guard/ci-cd.yml?branch=main&style=flat-square&logo=githubactions&logoColor=white&label=CI%2FCD" alt="CI/CD" />
    <img src="https://img.shields.io/github/license/yashchauhan66/Ai-Security-Guard?style=flat-square" alt="License" />
    <img src="https://img.shields.io/badge/OWASP%20LLM%20Top%2010-Mapped-brightgreen?style=flat-square" alt="OWASP LLM Top 10 mapped" />
  </p>
  
  <br />
  
  **[✨ Features](#-key-features) • [🏆 Benchmark](#-benchmark-results) • [🚀 Quick Start](#-quick-start) • [📋 Services](#-services-overview) • [🏗️ Architecture](#️-architecture) • [🐳 Deployment](#-deployment)**
  
  <br />
</div>

---

## What is SoterAI?

**SoterAI** (from Greek *sōtēr* — "savior, protector") is an **open-source AI security command layer** that protects chatbots, RAG systems, and autonomous agents from:

- 🎯 **Prompt injection & jailbreak attacks**
- 🔓 **Data exfiltration & PII leakage**
- 🤖 **Rogue agent behavior & tool abuse**
- 🧠 **Memory poisoning & context manipulation**
- 💸 **Runaway LLM costs & budget overruns**
- ⚖️ **Regulatory compliance violations**

With **33 documented product services** organized across 6 layers of defense — Monitor, Protect, Detect, Control, Compliance, and Manage — SoterAI provides a broad security control surface for AI systems. Some modules are explicitly marked Preview and have open production-integration gaps.

> **🏆 Internal benchmark: F1=1.0000** — 97/97 adversarial cases detected with 0/25 false positives in a small, self-authored dataset. This is not an independent audit or a production-traffic result. [See the raw results and latency](scripts/guard-benchmark/results.json).
>
> **🔒 Production-oriented** — Includes Docker/EC2 deployment assets, CI/CD, health checks, workers, and operational runbooks. No production customer count or traffic volume is claimed in this repository. Source-available under the Business Source License (open core) — see [LICENSING.md](LICENSING.md).
>
> **📋 Comprehensive audit completed 2026-06-27** — See the [full audit report](docs/APP_AUDIT_AND_COMPETITIVE_REPORT_2026-06-27.md) including bug fixes, competitor comparison, and 30/60/90-day roadmap. 566+ tests pass, TypeScript compiles with zero errors, and Prisma schema is valid.

<br />

---

## ✨ Key Features


### Advanced LLM Attack Coverage

Recent guard updates expand SoterAI beyond classic prompt-injection and jailbreak detection. The guard now detects active indicators for:

- **Encoded and obfuscated attacks** - base64/base64url, hex, binary, decimal bytes, Morse, leetspeak, compact spacing, Unicode controls, homoglyph markers, and Caesar-shift payloads.
- **15 advanced jailbreak families** - roleplay jailbreaks, adversarial suffixes, multilingual trojans, token smuggling, ASCII-art smuggling, evolutionary jailbreak generation, cognitive-overload attacks, function-call wrappers, cross-modal payloads, automated chain attacks, and multi-agent compromise propagation.
- **Adversarial NLP attacks** - imperceptible perturbations, gradient/word-substitution evasion, universal transferable suffixes, classifier/NER evasion, tabular entity-swap attacks, and cross-lingual adversarial adaptation.
- **Backdoor and data-poisoning attempts** - trigger phrases, syntactic/style triggers, BadPrompt/BadPre/BITE-style poisoning, poisoned embeddings, LoRA/PEFT safety compromise, code-search poisoning, seq2seq backdoors, and model-hijacking prompts.
- **llmsecurity.net-style attack families** - training-data extraction, membership/private-attribute inference, data reconstruction, LLM resource exhaustion, agent RCE/escalation, package hallucination/dependency confusion, XSS/CSRF/CPRF browser attacks, multimodal visual/audio prompt injection, model theft, attack automation, and detector evasion.
- **Unsafe output handling** - model-generated HTML/script sinks, credentialed browser requests, script exfiltration, and unverified package installation guidance are held for review before reaching downstream systems.

These rules are covered by regression tests in `tests/guard.test.ts` and red-team benchmark categories in `lib/classifiers/datasets/guardRedTeamBenchmark.ts`.

### 6 Layers of AI Security

<table>
  <tr>
    <td width="50%" valign="top">
      <h3>👁️ Monitor</h3>
      <p><em>Observe, analyze, and understand your AI security posture</em></p>
      <ul>
        <li><strong>Guard Logs</strong> — Full audit trail of every security decision</li>
        <li><strong>Reports</strong> — Automated monthly security reports with trends</li>
        <li><strong>Detection Feedback</strong> — Improve accuracy by marking false positives</li>
        <li><strong>Customer Success</strong> — Activation rates and churn risk analytics</li>
      </ul>
    </td>
    <td width="50%" valign="top">
      <h3>🛡️ Protect</h3>
      <p><em>Shield your AI from attacks, abuse, and data leaks</em></p>
      <ul>
        <li><strong>Agent Firewall</strong> — Block unauthorized tool calls in real-time</li>
        <li><strong>Policy Engine</strong> — Custom risk thresholds and action defaults</li>
        <li><strong>RAG Security</strong> — Guard retrieval pipelines from poisoned docs</li>
        <li><strong>Webhooks</strong> — Real-time signed security event notifications</li>
      </ul>
    </td>
  </tr>
  <tr>
    <td width="50%" valign="top">
      <h3>🔍 Detect</h3>
      <p><em>Identify threats, vulnerabilities, and suspicious patterns</em></p>
      <ul>
        <li><strong>Shadow AI</strong> — Discover unauthorized AI tool usage</li>
        <li><strong>Red Team Lab</strong> — Test against 100+ adversarial scenarios</li>
        <li><strong>Forensics</strong> — Full incident investigation toolkit</li>
        <li><strong>Semantic Egress</strong> — Detect paraphrased confidential data leaks</li>
        <li><strong>Canary Network</strong> — Tripwire tokens to detect prompt injection</li>
      </ul>
    </td>
    <td width="50%" valign="top">
      <h3>🎛️ Control</h3>
      <p><em>Govern agent behavior with fine-grained policies</em></p>
      <ul>
        <li><strong>Agent Passports</strong> — Cryptographic agent identity verification</li>
        <li><strong>Transaction Escrow</strong> — Human-in-the-loop for risky actions</li>
        <li><strong>Intent Guard</strong> — Verify actions match original user intent</li>
        <li><strong>Tool Chain</strong> — Detect risky multi-tool attack sequences</li>
        <li><strong>Memory Firewall</strong> — Quarantine poisoned agent memory</li>
        <li><strong>MCP Drift</strong> — Detect MCP server tool changes</li>
        <li><strong>Legal Boundary</strong> — Hard guardrails for regulatory compliance</li>
      </ul>
    </td>
  </tr>
  <tr>
    <td width="50%" valign="top">
      <h3>📋 Compliance</h3>
      <p><em>Meet regulatory requirements with audit-ready evidence</em></p>
      <ul>
        <li><strong>Evidence Vault</strong> — SOC 2 / ISO 27001 evidence packaging</li>
        <li><strong>Context Lineage</strong> — Track data provenance and block cross-domain leaks</li>
        <li><strong>Blast Radius</strong> — Estimate damage if an agent is compromised</li>
        <li><strong>Credential Vault</strong> — Secure server-side credential storage</li>
      </ul>
    </td>
    <td width="50%" valign="top">
      <h3>⚙️ Manage</h3>
      <p><em>Configure, monitor, and administer your security stack</em></p>
      <ul>
        <li><strong>Projects</strong> — Multi-environment project organization</li>
        <li><strong>API Keys</strong> — Scoped keys with independent rate limits</li>
        <li><strong>Cost Firewall</strong> — Prevent runaway LLM spending</li>
        <li><strong>Security Badges</strong> — Real-time protection status badges</li>
        <li><strong>Audit Exports</strong> — Compliance-ready audit log exports</li>
      </ul>
    </td>
  </tr>
</table>

<br />

---

## 🏆 Benchmark Results

SoterAI was evaluated using a **Garak-style adversarial benchmark** against **97 attack variants** across **8 categories**:

| Metric | Result |
|--------|--------|
| 🎯 **Detection Rate** | **100%** (97/97 adversarial prompts detected) |
| ✅ **False Positives** | **0%** (25/25 safe inputs correctly allowed) |
| 📊 **F1 Score** | **1.0000** |
| 🎯 **Precision** | **1.0000** |
| 🔄 **Recall** | **1.0000** |
| ⚡ **Recorded HTTP latency** | **891ms p50 / 1,656ms p95 / 2,719ms p99** |

> **Benchmark limits:** This is an internal, self-authored test set and can overestimate real-world performance. The 25-safe-input false-positive sample is too small for a production FPR claim. Category counts overlap in the report and should not be summed. Run an independent benchmark on representative, authorized traffic before making comparative or production claims.

### Attack Categories Tested

| Category | Samples | Detection |
|----------|---------|-----------|
| Prompt Injection | 30 | ✅ 30/30 (100%) |
| Jailbreak / DAN | 11 | ✅ 11/11 (100%) |
| Encoding / Obfuscation | 12 | ✅ 12/12 (100%) |
| Multilingual (Hindi/Hinglish) | 7 | ✅ 7/7 (100%) |
| PII Detection (incl. India PII) | 12 | ✅ 12/12 (100%) |
| Secrets / Credentials | 19 | ✅ 19/19 (100%) |
| Unsafe Output | 7 | ✅ 7/7 (100%) |
| Indirect Prompt Injection | 6 | ✅ 6/6 (100%) |

> 📄 [View full benchmark results](scripts/guard-benchmark/results.json) | 🎮 [Try the interactive playground](https://soterai.publicvm.com/playground) | 🧪 [Attack-pack regression tests (74 cases)](tests/guard/attack-pack-regression.test.ts)

<br />

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────┐
│                     Your Application                      │
│  ┌────────────┐  ┌──────────┐  ┌──────────────────┐     │
│  │   Chatbot   │  │ RAG App  │  │ Autonomous Agent │     │
│  └─────┬──────┘  └────┬─────┘  └────────┬─────────┘     │
│        │              │                  │               │
└────────┼──────────────┼──────────────────┼───────────────┘
         │              │                  │
         ▼              ▼                  ▼
┌─────────────────────────────────────────────────────────┐
│                   SoterAI Guard API                       │
│                                                           │
│  ┌──────────────┐  ┌─────────────┐  ┌──────────────┐    │
│  │ Input Guard  │  │ Output Guard│  │Agent Firewall│    │
│  ├──────────────┤  ├─────────────┤  ├──────────────┤    │
│  │• Prompt Inj. │  │• PII Leak   │  │• Tool Check  │    │
│  │• Jailbreak   │  │• Secrets    │  │• Auth Verify │    │
│  │• Toxicity    │  │• Toxicity   │  │• Risk Score  │    │
│  │• PII Redact  │  │• Hallucin.  │  │• Policy Eval │    │
│  └──────────────┘  └─────────────┘  └──────┬───────┘    │
│                                            │            │
│  ┌─────────────────────────────────────────┘            │
│  ▼                                                       │
│  ┌──────────────┐  ┌─────────────┐  ┌──────────────┐    │
│  │  Webhooks    │  │   Reports   │  │  Forensics   │    │
│  │  & SIEM      │  │ & Analytics │  │  & Audit     │    │
│  └──────────────┘  └─────────────┘  └──────────────┘    │
│                                                           │
└─────────────────────────┬─────────────────────────────────┘
                          │
          ┌───────────────┼───────────────┐
          ▼               ▼               ▼
┌─────────────┐  ┌──────────────┐  ┌──────────────┐
│  PostgreSQL │  │  Upstash     │  │  Qdrant      │
│  (Prisma)   │  │  Redis       │  │  (Vector DB) │
└─────────────┘  └──────────────┘  └──────────────┘
```

### Tech Stack

| Component | Technology |
|-----------|-----------|
| **Framework** | Next.js 15.5 (TypeScript) + Turbopack |
| **Database** | PostgreSQL 16 + Prisma ORM 5.22 |
| **Caching** | Upstash Redis |
| **Vector Store** | Qdrant (optional) |
| **Auth** | NextAuth v5 (JWT sessions) |
| **Payments** | Razorpay |
| **UI** | Tailwind CSS + Lucide Icons |
| **Container** | Docker (multi-stage build) |
| **CI/CD** | GitHub Actions → Docker Hub → EC2 |
| **SDKs** | TypeScript, Python, LangChain, LlamaIndex |

<br />

---

## 🚀 Quick Start

### 1️⃣ One-liner (Node.js)

```bash
npm install @soterai/core
```

### 2️⃣ Basic Usage

```typescript
import { Soter } from "@soterai/core";

const soter = new Soter({
  apiKey: process.env.SOTERAI_API_KEY,
});

// Guard user input before passing to LLM
const result = await soter.guardInput({
  message: userMessage,
  userId: "user_123",
  sessionId: "session_456",
});

if (soter.shouldBlock(result)) {
  // 🛑 Blocked — don't call the LLM
  return { reply: "Message blocked for security reasons." };
}

const safeInput = soter.getSafeText(result, userMessage) ?? userMessage;
const llmResponse = await callMyLLM(safeInput);

// Guard the output before returning to user
const outputResult = await soter.guardOutput({
  aiResponse: llmResponse,
  sessionId: "session_456",
});

const safeOutput = soter.getSafeText(outputResult, llmResponse) ?? llmResponse;
return { reply: safeOutput };
```

### 3️⃣ Self-Host (Docker)

```bash
docker pull yashchauhan66/soter:latest
docker run -p 3000:3000 --env-file .env.production yashchauhan66/soter:latest
```

<details>
<summary><strong>📄 Requirements: .env.production (click to expand)</strong></summary>

```env
# Required
DATABASE_URL=postgresql://user:pass@host:5432/soter
AUTH_SECRET=<your-32-char-secret>

# API Keys
SOTERAI_API_KEY=<your-api-key>

# Optional
REDIS_URL=redis://...
QDRANT_URL=http://qdrant:6333
SLM_API_KEY=sk-...
```
</details>

<br />

---

## 📋 Services Overview

| Category | Service | Description |
|----------|---------|-------------|
| **👁️ Monitor** | [Guard Logs](https://soterai.publicvm.com/docs/services/guard-logs) | Full audit trail of every security decision |
| | [Reports](https://soterai.publicvm.com/docs/services/reports) | Automated security reports with trend analysis |
| | [Detection Feedback](https://soterai.publicvm.com/docs/services/detection-feedback) | Improve detection accuracy by marking false positives |
| | [Customer Success](https://soterai.publicvm.com/docs/services/customer-success) | Activation rates and churn risk analytics |
| **🛡️ Protect** | [Agent Firewall](https://soterai.publicvm.com/docs/services/agent-firewall) | Real-time agent action monitoring and blocking |
| | [Policy Engine](https://soterai.publicvm.com/docs/services/policy-engine) | Configurable risk thresholds and action policies |
| | [RAG Security](https://soterai.publicvm.com/docs/services/rag-security) | Document scanning and retrieval-time guard |
| | [Webhooks](https://soterai.publicvm.com/docs/services/webhooks) | Signed real-time security event notifications |
| **🔍 Detect** | [Shadow AI](https://soterai.publicvm.com/docs/services/shadow-ai) | Uncover unauthorized AI tool usage |
| | [Red Team Lab](https://soterai.publicvm.com/docs/services/red-team-lab) | 100+ adversarial attack scenarios |
| | [Forensics](https://soterai.publicvm.com/docs/services/forensics) | Incident investigation and root cause analysis |
| | [Semantic Egress](https://soterai.publicvm.com/docs/services/semantic-egress) | Detect paraphrased confidential data leaks |
| | [Canary Network](https://soterai.publicvm.com/docs/services/canary-network) | Tripwire tokens for prompt injection detection |
| **🎛️ Control** | [Agent Passports](https://soterai.publicvm.com/docs/services/agent-passports) | Cryptographic agent identity verification |
| | [Transaction Escrow](https://soterai.publicvm.com/docs/services/transaction-escrow) | Human-in-the-loop for risky agent actions |
| | [Intent Guard](https://soterai.publicvm.com/docs/services/intent-guard) | Verify actions match original user intent |
| | [Tool Chain](https://soterai.publicvm.com/docs/services/tool-chain) | Multi-step attack pattern detection |
| | [Dry-Run Sandbox](https://soterai.publicvm.com/docs/services/dry-run-sandbox) | Simulate policies without production impact |
| | [Memory Firewall](https://soterai.publicvm.com/docs/services/memory-firewall) | Quarantine poisoned agent memory |
| | [MCP Drift](https://soterai.publicvm.com/docs/services/mcp-drift) | Monitor MCP server tool changes |
| | [Legal Boundary](https://soterai.publicvm.com/docs/services/legal-boundary) | Hard guardrails for regulatory compliance |
| **📋 Compliance** | [Evidence Vault](https://soterai.publicvm.com/docs/services/evidence-vault) | SOC 2 / ISO 27001 evidence packaging |
| | [Context Lineage](https://soterai.publicvm.com/docs/services/context-lineage) | Data provenance and cross-domain leak blocking |
| | [Blast Radius](https://soterai.publicvm.com/docs/services/blast-radius) | Agent compromise damage estimation |
| | [Credential Vault](https://soterai.publicvm.com/docs/services/credential-vault) | Secure credential storage for agents |
| **⚙️ Manage** | [Projects](https://soterai.publicvm.com/docs/services/projects) | Multi-environment project organization |
| | [API Keys](https://soterai.publicvm.com/docs/services/api-keys) | Scoped keys with independent rate limits |
| | [Cost Firewall](https://soterai.publicvm.com/docs/services/cost-firewall) | Prevent runaway LLM spending |
| | [Security Badges](https://soterai.publicvm.com/docs/services/security-badges) | Real-time protection status badges |
| | [Billing](https://soterai.publicvm.com/docs/services/billing) | Plan management and usage tracking |
| | [Settings](https://soterai.publicvm.com/docs/services/settings) | Profile, team, and preferences |
| | [Audit Exports](https://soterai.publicvm.com/docs/services/audit-exports) | Compliance-ready audit log exports |
| | [Onboarding](https://soterai.publicvm.com/docs/services/onboarding) | Guided setup with live validation |

> 📖 **Full documentation available at:** [soterai.publicvm.com/docs/services](https://soterai.publicvm.com/docs/services)

<br />

---

## 🔌 SDKs & Integrations

| Platform | Package | Status |
|----------|---------|--------|
| **Node.js / TypeScript** | `@soterai/core` | ✅ Stable |
| **Python** | `@soterai/python` | ✅ Stable |
| **Next.js** | `@soterai/core/next` | ✅ Stable |
| **Express** | `@soterai/core/express` | ✅ Stable |
| **LangChain** | `@soterai/langchain-middleware` | ✅ Stable |
| **LlamaIndex** | `@soterai/llamaindex-middleware` | ✅ Stable |
| **WordPress** | Plugin package available | ✅ Stable |
| **Botpress** | Integration channel | ✅ Stable |
| **Intercom** | Integration channel | ✅ Stable |
| **Zendesk** | Integration channel | ✅ Stable |
| **WhatsApp** | Business API integration | ✅ Stable |
| **REST API** | `/api/*` routes (see [API docs](/docs/rest-api)) | ✅ Implemented |

<br />

---

## 🐳 Deployment

### Docker (Production)

```bash
# Build
docker build -t soter:latest --secret id=npmrc,src=$HOME/.npmrc .

# Run
docker run -p 3000:3000 --env-file .env.production soter:latest
```

### CI/CD Pipeline (Automatic)

The project includes a **fully automated CI/CD pipeline** via GitHub Actions:

| Stage | Description |
|-------|-------------|
| 🔨 **Build & Typecheck** | TypeScript compilation + Prisma validation |
| 🧪 **Tests** | 45+ test suites (566+ passing tests) covering all security services |
| 🐳 **Docker Build & Push** | Multi-stage build → Docker Hub |
| 🚀 **Deploy to EC2** | SSH → pull image → restart containers |

Deployment happens automatically on push to `main` branch.

### Architecture

```
GitHub Push → GitHub Actions → Docker Hub → EC2 Instance
                                                    │
                                          ┌─────────┴──────────┐
                                          │  docker-compose     │
                                          │  or docker run      │
                                          │  with --env-file    │
                                          └─────────┬──────────┘
                                                    │
                                          ┌─────────▼──────────┐
                                          │  App (port 3000)   │
                                          │  Redis (cache)     │
                                          │  Qdrant (vectors)  │
                                          └────────────────────┘
```

<br />

---

## 🧪 Testing

```bash
# Run all tests (45+ test suites, 566+ tests)
npm test

# TypeScript typecheck
npm run typecheck

# SDK tests
npm run test:sdk:js
npm run test:sdk:python

# Integration tests
npm run test:integrations

# E2E tests (Playwright)
npm run test:e2e

# Production env validation
npx tsx scripts/validate-env.ts

# Full verification
npm run verify
```

Playwright applies migrations and seed fixtures. Use a dedicated local database
via `E2E_DATABASE_URL`; as a safety fallback, a loopback-only `DATABASE_URL` is
accepted. A remote default `DATABASE_URL` is never modified unless it is
explicitly repeated as `E2E_DATABASE_URL` to confirm that it is test-only.

### Verified test results (as of 2026-06-27)

| Suite | Tests | Result |
|-------|------:|--------|
| Auth (signup, verify, reset) | 11 | ✅ All pass |
| Guard (input/output, decisions) | 34 | ✅ All pass |
| Agent Firewall (MVP1-3) | 25 | ✅ All pass |
| Agent Passport / Intent / Escrow | 50 | ✅ All pass |
| Tool Chain / Dry Run / Canary | 25 | ✅ All pass |
| Semantic Egress / Evidence / RAG | 20 | ✅ All pass |
| Advanced Security (MVPs 1-3) | 20 | ✅ All pass |
| Security (XSS, rate limit, sanitize) | 13 | ✅ All pass |
| Attack-Pack Regression | 74 | ✅ All pass |
| Phase Tests (2-12) | 67 | ✅ All pass |
| SLM Evaluation / Performance | 15 | ✅ All pass |
| Billing / Webhooks / Retention | 20 | ✅ All pass |
| API Route Audit / Integrations | 15 | ✅ All pass |
| Service Catalog Contract Tests | 2 | ✅ All pass |
| **Total** | **~566+** | **✅ All pass** |

Test suites cover: auth, guard, agent-firewall, agent-passports, intent verification, tool chain, escrow, dry-run, semantic egress, evidence vault, canary network, RAG, SLM evaluation, billing, webhooks, retention, API contract verification, and more.

<br />

---

## 🛠️ Development Setup

```bash
# 1. Clone and install
git clone https://github.com/yashchauhan66/Ai-Security-Guard.git
cd Ai-Security-Guard
npm install

# 2. Setup PostgreSQL database
createdb soter
npx prisma migrate deploy

# 3. Configure environment
cp .env.example .env.local
# Edit .env.local with your settings

# 4. Start dev server
npm run dev
# → http://localhost:3000

# 5. Seed database (optional)
npm run db:seed
```

<br />

---

## 📊 Compliance & Standards

SoterAI is designed to help you meet:

| Framework | Coverage |
|-----------|----------|
| **OWASP LLM Top 10** | ✅ Full mapping for all 10 categories |
| **SOC 2** | ✅ Evidence collection for security, availability, confidentiality |
| **ISO 27001** | ✅ Evidence collection for A.8 (Access Control), A.12 (Operations Security) |
| **HIPAA** | ✅ PII/PHI detection and redaction |
| **GDPR** | ✅ Data subject request workflows |
| **DPDP (India)** | ✅ Consent records, breach notifications |
| **PCI-DSS** | ✅ Secret detection and masking |

<br />

---

## 🧠 Why SoterAI?

<details>
<summary><strong>vs. Guardrails & Content Filters</strong></summary>

Traditional content filters only match known patterns. SoterAI uses **semantic understanding**, **behavioral analysis**, and **multi-layer defense** to catch:
- Novel prompt injection attacks never seen before
- Paraphrased confidential data (Semantic Egress)
- Gradual multi-turn manipulation (Intent Guard)
- Multi-step tool chain attacks (Tool Chain Detector)
- Memory poisoning across sessions (Memory Firewall)
</details>

<details>
<summary><strong>vs. Agent Monitoring Platforms</strong></summary>

Most agent monitoring tools are **observability-first** — they show you what happened. SoterAI is **protection-first** — we block attacks in real-time before they cause damage, with full audit trails for after-action analysis.
</details>

<details>
<summary><strong>vs. DIY Security Wrappers</strong></summary>

Building your own security layer means maintaining 30+ detection models, policy engines, compliance frameworks, and a real-time dashboard. SoterAI gives you all of this out-of-the-box with zero configuration for basic protection.
</details>

<br />

---

## 📁 Project Structure

```
├── app/                    # Next.js app (pages, API routes)
│   ├── api/                #   REST API endpoints
│   ├── dashboard/          #   Dashboard (42+ feature pages)
│   ├── docs/               #   Documentation pages
│   └── (public pages)      #   Marketing, pricing, etc.
├── components/             # React components
│   ├── auth/               #   Auth UI
│   ├── dashboard/          #   Dashboard widgets
│   ├── docs/               #   Doc components
│   └── ui/                 #   Shared UI primitives
├── lib/                    # Shared utilities & services
│   ├── agent-firewall/     #   Agent firewall logic
│   ├── guard/              #   Guard analysis engine
│   ├── auth/               #   Auth helpers
│   └── docs/               #   Service documentation data
├── packages/               # SDK packages (monorepo)
│   ├── sdk/                #   TypeScript SDK
│   └── python-sdk/         #   Python SDK
├── prisma/                 # Database schema & migrations
├── workers/                # Background workers
├── scripts/                # Maintenance & CI scripts
├── tests/                  # Test suites (45+, 566+ tests)
├── examples/               # Example integrations
├── .github/workflows/      # CI/CD pipeline
└── docker-compose.prod.yml # Production Docker setup
```

<br />

---

## 🤝 Contributing

We welcome contributions!

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m "Add amazing feature"`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

<br />

---

## 📄 License

SoterAI is **open core**, not MIT. Different parts are licensed differently — see [LICENSING.md](LICENSING.md) for the full map:

- **Core product & server** — [Business Source License 1.1](LICENSE) (source-available; production/SaaS/competing use needs a commercial license from Yash Chauhan; auto-converts to Apache-2.0 on 2030-06-25).
- **Client SDKs & middleware** (`packages/*`) — Apache-2.0, free to integrate.
- **Enterprise modules** — Commercial, all rights reserved.

Copyright © 2026 Yash Chauhan. Contributions require signing the [CLA](CLA.md).

<br />

---
<div align="center">
  <br />
  <a href="https://github.com/yashchauhan66/Ai-Security-Guard">
    <img src="https://img.shields.io/github/stars/yashchauhan66/Ai-Security-Guard?style=for-the-badge&logo=github&logoColor=white&label=⭐%20Star%20us%20on%20GitHub" alt="Star us" />
  </a>
  <br /><br />
  <p>
    <strong>⭐ Star us on GitHub</strong> — it helps developers discover SoterAI and makes AI safer for everyone!
  </p>
  <br />
  <p>
    <a href="https://soterai.publicvm.com">🌐 Website</a> •
    <a href="https://soterai.publicvm.com/docs">📖 Docs</a> •
    <a href="https://soterai.publicvm.com/playground">🎮 Playground</a> •
    <a href="https://soterai.publicvm.com/pricing">💵 Pricing</a> •
    <a href="https://github.com/yashchauhan66/Ai-Security-Guard/issues">🐛 Issues</a> •
    <a href="https://github.com/yashchauhan66/Ai-Security-Guard/discussions">💬 Discussions</a>
  </p>
  <p>
    <sub>Built with ❤️ for the AI security community | Open core (BSL 1.1) | India-first PII detection</sub>
  </p>
</div>
