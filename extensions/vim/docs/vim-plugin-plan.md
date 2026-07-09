# SoterAI IDE Guard for Vim — plugin plan

Status date: 2026-07-06. Priority 4 in the cross-IDE feasibility matrix
("defer to a basic adapter"). This is a design/status record, not a support
claim.

## Goal

Provide a minimal, honest Vim entry point to the SoterAI Local AI Broker. The
adapter must add zero detection logic: it builds authenticated requests, sends
buffer/range text to the broker, and renders the broker's redacted responses.

## Why Vim is a basic adapter

Vim has no native HTTP client and fragmented async/JSON/TLS support across
builds and versions. The defensible, portable MVP is a synchronous `curl`
shell-out gated on `json_encode`/`json_decode`. Neovim (priority 8) gets the richer Lua adapter;
Vim intentionally stays basic.

## Architecture

```
plugin/soterai.vim    Command definitions + handlers (buffer/range plumbing).
autoload/soterai.vim  Broker helpers: config, token resolution, curl request,
                      response formatting, scratch/echo rendering.
```

- **Transport.** `curl` invoked through a temporary `--config` file so the
  Authorization header (and therefore the token) never appears in `argv`.
  Request bodies are written to a temporary file and referenced with
  `data = "@file"`. Both temp files are deleted in a `finally` block.
- **Token.** Resolved from `g:soterai_token`, else the first non-empty line of
  `~/.soterai/broker/auth-token` (override with `g:soterai_token_file`). Never
  echoed, logged, or written outside the transient config file.
- **Auth policy.** Every endpoint sends `Authorization: Bearer <token>` except
  `GET /health`, matching the broker contract.
- **Rendering.** A single reusable read-only scratch buffer (`__SoterAI__`)
  plus a one-line `echomsg` summary.

## Broker endpoints used

| Command | Method + path | Notes |
|---|---|---|
| `:SoterScanBuffer` / `:SoterScanSelection` | `POST /v1/scan` `{content}` | Renders `decision`, `riskScore`, `categories`, `evidencePreview`, `contentHash`. |
| `:SoterRedactRange` / `:SoterSafePrompt` | `POST /v1/redact` `{content}` | Uses `redacted` field only. |
| `:SoterBrokerStatus` | `GET /health`, `GET /version`, `GET /v1/safe-mode/status` | Health is unauthenticated; the others require the token. |

## Feature-parity target (Vim column)

Copied from `docs/cross-ide-feature-parity-matrix.md`; every broker-backed
row is **B**. This adapter implements a subset:

| Feature | Target | This adapter |
|---|---|---|
| Scan Selection | B | Implemented (`:SoterScanSelection`) |
| Scan Current File | B | Implemented (`:SoterScanBuffer`) |
| Redact Selection for AI | B | Implemented (`:SoterRedactRange`) |
| Safe Prompt Builder | B | Implemented (`:SoterSafePrompt`) |
| Local AI Broker start/status | P/B | Status only (`:SoterBrokerStatus`); no broker lifecycle mgmt |
| What AI Saw Ledger | B | Not yet (broker `GET /v1/events/recent` exists; no command wired) |
| AI Safe Mode | B | Read-only status; no enable/disable command yet |

## Deliberately out of scope for the basic adapter

- Async/non-blocking requests (`job_start`/channels).
- Gutter signs, popups, or live decoration.
- Terminal command interception (not reliably possible; see matrix).
- Any secret storage beyond the OS-file/broker handoff (Vim has no vault).

## Future work

- Optional async path using `job_start` where the Vim build supports it.
- `:SoterEvents` reading `GET /v1/events/recent` into the scratch buffer.
- `:SoterSafeMode enable|disable` calling the safe-mode endpoints.
- Automated headless smoke test (`vim -Nu`) against a broker stub.

## References

- [Vim `json_encode`/`json_decode`](https://vimhelp.org/eval.txt.html#json_encode)
- [Vim `system()` and `tempname()`](https://vimhelp.org/builtin.txt.html#system%28%29)
- [curl `--config` files](https://curl.se/docs/manpage.html#-K)
