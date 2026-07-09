# SoterAI Guard CLI (`soterai-guard`)

Package: `packages/soterai-cli`
Status: Built and tested. Works on Windows, macOS, and Linux wherever Node.js 18+ is available.

The CLI is the shared fallback for IDE adapters where direct broker API integration is difficult, and a standalone tool for scripting, CI pipelines, and pre-commit hooks.

## Install

```bash
# From the monorepo (after npm ci):
npx soterai --help

# Or link globally for development:
npm --prefix packages/soterai-cli link
soterai --help
```

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

## Global flags

```
--url <url>     Broker base URL (default http://127.0.0.1:47321, loopback only)
--token <t>     Broker token (else SOTERAI_BROKER_TOKEN env var or token file)
--json          Emit machine-readable JSON output
```

## Token resolution

The CLI resolves the broker token in this order:
1. `--token <value>` flag
2. `SOTERAI_BROKER_TOKEN` environment variable
3. Token file at `~/.soterai/broker/auth-token` (written by the broker on first start)

The token is never printed in output, logs, or error messages.

## Security guarantees

- File contents are sent only to the loopback broker (`127.0.0.1`). No raw source, secrets, or prompts are sent to SoterAI Cloud by default.
- Scan output shows only the decision, risk score, categories, and a redacted evidence preview — never the matched raw secret value.
- `redact file` prints the broker's redacted output, which is safe to pipe or display.
- `memory export` returns the broker's redacted ledger (content hashes and decisions, not raw content).

## Exit codes

| Code | Meaning |
|---|---|
| 0 | Success / decision is `allow` or `warn` |
| 1 | Broker unreachable or unexpected error |
| 2 | Bad arguments |
| 3 | Decision is `approval_required` |
| 1 | Decision is `block` (scan commands) |

## MCP scan

`soterai mcp scan` searches for MCP config files in common locations:
- `.mcp.json`, `mcp.json` in the current directory
- `.cursor/mcp.json`, `.vscode/mcp.json`, `.config/mcp.json`
- `~/.config/` entries containing "mcp"

Returns exit code 1 if any config has a risk score ≥ 70.

## Git scan

`soterai git scan` runs `git diff --no-color` in the current directory and scans the output. Useful as a pre-commit hook:

```bash
# .husky/pre-commit or .git/hooks/pre-commit
soterai git scan || exit 1
```

## Broker start

`soterai broker start` spawns the Local AI Broker process (from `@soterai/local-ai-broker`). The broker must be built first:

```bash
npm --prefix apps/local-ai-broker run build
soterai broker start
```

## Limitations

- The CLI cannot observe AI extensions, terminals, or prompts it does not itself send to the broker.
- `broker start` requires the broker package to be built and resolvable via `require.resolve`.
- Large files are sent to the broker in a single request; very large files may hit broker request size limits.
- No "100% secure" claim. The CLI is a thin client over the broker's detection engine.
