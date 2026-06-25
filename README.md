<div align="center">
  <img src="https://raw.githubusercontent.com/yashchauhan66/Ai-Security-Guard/main/public/logo.png" alt="SoterAI Logo" width="280" />
  
  # SoterAI — AI Security Command Layer
  
  **Secure your AI agents, chatbots, and RAG applications from prompt injection, data leakage, and agent abuse using defense-in-depth.**
  
  <p align="center">
    <a href="https://soterai.publicvm.com"><img src="https://img.shields.io/badge/Live%20Demo-soterai.publicvm.com-31d7c8?style=for-the-badge&logo=vercel&logoColor=white" alt="Live Demo" /></a>
    <a href="https://soterai.publicvm.com/docs"><img src="https://img.shields.io/badge/Docs-31d7c8?style=for-the-badge&logo=gitbook&logoColor=white" alt="Documentation" /></a>
    <a href="https://soterai.publicvm.com/playground"><img src="https://img.shields.io/badge/Playground-31d7c8?style=for-the-badge&logo=react&logoColor=white" alt="Playground" /></a>
  </p>
  
  <p align="center">
    <img src="https://img.shields.io/github/actions/workflow/status/yashchauhan66/Ai-Security-Guard/ci-cd.yml?branch=main&style=flat-square&logo=githubactions&logoColor=white&label=CI%2FCD" alt="CI/CD" />
    <img src="https://img.shields.io/github/last-commit/yashchauhan66/Ai-Security-Guard/main?style=flat-square&logo=git&logoColor=white" alt="Last Commit" />
    <img src="https://img.shields.io/github/license/yashchauhan66/Ai-Security-Guard?style=flat-square" alt="License" />
    <img src="https://img.shields.io/badge/Next.js-15.5-black?style=flat-square&logo=next.js&logoColor=white" alt="Next.js" />
    <img src="https://img.shields.io/badge/TypeScript-5.7-3178C6?style=flat-square&logo=typescript&logoColor=white" alt="TypeScript" />
    <img src="https://img.shields.io/badge/PostgreSQL-16-4169E1?style=flat-square&logo=postgresql&logoColor=white" alt="PostgreSQL" />
    <img src="https://img.shields.io/badge/Prisma-5.22-2D3748?style=flat-square&logo=prisma&logoColor=white" alt="Prisma" />
    <img src="https://img.shields.io/badge/Docker-2496ED?style=flat-square&logo=docker&logoColor=white" alt="Docker" />
    <img src="https://img.shields.io/badge/OWASP%20LLM%20Top%2010-Compliant-brightgreen?style=flat-square" alt="OWASP" />
  </p>
  
  <br />
  
  **[✨ Features](#-key-features) • [🚀 Quick Start](#-quick-start) • [📋 Services](#-services-overview) • [🏗️ Architecture](#️-architecture) • [🐳 Deployment](#-deployment) • [🧪 Testing](#-testing)**
  
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

With **32 specialized security services** organized across 6 layers of defense — Monitor, Protect, Detect, Control, Compliance, and Manage — SoterAI provides comprehensive protection for production AI systems.

> **⭐ Production-ready** — Used in production with 1M+ guarded requests, Docker & EC2 deployment, and full CI/CD pipeline.

<br />

---

## ✨ Key Features

### 🛡️ 6 Layers of AI Security

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
| **REST API** | `https://api.soterai.com/v1/*` | ✅ Stable |

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
| 🧪 **Tests** | 40+ test suites covering all security services |
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
# Run all tests (40+ test suites)
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

# Full verification
npm run verify
```

Test suites cover: auth, guard, agent-firewall, agent-passports, intent verification, tool chain, escrow, dry-run, semantic egress, evidence vault, canary network, RAG, SLM evaluation, billing, webhooks, retention, and more.

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
├── tests/                  # Test suites (40+)
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

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.

<br />

---

<div align="center">
  <p>
    <strong>⭐ Star us on GitHub</strong> — it helps others discover SoterAI!
  </p>
  <p>
    <a href="https://soterai.publicvm.com">🌐 Website</a> •
    <a href="https://soterai.publicvm.com/docs">📖 Docs</a> •
    <a href="https://soterai.publicvm.com/playground">🎮 Playground</a> •
    <a href="https://soterai.publicvm.com/demo">🖥️ Demo</a> •
    <a href="https://soterai.publicvm.com/pricing">💵 Pricing</a>
  </p>
  <p>
    <sub>Built with ❤️ for the AI security community</sub>
  </p>
</div>
