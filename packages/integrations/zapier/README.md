# SoterAI for Zapier

SoterAI protects AI chatbots, agents, and workflows from prompt injection, jailbreaks, PII leakage, and unsafe outputs.

This integration brings SoterAI's security scanning directly into your Zapier workflows so every AI interaction is checked automatically.

## Actions

| Action | Key | Description |
|--------|-----|-------------|
| **Check Input Safety** | `input_guard` | Scan user input for prompt injection, jailbreaks, PII, and other AI security threats before sending to an LLM. |
| **Check Output Safety** | `output_guard` | Scan AI-generated responses for unsafe content, system prompt leakage, and PII before delivering to users. |
| **Redact PII From Text** | `pii_redactor` | Redact personally identifiable information and secrets from any text. Supports partial, full, and hash redaction modes. |
| **Scan RAG Document** | `rag_scanner` | Scan documents for embedded threats before adding them to RAG or vector databases. |
| **Analyze Text for Threats** | `analyze_text` | Public analysis endpoint — detect threats in either direction without an API key (rate-limited). |
| **Streaming Guard** | `streaming_guard` | Inspect streamed or chunked LLM content, with per-chunk results plus the highest risk score and the first risky chunk index. |
| **Universal Guard (All Layers)** | `universal_guard` | Input and output in one step, returning one combined verdict under a protection profile (Balanced / Strict / Maximum). |
| **Audit Workflow for AI Security Risks** | `workflow_audit` | Static OWASP-LLM audit of an exported workflow — security score, findings, quick wins, and where to place SoterAI. |
| **Start Agent Session** | `start_agent_session` | Open an Agent Firewall session so the agent checks below share one policy context and one audit trail. |
| **Check Agent Action** | `agent_action_check` | Ask whether an AI-initiated action — tool call, API request, file write — is allowed. Put this before any step that acts on the world. |
| **Check Agent Data Access** | `agent_data_check` | Check data an agent is reading (RAG context, files, clipboard) and detect exfiltration toward external destinations. |
| **Check Agent Output** | `agent_output_check` | Check agent output for sensitive data leakage before it is sent, posted, or written. |

These are the same 12 operations the n8n node and the Make app expose. Pick a
platform on workflow ergonomics, not on which one carries the guard you need.

> **Analyze Text** uses the public `/api/guard/analyze` endpoint and works
> without an API key, so you can wire it up before a key is issued.

### Reading the result

`Check Input Safety`, `Check Output Safety`, and `Universal Guard` return
`primaryRiskType` alongside `categories`. Filter on `primaryRiskType`, not on the
first element of `categories` — that array is ordered by which detector ran
first, which is how a SQL payload ends up looking like a prompt injection.
`categoryConfidence` gives the per-category score behind that choice, and
`latencyMs` is the server-side processing time for the call.

On the agent actions, filter on `allowed` rather than on `decision`:
`ASK_APPROVAL` means a human still has to decide, and `allowed` is already false
for it.

## Authentication

SoterAI uses API Key authentication. When you add the integration to a Zap you will be prompted for:

| Field | Required | Description |
|-------|----------|-------------|
| **API Key** | Yes | Your SoterAI API key (starts with `sk_`). |
| **Base URL** | No | Defaults to `https://soterai.in`. Change only for self-hosted deployments. |
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

> Any Trigger -> **SoterAI: Check Input** -> Filter (blocked = true) -> **SoterAI: Check Output**

Automatically verify blocked threats are handled safely.

### 5. Agent With an Approval Gate

> Trigger -> **SoterAI: Start Agent Session** -> AI step -> **SoterAI: Check Agent Action** -> Filter (allowed = true) -> Gmail: Send Email

The Zap only sends the email if the Agent Firewall permits that action in this
session's context. Passing the Session ID through keeps every check on one audit
trail instead of four unrelated ones.

### 6. One-Step Guard

> Webhook -> OpenAI: Chat -> **SoterAI: Universal Guard** (Input Text + AI Output Text) -> Filter (allowed = true) -> Webhook

Both directions in a single step when you would rather not maintain two.

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
- See [https://soterai.in/privacy](https://soterai.in/privacy) for the full privacy policy.
- Terms of Service: [https://soterai.in/terms](https://soterai.in/terms)
- Support: support@soterai.in

## Status

Published on the Zapier marketplace. The 8 actions added beyond the original 4
are in this working tree but have **not** been pushed to Zapier yet — run
`npm run validate` and `npm run push` to publish them.
