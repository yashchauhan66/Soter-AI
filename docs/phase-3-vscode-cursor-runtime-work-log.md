# Phase 3 VS Code / Cursor Runtime Work Log

Date: 2026-07-14

## Actions

| Task | Command run | Result | Files changed | Reason | Evidence | Retest result | Remaining blocker |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Read Phase 1/2 and VS Code readiness context | `Get-Content` on prior reports and extension metadata | Completed | None | Establish baseline and avoid stale claims | Prior reports showed build verified, runtime evidence historically pending; current runtime report claimed CLI install evidence | N/A | None |
| Install dependencies | `npm install` in `packages/vscode-extension` | PASS | `package-lock.json` may reflect existing workspace state only | Ensure package commands run from current tree | Prisma generated successfully; no secret values inspected or printed | N/A | None |
| Baseline extension checks | `npm run typecheck`, `npm run lint`, `npm test`, `npm run build` | Typecheck/lint/test PASS; build needed escalation due sandbox path access | None | Verify starting point | 50/50 extension tests passed | Build passed after approved non-sandbox run | Sandbox blocks esbuild workspace path resolution |
| Root gates | `npm --prefix packages/vscode-extension run typecheck`, `npm --prefix packages/vscode-extension test`, `npm run validate:extension-permissions`, `npm run typecheck`, `npm run lint`, `npm test` | PASS | None | Verify monorepo compatibility | Root tests 679/679; lint 0 errors / 72 warnings | Re-run after fixes also PASS | Existing lint warnings remain |
| Security searches | `rg -n "eval\\(|new Function|child_process|exec\\(|spawn\\(|innerHTML|console\\.log|Authorization|apiKey|token|SecretStorage" packages/vscode-extension/src` | Reviewed | None | Find unsafe runtime/security patterns | No eval/new Function/innerHTML/console.log in source; child process boundaries use fixed argv | Tests cover child process and logging guardrails | None |
| Fix live scan save behavior | Source/test edit | PASS | `packages/vscode-extension/src/extension.ts`, `packages/vscode-extension/src/__tests__/extension.test.ts` | Save hook scanned files even when live scanning was disabled | Added `soterai.liveScan.enabled` gate to save-triggered scan | Typecheck PASS, 50/50 tests PASS | None |
| Add requested experimental gate | Manifest/source/test edit | PASS | `packages/vscode-extension/package.json`, `packages/vscode-extension/src/extension.ts`, test file | Requirement asked for `soterai.experimentalFeatures.enabled` | Added setting and wired it to advanced command context key with legacy `showAllCommands` compatibility | Typecheck PASS, 50/50 tests PASS | None |
| Build VSIX | `npm run package` | PASS | `packages/vscode-extension/soterai-ide-guard-0.2.0.vsix` | Produce release artifact | VSIX 16 files, 227,538 bytes | Archive inspection PASS | None |
| Inspect VSIX | `tar -tf ...`, `Select-String` for `.env|secret|token|test|coverage|node_modules|.map|src/` | PASS | None | Ensure package hygiene | No suspicious archive entries matched | N/A | None |
| VS Code CLI runtime install | `node scripts/test-vscode-family.mjs code` with `SOTERAI_SKIP_PACKAGE=1` | PASS after approved non-sandbox run | None | Real VS Code-family install verification | VS Code 1.128.0 installed VSIX and listed `soterai.soterai-ide-guard@0.2.0` | PASS | Visual command/webview clicks still require human UI evidence |
| Cursor CLI runtime install | `node scripts/test-vscode-family.mjs cursor` with `SOTERAI_SKIP_PACKAGE=1` | PASS after approved non-sandbox run | None | Cursor compatibility verification | Cursor 3.10.17 installed VSIX and listed extension | PASS | Visual command/webview clicks still require human UI evidence |
| VSCodium check | `codium --version` | Not available | None | OpenVSX/VSCodium compatibility check | Command not found | N/A | VSCodium runtime not installed |
| Runtime fixture workspace | PowerShell file creation in `.tmp/soterai-vscode-runtime-test` | PASS | Ignored `.tmp` fixtures only | Provide sample workspace data for manual UI checks | Created safe, malicious prompt, fake secret, MCP config, terminal commands, policy, large file, binary sample | Lint rerun restored baseline warnings | Manual UI execution still required |

