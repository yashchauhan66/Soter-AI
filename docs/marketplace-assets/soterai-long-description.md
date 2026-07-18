# SoterAI Guard

SoterAI Guard adds a security layer for AI usage across developer tools, browser AI apps, automation platforms, and API-based products. It scans prompts, files, workflow inputs, and model outputs for sensitive data and risky instructions before they leave the user or organization boundary.

Core capabilities:

- Input guard for secrets, PII, source code, credentials, and prompt injection attempts.
- Output guard for accidental leakage, unsafe generated content, and policy violations.
- Redaction and human-review decisions for workflows that need controlled exceptions.
- API, JavaScript SDK, webhook, n8n, Zapier, Make, Botpress, Dify, Flowise, Langflow, browser extension, and IDE integration paths.
- Privacy-focused browser extension behavior with local scanning where supported and metadata-only audit payloads by default.
- Enterprise controls for enrollment, emergency lockdown, audit events, SIEM webhooks, and policy bundles.

SoterAI is built for teams adopting AI assistants, coding agents, browser copilots, and workflow builders while needing stronger control over confidential data. It helps security, engineering, and operations teams reduce accidental exposure without blocking normal AI adoption.

Recommended use cases:

- Block API keys, database credentials, private keys, and `.env` files before users paste them into AI tools.
- Redact sensitive customer or employee data before AI processing.
- Add guardrails to n8n, Zapier, Make, Botpress, Dify, Flowise, and Langflow workflows.
- Enforce AI egress policy for browser-based AI destinations and coding platforms.
- Send sanitized audit events to security dashboards and SIEM pipelines.

