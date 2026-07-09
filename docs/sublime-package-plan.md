# SoterAI IDE Guard - Sublime Text package plan

Status date: 2026-07-06. This is an engineering plan, not a support claim.
Sublime Text becomes a supported target only after the package loads in a clean
install, completes a broker-backed scan and redact, passes a canary privacy
check, and is listed through Package Control.

## Goal and non-goals

Ship a **thin** Sublime Text 4 package that reuses the shared SoterAI security
plane. The package captures editor content that the user explicitly chooses and
forwards it to the authenticated loopback Local AI Broker.

Non-goals:

- No reimplementation of detectors, redactors, canary logic or policy. Those
  live in the broker.
- No silent interception of other AI extensions' prompts or of terminal input.
  Sublime provides no supported hook for that (see the cross-IDE feasibility
  matrix). The adapter must not claim to observe what it cannot.
- No raw cloud upload by default. The broker is the enforcement boundary.

## Runtime constraints

- Sublime Text 4 runs plugins on a bundled interpreter. The package requests the
  Python 3.8 plugin host via a `.python-version` file containing `3.8`.
- Only the Python standard library is available (`urllib.request`, `json`,
  `threading`). No `pip`, no third-party packages.
- Plugin command callbacks run on the main UI thread. Blocking network calls
  there would freeze the editor, so all broker I/O runs on a worker thread and
  results are marshalled back with `sublime.set_timeout`.
- A Sublime `edit` token is only valid inside the command run that created it.
  Redaction therefore captures spans, fetches redacted text off-thread, and
  re-enters an internal `TextCommand` to apply the replacement.

## Broker HTTP contract used

Loopback base URL default `http://127.0.0.1:47321`. Bearer token on every
endpoint except `GET /health`. Token read from settings `token`, else from the
file at `token_path` (default `~/.soterai/broker/auth-token`).

| Package action | Endpoint |
| --- | --- |
| Broker Status | `GET /health`, `GET /version`, `GET /v1/safe-mode/status` |
| Scan File / Scan Selection | `POST /v1/scan` `{content}` |
| Redact Selection / Safe Prompt | `POST /v1/redact` `{content}` |
| Toggle Safe Mode | `GET /v1/safe-mode/status`, `POST /v1/safe-mode/enable` `{level}`, `POST /v1/safe-mode/disable` |

`decision` values consumed for display: `allow | warn | redact | block |
approval_required`.

## Package layout

```
extensions/sublime/
  .python-version                 # requests the 3.8 plugin host
  soterai_guard.py                # sublime_plugin commands (thin)
  broker_client.py                # stdlib urllib client, no sublime dependency
  SoterAI Guard.sublime-settings  # broker_url, token, token_path, level, timeout
  Default.sublime-commands        # command palette entries
  Context.sublime-menu            # editor right-click entries
  Main.sublime-menu               # Tools > SoterAI Guard menu
  messages.json                   # maps install -> messages/install.txt
  messages/install.txt            # first-run guidance and limitations
  README.md                       # install + honest limitations
```

## Commands

| Command class | Palette id | Type | Behaviour |
| --- | --- | --- | --- |
| `SoteraiScanFileCommand` | `soterai_scan_file` | TextCommand | Scan whole buffer, show findings in an output panel. |
| `SoteraiScanSelectionCommand` | `soterai_scan_selection` | TextCommand | Scan the selection(s). |
| `SoteraiRedactSelectionCommand` | `soterai_redact_selection` | TextCommand | Replace selection(s) in place with redacted text. |
| `SoteraiApplyRedactionCommand` | `soterai_apply_redaction` | TextCommand (internal) | Applies redactions on the main thread with a fresh edit. |
| `SoteraiSafePromptCommand` | `soterai_safe_prompt` | TextCommand | Copy a redacted copy to the clipboard; buffer unchanged. |
| `SoteraiBrokerStatusCommand` | `soterai_broker_status` | WindowCommand | Health, version, Safe Mode state. |
| `SoteraiSafeModeToggleCommand` | `soterai_safe_mode_toggle` | WindowCommand | Toggle Safe Mode at the configured level. |

Results render in a dedicated output panel (`output.soterai_guard`), not in
blocking dialogs.

## Threading model

1. The command runs on the main thread, reads the buffer/selection and builds a
   `BrokerClient` from settings (the only Sublime API access).
2. A daemon `threading.Thread` performs the HTTP call.
3. `sublime.set_timeout(..., 0)` delivers `(result, error)` back on the main
   thread, where the output panel is written and, for redaction, the internal
   apply command runs. Redaction spans are applied from the end of the buffer
   backwards so earlier offsets stay valid.

## Security and privacy decisions

- The bearer token is never logged, never printed to the output panel, and never
  included in error strings. `broker_client` intentionally builds error messages
  from the URL/path/status only.
- HTTP error bodies from the broker are truncated to 200 characters before
  display so a large body cannot flood the panel.
- Prefer `token_path` over an inline `token` so the credential stays in the
  broker's file rather than a plain-text Sublime settings file.
- No content leaves loopback except what the broker itself is configured to do.

## Out of scope for this slice

- Automatic on-save or on-type scanning (would need careful debounce and an
  explicit opt-in; deferred).
- Terminal or subprocess mediation.
- Reading the broker ledger into a rich panel beyond `GET /v1/events/recent`
  (not surfaced as a command yet).
- Package Control default-channel submission (tracked separately in
  `docs/publishing-sublime-package-control.md`).
