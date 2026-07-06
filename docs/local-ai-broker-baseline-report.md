# SoterAI Local AI Broker Baseline Report

Date: 2026-07-05

This report records the repaired PASS state before the missing broker package and extension integration were added. The audit began with substantial uncommitted Safe Mode, memory, approval, and firewall work already present.

## Initial blockers and repair

The first gate run found two problems:

- `guard-core` typecheck failed because `BrokerScanner` called an undefined `strictestAction` helper. It now imports and uses the tested `strictest` helper from `SafeMode`.
- The extension bundle could not resolve its entry while esbuild traversed above the managed workspace. The build now uses an explicit extension working directory. The validation command was rerun with the filesystem permission needed by esbuild.

No feature implementation continued until the repaired baseline passed.

## Repaired baseline results

| Package | Gate | Result |
| --- | --- | --- |
| `@soterai/guard-core` | `npm run typecheck` | PASS |
| `@soterai/guard-core` | `npm run test` | PASS — 119 tests, 35 suites |
| `@soterai/guard-core` | `npm run build` | PASS |
| `soterai-ide-guard` | `npm run typecheck` | PASS |
| `soterai-ide-guard` | `npm run test` | PASS — 20 tests, 9 suites |
| `soterai-ide-guard` | `npm run bundle` | PASS — `dist/extension.js` 144.62 KB |
| `soterai-ide-guard` | `npm run vscode:package` | PASS |

Baseline VSIX: `packages/vscode-extension/soterai-ide-guard-0.1.0.vsix`, 49.61 KB, 7 files. It contained only manifest/license/readme metadata, the extension bundle, and the icon. There were 51 declared commands.

Combined repaired baseline: 139 tests passed with zero failures. No hardcoded runtime canary was present in the bundle; canary-related strings were identifiers and detector patterns.

## Verdict

Baseline after repair: PASS. This is the comparison point for the final broker, Safe Mode, and Memory Inspector validation.
