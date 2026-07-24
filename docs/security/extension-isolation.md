# Extension Isolation Policy

Date: 2026-07-22

`ExtensionIsolationPolicy` evaluates third-party IDE extensions before sensitive AI workflows.

It flags extensions by:

- AI/agent-like identity.
- Workspace, filesystem, terminal, network, MCP, debug, or SCM authority.
- Unverified or untrusted publisher.
- Missing enterprise allowlist entry.
- Explicit blocklist entry.
- Untrusted workspace context.

The authenticated local broker exposes this as:

- `POST /v1/preflight/extension-isolation`

The VS Code extension exposes:

- `SoterAI: Show Extension Isolation Summary`

Important limitation: VS Code extensions share host authority. SoterAI can detect, warn, and recommend workspace disable/enterprise allowlisting, but guaranteed isolation requires organization-level extension controls or a separate sandboxed IDE/runtime profile.
