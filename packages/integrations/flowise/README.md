# Soter Guard — Flowise Integration

Custom Flowise nodes that add AI security to your chatbot flows.

## Nodes

| Node | Purpose |
|------|---------|
| **Soter Input Guard** | Check user input before LLM processing |
| **Soter Output Guard** | Check AI output before sending to users |
| **Soter PII Redactor** | Redact PII and secrets from any text |

## Installation

1. Copy `src/SoterInputGuard.ts` to your Flowise `packages/components/nodes/` directory
2. Restart Flowise
3. The Soter nodes appear in the **Security** category

## Configuration

Each node requires:
- **Soter API Key** — your `sk_...` key from the Soter dashboard
- **Base URL** — defaults to `https://api.cybersecurityguard.com`
- **Project ID** — optional
- **Policy Mode** — MONITOR, BALANCED, or STRICT
- **On Threat** — BLOCK, REDACT, WARN, or CONTINUE

## Example Flow

```
[Chat Input] → [Soter Input Guard] → [ChatOpenAI] → [Soter Output Guard] → [Chat Output]
```

The Input Guard checks user messages for prompt injection and jailbreaks.
The Output Guard checks AI responses for unsafe content and PII leakage.
