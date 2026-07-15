# VS Code Extension Final Real Runtime Test Report

Date: 2026-07-13

## Runtime Evidence Completed

| Check | Result |
| --- | --- |
| VS Code CLI available | Passed: `code --version` returned `1.128.0`, x64. |
| Install VSIX | Passed: `code --install-extension packages\\vscode-extension\\soterai-ide-guard-0.1.0.vsix --force`. |
| Verify installed extension | Passed: `code --list-extensions --show-versions` showed `soterai.soterai-ide-guard@0.1.0`. |

## Environment Warnings

VS Code CLI emitted permission warnings while creating crashpad/log files:

- Crashpad `CreateFile: Access is denied`.
- `EPERM` creating `c:\\Users\\USER\\AppData\\Roaming\\Code\\logs\\...`.

## Interactive Runtime Checklist Status

Not completed in this headless execution session:

- Command Palette activation.
- Quick Start UI flow.
- Selected text scan.
- Prompt injection scan.
- Fake secret scan.
- Current file scan.
- Git diff scan from UI.
- MCP config scan from UI.
- Terminal command review from UI.
- AI Activity Ledger webview.
- Canary token flow.
- Policy pack flow.
- Privacy mode switching in UI.
- Workspace Trust enabled/disabled UI behavior.
- Dark/light/high contrast checks.
- Developer Tools console check.
- CPU/memory/activation timing.
- Reload/uninstall/reinstall manual cycle.

Readiness rule applied: because full real runtime UI testing is not complete, marketplace readiness cannot exceed 90.
