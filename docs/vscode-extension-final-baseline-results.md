# SoterAI IDE Guard — Baseline Results (verified run 2026-07-14)

> Per `vscode-extension-final-execution-rules.md`: every number below was produced by
> running the real command in this environment on 2026-07-14. Commands that cannot run
> here are marked NOT RUN — they are not scored as passing.

## Environment
- Repo branch: `vscode-world-best-ai-security-guard`
- VS Code on PATH: **1.128.0** (`code` CLI available)
- Package dir: `packages/vscode-extension`

## Toolchain (all real, this run)

| Step | Command | Result | Evidence |
|------|---------|--------|----------|
| Typecheck | `npm run typecheck` (`tsc --noEmit`) | ✅ exit 0, 0 errors | terminal |
| Tests | `npm test` (node --test) | ✅ **32 tests / 13 suites, 0 fail** | terminal |
| Build | `npm run build` (esbuild --production) | ✅ extension.js 208.8 KB + local-ai-broker.js 100.9 KB, no source maps | `dist/` |
| Package | `npm run package` (vsce) | ✅ **soterai-ide-guard-0.1.0.vsix, 11 files, 214.87 KB** | VSIX |
| Audit (prod) | `npm audit --omit=dev` | ✅ **0 vulnerabilities** (prior run reported this blocked; it now completes) | terminal |
| CLI install | `code --install-extension …vsix --force` | ✅ installed + registered `soterai.soterai-ide-guard@0.1.0` | `code --list-extensions` |

## VSIX contents (real listing) — no leaked files
```
extension/CHANGELOG.md, LICENSE.md, LICENSE.txt, README.md, package.json
extension/dist/extension.js, dist/local-ai-broker.js
extension/media/icon.png, icon.svg
```
No `src/`, no test files, no `node_modules`, no `.env`, no secrets. ✅

## Security greps (Phase 4, real)

| Check | Result |
|-------|--------|
| `eval(` | none in src ✅ |
| `new Function` | none ✅ |
| `innerHTML` | none ✅ |
| `localStorage` | none (secrets use SecretStorage) ✅ |
| `console.log` in src | none — enforced by a passing test ✅ |
| `child_process` | 3 sites, all shell-free: `spawn(process.execPath,[script],{windowsHide,stdio:"ignore"})`, `execFile` for git ✅ |
| SecretStorage | used in broker, canary, vault, state ✅ |
| Webview CSP | `default-src 'none'`, nonce-gated scripts, `cspSource` styles ✅ |

## Contribution surface (real, from package.json)
- **~100 contributed commands**, **0 `menus`/commandPalette when-clauses** → every command shows in the palette. **This is the main real launch-quality gap** (reviewer clutter; internal/advanced commands not hidden from the palette).
- 12 primary commands are the intended default surface (quickStart, checkExtensionHealth, openSettings, runDemoScan, scanSelectedText, scanCurrentFile, scanGitDiff, reviewTerminalCommand, scanMCPAgentTools, openAIActivityLedger, generateCanaryToken, choosePolicyPack).
- Views: 3 (project-risk, latest-findings, policy-status). Settings: 15. `untrustedWorkspaces: limited`. `preview: false`.

## NOT RUN in this environment (cannot be truthfully scored as done)
- Interactive activation + 37-point manual runtime checklist (needs a GUI VS Code session with a human).
- Theme/webview visual checks, activation-time & memory measurement from a live Extension Host.
- Screenshots / GIFs for the store listing.

## Honest baseline verdict
No P0/P1 **build/test/package/security** blockers — the engineering baseline is genuinely green.
Top real remaining items: (1) command-palette clutter (~100 commands, no when-clauses),
(2) interactive runtime proof, (3) store screenshots. Readiness is therefore **capped at ~84–88**
until interactive runtime testing is done by a human — consistent with the prior run's honest 84.
