# MCP Tool Permission Scanner

## What it does
Scans MCP server/tool definitions via `/api/agent/mcp/scan`, detects each tool's capabilities, assigns a risk level, and returns a recommended permission manifest.

## Why it matters
MCP servers ship tools whose real power is hidden in a name and a JSON schema. A tool called `helper.run` may execute shell commands. Scanning surfaces the dangerous capabilities (file delete, terminal execute, credential access) before you connect an agent to the server.

## API example
```http
POST /api/agent/mcp/scan
x-api-key: cybsg_live_...

{
  "serverName": "filesystem-mcp",
  "tools": [
    { "name": "filesystem.read", "description": "Read a file from disk", "inputSchema": {} },
    { "name": "filesystem.delete", "description": "Delete a file", "inputSchema": {} }
  ]
}
```
Response:
```json
{
  "serverRiskLevel": "CRITICAL",
  "tools": [
    { "tool": "filesystem.read", "riskLevel": "HIGH", "capabilities": ["file_read"], "reasons": ["file read"], "recommendedDecision": "ASK_APPROVAL" },
    { "tool": "filesystem.delete", "riskLevel": "CRITICAL", "capabilities": ["file_delete"], "reasons": ["file delete"], "recommendedDecision": "BLOCK" }
  ],
  "recommendedManifest": { "allowedTools": [], "approvalRequired": ["filesystem.read"], "blocked": ["filesystem.delete"] }
}
```

## SDK example
```ts
const scan = await firewall.scanMcpTools({ serverName: "filesystem-mcp", tools });
await persistManifest(scan.recommendedManifest);
```

## Security behavior
- Capabilities detected: `file_read`, `file_write`, `file_delete`, `terminal_execute`, `network_request`, `email_send`, `calendar_write`, `clipboard_read`, `clipboard_write`, `credential_access`, `browser_control`, `database_write`, `payment_action`, `external_post`, `memory_write`.
- `file_delete`, `terminal_execute`, `credential_access`, `payment_action` → `CRITICAL` → recommend `BLOCK`.
- `file_read/write`, `email_send`, `database_write`, `external_post` → `HIGH` → recommend `ASK_APPROVAL`.
- Server risk is the highest tool risk. Scans are stored per project with redacted schemas only.

## Common mistakes
- Trusting the tool name. Always scan the description and schema too.
- Auto-applying `recommendedManifest` without review for a CRITICAL server.

## Test examples
- `filesystem.read` → `HIGH`.
- `filesystem.delete` → `CRITICAL`.
- `terminal.run` → `CRITICAL`.
- `browser.read` → `LOW`/`MEDIUM`.
- `gmail.send` → `HIGH`.

See also [`docs/integrations/mcp-agent-firewall.md`](../integrations/mcp-agent-firewall.md).
