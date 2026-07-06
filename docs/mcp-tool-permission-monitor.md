# MCP / Tool Permission Monitor

LLMs increasingly use **MCP (Model Context Protocol) servers and tools** to reach
the filesystem, shell, network, and databases. SoterAI IDE Guard parses your MCP
configs and shows a **permission table + risk assessment**, and can generate a
hardened least-privilege policy.

## Commands (Phase 9)

| Command | What it does |
| --- | --- |
| **SoterAI: Scan MCP Configs** | Finds MCP config files and shows every server's permissions and risk. |
| **SoterAI: Show MCP Tool Permissions** | Permission table for the active MCP config (or a full scan). |
| **SoterAI: Block Risky MCP Recommendation** | Lists high/critical servers and opens the config to fix them. |
| **SoterAI: Generate MCP Safe Policy** | Emits a least-privilege policy JSON derived from your configs. |

## Config locations checked

`.vscode/mcp.json`, `.cursor/mcp.json(c)`, `.windsurf/mcp.json`, `.mcp.json`,
`mcp.json`, `.claude/mcp.json`, `.continue/config.json`, `.soterai/mcp.json`.
Both `{ "mcpServers": {...} }` and `{ "servers": {...} }` shapes are supported.

## Permissions & risk

`MCPPolicyAnalyzer` (in `@soterai/guard-core`) derives permissions from declared
config only — it never executes anything:

- **filesystem**, **broad_root** (`/`, `~`, drive roots, `..`)
- **shell** / **command_runner** (`npx`, `uvx`, `node`, `bash`, …)
- **network**, **remote_endpoint** (non-localhost URLs; credentials in URLs are
  redacted for display)
- **database**
- **env_secrets** — env var **names** that look like secrets. **Values are never
  read or shown.**
- **prompt-injection hints** — tool/description text containing phrasing like
  "ignore all previous instructions" or "send the secrets to…" escalates the
  server to **critical**.

Levels: `info` → `low` → `medium` → `high` → `critical`.

## Safe policy output

**Generate MCP Safe Policy** produces a JSON document with least-privilege
principles and, per server: the permissions to `allow`, items to `review`
(remove broad roots, move secret env keys out of config, pin remote endpoints,
sanitize descriptions), and whether it should `requireApproval`.

## Honest scope

SoterAI **reads and flags** MCP configs; it does not manage the MCP host and
cannot force another tool to honor its policy. It also never displays raw env
secret values — only names. Use the generated safe policy as guidance to harden
each server. See [ide-guard-limitations.md](ide-guard-limitations.md).
