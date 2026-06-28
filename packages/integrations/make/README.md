# SoterAI for Make.com

SoterAI protects AI chatbots, agents, and workflows from prompt injection, jailbreaks, PII leakage, and unsafe outputs.

This custom app brings SoterAI's security scanning directly into your Make.com scenarios so every AI interaction is checked automatically.

## Modules

| Module | Name | Description |
|--------|------|-------------|
| **Check Input for Threats** | `inputGuard` | Scan user input for prompt injection, jailbreaks, PII, and other AI security threats before sending to an LLM. |
| **Check AI Output for Threats** | `outputGuard` | Scan AI-generated responses for unsafe content, system prompt leakage, and PII before delivering to users. |
| **Redact PII from Text** | `piiRedactor` | Redact personally identifiable information and secrets from any text. Supports partial, full, and hash redaction modes. |
| **Scan RAG Document** | `ragScanner` | Scan documents for embedded threats before adding them to RAG or vector databases. |

## Connection Setup

1. In Make.com, go to **Connections** and add a new connection.
2. Select **SoterAI** from the app list (or add it via My Apps if using a custom app).
3. Enter your credentials:

| Field | Required | Description |
|-------|----------|-------------|
| **API Key** | Yes | Your SoterAI API key (starts with `sk_`). |
| **Base URL** | No | Defaults to `https://soterai.publicvm.com`. Change only for self-hosted deployments. |
| **Project ID** | No | Default SoterAI project ID applied to all modules unless overridden per-step. |

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
    actions.json                        # All 4 action modules
  scenarios/
    webhook-guard-openai.json           # Example scenario reference
```

## Privacy and Security

- All text is sent to the SoterAI API over HTTPS for scanning. No text is stored after analysis unless incident logging is enabled.
- API keys should be treated as secrets. Use Make.com's built-in connection storage.
- See [https://soterai.dev/privacy](https://soterai.dev/privacy) for the full privacy policy.

## Status

Ready for Make review.
