# @soterai/cli — `soterai`

**Local-first AI security guard CLI.** Scan files, redact PII/secrets, audit MCP
configs and git diffs, and manage the SoterAI Local AI Broker — from any editor
or terminal, no native plugin required.

> Sponsored by [SoterAI](https://soterai.in).

`@soterai/cli` is the cross-platform fallback runtime for SoterAI Guard: it gives
VS Code, Cursor, Windsurf, Neovim, JetBrains, CI pipelines — anything with a shell —
the same loopback-only security surface as the native IDE extensions.

## Install

```bash
npm install -g @soterai/cli
# or run once without installing:
npx @soterai/cli --help
```

Node ≥ 18 required.

## Commands

```
soterai scan file <path>        Scan a file through the Local AI Broker
soterai scan text               Scan text from stdin
soterai redact file <path>      Print a redacted, AI-safe version of a file
soterai broker start            Start the loopback Local AI Broker
soterai broker status           Show broker health and version
soterai safe-mode on [level]    Enable Safe Mode (developer|strict|enterprise)
soterai safe-mode off           Disable Safe Mode
soterai safe-mode status        Show Safe Mode status
soterai memory export           Export the redacted "What AI Saw" ledger
soterai mcp scan                Scan MCP config files for risky content
soterai git scan                Scan uncommitted git changes
soterai version                 Show CLI and broker protocol version
```

### Global flags

| Flag              | Meaning                                                       |
| ----------------- | ------------------------------------------------------------- |
| `--url <url>`     | Broker base URL (default loopback `DEFAULT_BROKER_URL`)       |
| `--token <t>`     | Broker token (else `SOTERAI_BROKER_TOKEN` or the token file)  |
| `--json`          | Emit machine-readable JSON                                    |

### Exit codes

| Code | Meaning                                       |
| ---- | --------------------------------------------- |
| 0    | Success / allow                               |
| 1    | Blocked by policy, or broker unreachable      |
| 2    | Usage error (bad/missing arguments)           |
| 3    | `approval_required` — action held for review  |

These are stable and safe to gate CI on:

```bash
soterai scan file ./prompts/system.md --json || exit 1
```

## Local-first privacy model

- File contents are sent only to the **loopback** Local AI Broker —
  `127.0.0.1`/localhost, never to a remote host.
- Raw secrets are **never printed**: scan output shows the decision
  (`allow`/`block`/`approval_required`), risk score, categories, and an
  already-redacted evidence preview. The `redact` command prints only the
  scrubbed document.
- The broker token is resolved from `--token`, `SOTERAI_BROKER_TOKEN`, or the
  token file — and is never logged.

## Examples

```bash
# Scan a prompt before sending it to an LLM
echo "Summarize this: $(cat customer-data.csv)" | soterai scan text

# Produce an AI-safe version of a file for pasting into a chatbot
soterai redact file ./logs/prod-2026-07-31.log > safe.log

# Gate a PR on uncommitted changes
soterai git scan --json

# Find risky MCP servers defined in this workspace
soterai mcp scan

# Air-gapped guard posture
soterai broker start &
soterai safe-mode on enterprise
soterai broker status

# Machine-readable output for CI
soterai scan file ./config.env --json
```

## Programmatic use

```ts
import { run, defaultDeps, parseArgs } from "@soterai/cli";

// Full control over side-effects (out/err/client/stdin/git/…):
const code = await run(["scan", "text"], myDeps);
```

## Hardened against top CLIs

Compared to Snyk / Claude-Code-style CLIs, `@soterai/cli` gives you: explicit
stable exit codes, `--json` for every command, injectable deps for deterministic
testing, loopback-only transport, and secret-safe output contracts — with zero
runtime dependencies beyond `@soterai/ide-common` and `soter-pii`.

## License

Business Source License 1.1 — see `LICENSE`. Converts to Apache-2.0 on the
change date.
