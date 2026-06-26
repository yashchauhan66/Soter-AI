# Soter Guard — Dify Plugin

Dify plugin that adds AI security tools to your Dify workflows.

## Tools

| Tool | Purpose |
|------|---------|
| **Input Guard** | Check user input for prompt injection and threats |
| **Output Guard** | Check AI output for unsafe content |
| **PII Redactor** | Redact PII and secrets from text |
| **RAG Scanner** | Scan documents before vector DB indexing |

## Installation

1. In Dify, go to **Plugins > Install from local**
2. Upload this directory as a plugin bundle
3. Configure your Soter API key in the provider credentials

## Structure

```
dify/
  manifest.yaml          # Plugin metadata and credentials
  tools/
    input_guard.yaml     # Input guard tool definition
    output_guard.yaml    # Output guard tool definition
    pii_redactor.yaml    # PII redactor tool definition
    rag_scanner.yaml     # RAG scanner tool definition
```

## Credentials

Set these in the Dify plugin configuration:
- **Soter API Key** — your `sk_...` key
- **Base URL** — defaults to `https://api.cybersecurityguard.com`
- **Project ID** — optional
