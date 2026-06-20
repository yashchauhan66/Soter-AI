# Botpress Integration

Add Soter as a pre-processing and post-processing HTTP step in your Botpress workflows.

## How It Works

1. **Input step** — Call `POST /api/guard/input` before the user message reaches your AI agent
2. **Output step** — Call `POST /api/guard/output` before the AI response is sent to the user
3. **Handle decisions** — Block or redirect when the guard returns `BLOCK` or `HUMAN_REVIEW`
4. **Audit logs** — Store only the public guard result (not raw text) in Botpress logs

## Quick Setup

```bash
# Environment variables for Botpress server-side
SOTER_API_KEY=ck_live_your_key_here
SOTER_BASE_URL=https://your-soter-host.example
```

## Example Botpress Workflow

```
User Message → Soter Input Guard (/api/guard/input) → AI Agent → Soter Output Guard (/api/guard/output) → User
```

```ts
// In your Botpress action or hook
const inputResult = await fetch(`${process.env.SOTER_BASE_URL}/api/guard/input`, {
  method: "POST",
  headers: {
    "x-api-key": process.env.SOTER_API_KEY,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ message: userMessage }),
}).then((r) => r.json());

if (inputResult.action === "BLOCK" || inputResult.action === "HUMAN_REVIEW") {
  return { reply: inputResult.safeText ?? "This message was blocked.", blocked: true };
}

// Pass safeText to your AI agent
const aiReply = await callBotpressAgent(inputResult.safeText ?? userMessage);

const outputResult = await fetch(`${process.env.SOTER_BASE_URL}/api/guard/output`, {
  method: "POST",
  headers: {
    "x-api-key": process.env.SOTER_API_KEY,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ aiResponse: aiReply }),
}).then((r) => r.json());

return {
  reply: outputResult.safeText ?? outputResult.redactedText ?? aiReply,
  blocked: outputResult.action === "BLOCK",
};
```

## Security Notes

- Keep the API key server-side in your Botpress environment variables
- Always guard both input and output
- This reduces risk; it does not guarantee complete protection
