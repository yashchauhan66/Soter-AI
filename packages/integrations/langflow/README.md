# Soter Guard — Langflow Component

Python components for Langflow that add AI security to your flows.

## Components

| Component | Purpose |
|-----------|---------|
| **SoterInputGuard** | Check user input for prompt injection, jailbreaks, PII |
| **SoterOutputGuard** | Check AI output for unsafe content before delivery |
| **SoterPiiRedactor** | Redact PII and secrets from text |
| **SoterRagScanner** | Scan documents before adding to vector stores |

## Installation

1. Copy `soter_guard_component.py` to your Langflow custom components directory
2. Restart Langflow
3. The Soter components appear in the sidebar

## Configuration

Each component requires:
- **api_key** — your Soter API key (`sk_...`)
- **base_url** — defaults to `https://api.cybersecurityguard.com`
- **project_id** — optional
- **policy_mode** — MONITOR, BALANCED, or STRICT

## Example Flow

```
[Chat Input] → [SoterInputGuard] → [OpenAI] → [SoterOutputGuard] → [Chat Output]
```

## No External Dependencies

The component uses only Python standard library (`urllib`, `json`) — no pip packages needed.
