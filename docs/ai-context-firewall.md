# AI Context Firewall

SoterAI IDE Guard's AI Context Firewall applies policy to context built through
SoterAI and records supported managed decisions. It does not control what an
independent assistant can read, transmit or produce.

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
- Invalid or unreadable managed boundary policy denies sharing from that root.
  Accepted repository denies are retained add-only; removal requires a separate
  labelled editor review, which is not agent-proof against same-user code.

Commands include Create/Edit Policy, Show Protected Files and add protected
paths. The old programmatic removal operation refuses; use Manage Manual AI
Rules for separate review of a retained deny after removing the repository entry.

## Context permission gate (Phase 3)

- **SoterAI: Inspect AI Context** — shows every context source (selection,
  active file, open tabs, git diff, README/CLAUDE/.cursorrules, MCP config) with
  its sensitivity level, decision (allow/redact/block/approval), whether raw
  content was excluded or transformed, and a managed preview.
- **Build Safe AI Context / Copy Safe AI Context** — excludes accepted protected
  sources and applies recognized-pattern redaction to included context. Unknown
  private information can remain; a candidate bundle is not a confidentiality proof.
- **Approve Context for Session / Clear Approval** — a time-boxed approval
  (`allowSessionMinutes`) for sharing sensitive-path summaries.

## Safe prompt builders (Phase 4)

**Build Safe Debug / Code Review / Deployment / Error Fix / Architecture
Prompt** — take your current context, redact/summarize it, wrap it in a task
frame with a security note, and copy a candidate prompt. Review unmarked private
information before sharing.

## Honest scope

These paths can reduce accidental exposure. Other extensions and native
processes can still read original files, buffers, Git/history and reachable
credentials or make their own network calls. The [Protected Secret Vault](protected-secret-vault.md)
changes selected file content but does not establish independent custody.
Selected-architecture G1–G6 remain **UNTESTED**, with the full claim **BLOCKED**. See
[ide-guard-limitations.md](ide-guard-limitations.md).
