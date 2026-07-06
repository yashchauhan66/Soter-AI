# Local Guard Agent — Enforcement Plan (Phase 10)

> **Status: design plan only.** Nothing in this document is implemented in the
> v0.1.x VS Code extension. It describes the architecture required for *stronger*
> enforcement than a VS Code extension can provide.

## Why a local agent is needed

A VS Code extension runs inside the same user/process/workspace trust boundary as
every other extension. It **cannot reliably**:

- Intercept another extension's internal file reads.
- Prevent an AI tool from reading a normal workspace file it already has access
  to.
- Mediate the OS-level filesystem, shell, or network calls made by MCP servers
  or spawned processes.

These require a component that sits **below** the extension host — a local agent
with OS-level mediation, plus a vault that stores secrets **outside** normal
workspace access.

## Design

### 1. Local service (127.0.0.1 only)
- Loopback-only service; **no unauthenticated localhost endpoint**.
- Authenticated **local IPC** (OS keychain-derived token or named-pipe/unix-socket
  peer credential check), so only authorized clients (the VS Code extension, a
  browser helper) can talk to it.

### 2. Protected vault (outside the workspace)
- Encrypted secret store on a path other extensions do not enumerate as
  workspace files (reuses the existing AES-256-GCM `VaultCrypto`).
- Workspace files hold only placeholders; the agent injects real values at
  runtime for authorized processes.

### 3. Context broker
- The single gate through which "safe context" is assembled and released.
- Applies project policy, redaction, and approval sessions before any content
  leaves the boundary.

### 4. MCP proxy
- All MCP traffic flows through the agent, which enforces the generated
  least-privilege policy (deny broad roots, strip secret env, pin endpoints,
  sanitize tool descriptions) — see
  [mcp-tool-permission-monitor.md](mcp-tool-permission-monitor.md).

### 5. Terminal approval broker
- Risky terminal commands (curl-to-shell, credential reads, destructive ops)
  require an explicit user approval brokered by the agent.

### 6. Signed policy + offline mode
- Policies are signed so an attacker cannot silently weaken them.
- Fully functional offline; no cloud dependency for enforcement.

### 7. Enterprise management
- Central policy distribution, fleet reporting, and tamper-evident audit export.

## Threat-model honesty

Even a local agent is not "100% block every extension" unless the OS enforces the
boundary (sandboxing, per-process filesystem ACLs, EDR integration). The agent's
value is **strong, auditable mediation** of the vault, context, MCP, and terminal
paths — a large improvement over best-effort extension-only controls, stated
without overclaiming. See [ide-guard-limitations.md](ide-guard-limitations.md).
