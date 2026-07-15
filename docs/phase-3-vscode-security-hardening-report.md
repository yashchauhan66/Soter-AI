# Phase 3 VS Code Security Hardening Report

## Static Search Results

Search command:

`rg -n "eval\\(|new Function|child_process|exec\\(|spawn\\(|innerHTML|console\\.log|Authorization|apiKey|token|SecretStorage" packages/vscode-extension/src`

Findings:

| Check | Result |
| --- | --- |
| `eval(` / `new Function` | None found |
| `innerHTML` | None found |
| `console.log` | None found |
| Child process use | Present only in documented boundaries: broker startup via `spawn(process.execPath, [script])`, git diff via `execFile` fixed argv |
| SecretStorage | Used for cloud token, broker token/provider keys, vault key, canary tokens |
| Token/API key logging | Tests assert no token logging; no console logging found |
| Webview CSP | Tests assert CSP presence and strict message allowlist |
| Ledger privacy | Tests assert no raw secrets/tokens in ledger writes |
| Local privacy mode | Tests assert telemetry blocked in local mode/untrusted workspace |

## Issues Fixed

1. Save-triggered file scanning now respects `soterai.liveScan.enabled`; disabling live scan disables the save hook too.
2. Added `soterai.experimentalFeatures.enabled` and wired it to the advanced command visibility context key, preserving `soterai.showAllCommands` compatibility.

## Remaining Security Evidence Required

Visual webview/notification behavior, Developer Tools console inspection, output panel inspection after UI command execution, and manual Workspace Trust toggling still require a human UI pass. The CLI evidence proves installation/registration, not clicked UI behavior.

