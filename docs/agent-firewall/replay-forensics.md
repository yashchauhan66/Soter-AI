# Agent Replay & Forensics

## What it does
Reconstructs a full, ordered timeline for an agent session via `GET /api/agent/replay/:sessionId`: the session start, action-firewall decisions, approvals, memory events, blocked attempts, and canary leaks — with a summary and an overall risk level.

## Why it matters
When an agent does something surprising, you need to answer "what exactly happened and where did we stop it?" Replay gives an auditable, redacted record for incident response, compliance, and debugging agent behavior.

## API example
```http
GET /api/agent/replay/agent_sess_123
x-api-key: cybsg_live_...
```
Response:
```json
{
  "sessionId": "agent_sess_123",
  "summary": "14 timeline events, 2 blocked, 1 approval-related.",
  "riskLevel": "CRITICAL",
  "timeline": [
    { "type": "session", "action": "start", "decision": "ACTIVE", "riskLevel": "LOW" },
    { "type": "action", "tool": "gmail.send", "decision": "BLOCK", "riskLevel": "CRITICAL", "reason": "Secret exfiltration blocked." },
    { "type": "approval", "action": "approval", "decision": "APPROVED", "riskLevel": "HIGH" }
  ]
}
```

### PDF incident export
Append `?format=pdf` to download a signed incident report instead of JSON:
```http
GET /api/agent/replay/agent_sess_123?format=pdf
x-api-key: cybsg_live_...
```
Returns `application/pdf` (HMAC-signed, redacted-only) built by `lib/pdf/agentIncidentReport.ts`. The dashboard replay table exposes a **PDF** link per session. JSON export remains the default.

## SDK example
```ts
const replay = await firewall.getAgentReplay(sessionId);
console.log(replay.summary, replay.riskLevel);
exportIncidentJson(replay.timeline);
```

## Security behavior
- The timeline is built from already-redacted log rows; raw secrets never appear in a replay.
- Strict project isolation: a replay only returns rows where `projectId` matches the `x-api-key` project. Cross-project session IDs return 404.
- Each fetch persists an `AgentReplay` snapshot for later export (dashboard JSON export, and PDF where the project supports PDF export).

## Common mistakes
- Assuming replay contains raw content. It is redacted by design.
- Using a session ID from another project — it will not resolve.

## Test examples
- Session replay includes a timeline.
- A blocked action appears in the replay.
- An approval event appears in the replay.
- A canary leak appears in the replay.
- Replay does not expose raw secrets.
