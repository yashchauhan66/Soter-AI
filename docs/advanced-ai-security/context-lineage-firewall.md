# Context Lineage Firewall

## What it does
The Context Lineage Firewall tracks the origin, movement, and destination of data used by AI agents, RAG systems, tools, and chatbots. Where normal DLP only asks "what data is present?", lineage also asks: where did it come from, is that source trusted, where is it going, is the destination allowed, and would multiple small flows combine into a larger leak?

It exposes two write paths — register a source, then check a flow — and two read paths for sessions and incidents.

## Why it matters
Most real agent leaks are not malware. They are an agent helpfully moving a confidential RAG chunk, a private email body, or the system prompt itself into an external API, a browser form, or an unknown MCP tool. Classifying content alone misses this; the *source → destination* relationship is what decides whether a flow is safe.

## API example
Register a source:
```http
POST /api/lineage/source/register
x-api-key: cybsg_live_...

{
  "sourceType": "RAG_DOCUMENT",
  "sourceName": "customer-contract.pdf",
  "sourceTrustLevel": "INTERNAL",
  "sensitivityLevel": "CONFIDENTIAL",
  "content": "raw document text"
}
```
Response: `{ "sourceId": "...", "contentHash": "...", "sensitivityLevel": "CONFIDENTIAL", "findings": [] }`

Check a flow:
```http
POST /api/lineage/flow/check
x-api-key: cybsg_live_...

{
  "sourceIds": ["<sourceId>"],
  "destinationType": "EXTERNAL_API",
  "destinationName": "unknown-mcp-tool",
  "destinationTrustLevel": "UNKNOWN",
  "action": "send_context",
  "content": "selected chunk"
}
```
Response:
```json
{
  "decision": "BLOCK",
  "riskLevel": "CRITICAL",
  "reason": "Confidential RAG document content cannot flow to an untrusted MCP tool.",
  "safeContent": "...",
  "redactions": [],
  "lineageIncidentId": "...",
  "policyMatches": ["confidential_rag_to_untrusted_tool"]
}
```

`GET /api/lineage/session/:sessionId` returns all sources, flows, and incidents for a session. `GET /api/lineage/incidents?status=OPEN` lists incidents.

## SDK example
```ts
import { createCybersecurityGuardClient } from "@cybersecurityguard/guard";
const guard = createCybersecurityGuardClient({ apiKey: process.env.CYBERSECURITYGUARD_API_KEY! });

const source = await guard.registerContextSource({
  sourceType: "RAG_DOCUMENT", sourceName: "customer-contract.pdf",
  sourceTrustLevel: "INTERNAL", sensitivityLevel: "CONFIDENTIAL", content: documentText,
});
const flow = await guard.checkContextFlow({
  sourceIds: [source.sourceId], destinationType: "EXTERNAL_API",
  destinationName: "unknown-tool", destinationTrustLevel: "UNKNOWN", action: "send_context", content: chunk,
});
if (flow.decision === "BLOCK") throw new Error(flow.reason);
```

## Dashboard usage
`/dashboard/lineage` shows context sources, the source → destination flow table with decision/risk badges, blocked-flow counts, and open lineage incidents. Use it to audit where confidential data tried to go and which flows were stopped.

## Security decisions (most-restrictive-wins, in order)
1. Destination `BLOCKED` → BLOCK.
2. Secret in content + external destination → BLOCK (`SECRET_FLOW`).
3. `SYSTEM_PROMPT`/`PRIVATE_CONTEXT` → final output or external/untrusted → BLOCK (`CROSS_CONTEXT_LEAK`).
4. Malicious source influencing a tool/LLM → BLOCK.
5. Confidential RAG document → untrusted/unknown tool → BLOCK.
6. CONFIDENTIAL/SECRET → external/unknown → BLOCK.
7. REGULATED → external → ASK_APPROVAL (policy may set BLOCK via `regulatedEgress`).
8. ≥2 confidential sources → external → REVIEW (`MULTI_STEP_EXFILTRATION`).
9. PII → external → ASK_APPROVAL.
10. Untrusted source influencing tool/LLM → REVIEW.
11. Internal → unknown destination → REVIEW.
12. Residual sensitive content to internal/trusted → REDACT.
13. Otherwise → ALLOW.

Only `contentHash` + redacted content are stored. Raw secrets are never persisted or logged. All queries are scoped to the `x-api-key` project.

## Common mistakes
- Checking flows only for `EXTERNAL` destinations — `UNKNOWN` is treated as external/untrusted too.
- Forwarding the raw `content` to the destination after a `REDACT`/`ASK_APPROVAL` decision instead of `safeContent`.
- Registering a confidential source as `PUBLIC` to dodge a block — sensitivity drives the decision.

## Test examples
- Public source → final output → ALLOW.
- Confidential RAG document → unknown MCP tool → BLOCK.
- Private email → external API → BLOCK.
- System prompt → final output → BLOCK.
- Internal source → trusted internal tool → ALLOW.
- Secret in content → external → BLOCK.
- Multiple confidential sources → external → REVIEW + incident.
- Cross-project source IDs are ignored (tenant isolation).
- Content hash stored, raw secret not stored.
