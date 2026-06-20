# Zendesk Integration

Use Soter to protect AI workflows in your Zendesk environment.

## Setup

```bash
SOTER_API_KEY=ck_live_your_key_here
SOTER_BASE_URL=https://your-soter-host.example
```

## Integration Pattern

1. **Guard inbound ticket messages** — Before they reach the AI agent
2. **Guard AI draft replies** — Before they are sent to customers
3. **Separate projects** — Use distinct Soter projects per brand or client
4. **Audit and reports** — Use webhooks and scheduled reports for security review

## API Example

```ts
// Guard incoming ticket message
const inputResult = await fetch(`${process.env.SOTER_BASE_URL}/api/guard/input`, {
  method: "POST",
  headers: {
    "x-api-key": process.env.SOTER_API_KEY,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ message: ticketBody }),
}).then((r) => r.json());

if (inputResult.action === "BLOCK") {
  // Return safe fallback or flag for human review
  return { reply: "This message could not be processed.", blocked: true };
}

// Guard AI draft before sending to customer
const outputResult = await fetch(`${process.env.SOTER_BASE_URL}/api/guard/output`, {
  method: "POST",
  headers: {
    "x-api-key": process.env.SOTER_API_KEY,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ aiResponse: aiDraft }),
}).then((r) => r.json());
```

## Best Practices

- Use separate Soter projects per brand or client for isolation
- Always run the output guard on AI drafts before they reach customers
- Store only redacted/guarded text in audit logs
- Use webhooks for real-time blocking alerts

## Security Notes

- Do not export private ticket contents into benchmarks without redaction and authorization
- API key stays server-side only
- This reduces risk; it does not guarantee complete protection
