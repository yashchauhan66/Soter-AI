# SoterAI Guard — API Reference

**Base URL:** `https://api.soterai.com`
**Auth:** `x-api-key: <your-api-key>` header on all requests

## POST /api/guard/input
Scan user input before it reaches your agent.

**Request:**
```json
{ "text": "string (required, max 20000 chars)", "projectId": "string (optional)" }
```

**Response (safe):**
```json
{ "decision": "ALLOW", "confidence": 0.95, "reason": null }
```

**Response (attack detected):**
```json
{ "decision": "BLOCK", "confidence": 0.99, "reason": "Prompt injection detected", "matchedRules": ["INJECTION_001"] }
```

## POST /api/guard/output
Scan agent output before returning to user.

**Request:**
```json
{ "text": "string (required)", "projectId": "string (optional)" }
```

**Response:** Same format as /api/guard/input.

## POST /api/agent/scan
Full agent behavior scan (input + output + tool calls).

**Request:**
```json
{
  "text": "string",
  "toolCalls": [{ "name": "string", "arguments": {} }],
  "projectId": "string (optional)"
}
```

## Rate Limits
- Default: 60 requests/minute per API key
- Headers: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`
- On 429: Response includes `Retry-After` header

## Error Format
```json
{ "error": true, "message": "Description of what went wrong", "code": "ERROR_CODE" }
```

Common codes:
- `UNAUTHORIZED` — Invalid or missing API key
- `RATE_LIMITED` — Too many requests
- `VALIDATION_ERROR` — Invalid request body
- `FORBIDDEN` — API key lacks permission for this project

## Webhook Events
See [Webhooks Guide](./webhooks.md) for event types and signature verification.