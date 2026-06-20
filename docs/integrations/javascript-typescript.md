# Soter for JavaScript and TypeScript

Soter is a developer-first safety layer for AI chatbots, agents, RAG systems, and LLM applications. It helps detect and block prompt injection, jailbreaks, data leakage, unsafe outputs, PII exposure, tool abuse, and risky AI behavior before it reaches your model or user.

## Install

```bash
npm install @soter/core
```

Requires Node.js ≥ 18.18 (built-in `fetch`).

## Environment

```bash
SOTER_API_KEY=ck_live_your_key_here   # server-side only
SOTER_BASE_URL=https://api.your-soter-host.example
SOTER_PROJECT_ID=                      # optional
```

> **Never** expose the API key in browser/client code. Do not prefix it with
> `NEXT_PUBLIC_`. Call Soter from a server route or proxy.

## Basic usage

```ts
import { Soter } from "@soter/core";

const soter = new Soter({
  apiKey: process.env.SOTER_API_KEY,
  baseUrl: process.env.SOTER_BASE_URL,
  projectId: process.env.SOTER_PROJECT_ID,
  timeoutMs: 5000,
});

const result = await soter.protect({
  input: userMessage,
  context: { userId: "user_123", sessionId: "session_123" },
});

if (!result.allowed) {
  console.log("Blocked by Soter:", result.reason);
}

// Continue to the model only after Soter allows the input.
```

### Decision helpers

```ts
soter.isAllowed(result);    // safe to forward
soter.shouldBlock(result);  // stop (BLOCK or HUMAN_REVIEW or !allowed)
soter.getSafeText(result, fallback);  // safeText ?? redactedText ?? fallback
```

`result.decision` is a normalized 4-value field (`ALLOW` | `REDACT` | `BLOCK` |
`HUMAN_REVIEW`) derived from the API's `action`. The raw `result.action` is also
available.

### One-call conversation

```ts
const { reply, blocked } = await soter.guardConversation({
  input: userMessage,
  callLLM: async (safeInput) => myLLMCall(safeInput),
});
```

## Next.js usage

Route handler with the one-line helper:

```ts
// app/api/chat/route.ts
import { createGuardedRoute } from "@soter/core/next";

export const runtime = "nodejs";

export const POST = createGuardedRoute({
  apiKey: process.env.SOTER_API_KEY!,
  baseUrl: process.env.SOTER_BASE_URL!,
  callLLM: async (safeInput) => myLLMCall(safeInput),
});
```

Lower-level helpers `guardNextInput(client, ...)`, `guardNextOutput(client, ...)`,
and `secureChatHandler({...})` are also exported from `@soter/core/next`.

The browser only ever sends `{ message }` and receives `{ reply, blocked }`.

## Express usage

```ts
import express from "express";
import { soterInputMiddleware, soterOutputMiddleware } from "@soter/core/express";

const app = express();
app.use(express.json());

app.post(
  "/chat",
  soterInputMiddleware({ apiKey: process.env.SOTER_API_KEY! }),
  async (req, res) => {
    // req.body.message is now safe/redacted; blocked requests already responded.
    const reply = await callLLM(req.body.message);
    res.json({ reply });
  },
);
```

`req.soter.inputResult` holds the full `GuardResult`. The legacy `req.cyberrakshak.inputResult` property is still populated for existing integrations.

## Error handling

```ts
import {
  CyberRakshakAuthError,
  CyberRakshakRateLimitError,
  CyberRakshakValidationError,
  CyberRakshakNetworkError,
  CyberRakshakError,
} from "@soter/core";

try {
  await soter.guardInput({ text });
} catch (caught) {
  if (caught instanceof CyberRakshakRateLimitError) {
    // caught.retryAfter (seconds) when provided
  } else if (caught instanceof CyberRakshakAuthError) {
    // 401/403 — check the key/project
  }
}
```

Set `retries: 2` in the constructor to auto-retry transient 5xx/network errors
with backoff.

## Security notes

- The API key and raw text are never logged, even with `debug: true`.
- The constructor warns if it detects a browser environment.
- Errors never include the API key.
- Always run the **output** guard, not just the input guard.
- This reduces risk; it does not guarantee complete protection, and false
  positives/negatives are possible.
