# SoterAI for Make.com

SoterAI protects AI chatbots, agents, and workflows from prompt injection, jailbreaks, PII leakage, and unsafe outputs.

This custom app brings SoterAI's security scanning directly into your Make.com scenarios so every AI interaction is checked automatically.

## Modules

| # | Module | Name | Description |
|---|--------|------|-------------|
| 1 | **Check Input for Threats** | `inputGuard` | Scan user input for prompt injection, jailbreaks, PII, and other AI security threats before sending to an LLM. |
| 2 | **Check AI Output for Threats** | `outputGuard` | Scan AI-generated responses for unsafe content, system prompt leakage, and PII before delivering to users. |
| 3 | **Redact PII from Text** | `piiRedactor` | Redact personally identifiable information and secrets from any text. Supports partial, full, and hash redaction modes. |
| 4 | **Scan RAG Document** | `ragScanner` | Scan documents for embedded threats before adding them to RAG or vector databases. |
| 5 | **Analyze Text for Threats** | `analyzeText` | Public text analysis endpoint — detect threats without an API key (rate-limited). Supports INPUT and OUTPUT directions. |
| 6 | **Streaming Guard** | `streamingGuard` | Real-time streaming content inspection with per-chunk risk results. Ideal for live LLM output and progressive input validation. |
| 7 | **Start Agent Session** | `startAgentSession` | Start a new AI agent session with Agent Firewall policy enforcement. |
| 8 | **Check Agent Action** | `agentActionCheck` | Check if an AI agent action (tool call, API request, file access) is allowed by the Agent Firewall policy. |
| 9 | **Check Agent Data Access** | `agentDataCheck` | Check if an AI agent accessing data (RAG context, files, clipboard, etc.) is allowed and detect potential data leaks. |
| 10 | **Check Agent Output** | `agentOutputCheck` | Check AI agent output for sensitive data leakage before delivering to users. |

## Connection Setup

1. In Make.com, go to **Connections** and add a new connection.
2. Select **SoterAI** from the app list (or add it via My Apps if using a custom app).
3. Enter your credentials:

| Field | Required | Description |
|-------|----------|-------------|
| **API Key** | Yes | Your SoterAI API key (starts with `sk_`). |
| **Base URL** | No | Defaults to `https://api.soterai.in`. Change only for self-hosted deployments. |
| **Project ID** | No | Default SoterAI project ID applied to all modules unless overridden per-step. |

> **Note:** Module 5 (Analyze Text) uses the public `/api/guard/analyze` endpoint and does **not** require an API key. It works with or without authentication (rate-limited).

## Example Scenarios

### 1. Webhook -> SoterAI Input Guard -> OpenAI -> SoterAI Output Guard

The most common pattern. Receives a user message via webhook, scans it with Input Guard, sends safe messages to OpenAI, then scans the AI response with Output Guard before returning.

See `scenarios/webhook-guard-openai.json` for a step-by-step reference.

### 2. PII-Safe Data Pipeline

> HTTP: Get Data -> **SoterAI: Redact PII** -> Google Sheets: Add Row

Automatically strip PII from incoming data before storing it.

### 3. Secure RAG Ingestion

> Google Drive: Watch Files -> **SoterAI: Scan RAG Document** -> Router (allowed=true) -> Pinecone: Upsert

Only clean documents are added to your vector database.

### 4. Block and Notify on Threats

> Webhook -> **SoterAI: Check Input** -> Router (allowed=false) -> Slack/Email: Notify

Route blocked threats to a notification channel for review.

### 5. Agent Action Firewall

> Webhook -> **SoterAI: Start Agent Session** -> Agent Tool Call -> **SoterAI: Check Agent Action** -> Router (decision=ALLOW) -> Execute Action

Secure your AI agents by checking every tool call against your Agent Firewall policy.

### 6. Real-Time Streaming Guard

> OpenAI Stream -> **SoterAI: Streaming Guard** -> Router (risk check) -> User

Inspect each chunk of a streaming LLM response in real-time to detect unsafe content early.

## Installation (Custom App)

1. In Make.com, go to **My Apps > Create a new app**
2. Import `app.json` as the app definition
3. Import `modules/actions.json` as the module definitions
4. Configure your SoterAI API key connection

## Files

```
make/
  app.json                              # App metadata and connection config
  modules/
    actions.json                        # All 10 action modules
  scenarios/
    webhook-guard-openai.json           # Example scenario reference
```

## Privacy and Security

- All text is sent to the SoterAI API over HTTPS for scanning. No text is stored after analysis unless incident logging is enabled.
- API keys should be treated as secrets. Use Make.com's built-in connection storage.
- See [https://soterai.in/privacy](https://soterai.in/privacy) for the full privacy policy.

## Status

Ready for Make review.
