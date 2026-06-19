# @cybersecurityguard/guard

Typed JavaScript / TypeScript SDK for cybersecurityguard Guard and Agent Firewall.

```bash
npm install @cybersecurityguard/guard
```

If your package registry exposes the short alias, `@cyberguard/guard` uses the same API surface.

## Agent Firewall

```ts
<<<<<<< HEAD
import { createAgentFirewallClient } from "@cybersecurityguard/guard";

const firewall = createAgentFirewallClient({
  apiKey: process.env.CYBERSECURITYGUARD_API_KEY!,
  baseUrl: process.env.CYBERSECURITYGUARD_BASE_URL || "https://api.cybersecurityguard.com",
});

const session = await firewall.startAgentSession({
  agentName: "openclaw",
  agentType: "computer_use",
});

const decision = await firewall.checkAgentAction({
  sessionId: session.sessionId,
  tool: "gmail.send",
  action: "send_email",
  target: "client@example.com",
  content: emailBody,
  destination: "external",
  riskContext: {
    externalDestination: true,
    canSendMessage: true,
    canModifyData: true,
  },
});

if (decision.decision === "BLOCK") throw new Error(decision.reason);
if (decision.decision === "ASK_APPROVAL") return decision.requiredApproval;

await sendEmail(decision.safeContent ?? emailBody);
```

## Universal Pattern

1. Call `guard.input()` before the LLM.
2. Call `firewall.checkAgentAction()` before every tool call.
3. Call `firewall.checkDataLeak()` before sending data outside the user environment.
4. Execute the tool only for `ALLOW`, `READ_ONLY`, or `REDACT`.
5. Call `firewall.checkAgentOutput()` before showing tool results or final responses.

## Protect A Chatbot

```ts
import { CybersecurityGuard } from "@cybersecurityguard/guard";

const guard = new CybersecurityGuard({
  apiKey: process.env.CYBERSECURITYGUARD_API_KEY!,
  baseUrl: process.env.CYBERSECURITYGUARD_BASE_URL || "https://api.cybersecurityguard.com",
});

const result = await guard.protectChat({
  message: userMessage,
  userId,
  sessionId,
  metadata: { source: "website-chatbot" },
  callLLM: async (safeMessage) => myLLM.chat(safeMessage),
});

return result.safeResponse;
```

`CyberRakshakGuard` remains exported as a compatibility class for existing integrations.
=======
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
>>>>>>> main

## API

| Method | Description |
<<<<<<< HEAD
| :--- | :--- |
| `input(message, options?)` | Alias for input guard. |
| `output(aiResponse, options?)` | Alias for output guard. |
| `analyze(text, direction)` | Public analyzer. |
| `guardInput(payload)` | Raw input guard request. |
| `guardOutput(payload)` | Raw output guard request. |
| `protectChat(options)` | Input guard -> LLM -> output guard. |
| `protectRag(options)` | Guard query, retrieval chunks, and final answer. |
| `startAgentSession(payload)` | Start a protected agent session. |
| `checkAgentAction(payload)` | Gate a planned tool/action before execution. |
| `checkToolUse(payload)` | Check whether an agent can use a tool. |
| `checkDataLeak(payload)` | Scan data before outbound transfer. |
| `checkAgentOutput(payload)` | Scan tool results and final agent output. |
| `wrapTool(context, executor)` | Wrap any JavaScript tool with fail-closed decisions. |
| `wrapMcpTool(name, executor, defaults?)` | Wrap MCP tool calls. |
| `createOpenClawAdapter(options)` | OpenClaw-style before-tool-call adapter. |
| `createLangChainToolWrapper(name, executor, defaults?)` | LangChain tool wrapper. |
| `createExpressAgentMiddleware()` | Express-compatible action-check middleware. |
| `createNextAgentHandler()` | Next.js action-check route handler. |

## Authentication

The SDK sends:
=======
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
>>>>>>> main

```http
x-api-key: <CYBERSECURITYGUARD_API_KEY>
```

<<<<<<< HEAD
The key is never added to request JSON bodies.

## Disclaimer

cybersecurityguard reduces risk through defense-in-depth controls. It does not guarantee complete protection or replace secure application design, access control, model governance, or human review.
=======
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

>>>>>>> main
