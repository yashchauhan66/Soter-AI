# Neovim adapter test report

Run date: 2026-07-06
Host OS: Windows 11, x64
Artifact: `extensions/neovim/` (Lua source plugin — no compiled artifact)

This report is honest. Items that could not be executed in this environment are
marked **NOT RUN** with the reason and a manual procedure plus expected result.
No PASS is invented.

## Environment findings

- `nvim` is **not installed / not on PATH** in this environment.
- `luac`, `luajit`, and `lua` are **not installed / not on PATH** in this
  environment.

Because no Lua interpreter or Neovim runtime is available here, the Lua files
were **not** compiled, linted, or executed. Correctness below is by code review
only, which is not a substitute for running the plugin.

## Results

| Check | Target | Result | Evidence / notes |
|---|---|---|---|
| Lua syntax lint (`luac -p`) | All `.lua` files | NOT RUN | No `luac`/`luajit`/`lua` on PATH. See manual procedure. |
| Plugin loads in clean config | `plugin/soterai.lua` | NOT RUN | No `nvim` runtime available. |
| Commands registered | 9 `:Soter*` commands | NOT RUN | Requires a running Neovim. |
| Broker health round trip | `:SoterBrokerStatus` → `GET /health` | NOT RUN | Requires Neovim + running broker. |
| Scan round trip | `:SoterScanBuffer` → `POST /v1/scan` | NOT RUN | Requires Neovim + running broker. |
| Redact round trip | `:SoterRedactSelection` → `POST /v1/redact` | NOT RUN | Requires Neovim + running broker. |
| Safe prompt to register | `:SoterSafePrompt` | NOT RUN | Requires Neovim + running broker. |
| Safe Mode toggle | `:SoterSafeModeOn/Off` | NOT RUN | Requires Neovim + running broker. |
| Recent events | `:SoterMemory` → `GET /v1/events/recent` | NOT RUN | Requires Neovim + running broker. |
| Git diff scan | `:SoterScanGit` | NOT RUN | Requires Neovim + running broker + git repo. |
| Canary privacy test | No raw content leaves loopback | NOT RUN | Requires a capture/proxy harness around the broker. |

## Static review notes (not a test result)

These were checked by reading the code, not by running it:

- The plugin guards Neovim < 0.7 and registers commands idempotently
  (`vim.g.loaded_soterai` plus a `registered` flag in `commands.lua`).
- The broker client attaches `Authorization: Bearer <token>` on all endpoints
  except `/health`, resolves the token from `~/.soterai/broker/auth-token` by
  default, and does not log/notify the token.
- Request bodies are sent to `curl` over stdin (`--data-binary @-`), keeping
  content out of the process argument list.
- Async on Neovim 0.10+ (`vim.system`) with a synchronous `vim.fn.system`
  fallback; both call back as `cb(err, data)` and marshal UI work through
  `vim.schedule`.

Treat all of the above as review observations to be confirmed by the manual
procedures below.

## Manual procedure to reproduce

### 1. Lua syntax lint (expected: no errors)

```sh
cd extensions/neovim
for f in plugin/soterai.lua lua/soterai/*.lua; do luac -p "$f" || echo "SYNTAX ERROR: $f"; done
```

Expected result: no output (all files parse). `luac -p` only checks syntax, not
Neovim API usage.

### 2. Plugin loads and registers commands (expected: 9 commands)

```sh
nvim --headless -u NONE \
  --cmd "set rtp+=$(pwd)/extensions/neovim" \
  -c "runtime plugin/soterai.lua" \
  -c "lua for _,c in ipairs({'SoterScanBuffer','SoterScanSelection','SoterRedactSelection','SoterSafePrompt','SoterBrokerStatus','SoterSafeModeOn','SoterSafeModeOff','SoterMemory','SoterScanGit'}) do assert(vim.fn.exists(':'..c)==2, c..' missing') end print('commands OK')" \
  -c "qa!"
```

Expected result: prints `commands OK` and exits 0. Any missing command aborts
with an assertion error.

### 3. Broker round trips (expected: broker decisions rendered)

Prerequisites: the Local AI Broker is running on `127.0.0.1:47321` and
`~/.soterai/broker/auth-token` exists and is non-empty.

1. `nvim README.md`
2. `:SoterBrokerStatus` — expect a float showing `status: ok`, `local only:
   true`, and the Safe Mode line.
3. Put a fake secret on a line (e.g. `AWS_SECRET_ACCESS_KEY=...`), select it,
   run `:'<,'>SoterScanSelection` — expect a decision at `warn`/`redact`/`block`
   and a detail float.
4. With the same selection, `:'<,'>SoterRedactSelection` — expect the line
   replaced by the broker's redacted text.
5. `:SoterSafePrompt` then paste from the clipboard/register — expect redacted
   content; the buffer is unchanged.
6. `:SoterSafeModeOn strict` then `:SoterBrokerStatus` — expect Safe Mode
   `enabled (strict)`. `:SoterSafeModeOff` returns it to disabled.
7. `:SoterMemory` — expect a float of recent redacted event summaries.
8. In a git repo with unstaged changes, `:SoterScanGit` — expect a decision for
   the diff.

### 4. Failure-path checks (expected: clear error, no change)

- Stop the broker, run `:SoterScanBuffer` — expect an error notification
  ("Could not reach the Local AI Broker …") and no buffer change.
- Rename the token file, run `:SoterScanBuffer` — expect a "token file is not
  readable" error.

### 5. Canary privacy test (expected: no raw content off loopback)

Route the broker behind a capture proxy or run a packet capture scoped to the
broker port, insert a unique canary string in the buffer, run the scan/redact
commands, and confirm the canary never appears on any non-loopback socket and
that the broker ledger stores only redacted/hashed evidence.

## Verdict

**NOT VERIFIED IN THIS ENVIRONMENT.** The adapter is written and reviewed, but no
lint, load, command, broker, or privacy check was executed here because neither a
Lua interpreter nor a Neovim runtime is available. The procedures above must pass
on a real Neovim host before any Neovim support claim.
