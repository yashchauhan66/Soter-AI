# Soter Guard — n8n Community Node Guide

## Overview

The SoterAI n8n node (`n8n-nodes-soterai`) is published in the n8n community node registry. It adds AI security to any n8n workflow with drag-and-drop: check user inputs for prompt injection, scan AI outputs for unsafe content, redact PII, scan RAG documents, and audit workflow security posture.

No separate package install is needed — install the node directly from n8n.

## Direct Node Link

- n8n community node registry: `n8n-nodes-soterai`
- npm page: <https://www.npmjs.com/package/n8n-nodes-soterai>

## Install from n8n (recommended)

1. Open n8n.
2. Go to **Settings > Community Nodes**.
3. Click **Install a Community Node** and enter `n8n-nodes-soterai`, or find SoterAI in the community node list.
4. Restart n8n if your instance requires it.
5. Search for **SoterAI** in the node panel.

## Set Up Credentials

1. Open <https://soterai.in> and create or select a project.
2. Create a SoterAI API key.
3. In n8n, create a new **SoterAI API** credential.
4. Paste the API key. n8n stores it in its encrypted credential store.
5. Keep **Base URL** as `https://soterai.in` unless you operate a self-hosted SoterAI API. HTTPS is required except for `http://localhost` local development.
6. Optionally set a default **Project ID**. Each node can override it.

Do not paste real production secrets into test workflows. Use fake values such as `sk-test-1234567890abcdef`.

## Supported Operations

| Operation | Purpose |
| --- | --- |
| Universal AI Firewall (Best Protection) | Recommended one-node protection for AI workflows. Checks prompt injection, jailbreaks, PII/secrets, RAG context, tool calls, memory operations, AI output, and semantic data egress. |
| Guard Input | Check inbound prompts before an AI app receives them. Supports Block, Redact, Warn, or Continue. |
| Guard Output | Check AI-generated output before sending, saving, or responding with it. Supports Block, Redact, Warn, or Continue. |
| Redact Secrets or PII | Detect and redact sensitive strings such as emails, phone-like values, API keys, and secrets. |
| Get RAG Risk Summary | Scan a document or chunk and return `trustScore`, `trustLevel`, findings, and a recommended action. |
| Audit n8n Workflow Security | Score an exported n8n workflow for AI Agent, tool, webhook, Code node, memory, RAG, credential, and output-egress risks. |
| Analyze Text | Analyze a text field and return `allowed`, `riskScore`, `categories`, `reason`, and safe text without local blocking. |

## Recommended Workflow Pattern

```
[Webhook Trigger]
    → [SoterAI: Universal AI Firewall (Maximum Protection, On Threat: BLOCK)]
        ├─ Safe → [LLM: OpenAI/Anthropic/Ollama]
        │         → [SoterAI: Universal AI Firewall (AI Output Text = response)]
        │             ├─ Safe → [Respond / Tool / Memory]
        │             └─ Flagged → [Respond: "Blocked for security"]
        └─ Flagged → [Respond: {{ $json.userMessage }}]
```

The node has **Safe** and **Flagged** outputs and routes items itself — no IF node is required to act on a verdict. Use `{{ $json.outputText }}` downstream; it holds the cleaned or redacted value.

## Example Workflows

The package includes importable workflows in `examples/`:

- `soterai-basic-analyze.workflow.json` — Manual Trigger → SoterAI Analyze Text → IF High Risk.
- `soterai-guard-input-webhook.workflow.json` — Webhook → SoterAI Guard Input → IF Risk High → Respond to Webhook.
- `soterai-guard-output.workflow.json` — Manual Trigger → AI Output Text → SoterAI Guard Output → Save Safe Output.
- `soterai-secret-pii-redaction.workflow.json` — Manual Trigger → SoterAI Redact Secrets or PII → IF Secrets Found → Safe Output.
- `soterai-error-handling.workflow.json` — Manual Trigger → SoterAI Invalid Input with continueOnFail → Error branch.
- `soterai-universal-ai-firewall.workflow.json` — Webhook → SoterAI Universal AI Firewall → blocked/allowed response branches.
- `soterai-security-context-templates.workflow.json` — Manual Trigger → Set Security Context JSON → SoterAI Universal AI Firewall.
- `soterai-workflow-security-audit.workflow.json` — Manual Trigger → SoterAI Audit n8n Workflow Security → posture report.

See the full README in [`packages/integrations/n8n/README.md`](../../packages/integrations/n8n/README.md) for output fields, security context templates, and error handling.