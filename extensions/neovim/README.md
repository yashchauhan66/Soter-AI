# SoterAI IDE Guard for Neovim

Early adapter implementation. It is a thin Lua plugin: it collects text from a
buffer, range, or `git diff`, sends it to the authenticated **Local AI Broker**
on loopback, and renders the broker's decision. All detector, redaction, and
policy logic lives in the shared SoterAI engine behind the broker — this plugin
reimplements none of it.

This repository does not yet claim Neovim support. Loadable-plugin verification,
broker integration, command smoke tests, and canary privacy evidence are
required first. See `docs/neovim-test-report.md` for the honest status.

## Requirements

- Neovim 0.7 or newer (async broker calls use `vim.system` on 0.10+, with a
  synchronous `vim.fn.system` fallback on older versions).
- `curl` on `PATH`.
- A running SoterAI Local AI Broker listening on `http://127.0.0.1:47321`
  (or a custom URL you configure).
- A broker auth token. By default the plugin reads it from
  `~/.soterai/broker/auth-token`. The token is never logged, echoed, or written
  into a buffer.

## Install

### lazy.nvim

```lua
{
  "soterai/ide-guard-neovim",
  -- Optional; commands work without calling setup().
  config = function()
    require("soterai").setup({
      broker_url = "http://127.0.0.1:47321",
      -- token_path = vim.fn.expand("~/.soterai/broker/auth-token"),
      -- safe_prompt_register = "+",
    })
  end,
}
```

### packer.nvim

```lua
use({
  "soterai/ide-guard-neovim",
  config = function()
    require("soterai").setup({})
  end,
})
```

### Manual install

Copy or symlink this directory into a `packpath` entry so that `plugin/` and
`lua/` are discoverable, for example:

```
~/.config/nvim/pack/soterai/start/ide-guard-neovim/
  ├── plugin/soterai.lua
  └── lua/soterai/{init,broker,commands}.lua
```

Neovim loads `plugin/soterai.lua` automatically and registers the commands.
Calling `require("soterai").setup(...)` is optional and only overrides
configuration.

## Configuration

`setup()` accepts (defaults shown):

```lua
require("soterai").setup({
  broker_url = "http://127.0.0.1:47321", -- loopback broker base URL
  token = nil,                            -- explicit token (prefer token_path)
  token_path = nil,                       -- default: ~/.soterai/broker/auth-token
  safe_prompt_register = "+",             -- register for :SoterSafePrompt
  timeout = 20,                           -- curl timeout (seconds)
  default_safe_mode_level = "developer",  -- used by :SoterSafeModeOn with no arg
  notify = true,                          -- set false to silence info notifications
})
```

Prefer leaving `token` unset so the secret stays out of your dotfiles; the
plugin reads the token file at request time only.

## Commands

| Command | Range | Action |
|---|---|---|
| `:SoterScanBuffer` | no | Scan the whole current buffer. |
| `:SoterScanSelection` | yes | Scan the selected line range (or whole buffer if no range). |
| `:SoterRedactSelection` | yes | Replace the selected range with broker-redacted text. |
| `:SoterSafePrompt` | yes | Copy a broker-redacted version of the range/buffer to a register (default: system clipboard). Does not modify the buffer. |
| `:SoterBrokerStatus` | no | Show broker health and Safe Mode status. |
| `:SoterSafeModeOn [level]` | no | Enable Safe Mode (`developer`, `strict`, or `enterprise`). |
| `:SoterSafeModeOff` | no | Disable Safe Mode. |
| `:SoterMemory` | no | Show recent redacted broker events. |
| `:SoterScanGit` | no | Scan `git diff` output via the broker. |

`:'<,'>SoterScanSelection` and friends work over a visual selection because the
`:` range is line-wise. Selection-based commands operate on whole lines — see
Limitations.

Suggested mappings (optional):

```lua
vim.keymap.set("n", "<leader>ss", "<cmd>SoterScanBuffer<cr>", { desc = "SoterAI scan buffer" })
vim.keymap.set("x", "<leader>ss", ":SoterScanSelection<cr>",  { desc = "SoterAI scan selection" })
vim.keymap.set("x", "<leader>sr", ":SoterRedactSelection<cr>", { desc = "SoterAI redact selection" })
vim.keymap.set("x", "<leader>sp", ":SoterSafePrompt<cr>",      { desc = "SoterAI safe prompt" })
```

## Security model

- **Local-first.** The plugin talks only to the loopback broker. It does not
  send raw source, secrets, or prompts to any cloud. The broker is the
  enforcement boundary and redacts its own ledger.
- **Authenticated.** Every endpoint except `/health` requires the broker bearer
  token. The token is read from the token file (or explicit config) per request
  and never logged or placed on a shell command line.
- **No plaintext exposure via process args.** Request bodies are streamed to
  `curl` over stdin, not passed as command-line arguments.

## Limitations (honest)

- **No claim of "100% secure."** This adapter reduces accidental exposure of
  secrets/prompts in the flows you explicitly route through it. It cannot
  intercept everything you type, paste elsewhere, or send from other plugins.
- **Line-wise selections.** `:SoterScanSelection`, `:SoterRedactSelection`, and
  `:SoterSafePrompt` operate on the line range of a selection, not exact
  character columns. Redaction replaces whole lines.
- **No universal terminal/AI interception.** Neovim provides no supported hook
  to observe every shell command, or another plugin's private AI context. This
  adapter mediates only the content you pass to its commands.
- **Broker required.** With no broker running (or an unreadable/empty token
  file), commands report a clear error and do nothing else.
- **Remote/SSH/WSL topology.** `127.0.0.1` must actually be the machine running
  the broker. Remote editing needs the broker beside the Neovim instance or an
  authenticated tunnel; do not assume `localhost` is your laptop.

## License

See the repository `LICENSE`.
