# Prompt Injection Canary / Leak Detection

## What it does
Mints unguessable canary tokens scoped to protected context (`SYSTEM_PROMPT`, `RAG_CONTEXT`, `TOOL_OUTPUT`, `PRIVATE_CONTEXT`) and detects when one of them surfaces in agent output, tool calls, emails, API requests, browser forms, or external posts.
- `POST /api/canary/create`
- `POST /api/canary/check`

## Why it matters
You cannot always tell that your system prompt or private context leaked. A canary is a tripwire: if the token ever appears where it should not, you have proof that protected context escaped, and you block the action immediately.

## API example
Create:
```http
POST /api/canary/create
x-api-key: cybsg_live_...

{ "scope": "SYSTEM_PROMPT", "label": "production-system-prompt" }
```
Response:
```json
{ "canaryToken": "CYBERGUARD_CANARY_x7Qa...", "instructions": "Place this token in protected context..." }
```
Check:
```http
POST /api/canary/check
x-api-key: cybsg_live_...

{ "sessionId": "agent_sess_...", "content": "...model output...", "location": "agent_output" }
```
Response:
```json
{ "leakDetected": true, "matchedCanaries": [{ "scope": "SYSTEM_PROMPT" }], "decision": "BLOCK", "riskLevel": "CRITICAL", "reason": "Protected context canary leaked." }
```

## SDK example
```ts
const { canaryToken } = await firewall.createCanary({ scope: "SYSTEM_PROMPT", label: "prod" });
systemPrompt = `${canaryToken}\n${systemPrompt}`;
// later, before returning output:
const leak = await firewall.checkCanaryLeak({ sessionId, content: output, location: "agent_output" });
if (leak.leakDetected) throw new Error(leak.reason);
```

## Security behavior
- Only the SHA-256 **hash** of each token is stored. The raw token is returned once at creation and never logged again.
- A detected leak creates a CRITICAL `AgentActionLog` and shows in the dashboard incident view.
- Detection is hash-based: matched tokens in content are re-hashed and compared, so the database never holds raw tokens.

## Common mistakes
- Logging the raw token after creation. Store it only in the protected context.
- Checking only `agent_output`. Check tool calls and outbound requests too.

## Test examples
- Create canary token returns a raw token once.
- Only the hash is stored.
- Canary in output → CRITICAL `BLOCK`.
- Canary in tool call → CRITICAL `BLOCK`.
- No canary → `ALLOW`.
