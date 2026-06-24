# Generic Chatbot & Agent Pattern

Use this pattern for any chatbot, RAG bot, browser agent, desktop agent, or custom tool-using AI system.

## Installation

```bash
npm install @soterai/core
```

## Basic Chatbot Pattern

```ts
import { Soter } from "@soterai/core";

const soter = new Soter({
  apiKey: process.env.SOTER_API_KEY,
  baseUrl: process.env.SOTER_BASE_URL,
});

// Guard input → call LLM → guard output
const result = await soter.protect({
  input: userMessage,
  context: { userId: "user_123", sessionId: "session_123" },
});

if (!result.allowed) {
  return { reply: result.safeText ?? "Message blocked.", blocked: true };
}

const llmReply = await callLLM(result.safeText ?? userMessage);
const outputResult = await soter.guardOutput({ text: llmReply });

return {
  reply: outputResult.safeText ?? outputResult.redactedText ?? llmReply,
  blocked: !outputResult.allowed,
};
```

## Agent with Tool Firewall

For agents that call tools, APIs, or access data:

```ts
import { createAgentFirewallClient } from "@soterai/core";

const firewall = createAgentFirewallClient({
  apiKey: process.env.SOTER_API_KEY,
  baseUrl: process.env.SOTER_BASE_URL,
});

// Start an agent session
const session = await firewall.startAgentSession({
  agentName: "support-bot",
  agentType: "chatbot",
});

// Check every tool call before execution
const action = await firewall.checkAgentAction({
  sessionId: session.sessionId,
  tool: "api.call",
  action: "post_ticket",
  content: ticketPayload,
  destination: "external",
  riskContext: { externalDestination: true, canModifyData: true },
});

if (action.decision === "BLOCK") return action.reason;
if (action.decision === "ASK_APPROVAL") return action.requiredApproval?.message;

// Only execute after firewall allows it
const toolResult = await callTool(action.safeContent ?? ticketPayload);

// Guard the final output
const final = await soter.protect({ input: toolResult });
return final.safeText ?? final.reason;
```

## Quick Decision Flow

```
User Input → Soter Guard → Safe Text → LLM/Agent → Output → Soter Output Guard → Safe Response
                ↓                               ↓
           Blocked (no LLM)              Blocked/Redacted
```

## Key Rules

- Never execute a tool before the firewall approves it
- Always guard both input and output
- Set `retries: 2` for transient error tolerance
- API key stays server-side only
