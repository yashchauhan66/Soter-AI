# Generic Chatbot And Agent Pattern

Use this pattern for any chatbot, RAG bot, browser agent, desktop agent, or custom tool-using AI system:

```ts
const input = await guard.input(userMessage);
if (!guard.shouldCallLLM(input)) return input.safeText ?? input.reason;

const session = await firewall.startAgentSession({
  agentName: "support-bot",
  agentType: "chatbot"
});

const action = await firewall.checkAgentAction({
  sessionId: session.sessionId,
  tool: "api.call",
  action: "post_ticket",
  content: ticketPayload,
  destination: "external",
  riskContext: { externalDestination: true, canModifyData: true }
});

if (action.decision === "BLOCK") return action.reason;
if (action.decision === "ASK_APPROVAL") return action.requiredApproval?.message;

const toolResult = await callTool(action.safeContent ?? ticketPayload);
const checkedResult = await firewall.checkAgentOutput({ sessionId: session.sessionId, content: toolResult });
const final = await guard.output(checkedResult.safeContent ?? toolResult);
return final.safeText ?? final.reason;
```

Never execute a tool before the firewall decision.
