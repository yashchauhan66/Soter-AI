# Phase 3 VS Code Real Runtime Test Report

## Environment

| Item | Result |
| --- | --- |
| VS Code CLI | Present, `1.128.0`, x64 |
| Cursor CLI | Present, `3.10.17`, x64 |
| VSCodium CLI | Not installed (`codium` not found) |
| VSIX | `soterai-ide-guard-0.2.0.vsix` |
| Runtime fixture workspace | `.tmp/soterai-vscode-runtime-test` |

Both VS Code and Cursor printed a Crashpad access warning under the sandbox, but returned valid versions. Isolated install tests were run outside the sandbox after approval.

## Automated Runtime Evidence

| Check | Result | Evidence |
| --- | --- | --- |
| VS Code isolated VSIX install | PASS | `node scripts/test-vscode-family.mjs code` installed VSIX and verified extension list |
| Cursor isolated VSIX install | PASS | `node scripts/test-vscode-family.mjs cursor` installed VSIX and verified extension list |
| Extension ID/version | PASS | `soterai.soterai-ide-guard@0.2.0` verified by install script |
| VSIX package present | PASS | 227,520 bytes, 16 files |
| Runtime sample workspace created | PASS | safe, malicious prompt, fake secret, MCP config, terminal command, policy, large-file, binary samples |

## Manual UI Evidence Boundary

The VS Code and Cursor CLIs do not provide a supported non-interactive way to click through extension webviews, notifications, status bar items, command palette flows, Developer Tools, theme rendering, or Workspace Trust prompts. Therefore the following are **EVIDENCE REQUIRED**, not marked PASS:

- Quick Start visual flow
- Demo scan notification/webview behavior
- Scan selected text/current file/git diff/MCP command UX
- AI Activity Ledger view and clear action
- Policy picker visual behavior
- Extension Health document visual confirmation
- Output panel and Developer Tools secret-leak inspection
- Dark/light/high contrast screenshots
- Activation time and memory/CPU measurement from UI host
- Workspace Trust on/off manual toggling

## Runtime Decision

VS Code CLI install/runtime registration: YES.

Full human UI runtime pass: EVIDENCE REQUIRED.

