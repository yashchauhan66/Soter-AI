# Native evidence supplement 02 - 6 November 2026

Exact VSIX SHA-256: `011f96d19d42dbefc2e56eb5399bf5c7f16a09d6b71b8bae5be9d66b2f3769ec`. [F05 native acceptance](../../20261106-editor-reliability-01/f05-current-acceptance-04.json) now passes the original 10 CustomDocument assertions (save7/reload3) on Code 1.145.1. Exact packaged runtime/driver identity, assertion IDs/scopes and declared outer/editor close with both EOF were checked. Developer-bootstrap scope remains explicit.

F28 ran the primary host: 20 PASS, F28-HP21 FAIL, four primary NOT_RUN; five restart checks were not entered. The peer Code process exited1 after waiting 30 seconds for the global `vscode-updating` mutex. Two source handles closed, no unfinished fixture handles remained, and all four runtime hashes matched. Partial observations do not complete native30.

Both F28 synthetic profiles already had `update.mode=none`, and both launch paths supplied `--disable-updates`; the primary log confirms updates disabled by environment. Later read-only observations found the updating mutex and two CodeSetup processes outside isolated profiles while the admitted 1.145.1 executable remained unchanged. No normal profile, updater or process was modified.

The [fresh successor](../../20261106-editor-reliability-01/f28-updater-successor-02/preparation.json) preserves the original30 driver/cases and adds a read-only preflight that refuses active updater/setup processes before Code launch. Its actual preflight correctly refused the busy updater. It has not run native checks. Once the updater exits, all host hashes must be re-admitted; a changed Code version cannot reuse earlier acceptance.

F26a original34 acceptance remains recorded in supplement01. F32, actual tool routes, per-pair catalog/human/independent requirements remain governed by their separate receipts. Release NOT_READY; rating PENDING.
