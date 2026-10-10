# SoterAI Guard

SoterAI Guard provides scanning, recognized-value redaction and policy decisions for inputs and outputs submitted through configured integrations. Supported developer, browser, automation and API routes have different coverage. An independent tool can bypass cooperative checks; detector results do not establish complete confidentiality or an OS egress allowlist.

Core capabilities:

- Input guard for secrets, PII, source code, credentials, and prompt injection attempts.
- Output guard for accidental leakage, unsafe generated content, and policy violations.
- Redaction and human-review decisions for workflows that need controlled exceptions.
- API, JavaScript SDK, webhook, n8n, Zapier, Make, Botpress, Dify, Flowise, Langflow, browser extension, and IDE integration paths.
- Privacy-focused browser extension behavior with local scanning where supported and metadata-only audit payloads by default.
- Enterprise controls for enrollment, emergency lockdown, audit events, SIEM webhooks, and policy bundles.

SoterAI is built for teams adopting AI assistants, coding agents, browser copilots, and workflow builders while needing stronger control over confidential data. It helps security, engineering, and operations teams reduce accidental exposure without blocking normal AI adoption.

Recommended use cases:

- Review recognized credential patterns and accepted protected-source rules on managed context paths before sharing.
- Redact supported customer or employee data patterns, while reviewing unmarked private information separately.
- Add guardrails to n8n, Zapier, Make, Botpress, Dify, Flowise, and Langflow workflows.
- Apply request policy on supported browser destinations and configured coding-tool routes; arbitrary process egress is outside that integration.
- Send sanitized audit events to security dashboards and SIEM pipelines.

For the VS Code same-user threat model, setup, encrypted storage and synthetic checks are operational/scoped evidence. Selected-architecture **G1–G6 remain UNTESTED and the full claim is BLOCKED**; separate-account deployment is **DEFERRED**. Native agents, original buffers/tabs, clipboard/capture, reachable keys/history and independent network routes are outside extension mediation. See [IDE limitations](../ide-guard-limitations.md).

