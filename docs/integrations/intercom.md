# Intercom Integration

Use Soter to reduce AI support-chat risk in your Intercom workflows.

## Setup

```bash
SOTER_API_KEY=ck_live_your_key_here
SOTER_BASE_URL=https://your-soter-host.example
```

## Integration Pattern

1. **Guard user messages** — Before they reach the AI assistant
2. **Guard generated replies** — Before they reach customers
3. **Redact PII/secrets** — Before saving examples for review
4. **Monthly reports** — Use for security evidence and compliance

## API Usage (Server-side)

```ts
// Guard incoming customer message
const inputResult = await fetch(`${process.env.SOTER_BASE_URL}/api/guard/input`, {
  method: "POST",
  headers: {
    "x-api-key": process.env.SOTER_API_KEY,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ message: customerMessage }),
}).then((r) => r.json());

if (inputResult.action === "BLOCK") {
  // Return a safe fallback response
  return { reply: "I couldn't process that request.", blocked: true };
}

// Guard AI-generated reply before sending
const outputResult = await fetch(`${process.env.SOTER_BASE_URL}/api/guard/output`, {
  method: "POST",
  headers: {
    "x-api-key": process.env.SOTER_API_KEY,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ aiResponse: aiReply }),
}).then((r) => r.json());
```

## Best Practices

- Use separate Soter projects per brand or client
- Store only redacted text in your review logs
- Coordinate with support owners before enabling blocking mode
- Run output guard on every AI response, not just input

## Security Notes

- API key stays server-side only
- This reduces risk; it does not guarantee complete protection
