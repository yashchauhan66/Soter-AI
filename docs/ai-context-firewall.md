# AI Context Firewall

SoterAI IDE Guard's AI Context Firewall controls **what AI can see**, **what AI
can output**, and **what gets audited** — locally, by default.

## Project policy — `.soterai/policy.json`

Create it with **SoterAI: Create Project AI Security Policy**. Schema:

```json
{
  "version": 1,
  "mode": "standard",
  "protectedFiles": [".env", ".env.*", "**/*.pem", "**/*.key", "**/id_rsa", "**/credentials", "**/secrets.*", "**/customer-*.csv", "**/production*.json"],
  "sensitivePaths": ["src/auth/**", "src/payments/**", "infra/**", "prisma/schema.prisma"],
  "aiContext": {
    "defaultAction": "warn",
    "protectedFileAction": "block",
    "sensitivePathAction": "approval_required",
    "allowSessionMinutes": 30
  },
  "cloud": { "enabled": false, "sendRawContent": false }
}
```

- **protectedFiles** → excluded from any SoterAI-built context (`block`).
- **sensitivePaths** → summarized, secrets redacted, and require approval.
- Patterns use `**`/`*`/`?` globs. A pattern without `/` matches by basename
  anywhere; a pattern with `/` anchors to the workspace root.
- A corrupt/partial policy safely falls back to the stricter defaults.

Commands: Create / Edit Policy, Show Protected Files, Add/Remove Current File to
Protected Files.

## Context permission gate (Phase 3)

- **SoterAI: Inspect AI Context** — shows every context source (selection,
  active file, open tabs, git diff, README/CLAUDE/.cursorrules, MCP config) with
  its sensitivity level, decision (allow/redact/block/approval), whether raw
  content is included (never — only redacted), and a safe preview.
- **Build Safe AI Context / Copy Safe AI Context** — assembles a secret-free
  bundle. Protected files are excluded; normal files are redacted with
  `redactForSharing`; the assembled text is asserted free of high-risk secrets.
- **Approve Context for Session / Clear Approval** — a time-boxed approval
  (`allowSessionMinutes`) for sharing sensitive-path summaries.

## Safe prompt builders (Phase 4)

**Build Safe Debug / Code Review / Deployment / Error Fix / Architecture
Prompt** — take your current context, redact/summarize it, wrap it in a task
frame with a security note, and copy a ready-to-paste, secret-free prompt.

## Honest scope

The firewall prevents **accidental exposure** and gives you auditable, safe
context. It cannot stop another extension from reading files you have not
migrated to the vault. Move real secrets into the [Protected Secret
Vault](protected-secret-vault.md) and share only SoterAI-built context. See
[ide-guard-limitations.md](ide-guard-limitations.md).
