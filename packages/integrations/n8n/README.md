# Soter Guard — n8n Integration

Add AI security to your n8n workflows with drag-and-drop nodes.

## Actions

| Action | Purpose |
|--------|---------|
| **Input Guard** | Check user messages for prompt injection, jailbreaks, PII before LLM |
| **Output Guard** | Check AI responses for unsafe content before sending to users |
| **PII Redactor** | Redact sensitive data (emails, phone numbers, secrets) from text |
| **RAG Scanner** | Scan documents/chunks before adding to vector databases |

## Installation

### Community Node (recommended)

1. In n8n, go to **Settings > Community Nodes**
2. Install `@soter/n8n-nodes-soter-guard`
3. The **Soter Guard** node appears in your node panel

### Manual Install

```bash
cd ~/.n8n
npm install @soter/n8n-nodes-soter-guard
# Restart n8n
```

### From Source

```bash
cd packages/integrations/n8n
npm install
npm run build
# Copy dist/ to ~/.n8n/custom-nodes/
```

## Setup

1. Get your API key from the [Soter Dashboard](https://app.cybersecurityguard.com)
2. In n8n, add a **Soter Guard** node
3. Create credentials: paste your API key and (optionally) your project ID
4. Select an action and configure the fields

## Example: Protected Chatbot

```
[Webhook] → [Soter Input Guard] → [IF blocked?]
                                      ├─ Yes → [Reply: "Blocked"]
                                      └─ No  → [OpenAI Chat] → [Soter Output Guard] → [Reply]
```

See `examples/protected-chatbot-workflow.json` for an importable workflow.

## Fields

### Input Guard / Output Guard
- **Text** — the message or AI response to check
- **Policy Mode** — MONITOR (log only), BALANCED (default), STRICT (block aggressively)
- **On Threat** — BLOCK, REDACT, WARN, or CONTINUE
- **Project ID** — optional override
- **Metadata JSON** — optional audit metadata

### Output
- `allowed` — boolean
- `blocked` — boolean (based on onThreat setting)
- `riskScore` — 0.0 to 1.0
- `categories` — array of risk types detected
- `safeText` — redacted/safe version of the text
- `reason` — human-readable explanation
- `rawResponse` — full API response

## Security

- API keys are stored in n8n's encrypted credential store
- Keys are never logged or exposed in workflow outputs
- All security analysis happens server-side via Soter's policy engine
- Nodes are stateless connectors — no user data is stored locally
