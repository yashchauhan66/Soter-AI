# SoterAI Local AI Broker

The Local AI Broker is an authenticated Node.js service that runs on `127.0.0.1` and applies SoterAI request and response controls to AI traffic explicitly routed through it. The default URL is `http://127.0.0.1:47321`.

## Start and control it

From VS Code, use:

- `SoterAI: Start Local AI Broker`
- `SoterAI: Stop Local AI Broker`
- `SoterAI: Restart Local AI Broker`
- `SoterAI: Show Broker Status`
- `SoterAI: Configure AI Broker`
- `SoterAI: Test Broker Protection`

The extension generates a 256-bit token, stores it in VS Code SecretStorage, and starts the broker with the embedded standalone bundle. The broker persists its matching token in its local data directory with restrictive file permissions where the platform supports them. Tokens are never shown in a webview or log. Use the rotate/clear commands to invalidate them.

Standalone development:

```powershell
cd apps/local-ai-broker
npm run build
$env:SOTERAI_BROKER_TOKEN = '<at-least-32-character-local-token>'
$env:SOTERAI_OPENAI_PROVIDER_URL = 'https://api.openai.com/v1/chat/completions'
$env:SOTERAI_PROVIDER_API_KEY = '<provider-key>'
npm start
```

## Protected API

Only `GET /health` is unauthenticated. Every other endpoint requires `Authorization: Bearer <local-token>`.

| Area | Endpoints |
| --- | --- |
| Metadata | `GET /version` |
| Local scanning | `POST /v1/scan`, `/v1/redact`, `/v1/decision` |
| AI proxies | `POST /v1/ai/openai-compatible/chat/completions`, `/v1/ai/anthropic-compatible/messages` |
| Safe Mode | `POST /v1/safe-mode/enable`, `/disable`; `GET /status` |
| Memory | `POST /v1/memory/session/start`, `/event`, `/end`, `/clear`; `GET /v1/memory/session/:id` |
| Audit | `GET /v1/events/recent`, `POST /v1/events/export-redacted` |
| Approvals | `GET/POST /v1/approvals`, `POST /v1/approvals/clear` |
| Auth | `POST /v1/auth/rotate` |

Requests are body-limited, rate-limited, timed out, rejected when a browser `Origin` is present unless explicitly allowed, and returned as structured errors. Streaming proxy responses are not supported in this MVP and are rejected explicitly.

## Data handling

Raw request and response bodies are used transiently for local scanning and provider forwarding. Events and memory contain hashes, decisions, categories, model/provider labels, and redacted evidence only. The MVP event, approval, and memory stores are bounded and process-local; a restart clears them unless the user exported a redacted report. No broker cloud connection is implemented, so there is no SoterAI Cloud call in the prompt path.

See [security model](./local-ai-broker-security-model.md), [limitations](./broker-limitations.md), and [architecture](./local-ai-broker-architecture.md).
