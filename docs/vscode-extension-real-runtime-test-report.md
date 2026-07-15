# VS Code Extension Real User Test Report

**Extension:** `soterai.soterai-ide-guard`  
**Installed version tested:** `0.2.0`  
**Date:** 2026-07-14  
**VS Code:** `1.128.0` (`fc3def6774c76082adf699d366f31a557ce5573f`, x64)  
**OS:** Windows 10/11 family (`Windows_NT x64 10.0.26300`)  
**Workspace:** `C:\Users\USER\OneDrive\Desktop\Ai-Agent-Security-Guard`

## Real Profile Checks

| Check | Result | Evidence |
|---|---:|---|
| VS Code CLI available | PASS | `code --version` returned `1.128.0` |
| User-installed extension present | PASS | `code --list-extensions --show-versions` returned `soterai.soterai-ide-guard@0.2.0` |
| Installed extension folder present | PASS | `C:\Users\USER\.vscode\extensions\soterai.soterai-ide-guard-0.2.0` |
| Installed manifest loads | PASS | Installed `package.json` read successfully; `main` is `./dist/extension.js` |
| VS Code launches with real profile/workspace | PASS | `code -n . --log trace` exited successfully |
| Extension host running after launch | PASS | `code --status` showed active `extension-host [1]` for the workspace |

Note: VS Code CLI does not provide a supported non-interactive `--command` runner
for extension commands. Command behavior was therefore verified through the
extension's automated command/feature tests and isolated VSIX install test, while
the real user profile was used for install, manifest, launch, and extension-host
health evidence.

## Build, Packaging, and Install

| Check | Result | Evidence |
|---|---:|---|
| TypeScript typecheck | PASS | `npm --prefix packages/vscode-extension run typecheck` |
| VSIX package build | PASS | `soterai-ide-guard-0.2.0.vsix`, 16 files, 222.11 KB |
| Production bundle | PASS | `dist/extension.js` 217.2 KB; `dist/local-ai-broker.js` 100.9 KB |
| Isolated VS Code install | PASS | `node scripts/test-vscode-family.mjs code` installed VSIX and verified extension list |
| Test harness version bug | FIXED | `scripts/test-vscode-family.mjs` now derives VSIX name from package version instead of hard-coded `0.1.0` |

## Automated Feature Coverage

| Area | Result | Evidence |
|---|---:|---|
| VS Code extension command/feature contract tests | PASS | 50/50 tests passed |
| Browser extension/shared extension runtime tests | PASS | 120/120 tests passed |
| Local AI Broker service tests | PASS | 14/14 tests passed |

## VS Code Extension Feature Matrix

| Feature group | Status |
|---|---:|
| Command registration parity | PASS |
| Launch-critical commands | PASS |
| Command Palette hygiene / advanced-command gating | PASS |
| Getting Started walkthrough | PASS |
| Activity Bar / tree view contribution metadata | PASS |
| Status bar and activation contract | PASS |
| Scan current file / selection / workspace / git changes | PASS |
| Scan before AI prompt / redact selection / scan clipboard / safe paste | PASS |
| Live inline scanning + Quick Fixes | PASS |
| Terminal command review | PASS |
| AI Context Firewall | PASS |
| Safe prompt builders | PASS |
| Protected secret vault | PASS |
| Canary generation, rotation, scan, and log verification | PASS |
| AI ledger / "What AI Saw" privacy flow | PASS |
| AI output scan and leakage comparison | PASS |
| Local AI Broker start/stop/proxy/self-test/token rotation | PASS |
| AI Safe Mode | PASS |
| AI Memory Inspector | PASS |
| AI Activity Sentinel | PASS |
| Permission Center | PASS |
| Protected Workspace Mode | PASS |
| MCP Tool Firewall | PASS |
| Memory poisoning guard | PASS |
| Dependency Guard | PASS |
| Policy Packs | PASS |
| Enterprise dashboard/report export | PASS |
| Cloud configuration trust gates | PASS |
| Installed AI extension risk scanning | PASS |

## Security and Privacy Verification

| Check | Result |
|---|---:|
| Local-first privacy mode defaults to `local` | PASS |
| Telemetry blocked in local mode / untrusted workspace | PASS |
| SecretStorage used for cloud/broker/vault/canary tokens | PASS |
| No token logging in extension source | PASS |
| Webviews have CSP and escape interpolated fields | PASS |
| Firewall info webviews disable scripts | PASS |
| Clipboard writes are redacted except intentional canary copy | PASS |
| Ledger writes are sanitized and do not persist raw secrets | PASS |
| Vault status strips raw values | PASS |
| Broker binds to `127.0.0.1` and requires auth beyond health | PASS |
| Broker never logs provider keys | PASS |
| Browser/shared extension payloads avoid raw prompt/file content | PASS |

## Services Tested

| Service / integration | Result |
|---|---:|
| Local AI Broker health/auth/body limits/CORS | PASS |
| OpenAI-compatible proxy with mocked provider | PASS |
| Anthropic-compatible proxy with mocked provider | PASS |
| Safe Mode local rule set | PASS |
| Canary blocking in broker requests/responses | PASS |
| Memory event export sanitization | PASS |
| Approval exact-session/content-hash unlock | PASS |

## Observations

- The real VS Code profile contains many AI-related extensions, including Amazon Q,
  Claude Code, Blackbox, Codeium, Continue, Gemini Code Assist, Kilo Code, ChatGPT,
  Roo Code, and others. This makes the installed-extension risk feature relevant.
- Older folder `soterai.soterai-ide-guard-0.1.0` is still present alongside
  `0.2.0`, but VS Code reports the active installed version as `0.2.0`.
- One duplicate non-elevated package run failed because sandboxed esbuild could not
  read sibling workspace paths. The same VSIX package/install verification passed
  when run with normal workspace/user-profile permissions.
- No SoterAI-specific activation error was found in the targeted current-session
  checks. Existing VS Code logs contain unrelated network and Java/Gradle errors
  from other extensions/tooling.

## Summary

**Result:** PASS for install, package, extension-host smoke, automated feature
coverage, local broker services, and privacy/security guardrails.

**Remaining manual-only evidence:** visual confirmation inside VS Code for each
webview panel and notification flow, because VS Code CLI cannot execute arbitrary
extension commands non-interactively.

## EVIDENCE REQUIRED

Manual visual evidence is still required for each VS Code webview panel,
notification flow, and marketplace-installed interactive command path before this
report can be treated as complete external runtime evidence.
