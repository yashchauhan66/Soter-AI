# SoterAI IDE Guard for Vim

A deliberately minimal Vim adapter for the SoterAI Local AI Broker. It is a
**thin** adapter: every detector, redaction rule, and policy decision lives in
the broker. This plugin only builds authenticated `curl` calls to the broker on
loopback and renders the results it returns.

This is an early adapter. It does not make SoterAI "supported" on Vim. See
[`docs/vim-test-report.md`](docs/vim-test-report.md) for the honest test status.

## Requirements

- Vim 8.0 or newer with the `json_encode`/`json_decode` builtins (present in
  all modern Vim builds; the plugin checks and no-ops if they are missing).
- `curl` on `PATH`. Vim has no native HTTP client, so the adapter shells out.
- A running SoterAI Local AI Broker on loopback (default
  `http://127.0.0.1:47321`) and its auth token.

## Install

### Vim 8 native packages

```sh
mkdir -p ~/.vim/pack/soterai/start
cp -r extensions/vim ~/.vim/pack/soterai/start/soterai
```

### vim-plug

```vim
Plug 'soterai/ide-guard', { 'rtp': 'extensions/vim' }
```

(or point `Plug` at a local checkout / your fork; adjust `rtp` to the plugin
subdirectory).

## Configure

The token is read from `g:soterai_token` if set, otherwise from the token file.
Prefer the file so the token is not stored in your `vimrc`.

```vim
" Optional; these are the defaults.
let g:soterai_broker_url = 'http://127.0.0.1:47321'
let g:soterai_token_file = '~/.soterai/broker/auth-token'
" Optional: register used by :SoterSafePrompt (defaults to the unnamed register).
let g:soterai_prompt_register = '"'
```

The token is only ever placed inside a temporary `curl --config` file that is
deleted after each request, so it never appears in the process argument list
and is never echoed or logged.

## Commands

| Command | Range | Description |
|---|---|---|
| `:SoterScanBuffer` | no | Scan the whole buffer; show decision/risk/findings in a scratch window. |
| `:SoterScanSelection` | yes | Scan the selected/line range (e.g. `:'<,'>SoterScanSelection`). |
| `:SoterRedactRange` | yes | Replace the range in place with the broker's redacted text. |
| `:SoterBrokerStatus` | no | Show broker health, version, and Safe Mode state (no token shown). |
| `:SoterSafePrompt` | yes (default whole buffer) | Redact the range and yank it into a register + scratch window to paste into an AI chat. |

Results appear in a read-only `__SoterAI__` scratch window and, briefly, on the
message line.

## Honest limitations

- **Blocking calls.** `curl` runs synchronously, so large scans pause Vim for
  the duration of the request. There is no async job pipeline in this adapter.
- **No rich UI.** Output is plain text in a scratch buffer; there is no
  gutter, popup adornment, or live decoration.
- **No universal interception.** The adapter only inspects text you explicitly
  send it. It cannot observe other plugins, AI assistants, terminal input, or
  network traffic, and does not claim to.
- **Local-first.** Content goes only to the loopback broker. Nothing is sent to
  SoterAI Cloud by default. The plugin makes no "100% secure" claim.
- **Feature fragmentation.** Behavior depends on your Vim build (`+json`,
  `+clipboard`). Missing features degrade gracefully rather than silently
  succeeding.
