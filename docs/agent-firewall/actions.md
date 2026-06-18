# Agent Firewall Actions

Use `/api/agent/action/check` before any planned action:

```json
{
  "sessionId": "agent_sess_...",
  "agentName": "openclaw",
  "tool": "gmail.send",
  "action": "send_email",
  "target": "client@example.com",
  "content": "Email body",
  "destination": "external",
  "riskContext": {
    "externalDestination": true,
    "canSendMessage": true,
    "canModifyData": true
  }
}
```

Only execute when the decision is `ALLOW`, `READ_ONLY`, or `REDACT`. For `REDACT`, execute with `safeContent`.

Never execute on `BLOCK`, `ASK_APPROVAL`, or `SANDBOX_ONLY` unless a separate sandbox/approval flow explicitly resolves it.

Use `/api/agent/tool/check` when an agent asks whether a tool is available. Use `/api/agent/data/check` before outbound data transfer. Use `/api/agent/output/check` before showing tool results or final responses.
