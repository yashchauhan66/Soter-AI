# Soter Guard — Zapier Integration

Zapier actions for Soter Guard AI security.

## Actions

| Action | Purpose |
|--------|---------|
| **Check Input for Threats** | Scan user input before LLM processing |
| **Check AI Output for Threats** | Scan AI responses before delivery |
| **Redact PII from Text** | Redact PII and secrets from any text |

## Local Development

```bash
cd packages/integrations/zapier
npm install
npm run build
zapier test    # requires Zapier CLI
zapier push    # publish to Zapier
```

## Authentication

Uses API Key auth via the `x-api-key` header. Configure:
- **API Key** — your Soter `sk_...` key
- **Base URL** — defaults to `https://api.cybersecurityguard.com`
- **Project ID** — optional default project
