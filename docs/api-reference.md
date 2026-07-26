# SoterAI Guard - API Reference

**Base URL:** `https://api.soterai.com`
**Auth:** `x-api-key: <your-api-key>` header on authenticated requests
**API version:** `v1`
**OpenAPI:** `GET /api/openapi` or `docs/api/openapi.v1.json`

All JSON responses include `X-SoterAI-API-Version: v1` and
`X-SoterAI-Contract-Version: 2026-07-26`. Official SDKs send
`X-SoterAI-API-Version: v1` and fail closed if a server explicitly returns an
incompatible API version.

## POST /api/guard/input

Scan user input before it reaches your agent or model.

**Request:**

```json
{
  "message": "string (required, max 20000 chars)",
  "userId": "string (optional)",
  "sessionId": "string (optional)",
  "providerName": "string (optional)",
  "modelName": "string (optional)",
  "metadata": { "projectId": "string (optional)" }
}
```

**Response:**

```json
{
  "allowed": false,
  "action": "BLOCK",
  "decision": "BLOCK",
  "riskScore": 90,
  "riskTypes": ["PROMPT_INJECTION"],
  "reason": "Prompt injection detected.",
  "safeText": null,
  "redactedText": null,
  "findings": []
}
```

## POST /api/guard/output

Scan model output before returning it to the user.

**Request:**

```json
{
  "aiResponse": "string (required, max 20000 chars)",
  "userId": "string (optional)",
  "sessionId": "string (optional)",
  "providerName": "string (optional)",
  "modelName": "string (optional)",
  "metadata": { "projectId": "string (optional)" }
}
```

**Response:** Same public guard result shape as `/api/guard/input`.

## POST /api/guard/analyze

Analyze text in an explicit direction. This endpoint is public and IP
rate-limited; authenticated production integrations should prefer
`/api/guard/input` and `/api/guard/output`.

**Request:**

```json
{ "text": "string (required, max 20000 chars)", "direction": "INPUT" }
```

## Agent, RAG, MCP, Lineage, Memory, and Compliance

The official SDK routes these public methods through the v1 OpenAPI contract:

| SDK method | Endpoint |
| --- | --- |
| `guard.agentAction()` | `POST /api/agent/action/check` |
| `guard.toolCall()` | `POST /api/agent/tool/check` |
| `guard.scanMcpTools()` | `POST /api/agent/mcp/scan` |
| `guard.rag()` / `guard.scoreRagDocument()` | `POST /api/rag/document/trust-score` |
| `guard.getAgentReplay(sessionId)` | `GET /api/agent/replay/{sessionId}` |
| `guard.registerContextSource()` | `POST /api/lineage/source/register` |
| `guard.checkContextFlow()` | `POST /api/lineage/flow/check` |
| `guard.listMcpDrifts()` | `GET /api/mcp/drifts` |
| `guard.getOwaspLlm2025Report()` | `GET /api/compliance/owasp-llm-2025` |
| `guard.getOwaspAgentic2026Report()` | `GET /api/compliance/owasp-agentic-2026` |

Use `npm run validate:api-contract` to ensure the SDK route map and OpenAPI
contract stay aligned.

## Rate Limits

- Default: 60 requests/minute per API key for authenticated guard calls
- Headers: `X-RateLimit-Limit`, `X-RateLimit-Remaining`
- On 429: response includes `Retry-After`

## Error Format

```json
{ "error": true, "message": "Description of what went wrong", "code": "ERROR_CODE" }
```

Common codes:

- `auth_error` - Invalid, missing, or inactive API key
- `rate_limited` - Too many requests
- `validation_error` - Invalid request body
- `api_version_unsupported` - SDK received an explicit incompatible API version
- `guard_error` - Unexpected non-auth/non-validation request failure

## Webhook Events

See [Webhooks Guide](./webhooks.md) for event types and signature verification.
