# Phase 3 VS Code Test Results

## Commands Run

| Command | Result |
| --- | --- |
| `npm install` in `packages/vscode-extension` | PASS |
| `npm run typecheck` in `packages/vscode-extension` | PASS |
| `npm run lint` in `packages/vscode-extension` | PASS |
| `npm test` in `packages/vscode-extension` | PASS, 50/50 |
| `npm run build` in `packages/vscode-extension` | PASS after non-sandbox approval |
| `npm --prefix packages/vscode-extension run typecheck` | PASS |
| `npm --prefix packages/vscode-extension test` | PASS, 50/50 |
| `npm run validate:extension-permissions` | PASS |
| `npm run typecheck` | PASS |
| `npm run lint` | PASS, 0 errors / 72 warnings |
| `npm test` | PASS, 679/679 |
| `npm run package` in `packages/vscode-extension` | PASS |

## Notes

- The extension build needs normal filesystem permissions because esbuild resolves workspace source paths that the sandbox denies.
- Root lint warnings are pre-existing unused-variable warnings and do not fail the gate.
- The runtime fixture workspace is under `.tmp/soterai-vscode-runtime-test` and is ignored by Git.

