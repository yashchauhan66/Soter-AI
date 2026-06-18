# @cybersecurityguard/guard

Typed JavaScript / TypeScript SDK for cybersecurityguard Guard and Agent Firewall.

```bash
npm install @cybersecurityguard/guard
```

If your package registry exposes the short alias, `@cyberguard/guard` uses the same API surface.

## Agent Firewall

```ts
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

## API

| Method | Description |
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

```http
x-api-key: <CYBERSECURITYGUARD_API_KEY>
```

The key is never added to request JSON bodies.

## Disclaimer

cybersecurityguard reduces risk through defense-in-depth controls. It does not guarantee complete protection or replace secure application design, access control, model governance, or human review.
