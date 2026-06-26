# SoterAI for Zapier

SoterAI protects AI chatbots, agents, and workflows from prompt injection, jailbreaks, PII leakage, and unsafe outputs.

This integration brings SoterAI's security scanning directly into your Zapier workflows so every AI interaction is checked automatically.

## Actions

| Action | Key | Description |
|--------|-----|-------------|
| **Check Input for Threats** | `input_guard` | Scan user input for prompt injection, jailbreaks, PII, and other AI security threats before sending to an LLM. |
| **Check AI Output for Threats** | `output_guard` | Scan AI-generated responses for unsafe content, system prompt leakage, and PII before delivering to users. |
| **Redact PII from Text** | `pii_redactor` | Redact personally identifiable information and secrets from any text. Supports partial, full, and hash redaction modes. |
| **Scan RAG Document** | `rag_scanner` | Scan documents for embedded threats before adding them to RAG or vector databases. |
| **Create Incident** | `create_incident` | Log a security incident to the SoterAI dashboard for tracking and review. Requires admin API access. |

## Authentication

SoterAI uses API Key authentication. When you add the integration to a Zap you will be prompted for:

| Field | Required | Description |
|-------|----------|-------------|
| **API Key** | Yes | Your SoterAI API key (starts with `sk_`). |
| **Base URL** | No | Defaults to `https://api.cybersecurityguard.com`. Change only for self-hosted deployments. |
| **Project ID** | No | Default SoterAI project ID applied to all actions unless overridden per-step. |

## Example Zaps

### 1. Safe Chatbot

> Webhook (user message) -> **SoterAI: Check Input** -> OpenAI: Chat -> **SoterAI: Check Output** -> Webhook (response)

Every message is scanned on the way in and the AI response is scanned on the way out.

### 2. PII-Safe Support Ticket

> Zendesk: New Ticket -> **SoterAI: Redact PII** -> Google Sheets: Create Row

Strip PII from support tickets before logging them for analytics.

### 3. Secure RAG Ingestion

> Google Drive: New File -> Extract Text -> **SoterAI: Scan RAG Document** -> Filter (allowed = true) -> Pinecone: Upsert

Only clean documents are added to the vector database.

### 4. Incident Logging

> Any Trigger -> **SoterAI: Check Input** -> Filter (blocked = true) -> **SoterAI: Create Incident**

Automatically log blocked threats to the SoterAI dashboard.

## Local Development

```bash
cd packages/integrations/zapier
npm install
npm run build
npm run validate   # zapier validate
npm run push       # zapier push
```

## Privacy and Security

- All text is sent to the SoterAI API over HTTPS for scanning. No text is stored after analysis unless incident logging is enabled.
- API keys should be treated as secrets. Use Zapier's built-in credential storage.
- See [https://soterai.dev/privacy](https://soterai.dev/privacy) for the full privacy policy.

## Status

Ready for Zapier review.
