# MCP Security

Date: 2026-07-22

## Implemented controls

SoterAI now has two MCP layers:

- Config analysis via `MCPPolicyAnalyzer`, which scans declared server transport, command, environment-key names, broad filesystem roots, remote endpoints, and prompt-injection text.
- Gateway policy via `MCPGateway`, which evaluates a proposed tool invocation before execution, redacts arguments for evidence, denies unknown servers, denies secret-bearing arguments, denies prompt-injected tool metadata, and escalates tainted invocations.
- Authenticated local broker preflight via `POST /v1/preflight/mcp-tool`.

Coverage:

- MCP config scanning: `PARTIAL_VISIBILITY`.
- MCP invocations routed through `evaluateMCPToolInvocation`: `STRONG_ENFORCEMENT`.
- MCP traffic outside the gateway: `UNSUPPORTED` for runtime enforcement.

## Required deployment model

A host or agent must call SoterAI's MCP gateway before invoking a tool. Config scanning alone does not prevent hidden side effects.

## Remaining gaps

- No universal interception of arbitrary MCP hosts.
- No live OAuth scope introspection for every MCP provider.
- No process sandbox for stdio MCP servers unless launched through a future broker/sandbox path.
- Dynamic tool changes are detected only when inventory is refreshed or gateway metadata is supplied.
