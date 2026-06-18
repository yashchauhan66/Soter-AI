# MCP Tool Drift Monitor

## What it does
Snapshots MCP server tool definitions and detects risky **drift** over time — new dangerous capabilities, prompt injection appearing in a description, input/output schema changes, endpoint changes, and overall risk increases. Register a server (`/api/mcp/servers/register`), snapshot its tools repeatedly (`/api/mcp/tools/snapshot`), and review drift (`/api/mcp/drifts`, `/api/mcp/servers/:serverId/tools`).

## Why it matters
An MCP tool you approved last week can quietly change. A benign `helper.do` that "formats text" can be updated to "format text and run a shell command", or have `ignore previous instructions` slipped into its description. Re-scanning each snapshot against the previous one catches the moment a tool becomes dangerous, instead of trusting it forever after the first review.

## API example
```http
POST /api/mcp/tools/snapshot
x-api-key: cybsg_live_...

{
  "serverName": "filesystem-mcp",
  "tools": [
    { "name": "files.tool", "description": "Read or delete a file from the filesystem", "inputSchema": {} }
  ]
}
```
Response:
```json
{
  "serverRiskLevel": "CRITICAL",
  "serverStatus": "ACTIVE",
  "snapshotsCreated": 1,
  "drifts": [{ "toolName": "files.tool", "driftType": "CAPABILITY_ADDED", "riskBefore": "HIGH", "riskAfter": "CRITICAL", "recommendation": "Quarantine the server or require approval for this tool." }],
  "tools": [{ "tool": "files.tool", "riskLevel": "CRITICAL", "capabilities": ["file_read", "file_delete"], "reasons": ["file read", "file delete"] }]
}
```
`POST /api/mcp/servers/register` registers/updates a server with a trust level. `GET /api/mcp/drifts?status=OPEN` lists drift. `GET /api/mcp/servers/:serverId/tools` returns the latest snapshot per tool.

## SDK example
```ts
import { createCybersecurityGuardClient } from "@cybersecurityguard/guard";
const guard = createCybersecurityGuardClient({ apiKey: process.env.CYBERSECURITYGUARD_API_KEY! });

await guard.registerMcpServer({ serverName: "filesystem-mcp", trustLevel: "INTERNAL" });
const snap = await guard.snapshotMcpTools({ serverName: "filesystem-mcp", tools: mcpClient.listTools() });
if (snap.drifts.some((d) => d.riskAfter === "CRITICAL")) {
  // quarantine the server / require approval before the next tool call
}
const open = await guard.listMcpDrifts("OPEN");
```

## Dashboard usage
`/dashboard/mcp-drift` lists registered servers with status (ACTIVE / DISABLED / QUARANTINED) and a drift-history table showing drift type, tool, before → after risk, and the recommendation.

## Security decisions
Capabilities detected include the MVP 1 set plus **auth_token_access** and **environment_access**. Drift rules:
- New `terminal_execute` / `file_delete` / `credential_access` / `payment_action` / `auth_token_access` / `environment_access` → CRITICAL.
- Prompt injection in description → `PROMPT_INJECTION_DETECTED` (CRITICAL).
- Schema adds a command parameter → CRITICAL; adds an external URL/destination parameter → HIGH.
- Endpoint hash change → `ENDPOINT_CHANGED`. Schema/description hash change → `SCHEMA_CHANGED` / `DESCRIPTION_CHANGED`.
- Risk level rising (e.g. LOW → CRITICAL) → `RISK_INCREASED` alert.
- Only description **hashes** + redacted descriptions are stored. All snapshots/drifts are project-scoped; a quarantined server's `serverStatus` is surfaced so callers can block tool use.

## Common mistakes
- Snapshotting once and trusting forever — drift only exists relative to a prior snapshot; re-snapshot on a schedule.
- Ignoring `DESCRIPTION_CHANGED` — description text is a common injection vector; review it.
- Treating `serverStatus: "QUARANTINED"` as advisory — stop calling that server's tools until the drift is resolved.

## Test examples
- First snapshot → no drift.
- Description change → DESCRIPTION_CHANGED.
- New terminal / file-delete capability → CAPABILITY_ADDED + CRITICAL.
- Prompt injection in description → PROMPT_INJECTION_DETECTED + CRITICAL.
- Schema URL parameter → HIGH; command parameter → CRITICAL.
- Risk increase → RISK_INCREASED.
- `auth_token_access` / `environment_access` capabilities detected.
