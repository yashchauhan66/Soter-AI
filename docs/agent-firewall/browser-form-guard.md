# Browser Agent Form Guard

## What it does
Checks a browser form before the agent submits it via `/api/agent/browser/form/check`. It inspects the field names/types/values and the visible page text, and returns one of `ALLOW`, `REDACT`, `ASK_APPROVAL`, `BLOCK`, or `TAKEOVER_REQUIRED`.

## Why it matters
Browser/computer-use agents type into and submit live web forms. A form can request a password or OTP, exfiltrate a pasted API key, or contain an injected instruction in the page text telling the agent to ignore its rules. Form Guard stops the submit before it happens.

## API example
```http
POST /api/agent/browser/form/check
x-api-key: cybsg_live_...

{
  "sessionId": "agent_sess_...",
  "url": "https://example.com/login",
  "domain": "example.com",
  "formFields": [
    { "name": "username", "value": "user@example.com", "type": "email" },
    { "name": "password", "value": "hunter2", "type": "password" }
  ],
  "pageText": "Sign in to continue",
  "destination": "external"
}
```
Response:
```json
{
  "decision": "TAKEOVER_REQUIRED",
  "riskLevel": "CRITICAL",
  "reason": "Human takeover required for password, OTP, or payment form fields.",
  "safeFields": [ ... ],
  "findings": []
}
```

## SDK example
```ts
const verdict = await firewall.checkBrowserForm({ sessionId, url, domain, formFields, pageText, destination: "external" });
if (verdict.decision === "TAKEOVER_REQUIRED") return handOffToHuman(verdict);
if (verdict.decision === "BLOCK") throw new Error(verdict.reason);
```

## Security behavior
- Password / OTP / CVV / card / payment / PIN fields → `TAKEOVER_REQUIRED`.
- Page text with prompt injection ("ignore previous instructions", "reveal system prompt") → `BLOCK`.
- API keys / secrets in any field → `BLOCK`.
- Unknown external domain + PII → `ASK_APPROVAL`.
- Trusted domain + non-sensitive fields → `ALLOW`.
- Field values are redacted before logging; raw values never persist.

## Common mistakes
- Treating `TAKEOVER_REQUIRED` like `ASK_APPROVAL` — it means a human must drive the credential entry directly, not approve the agent doing it.
- Passing only field names without `pageText`, so injection in the visible page is missed.

## Test examples
- Safe form to trusted domain → `ALLOW`.
- Password field → `TAKEOVER_REQUIRED`.
- OTP field → `TAKEOVER_REQUIRED`.
- API key in form → `BLOCK`.
- PAN/Aadhaar in unknown form → `ASK_APPROVAL`/`BLOCK`.
- Page injection asking to ignore safety → `BLOCK`.
