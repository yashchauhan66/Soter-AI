# n8n-nodes-soterai

[![npm version](https://img.shields.io/npm/v/n8n-nodes-soterai.svg)](https://www.npmjs.com/package/n8n-nodes-soterai)
[![n8n community node](https://img.shields.io/badge/n8n-community%20node-ff6d5a)](https://n8n.io)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

SoterAI community node for [n8n](https://n8n.io) -- protect your AI workflows from prompt injection, jailbreaks, PII leakage, and unsafe outputs.

SoterAI is an AI security platform that sits between your users and your LLMs. It analyses every input and output in real time, blocks threats, redacts sensitive data, and records incidents for audit review. This n8n node lets you add that protection to any n8n workflow with drag-and-drop.

## Installation

### From the n8n GUI (recommended)

1. Open your n8n instance.
2. Go to **Settings > Community Nodes**.
3. Enter `n8n-nodes-soterai` and click **Install**.
4. The **SoterAI** node will appear in your node panel.

### From npm

```bash
cd ~/.n8n
npm install n8n-nodes-soterai
```

Restart n8n after installation.

## Credentials Setup

1. Sign up at [https://soterai.in](https://soterai.in) and create a project.
2. Generate an API key from the project dashboard (it starts with `sk_`).
3. In n8n, go to **Credentials > New Credential > SoterAI API**.
4. Paste your API key.
5. Keep the default **Base URL**: `https://soterai.in`.
6. (Optional) Set a default **Project ID** -- this can also be overridden per node.

For self-hosted deployments, replace the Base URL with your own HTTPS SoterAI API endpoint.

Full credential documentation: [https://soterai.in/docs](https://soterai.in/docs)

## Actions

### SoterAI Input Guard

Check user messages for prompt injection, jailbreaks, and other threats **before** they reach the LLM.

| Field | Type | Description |
|-------|------|-------------|
| Input Text | string | The user message to analyse |
| On Threat | BLOCK / REDACT / WARN / CONTINUE | Local behavior when a threat is detected |
| Project ID | string | Optional project override |
| Metadata JSON | string | Optional audit metadata (JSON object) |

### SoterAI Output Guard

Check AI-generated responses for unsafe content, hallucinated PII, or policy violations **before** sending them to users.

| Field | Type | Description |
|-------|------|-------------|
| AI Output Text | string | The AI response to analyse |
| On Threat | BLOCK / REDACT / WARN / CONTINUE | Local behavior when a threat is detected |
| Project ID | string | Optional project override |
| Metadata JSON | string | Optional audit metadata (JSON object) |

### SoterAI PII Redactor

Detect and redact sensitive data (emails, phone numbers, API keys, secrets) from any text.

| Field | Type | Description |
|-------|------|-------------|
| Text | string | The text to scan for PII |
| Project ID | string | Optional project override |
| Metadata JSON | string | Optional audit metadata (JSON object) |

### SoterAI RAG Scanner

Scan documents and text chunks for embedded threats, hidden instructions, or data poisoning **before** adding them to a vector database.

| Field | Type | Description |
|-------|------|-------------|
| Document Text | string | The document or chunk text to scan |
| Document ID | string | Stable identifier used to track the document scan |
| Document Source | API / Email / File Upload / URL / Unknown | Where the document entered the RAG pipeline |
| Project ID | string | Optional project override |
| Metadata JSON | string | Optional audit metadata (JSON object) |

## Output Fields

### Input Guard / Output Guard

| Field | Type | Description |
|-------|------|-------------|
| `allowed` | boolean | Whether the API considers the text safe |
| `blocked` | boolean | Whether the node blocked the item (based on On Threat) |
| `riskScore` | number | Risk score from 0.0 to 1.0 |
| `categories` | string[] | Array of detected risk types |
| `safeText` | string | Redacted/safe version of the text |
| `outputText` | string | The text to use downstream (empty if blocked) |
| `reason` | string | Human-readable explanation |
| `warning` | string | Present when On Threat is WARN |
| `incidentId` | string | Incident ID if one was created |
| `rawResponse` | object | Full API response for advanced use |

### PII Redactor

| Field | Type | Description |
|-------|------|-------------|
| `safeText` | string | Text with PII redacted |
| `detectedEntities` | array | List of detected PII entities with type, label, severity |
| `riskScore` | number | Overall risk score |
| `rawResponse` | object | Full API response |

### RAG Scanner

| Field | Type | Description |
|-------|------|-------------|
| `trustScore` | number | Document trust score from 0.0 to 1.0 |
| `trustLevel` | string | Trust classification (e.g. `TRUSTED`, `NEEDS_REVIEW`, `UNTRUSTED`) |
| `findings` | array | List of issues found in the document |
| `recommendedAction` | string | Suggested action (e.g. `ALLOW`, `REVIEW`, `REJECT`) |
| `rawResponse` | object | Full API response |

## Example Workflow

An importable example workflow is included at `examples/protected-chatbot-workflow.json`.

The workflow implements a protected chatbot pattern:

```
[Webhook] -> [SoterAI Input Guard] -> [IF blocked?]
                                          |-- Yes -> [Reply: "Blocked"]
                                          |-- No  -> [OpenAI Chat] -> [SoterAI Output Guard] -> [Reply]
```

To import: in n8n, go to **Workflows > Import from File** and select the JSON file.

## Privacy and Security

- **API keys** are stored in n8n's encrypted credential store and are never logged or exposed in workflow outputs.
- **All security analysis** happens server-side via the SoterAI policy engine. No user data is analysed locally.
- **Nodes are stateless connectors** -- no user data, messages, or documents are stored locally by the node.
- **Network traffic** uses HTTPS exclusively. The node communicates only with your configured SoterAI API endpoint.
- **No telemetry** is collected by this node.

## Resources

- [SoterAI Documentation](https://soterai.in/docs)
- [n8n Integration Guide](https://soterai.in/docs)
- [SoterAI Dashboard](https://soterai.in)
- [Privacy Policy](https://soterai.in/privacy)
- [Terms of Service](https://soterai.in/terms)
- [Pricing](https://soterai.in/pricing)
- [Status](https://soterai.in/status)
- [Support](https://soterai.in/support)
- [GitHub Repository](https://github.com/yashchauhan66/Soter-AI/tree/main/packages/integrations/n8n)
- [npm Package](https://www.npmjs.com/package/n8n-nodes-soterai)

## Support

- **Email**: support@soterai.dev
- **GitHub Issues**: [https://github.com/yashchauhan66/Soter-AI/issues](https://github.com/yashchauhan66/Soter-AI/issues)
- **Documentation**: [https://soterai.in/docs](https://soterai.in/docs)

## License

[MIT](LICENSE)
