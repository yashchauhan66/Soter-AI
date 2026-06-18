# Data Egress Firewall

## What it does
Scans any content before it leaves the local/internal environment via `/api/agent/data/check`. It inspects both *what* the data is (secrets, PII, keys, .env content) and *where* it is going (`local`, `internal`, `external`, `unknown`).

## Why it matters
Most agent data leaks are not malicious code — they are an agent helpfully pasting an API key, database URL, or customer PAN/Aadhaar into an external form, email, or API call. Classifying content alone is not enough; the destination decides the verdict.

## API example
```http
POST /api/agent/data/check
x-api-key: cybsg_live_...
Content-Type: application/json

{
  "sessionId": "agent_sess_...",
  "content": "Here is the prod connection string postgres://user:pass@db.internal/app",
  "source": "terminal",
  "destination": "external",
  "target": "https://unknown-webhook.example"
}
```
Response:
```json
{
  "decision": "BLOCK",
  "riskLevel": "CRITICAL",
  "reason": "Database URL must not leave the internal environment.",
  "safeContent": "Here is the prod connection string [REDACTED_DB_URL]",
  "findings": [{ "type": "SECRET_DETECTED", "label": "Database URL" }],
  "redactions": ["Database URL"]
}
```

## SDK example
```ts
const egress = await firewall.checkDataEgress({
  sessionId,
  content: outboundPayload,
  source: "rag_context",
  destination: "external",
  target: "https://partner-api.example.com",
});
if (egress.decision === "BLOCK") throw new Error(egress.reason);
const safe = egress.safeContent ?? outboundPayload;
```

## Security behavior
- Detects OpenAI/Anthropic/Groq/generic API keys, JWTs, database URLs, passwords, OTPs, private keys, SSH keys, session cookies, `.env` content, client secrets, Aadhaar/PAN/GSTIN/UPI/IFSC, bank data, phones, emails, and private document excerpts.
- Destination logic: secret → external = `BLOCK`; PII → unknown site = `ASK_APPROVAL`/`BLOCK`; redacted PII → allowlisted domain = `ALLOW`; public summary → internal tool = `ALLOW`.
- Only redacted content is stored or logged. Raw secrets are never persisted.

## Common mistakes
- Calling this only on `external` destinations — call it on `unknown` too; unknown is treated as untrusted.
- Sending `safeContent` to a logger but the raw `content` to the destination. Always forward `safeContent`.
- Skipping egress checks for "internal" tools that actually proxy to third parties.

## Test examples
- OpenAI key to external destination → `BLOCK`.
- Database URL to external destination → `BLOCK`.
- PAN/Aadhaar to unknown site → `BLOCK`/`ASK_APPROVAL`.
- Redacted PII to allowed domain → `ALLOW`.
- Public summary → `ALLOW`.
