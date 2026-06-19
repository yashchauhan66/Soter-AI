# Tool Chain Attack Detector

The Tool Chain Attack Detector watches an agent session as a sequence, not as isolated tool calls. A single read, summary, or send can look safe alone, but the chain can become dangerous when private data flows from one tool into another destination.

## What It Does

- Starts a project-scoped tool chain session.
- Records each tool step with source, action, destination, data sensitivity, decision, and risk.
- Detects dangerous multi-step chains such as private read to external email, confidential RAG to unknown MCP tool, memory to external API, terminal to network post, and system prompt to final output.
- Creates findings with involved step numbers and recommended fixes.

## Why It Matters

Agent incidents often happen through composition. The agent first reads sensitive data, then summarizes it, then sends or posts it elsewhere. The detector blocks or holds these chains even when each individual tool call appears normal.

## API Example

```ts
await fetch("/api/tool-chain/session/start", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "x-api-key": process.env.CYBERSECURITYGUARD_API_KEY!,
  },
  body: JSON.stringify({ sessionId: "agent-session-123" }),
});

const check = await fetch("/api/tool-chain/step/check", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "x-api-key": process.env.CYBERSECURITYGUARD_API_KEY!,
  },
  body: JSON.stringify({
    sessionId: "agent-session-123",
    tool: "gmail.send",
    action: "send email externally",
    sourceType: "PRIVATE_DATA",
    destinationType: "EXTERNAL_EMAIL",
    dataSensitivity: "PRIVATE",
  }),
});
```

## SDK Example

```ts
import {
  startToolChainSession,
  checkToolChainStep,
  getToolChainFindings,
} from "@cybersecurityguard/guard";

const client = { apiKey: process.env.CYBERSECURITYGUARD_API_KEY! };

await startToolChainSession(client, { sessionId: "agent-session-123" });

const result = await checkToolChainStep(client, {
  sessionId: "agent-session-123",
  tool: "api.call",
  action: "post to external api",
  sourceType: "MEMORY",
  destinationType: "EXTERNAL_POST",
  dataSensitivity: "PRIVATE",
});

if (result.decision === "BLOCK") {
  throw new Error(result.reason);
}

const findings = await getToolChainFindings(client, "agent-session-123");
```

## Dashboard Usage

Open `/dashboard/tool-chain`.

The dashboard shows:

- Recent tool chain sessions
- Source to action to destination timeline
- Step decisions and risk
- Blocked chains
- Review or approval holds
- Findings and recommendations

## Security Decisions

- Safe isolated read returns `ALLOW`.
- Private or confidential data read followed by external send returns `BLOCK`.
- Confidential RAG routed to an unknown tool returns `BLOCK`.
- Memory read followed by external post returns `BLOCK`.
- File read followed by email send returns `ASK_APPROVAL` or `BLOCK` depending on sensitivity.
- Terminal command followed by network post returns `BLOCK` with `CRITICAL` risk.
- System prompt or secret context reaching final output returns `BLOCK`.
- Untrusted browser page influencing a tool call returns `REVIEW`.

## Common Mistakes

- Checking only the current tool call and ignoring previous steps.
- Treating summary text as harmless when it came from confidential context.
- Sending RAG or memory content to unknown MCP tools.
- Allowing terminal/network combinations without sandboxing.
- Logging raw tool payloads or secrets in metadata.

## Testing Examples

Run focused tests:

```bash
node_modules\.bin\tsx.cmd --test tests\tool-chain.test.ts
```

Run the package suite:

```bash
npm test
```

## Production Notes

- Always start a session before checking steps.
- Pass accurate `sourceType`, `destinationType`, and `dataSensitivity` when available.
- Treat `BLOCK` as fail-closed.
- Treat `REVIEW` as a human review queue item.
- Store only redacted metadata, hashes, risk labels, and safe summaries.
- Keep `x-api-key` authentication on all server-to-server requests.
