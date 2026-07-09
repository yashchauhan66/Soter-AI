# SoterAI IDE Guard — Neovim adapter plan

Status date: 2026-07-06. This is an engineering plan and design record, not a
support claim. Neovim becomes "supported" only after the plugin loads in a clean
config, completes a broker-backed scan, passes the canary privacy test, and ships
a tagged release consumers can install with a plugin manager.

## Goal and non-goals

The adapter is a **thin Lua client**. It moves text from the editor to the
authenticated Local AI Broker and renders the broker's decision. It does not,
and must not, reimplement detectors, redaction, scoring, or policy — those live
in the shared SoterAI engine behind the broker.

Non-goals for this slice:

- Universal terminal or shell-command interception (Neovim has no supported hook
  for it).
- Observing other plugins' private AI context.
- Any "100% secure" claim.

## Architecture

```
Neovim buffer / range / git diff
        │  (text only)
        ▼
lua/soterai/commands.lua   ── collects text, renders results (notify + float)
        │
        ▼
lua/soterai/broker.lua     ── curl subprocess, JSON, token from file, async
        │  HTTP loopback, Bearer <token>
        ▼
Local AI Broker 127.0.0.1:47321  ── detectors, redaction, policy, redacted ledger
```

- `plugin/soterai.lua` — loaded automatically by Neovim; registers the `:Soter*`
  user commands (idempotent) and guards against Neovim < 0.7.
- `lua/soterai/init.lua` — configuration only: `setup(opts)`, defaults, `get()`.
- `lua/soterai/broker.lua` — dependency-free HTTP client. Async via `vim.system`
  on Neovim 0.10+, synchronous `vim.fn.system` fallback otherwise. Same
  callback shape either way: `cb(err, data)`.
- `lua/soterai/commands.lua` — command handlers and UI (notifications + a
  read-only scratch float for detail).

No third-party Lua dependency is required (no plenary, no lua-cjson). JSON uses
Neovim's built-in `vim.json` with a `vim.fn.json_*` fallback.

## Command map

| Command | Broker endpoint | Notes |
|---|---|---|
| `:SoterScanBuffer` | `POST /v1/scan` | Whole buffer. |
| `:SoterScanSelection` | `POST /v1/scan` | Line range; whole buffer if no range. |
| `:SoterRedactSelection` | `POST /v1/redact` | Replaces the range lines with redacted text. |
| `:SoterSafePrompt` | `POST /v1/redact` | Copies redacted text to a register (default `+`); buffer unchanged. |
| `:SoterBrokerStatus` | `GET /health` + `GET /v1/safe-mode/status` | Health, local-only flag, Safe Mode. |
| `:SoterSafeModeOn [level]` | `POST /v1/safe-mode/enable` | `developer`\|`strict`\|`enterprise`. |
| `:SoterSafeModeOff` | `POST /v1/safe-mode/disable` | — |
| `:SoterMemory` | `GET /v1/events/recent` | Redacted event summaries. |
| `:SoterScanGit` | `POST /v1/scan` | Scans `git diff` output. |

Decision values handled: `allow`, `warn`, `redact`, `block`, `approval_required`.
A clean `allow` produces a short notification; anything else opens the detail
float. `block`/`approval_required` are surfaced at error level.

## Security model

- **Loopback only.** Default base URL is `http://127.0.0.1:47321`, overridable
  via `broker_url`. No raw source/secret/prompt is sent to any cloud by this
  plugin.
- **Authenticated.** All endpoints except `/health` require `Authorization:
  Bearer <token>`. The token is resolved per request from `token` (explicit) or
  `token_path` (default `~/.soterai/broker/auth-token`). It is never logged,
  echoed, notified, or written into a buffer.
- **No plaintext in process args.** Request bodies are streamed to `curl` via
  stdin (`--data-binary @-`), so buffer content does not appear in the process
  table.
- **Broker is the boundary.** Redaction and the event ledger are the broker's
  responsibility; the plugin only displays what the broker returns.

## Broker dependency

The plugin is inert without a running broker. On an unreachable broker,
unreadable/empty token file, or missing `curl`, each command reports a clear
error and makes no change. This is intentional: the adapter never falls back to
a local best-effort detector.

## Distribution and publishing path

Neovim has no central reviewed marketplace. Distribution is a Git repository plus
tagged releases installed by a plugin manager (`lazy.nvim`, `packer`, native
`packpath`). Optional discoverability via community indexes (awesome-neovim,
dotfyle). Details in `docs/publishing-neovim-plugin.md`.

## Testing path

Headless Neovim (`nvim --headless`) can load the plugin and exercise commands
against a broker or a stub loopback server. See `docs/neovim-test-report.md` for
what has and has not been run, and the manual procedure to reproduce.

## Open items before a support claim

- Loadable-plugin verification in a clean config (headless).
- Broker-backed scan/redact round trip against the real broker.
- Canary privacy test proving no raw content leaves loopback.
- Character-precise (not line-wise) selection handling, if required.
- Tagged release + install verification with `lazy.nvim` and `packer`.
