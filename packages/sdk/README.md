# @cyberrakshak/guard

Typed JavaScript / TypeScript client and Next.js helper for the
[CyberRakshak Guard](https://github.com/) AI security gateway.

CyberRakshak Guard is OWASP LLM Top 10 aligned, defensive in design, and
inspects both input and output of chatbot flows. The SDK is a thin, typed
wrapper around the REST API; it never claims to provide complete protection.

```bash
npm install @cyberrakshak/guard
```

> Phase 2 beta ships a CommonJS build with TypeScript declarations. Modern
> bundlers (Next.js, Vite, Webpack 5, Rollup with `@rollup/plugin-commonjs`)
> consume it directly. Pure-ESM Node 22 setups should use a `require` shim
> via `createRequire` until the dual-format build lands in Phase 3.

## Quick start

```ts
import { CyberRakshakClient } from "@cyberrakshak/guard";

const guard = new CyberRakshakClient({
  apiKey: process.env.CYBERRAKSHAK_API_KEY!,
  baseUrl: process.env.CYBERRAKSHAK_BASE_URL ?? "https://api.cyberrakshak.dev",
  projectId: process.env.CYBERRAKSHAK_PROJECT_ID,
  timeoutMs: 5000,
});

const input = await guard.guardInput({ text: userMessage });
if (guard.shouldBlock(input)) {
  return "This request was blocked for safety.";
}

const aiResponse = await callLLM(guard.getSafeText(input, userMessage) ?? userMessage);
const output = await guard.guardOutput({ text: aiResponse });
return guard.getSafeText(output, aiResponse);
```

> `CyberRakshakGuard` remains exported as a backwards-compatible alias of
> `CyberRakshakClient`.

## API

| Method | Description |
| --- | --- |
| `guardInput({ text \| message, userId?, sessionId?, metadata? })` | Run the input guard. |
| `guardOutput({ text \| aiResponse, sessionId?, metadata? })` | Run the output guard. |
| `analyze({ text, direction })` | Public analyzer (no API key required). |
| `guardConversation({ input, callLLM, ... })` | Combined input → LLM → output flow. |
| `secureChat({ message, callLLM, ... })` | Lower-level combined flow. |
| `isAllowed(result)` | `true` when the result is safe to forward. |
| `shouldBlock(result)` | `true` when the caller should stop. |
| `getSafeText(result, fallback?)` | Redacted/safe text, or the fallback. |

All methods return a typed `GuardResult` with `allowed`, `action`, a normalized
`decision` (`ALLOW` \| `REDACT` \| `BLOCK` \| `HUMAN_REVIEW`), `riskScore`,
`riskTypes`, `findings`, `reason`, and optional `safeText` / `redactedText`.
`originalText` is never returned by the server.

### Field compatibility

The live API uses `message` (input) and `aiResponse` (output). The SDK also
accepts a generic `text` field for both and maps it to the correct API field,
so the same call shape works on either side.

## Security notes

- The constructor warns if it detects a browser environment. **Never** ship an
  API key to client-side code; call the Guard from a server route or proxy.
- The API key and raw text are never logged, even when `debug: true`.
- Errors never include the API key.


## Errors

```ts
import {
  CyberRakshakAuthError,
  CyberRakshakRateLimitError,
  CyberRakshakValidationError,
  CyberRakshakNetworkError,
  CyberRakshakError,
} from "@cyberrakshak/guard";

try {
  await guard.guardInput({ message });
} catch (caught) {
  if (caught instanceof CyberRakshakRateLimitError) {
    // retryAfter (seconds) when provided by server
  }
}
```

## Next.js helper

`@cyberrakshak/guard/next` exposes `secureChatHandler`, a ready-to-mount
Next.js Route Handler that runs input guard → your LLM → output guard:

```ts
// app/api/chat/route.ts
import { secureChatHandler } from "@cyberrakshak/guard/next";

export const POST = secureChatHandler({
  apiKey: process.env.CYBERRAKSHAK_API_KEY!,
  callLLM: async ({ safeInput }) => {
    return await myLLMCall(safeInput);
  },
});
```

The helper:

- Validates `message`.
- Calls `guardInput`. If blocked, returns the safe blocked response.
- Calls your `callLLM` with the redacted/safe input.
- Calls `guardOutput`. If withheld, returns the safe withhold response.
- Never echoes the original request text.

## Express helper

`@cyberrakshak/guard/express` exposes `cyberRakshakInputMiddleware` and
`cyberRakshakOutputMiddleware`:

```ts
import express from "express";
import { cyberRakshakInputMiddleware } from "@cyberrakshak/guard/express";

const app = express();
app.use(express.json());

app.post(
  "/chat",
  cyberRakshakInputMiddleware({ apiKey: process.env.CYBERRAKSHAK_API_KEY! }),
  async (req, res) => {
    // req.body.message has been replaced with safe/redacted text.
    const reply = await callLLM(req.body.message);
    res.json({ reply });
  },
);
```

## Webhook signature verification

`signWebhookPayload` and `verifyWebhookSignature` are not bundled into the SDK,
because the consuming app already has Node `crypto`. Verify like this:

```ts
import { createHmac, timingSafeEqual } from "crypto";

function verify(rawBody: string, header: string, secret: string) {
  const match = /t=(\d+),v1=([0-9a-f]+)/.exec(header);
  if (!match) return false;
  const [, t, sig] = match;
  const expected = createHmac("sha256", secret).update(`${t}.${rawBody}`).digest("hex");
  return timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(sig, "hex"));
}



## Disclaimer

CyberRakshak Guard reduces risk through pattern detection and policy enforcement.
It does not guarantee complete protection, replace secure development practices,
or represent OWASP certification. False positives and false negatives are possible.

