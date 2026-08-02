# @soterai/mcp-gateway

**Inline Model Context Protocol (MCP) enforcement proxy** with policy-based
tool-call interception, human-in-the-loop approval, and result secret-scanning.
Zero-dependency at runtime, TypeScript-native.

> Sponsored by [SoterAI](https://soterai.in).

## What it does

```
MCP Client (Claude, Cursor, your agent, …)
    │  JSON-RPC (HTTP or stdio)
    ▼
┌──────────────────────────────────────────────┐
│  @soterai/mcp-gateway                        │
│  ─────────────────────────                   │
│  1. SessionManager   — identity binding,     │
│     tenant/project isolation, session TTL    │
│  2. evaluatePolicy   — your callback decides │
│     ALLOW / DENY / ASK / REDACT per call     │
│  3. ApprovalManager  — one-shot execution    │
│     tokens with expiry for ASK verdicts      │
│  4. MCPResultInspector — secret/PII redaction │
│     on tool responses before they leave      │
│  5. Evidence log     — every decision gets   │
│     a trace ID, hash, risk score             │
└──────────────────────────────────────────────┘
    │
    ▼
Upstream MCP server (the real tool host)
```

A tool call that violates policy is **never forwarded upstream**. An
approval-gated call executes exactly once per approval token. Secrets in the
tool response are always redacted before the client sees them.

## Why this instead of raw MCP

| Capability                          | raw MCP | @soterai/mcp-gateway |
| ----------------------------------- | ------- | -------------------- |
| Per-tool allow / deny decisions     | ❌      | ✅ via `evaluatePolicy` |
| Approval workflow with one-shot tokens | ❌   | ✅                   |
| Secret / PII redaction in results   | ❌      | ✅                   |
| Tenant / project session isolation  | ❌      | ✅                   |
| Rate limiting                       | ❌      | ✅                   |
| Circuit breaker on upstream failure | ❌      | ✅                   |
| Rate-limited, auth-token-gated HTTP | ❌      | ✅                   |
| Audit evidence (trace IDs, hashes)  | ❌      | ✅                   |

## Install

```bash
npm install @soterai/mcp-gateway
```

Node ≥ 18 required (uses native `fetch`, `crypto.randomUUID`).

## Quick start — CLI

```bash
# Proxy stdio: start the gateway around a local MCP server
npx soterai-mcp-gateway --stdio "npx -y @modelcontextprotocol/server-filesystem /tmp"

# Proxy HTTP: forward to a remote MCP endpoint
npx soterai-mcp-gateway --url http://localhost:8080/mcp --port 47322
```

The gateway listens on `127.0.0.1:47322` by default. Point your MCP client at
`http://127.0.0.1:47322/mcp`.

## Quick start — library

```ts
import { MCPJsonRpcGateway, DEFAULT_GATEWAY_CONFIG } from "@soterai/mcp-gateway";

const gateway = new MCPJsonRpcGateway(
  {
    ...DEFAULT_GATEWAY_CONFIG,
    upstreamEndpoint: { transport: "http", address: "http://localhost:8080/mcp" },
    tenant: "my-tenant",
    project: "my-project",
    protectionMode: "standard",
  },
  {
    evaluatePolicy: ({ serverName, toolName, args }) => {
      // Return ALLOW / DENY / ASK / REDACT
      if (toolName === "shell_exec") {
        return {
          action: "DENY",
          riskScore: 95,
          reasonCodes: ["SHELL_EXEC_DISABLED"],
          categories: ["shell"],
          explanation: "Shell execution is disabled by policy",
          redactedArgsPreview: "",
        };
      }
      if (toolName === "filesystem_write") {
        return {
          action: "ASK",
          riskScore: 60,
          reasonCodes: ["WRITE_NEEDS_APPROVAL"],
          categories: ["filesystem"],
          explanation: "Filesystem write requires approval",
          redactedArgsPreview: "",
        };
      }
      return {
        action: "ALLOW",
        riskScore: 0,
        reasonCodes: [],
        categories: [],
        explanation: "Allowed",
        redactedArgsPreview: "",
      };
    },
  }
);

// Feed JSON-RPC messages in (from an HTTP route, stdio, or a socket)
const response = await gateway.processMessage(
  { jsonrpc: "2.0", method: "tools/call", params: { name: "read_file", arguments: { path: "/etc/passwd" } }, id: 1 },
  { tenant: "my-tenant", project: "my-project", clientId: "client-1", userId: "user:alice" },
);
```

### Policy callback contract

```ts
evaluatePolicy(request: {
  serverName: string;     // upstream server identity if known
  toolName: string;       // e.g. "read_file"
  args: Record<string, unknown>; // already-sanitized arguments
  protectionMode?: string; // observe | standard | strict | enterprise_locked | air_gapped
}) => {
  action: "ALLOW" | "DENY" | "ASK" | "REDACT" | "TRANSFORM" | "BLOCK" | "QUARANTINE" | "ABSTAIN";
  riskScore: number;      // 0..100
  reasonCodes: string[];
  categories: string[];
  explanation: string;
  redactedArgsPreview: string;
}
```

- `ALLOW` — forward to upstream and return the result
- `DENY` / `BLOCK` — return an `isError` result; **never touches upstream**
- `ASK` — mint an approval ID, hold the call until approved via HTTP route
- `REDACT` — execute but run the result inspector on the response
- `ABSTAIN` — recorded as an abstention; fails closed when `failClosed`

### HTTP routes

`MCPServer` exposes:

| Path                          | Method | Purpose                        |
| ----------------------------- | ------ | ------------------------------ |
| `/mcp`                        | POST   | JSON-RPC endpoint              |
| `/health`                     | GET    | Liveness + version             |
| `/session/:id/approvals`      | POST   | Approve a pending `tools/call` |
| `/approvals/:approvalId`      | GET    | Inspect an approval            |

```ts
import { MCPServer } from "@soterai/mcp-gateway";

const server = new MCPServer({
  config: {
    ...DEFAULT_GATEWAY_CONFIG,
    upstreamEndpoint: { transport: "http", address: "http://localhost:8080/mcp" },
    authToken: process.env.SOTERAI_MCP_TOKEN,
  },
  deps: { evaluatePolicy: myPolicy },
  port: 47322,
});
await server.start();
```

## Evidence

Every enforcement decision appends to the gateway's evidence log
(`gateway.getEvidenceLog()`):

```ts
{
  traceId: string;          // UUIDv4 for correlation
  enforcement: "ALLOW" | "BLOCK" | "ASK" | "REDACT" | ...;
  toolName: string;
  riskScore: number;
  requestHash: string;      // SHA-256 of canonical args
  timestampMs: number;
  /* … plus approval / decision metadata */
}
```

This shape matches the SoterAI Command Layer so existing dashboards and
compliance tooling work unchanged.

## Security

- **Auth**: bearer token check when `authToken` is set
- **Isolation**: tenant/project/client-bound sessions with TTL
- **Rate limiting**: 120 req/min per client by default
- **Circuit breaker**: trips after 5 consecutive upstream failures
- **Payload bounds**: 1 MiB body, 500 KiB result, per-arg length cap
- **Fail-closed**: policy errors block the call when `failClosed: true`

## License

MIT — see `LICENSE`.
