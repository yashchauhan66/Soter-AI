# SoterAI IDE Guard for Sublime Text

Early adapter implementation. It is a **thin** Sublime Text package: it captures
the text you choose (a file or a selection) and forwards it to the authenticated
loopback Local AI Broker. Detector, redaction and policy logic live in the shared
SoterAI engine, not in this package.

This repository does not yet claim Sublime Text support. Loadability in a clean
Sublime install, broker-backed scan/redact, a canary privacy check, and a
Package Control listing are required first (see
[`docs/sublime-test-report.md`](../../docs/sublime-test-report.md)).

## Requirements

- Sublime Text 4 (the package targets the Python 3.8 plugin host; a
  `.python-version` file requests it).
- A running SoterAI Local AI Broker reachable on loopback (default
  `http://127.0.0.1:47321`).
- The broker's bearer token, readable from `~/.soterai/broker/auth-token` or set
  explicitly in settings.

The package uses only the Python standard library (`urllib`, `json`,
`threading`). It has no third-party dependencies.

## Install

### Package Control (planned)

Once the package is accepted into the Package Control default channel it will be
installable via `Package Control: Install Package` → `SoterAI IDE Guard`. The
submission checklist is in
[`docs/publishing-sublime-package-control.md`](../../docs/publishing-sublime-package-control.md).
Until then, install manually.

### Manual install (works today)

1. In Sublime Text, run `Preferences: Browse Packages` from the command palette.
2. Copy this `extensions/sublime` folder into that `Packages` directory and
   rename it to `SoterAI Guard`. The final path should be
   `.../Packages/SoterAI Guard/soterai_guard.py`.
3. Restart Sublime Text (or let it reload the package automatically).
4. Run `SoterAI Guard: Broker Status` from the command palette to confirm the
   broker is reachable.

## Configuration

Open `Tools > SoterAI Guard > Settings` (or `Preferences > Package Settings`
style edit via the command palette entry `SoterAI Guard: Settings`).

| Setting | Default | Purpose |
| --- | --- | --- |
| `broker_url` | `http://127.0.0.1:47321` | Loopback broker base URL. |
| `token` | `""` | Optional inline bearer token. Prefer `token_path`. |
| `token_path` | `~/.soterai/broker/auth-token` | File to read the token from when `token` is empty. |
| `safe_mode_level` | `developer` | Level used by `Toggle Safe Mode` (`developer`/`strict`/`enterprise`). |
| `timeout_seconds` | `10` | Per-request network timeout. |

### Credential handling

The bearer token is a credential. This package never logs it and never writes it
to the output panel, status bar or error messages. Prefer `token_path` so the
token stays in the broker's own file rather than in a Sublime settings file. If
you paste a token into `token`, remember that Sublime settings are plain text on
disk.

## Commands

Available from the command palette, the `Tools > SoterAI Guard` menu, and the
editor right-click menu:

| Command | Effect |
| --- | --- |
| `SoterAI Guard: Scan File` | Scan the whole active file; show decision, risk and categories. |
| `SoterAI Guard: Scan Selection` | Scan the current selection(s). |
| `SoterAI Guard: Redact Selection` | Replace the selection in place with the broker's redacted text. |
| `SoterAI Guard: Copy Safe Prompt to Clipboard` | Copy a redacted copy to the clipboard without changing the buffer. |
| `SoterAI Guard: Broker Status` | Show broker health, version and Safe Mode state. |
| `SoterAI Guard: Toggle Safe Mode` | Enable/disable Safe Mode at `safe_mode_level`. |

Network calls run on a background thread, so the editor never freezes while a
scan is in flight. Buffer edits (redaction) are applied back on the main thread.

## Honest limitations

- The package does nothing useful without a running, reachable broker.
- It only inspects text you explicitly send. It does **not** intercept every
  prompt typed into other AI tools, nor every command typed into the terminal.
  Sublime provides no supported hook to do so.
- Redaction reduces exposure; it does not guarantee that all sensitive data is
  removed. Review results before sharing.
- No content is sent to SoterAI Cloud by default. The broker is the enforcement
  boundary and keeps a redacted ledger.
- There are no "100% secure" claims. This is a guard rail, not a guarantee.

## License

See the repository `LICENSE`.
