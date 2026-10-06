# Soter Guard — n8n Community Node Guide (v0.8.7)

[![npm version](https://img.shields.io/npm/v/n8n-nodes-soterai.svg)](https://www.npmjs.com/package/n8n-nodes-soterai)
[![n8n community node](https://img.shields.io/badge/n8n-community%20node-ff6d5a)](https://n8n.io)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

## Overview

The SoterAI n8n node (`n8n-nodes-soterai`) is an enterprise-grade AI security gateway for n8n workflows. It provides real-time defense against prompt injections, jailbreaks, data exfiltration, live secret leaks, and PII exposure across LLM chains, autonomous agents, and RAG pipelines.

- **Package:** `n8n-nodes-soterai`
- **Version:** `0.8.7`
- **npm Registry:** <https://www.npmjs.com/package/n8n-nodes-soterai>
- **Repository:** [packages/integrations/n8n](../../packages/integrations/n8n)

---

## Key Capabilities (v0.8.7)

1. **Version 3 Layout Hierarchy:** Organized into **Resource → Operation** selectors with clean separation of core parameters and a single expandable **Options** collection.
2. **Dual-Branch Routing:** Emits items to either **Safe** (Output 1) or **Flagged** (Output 2). Stopped items automatically prevent downstream nodes on the Safe branch from executing without requiring an IF node.
3. **Triple-Mode Detection Engine:**
   - **Auto (Default):** Cloud-first with graceful fallback to the in-process local pattern engine on transient network issues, timeouts, or 5xx/429 errors.
   - **Cloud:** Full ML-powered inspection with multi-turn conversation correlation, semantic egress comparison, and live attacker reputation tracking.
   - **Local:** 100% offline, zero-network pattern-and-heuristic engine running directly in the n8n Node.js process (ideal for air-gapped or strict data-residency deployments).
4. **Agent Passport Lifecycle:** Native node operations for agent identity enrollment, cryptographic passport issuance, real-time tool authorization verification, and revocation.
5. **Zero-Latency Indian & Global PII Detection:** In-process algorithms for Aadhaar (Verhoeff checksum), PAN, GSTIN, Voter ID/EPIC, UPI, IFSC, US SSN, and Credit Cards (Luhn algorithm).

---

## Installation

### From the n8n GUI (Recommended)

1. Open n8n (v1.x or v2.x).
2. Navigate to **Settings > Community Nodes**.
3. Click **Install a Community Node**.
4. Enter `n8n-nodes-soterai` and confirm installation.
5. Search for **SoterAI** in the workflow canvas node panel.

### From CLI / npm

For n8n 2.x instances:
```bash
mkdir -p ~/.n8n/nodes
cd ~/.n8n/nodes
npm install n8n-nodes-soterai
```

Restart your n8n container or process to load the node.

---

## Credential Setup

1. Log in to [https://soterai.in](https://soterai.in) and grab your API key.
2. In n8n, create a new **SoterAI API** credential.
3. Paste the API key. Authentication uses the `x-api-key` header (never sent as Bearer).
4. **Base URL:** Default is `https://soterai.in`. For self-hosted SoterAI deployments, point to your private endpoint.
5. **Connection Test:** Tests via `POST /api/workflow/audit` with an empty payload — zero quota consumption, no ML false positives, and no audit trail pollution.

> [!NOTE]
> The credential is optional when using **Local** detection mode or **Audit Workflow**; identity enrollment and passport issuance always require it.

---

## Supported Resources & Operations (v3)

| Resource | Operation | Description | Output Branches |
| --- | --- | --- | --- |
| **Guardrail** | **Guard Input** (`inputGuard`) | Pre-LLM firewall. Inspects incoming user messages for prompt injection, jailbreaks, and sensitive data. | Safe / Flagged |
| **Guardrail** | **Guard Output** (`outputGuard`) | Post-LLM DLP. Scans model output before delivering to users or external APIs. Redacts secrets/PII. | Safe / Flagged |
| **Guardrail** | **Universal Firewall** (`universalGuard`) | Multi-layered defense covering prompt input, RAG context, tool execution, memory writes, and data egress. | Safe / Flagged |
| **Guardrail** | **Analyze Text** (`analyzeText`) | Passive risk scoring without automated blocking. Emits score, primary risk type, and category confidence. | Safe / Flagged |
| **Guardrail** | **Redact Secrets or PII** (`piiRedactor`) | High-speed tokenizer redacting credentials, API keys, and PII into masked tokens (e.g. `[REDACTED_SECRET]`). | Clean (or Clean / Redacted) |
| **RAG Document** | **Scan Document** (`ragScanner`) | Ingestion gatekeeper for vector databases. Detects poisoned content, hidden instructions, and exfiltration payloads. | Safe / Flagged |
| **Workflow** | **Audit Workflow** (`workflowAudit`) | Static security posture analyzer for n8n workflows. Scores risk (0-100) and highlights unauthenticated agent access. | Safe / Flagged |
| **Agent Passport** | **Enroll Identity** (`enrollIdentity`) | Registers an agent with least-privilege policy presets (`READ_ONLY`, `CUSTOMER_SUPPORT`, `CODING_AGENT`). | Safe / Flagged |
| **Agent Passport** | **Issue Passport** (`issuePassport`) | Issues a time-bounded cryptographic session passport token (`passportToken`). | Safe / Flagged |
| **Agent Passport** | **Validate Passport** (`validatePassport`) | Real-time verification of session tokens and action permissions before tool execution. | Safe / Flagged |
| **Agent Passport** | **Check Tool Call** (`toolCall`) | Inspects tool arguments, destructive commands, and passport authorization. | Safe / Flagged |
| **Agent Passport** | **Revoke Passport** (`revokePassport`) | Immediately invalidates active passports on completion or security alert. | Safe / Flagged |

---

## Dual-Branch Execution Architecture

Every SoterAI guardrail node exposes two distinct outputs:

```text
                           ┌─ Safe (Output 1) ────► LLM / Agent / Downstream Tools
Inbound Request ─► SoterAI ─┤
                           └─ Flagged (Output 2) ─► Webhook Responder (Blocked) / SIEM Alert
```

### Runtime Isolation Mechanics

When a threat is blocked (`onThreat: BLOCK`):
- **1 item** is routed to **Flagged (Output 2)** with `outputText: ""` and security incident metadata.
- **0 items** are emitted to **Safe (Output 1)**.
- **Execution Safety:** In n8n, downstream nodes wired only to an output that emits zero items **will not run**. This guarantees that unauthorized prompt injections never reach downstream LLM nodes or costly tool executions.

---

## Production Reference Architecture

The repository includes the official enterprise customer support reference template:
[`Production-AI-Customer-Support-Agent-SoterAI.json`](../../Production-AI-Customer-Support-Agent-SoterAI.json)

### Workflow Layout & Execution Flow

```text
1. Customer Chat Webhook (POST /webhook/chat)
      │
      ▼
2. Stage 1: SoterAI Threat Shield (Guard Input, Maximum Protection)
      ├── [Safe] ─────────────────────────────────────────────────────────┐
      │                                                                   ▼
      │                                                 3. OpenAI GPT-4o Support Assistant
      │                                                                   │
      │                                                                   ▼
      │                                                 4. Stage 2: SoterAI Output DLP (Redactor)
      │                                                                   │
      │                                                                   ▼
      │                                                 5. Deliver Safe Response to Customer
      │
      └── [Flagged]
            │
            ▼
      6. Immediate Block Responder ({{ $json.userMessage }})
            │
            ▼
      7. SIEM / Slack Incident Logger
```

---

## Local vs Cloud Detection Comparison

| Security Capability | Cloud Engine | Local Engine (Bundled) |
| --- | :---: | :---: |
| **Network Egress** | Requires HTTPS API | **Zero (100% In-Process)** |
| **Execution Latency** | ~30-70 ms | **< 2 ms** |
| **Known Prompt Injections & Jailbreaks** | Yes (Regex + ML Classifier) | Yes (46+ Regex Heuristics) |
| **Zero-Width & Unicode Homoglyph Evasion** | Yes | Yes (Compiled Normalization) |
| **Secrets & Keys (AWS, OpenAI, GitHub, DB URIs)** | Yes | Yes |
| **Indian PII (Aadhaar, PAN, GSTIN, UPI, Mobile)** | Yes | Yes (Verhoeff Validated) |
| **US PII (SSN, Luhn Credit Cards)** | Yes | Yes (SSA Area Codes & Luhn) |
| **Multi-Turn Semantic Attack Correlation** | Yes | No (Single turn only) |
| **Attacker IP / Key Reputation Scoring** | Yes | No |
| **Cryptographic Agent Passport State** | Yes (Central Vault) | Emulated Local Mode |

---

## Output Data Contract

When branching downstream, use the standardized contract:

```typescript
{
  verdictCode: "ALLOW" | "CONTENT_BLOCKED" | "REPUTATION_THROTTLED" | "TOKEN_MISSING",
  enforcement: {
    outcome: "BLOCKED" | "CONTINUED" | "SKIPPED",
    routedTo: "Safe" | "Flagged"
  },
  outputText: string,          // Sanitized/redacted text (empty when blocked)
  userMessage: string,         // Safe, customer-facing response message
  developerMessage: string,    // Diagnostic reason for security logs
  primaryRiskType: string,     // "PROMPT_INJECTION", "SECRETS", "PII", etc.
  riskScore: number,           // Calculated risk metric
  engine: "cloud" | "local",
  engineDegraded: boolean      // True if Auto mode gracefully fell back to Local
}
```

---

## Verification & Test Suite

The package is thoroughly verified before release:
- **Unit Tests:** 286 automated test cases (`npm run test:unit`)
- **ReDoS Protection:** 164 regex patterns evaluated against 15 adversarial input shapes (`npm run test:redos`)
- **Stress Test:** 24 heavy scenarios processing up to 200,000 characters within millisecond budgets (`npm run test:stress`)
- **Live Docker Testing:** Validated on live n8n 2.x container instances with real prompt attacks and benign interactions.