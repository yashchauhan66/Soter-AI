# Agent Intent Verification Engine

## What It Does

Intent Guard records the user's original request, extracts safe intent categories, and checks every planned agent action against that intent before execution. It prevents an agent from turning "summarize this email" into "send this email externally" or "read this file" into "delete this file."

## Why It Matters

Prompt injection, compromised RAG content, and tool-output attacks often try to redirect an agent after the user has given a narrow instruction. Intent verification keeps the agent anchored to the user's original goal and fails closed for high-impact mismatches.

## API Example

All endpoints use `x-api-key`.

```ts
const intent = await fetch("/api/intent/extract", {
  method: "POST",
  headers: { "Content-Type": "application/json", "x-api-key": process.env.CYBERSECURITYGUARD_API_KEY! },
  body: JSON.stringify({
    sessionId: "agent_sess_123",
    userPrompt: "Summarize this email."
  })
}).then((res) => res.json());

const check = await fetch("/api/intent/action/check", {
  method: "POST",
  headers: { "Content-Type": "application/json", "x-api-key": process.env.CYBERSECURITYGUARD_API_KEY! },
  body: JSON.stringify({
    sessionId: "agent_sess_123",
    intentRecordId: intent.intentRecordId,
    tool: "gmail.send",
    action: "send_email",
    target: "external@example.com",
    actionDescription: "Forward the source email to an external recipient"
  })
}).then((res) => res.json());

if (check.decision === "BLOCK") throw new Error(check.reason);
```

## SDK Example

```ts
import {
  extractAgentIntent,
  checkIntentAction,
  getIntentSession
} from "@cybersecurityguard/guard";

const client = {
  apiKey: process.env.CYBERSECURITYGUARD_API_KEY!,
  baseUrl: process.env.CYBERSECURITYGUARD_BASE_URL
};

const intent = await extractAgentIntent(client, {
  sessionId: "agent_sess_123",
  userPrompt: "Draft a reply to this customer, but do not send it."
});

const decision = await checkIntentAction(client, {
  sessionId: "agent_sess_123",
  intentRecordId: intent.intentRecordId,
  tool: "gmail.send",
  action: "send_email",
  target: "customer@example.com"
});

await getIntentSession(client, "agent_sess_123");
```

## Dashboard Usage

Open `/dashboard/intent-guard` to review intent records, planned action checks, match scores, decisions, blocked mismatches, approval holds, and session timelines.

## Security Decisions

- Action clearly matches user intent: `ALLOW`
- Action is broader than the user intent: `ASK_APPROVAL`
- Action contradicts the user intent: `BLOCK`
- Read/summarize intent plus external send: `BLOCK`
- Read-only intent plus delete/modify action: `BLOCK`
- Purchase/payment without explicit intent: `BLOCK`
- Payment/purchase with explicit intent: `ASK_APPROVAL`
- Prompt injection attempts to change intent: `BLOCK`
- Low-confidence intent: `REVIEW` or `ASK_APPROVAL` for high-impact actions

## Common Mistakes

- Do not check actions before extracting and storing the user's original intent.
- Do not store raw prompts; use the redacted prompt plus prompt hash.
- Do not treat a draft request as permission to send.
- Do not treat a read/summarize request as permission to export data.
- Do not skip intent checks for tool calls that look safe in isolation.

## Testing Examples

```bash
tsx --test tests/agent-intent.test.ts
npx prisma validate
npm run typecheck
npm test
```

The focused tests cover matching summarize actions, blocked email sends, blocked deletes, draft-to-send approval, purchase/payment rules, prompt-injection intent changes, low-confidence review, cross-project query scoping, dashboard/API route presence, prompt hash/redaction safety, and existing Guard API preservation.

## Production Notes

Run Intent Guard after the user prompt is accepted and before any risky tool call. Pair it with Agent Passport validation, tool policy checks, escrow, and audit logging. For borderline or low-confidence actions, keep execution paused until a human approves or rewrites the action.
