# JavaScript / TypeScript Integration

The `@cyberrakshak/guard` package is a typed, server-side client for the
CyberRakshak Guard API. It is OWASP LLM Top 10 aligned and built for
defense-in-depth: **detect, block, redact, monitor, and report**. It does not
guarantee complete protection.

## Install

```bash
npm install @cyberrakshak/guard
```

Requires Node.js ≥ 18.18 (built-in `fetch`).

## Environment

```bash
CYBERRAKSHAK_API_KEY=ck_live_your_key_here   # server-side only
CYBERRAKSHAK_BASE_URL=https://api.cyberrakshak.dev
CYBERRAKSHAK_PROJECT_ID=                      # optional
```

> **Never** expose the API key in browser/client code. Do not prefix it with
> `NEXT_PUBLIC_`. Call the Guard from a server route or proxy.

## Basic usage

```ts
import { CyberRakshakClient } from "@cyberrakshak/guard";

const guard = new CyberRakshakClient({
  apiKey: process.env.CYBERRAKSHAK_API_KEY!,
  baseUrl: process.env.CYBERRAKSHAK_BASE_URL || "https://api.cyberrakshak.dev",
  projectId: process.env.CYBERRAKSHAK_PROJECT_ID,
  timeoutMs: 5000,
});

const inputResult = await guard.guardInput({ text: userMessage });
if (guard.shouldBlock(inputResult)) {
  return "This request was blocked for safety.";
}

const llmResponse = await callLLM(guard.getSafeText(inputResult, userMessage)!);

const outputResult = await guard.guardOutput({ text: llmResponse });
return guard.getSafeText(outputResult, llmResponse);
```

### Decision helpers

```ts
guard.isAllowed(result);    // safe to forward
guard.shouldBlock(result);  // stop (BLOCK or HUMAN_REVIEW or !allowed)
guard.getSafeText(result, fallback);  // safeText ?? redactedText ?? fallback
```

`result.decision` is a normalized 4-value field (`ALLOW` | `REDACT` | `BLOCK` |
`HUMAN_REVIEW`) derived from the API's `action`. The raw `result.action` is also
available.

### One-call conversation

```ts
const { reply, blocked } = await guard.guardConversation({
  input: userMessage,
  callLLM: async (safeInput) => myLLMCall(safeInput),
});
```

## Next.js usage

Route handler with the one-line helper:

```ts
// app/api/chat/route.ts
import { createGuardedRoute } from "@cyberrakshak/guard/next";

export const runtime = "nodejs";

export const POST = createGuardedRoute({
  apiKey: process.env.CYBERRAKSHAK_API_KEY!,
  baseUrl: process.env.CYBERRAKSHAK_BASE_URL!,
  callLLM: async (safeInput) => myLLMCall(safeInput),
});
```

Lower-level helpers `guardNextInput(client, ...)`, `guardNextOutput(client, ...)`,
and `secureChatHandler({...})` are also exported from `@cyberrakshak/guard/next`.

The browser only ever sends `{ message }` and receives `{ reply, blocked }`.

## Express usage

```ts
import express from "express";
import { cyberRakshakInputMiddleware, cyberRakshakOutputMiddleware } from "@cyberrakshak/guard/express";

const app = express();
app.use(express.json());

app.post(
  "/chat",
  cyberRakshakInputMiddleware({ apiKey: process.env.CYBERRAKSHAK_API_KEY! }),
  async (req, res) => {
    // req.body.message is now safe/redacted; blocked requests already responded.
    const reply = await callLLM(req.body.message);
    res.json({ reply });
  },
);
```

`req.cyberrakshak.inputResult` holds the full `GuardResult`.

## Error handling

```ts
import {
  CyberRakshakAuthError,
  CyberRakshakRateLimitError,
  CyberRakshakValidationError,
  CyberRakshakNetworkError,
  CyberRakshakError,
} from "@cyberrakshak/guard";

try {
  await guard.guardInput({ text });
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
