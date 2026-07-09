# Sublime Text package test report

Run date: 2026-07-06
Host OS: Windows 11, x64
Artifact: `extensions/sublime/` (source package; no `.sublime-package` zip built yet)
Checking interpreter: CPython 3.12.10 (host machine). The Sublime plugin host is
Python 3.8; the package targets that host via `.python-version`.

This report is deliberately honest about what was and was not exercised. The
package was **not** loaded inside Sublime Text on this run, so every command's
in-editor behaviour is marked NOT RUN with a manual procedure below.

## Results

| Check | Target | Result | Evidence / notes |
| --- | --- | --- | --- |
| Byte-compile Python | `broker_client.py`, `soterai_guard.py` | PASS | `python -m py_compile` returned success for both files (no `SyntaxError`). |
| Standalone client logic | `broker_client.py` | PASS | Ran offline: explicit token wins; missing token file yields `""`; authed call without a token raises a clear `BrokerError`; unreachable broker raises `BrokerError`. |
| Token-leak check | `broker_client.py` | PASS | Forced an error with a known token value; the token string did not appear in the raised message. |
| JSON resource validity | commands + menus + messages | PASS | `Default.sublime-commands`, `Context.sublime-menu`, `Main.sublime-menu`, `messages.json` all parse as JSON. |
| Package loads in Sublime | Sublime Text 4 | NOT RUN | Requires a Sublime Text 4 install; not available in this environment. |
| Command palette entries appear | Sublime Text 4 | NOT RUN | Requires the editor. |
| Broker Status command | Broker + Sublime | NOT RUN | Requires a running broker and the editor. |
| Scan File / Scan Selection | Broker + Sublime | NOT RUN | Requires a running broker and the editor. |
| Redact Selection (in-place edit) | Broker + Sublime | NOT RUN | Requires a running broker and the editor. |
| Copy Safe Prompt to Clipboard | Broker + Sublime | NOT RUN | Requires a running broker and the editor. |
| Toggle Safe Mode | Broker + Sublime | NOT RUN | Requires a running broker and the editor. |
| Canary privacy test | Broker + Sublime | NOT RUN | A real canary run inside the host is required before any support claim. |

> Note on the interpreter: byte-compilation was performed with CPython 3.12,
> not the 3.8 plugin host. The package uses only 3.8-compatible syntax
> (`.format`/f-strings, no `match`, no `:=` in unsupported positions), so a
> successful 3.12 compile is strong but not identical evidence. Loading under
> the real 3.8 host (the NOT RUN rows) remains required.

## Commands used

```bash
# from extensions/sublime
python -m py_compile broker_client.py soterai_guard.py

# offline client behaviour and token-leak check
python -c "import broker_client as bc; ..."   # see below

# JSON validity
python -c "import json; [json.load(open(f, encoding='utf-8')) for f in (...)]"
```

The offline client script verified, with no network and no editor:

- `resolve_token('abc') == 'abc'`
- `resolve_token('', '/no/such/token') == ''`
- an authed call with an empty token raises `BrokerError` mentioning that the
  token is not configured
- an unreachable broker raises `BrokerError` mentioning the broker URL
- a forced error carrying a secret token value does not contain that value

## Manual procedure (to move NOT RUN rows to PASS)

Prerequisites: Sublime Text 4, and a running SoterAI Local AI Broker with a
token file at `~/.soterai/broker/auth-token`.

1. **Install.** Command palette → `Preferences: Browse Packages`. Copy
   `extensions/sublime` into that folder and rename it to `SoterAI Guard`.
   Restart Sublime Text.
   - Expected: no errors in the Sublime console (`` Ctrl+` ``) mentioning
     `SoterAI Guard`.

2. **Broker Status.** Command palette → `SoterAI Guard: Broker Status`.
   - Expected: an output panel showing `Health: ok`, a version string, and the
     Safe Mode state. If the token is missing, Health still shows but Version
     and Safe Mode report `unavailable (... token is not configured ...)`.

3. **Scan File.** Open a file containing an obvious secret-looking string (for
   example a fake API key). Command palette → `SoterAI Guard: Scan File`.
   - Expected: a panel with `Decision:`, `Risk score:`, and `Categories:` lines
     reflecting the broker's finding. Raw file content is not uploaded to cloud.

4. **Scan Selection.** Select part of the file, run
   `SoterAI Guard: Scan Selection`.
   - Expected: the panel reflects only the selected text.

5. **Redact Selection.** Select the secret-looking string, run
   `SoterAI Guard: Redact Selection`.
   - Expected: the selection is replaced in place by the broker's redacted text
     (for example a `[REDACTED]`-style token). Undo restores the original.

6. **Copy Safe Prompt to Clipboard.** With a selection (or no selection, to use
   the whole file), run `SoterAI Guard: Copy Safe Prompt to Clipboard`.
   - Expected: the buffer is unchanged; the clipboard now holds the redacted
     copy; the panel shows a preview.

7. **Toggle Safe Mode.** Run `SoterAI Guard: Toggle Safe Mode` twice.
   - Expected: the panel reports `Safe Mode is now ON (level: developer)` then
     `Safe Mode is now OFF`, matching `GET /v1/safe-mode/status`.

8. **Canary privacy test.** Place a broker canary token in the buffer, scan, and
   confirm through the broker ledger that no raw canary content left loopback and
   that `canaryInRequest` was reported. Record the ledger evidence.

## Verdict

**PARTIAL / PRE-EDITOR.** Syntax, standalone client logic, token-leak safety and
resource JSON validity pass offline. Loading inside Sublime Text 4, all six
in-editor commands, broker integration, and the canary privacy test are NOT RUN
and are required before Sublime Text can be described as supported or as
Package-Control-ready.
