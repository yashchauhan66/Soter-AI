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
import { CyberRakshakGuard } from "@cyberrakshak/guard";

const guard = new CyberRakshakGuard({
  apiKey: process.env.CYBERRAKSHAK_API_KEY!,
  baseUrl: "https://yourdomain.com",
});

const input = await guard.guardInput({ message: userMessage });
if (!input.allowed) {
  return input.safeText ?? "This request was blocked for security reasons.";
}

const aiResponse = await callLLM(input.safeText ?? userMessage);
const output = await guard.guardOutput({ aiResponse });
return output.safeText ?? aiResponse;
```

## API

| Method | Description |
| --- | --- |
| `guardInput({ message, userId?, sessionId?, metadata? })` | Run the input guard. |
| `guardOutput({ aiResponse, sessionId?, metadata? })` | Run the output guard. |
| `analyze({ text, direction })` | Public analyzer (no API key required). |
| `secureChat({ message, callLLM, ... })` | Combined input → LLM → output flow. |

All methods return a typed `GuardResult` with `allowed`, `action`, `riskScore`,
`riskTypes`, `findings`, `reason`, and optional `safeText` / `redactedText`.
`originalText` is never returned by the server.

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
