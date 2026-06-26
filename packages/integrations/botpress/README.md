# Soter Guard — Botpress Integration

Botpress actions for AI security using Soter Guard.

## Actions

| Action | Purpose |
|--------|---------|
| **Check Input** | Scan user message for threats before processing |
| **Check Output** | Scan AI response for unsafe content before sending |

## Installation

1. Build: `npm run build`
2. In Botpress Studio, add this as a custom integration
3. Configure your Soter API key

## Configuration

- **apiKey** — your Soter `sk_...` key (stored as secret)
- **baseUrl** — defaults to `https://api.cybersecurityguard.com`
- **projectId** — optional
- **policyMode** — MONITOR, BALANCED, or STRICT

## Example Botpress Flow

```
[User Message] → [Execute: Soter Check Input]
    → if blocked → [Say: "Request blocked"]
    → else → [AI Task] → [Execute: Soter Check Output] → [Say: safe response]
```
