# VS Code-family test report

Run date: 2026-07-06  
Host OS: Windows, x64  
Artifact: `packages/vscode-extension/soterai-ide-guard-0.1.0.vsix`  
Artifact package size reported by `vsce`: 84.58 KB, 8 files

## Results

| Check | Target | Result | Evidence/notes |
|---|---|---|---|
| TypeScript typecheck | Adapter | PASS | `npm --prefix packages/vscode-extension run typecheck` exited successfully |
| Automated adapter tests | Adapter | PASS | 24 tests passed, 0 failed |
| Production bundle | Extension + embedded broker | PASS | `dist/extension.js` and `dist/local-ai-broker.js` built |
| VSIX packaging | VS Code/Open VSX artifact | PASS | `vsce package` generated the artifact |
| Package-content minimization | Artifact | PASS | 8 intended files only: manifest/content metadata, license, README, extension bundle, broker bundle, activity icon |
| Isolated sideload install + enumeration | VS Code 1.127.0 x64 | PASS | Installed into temporary user-data/extensions directories and found `soterai.soterai-ide-guard@0.1.0` |
| Isolated sideload install + enumeration | Cursor 3.7.19 x64 | PASS | Installed into temporary user-data/extensions directories and found extension ID/version |
| Isolated sideload install + enumeration | Windsurf 1.110.1 x64 | PASS | Installed into temporary user-data/extensions directories and found extension ID/version |
| Isolated sideload install + enumeration | VSCodium | SKIP | `codium` was not installed/on PATH; no compatibility claim |
| Open VSX server publication/registry install | Open VSX/Cursor proxy | NOT RUN | Requires namespace ownership and protected `OVSX_PAT`; publication is an external state change |
| UI activation and command smoke test | All installed hosts | NOT RUN | CLI install/list verification does not exercise extension-host activation |
| Broker integration in each host | All installed hosts | NOT RUN | Requires scripted/interactive command execution in the host |
| Canary privacy test in each host | All installed hosts | NOT RUN | Existing unit/privacy coverage is not a substitute for a real-host canary run |

## Package contents

The package listing contained `LICENSE.txt`, `README.md`, `package.json`, `dist/extension.js`, `dist/local-ai-broker.js`, and `media/icon.svg`, plus the two VSIX metadata files. It did not contain source maps, TypeScript source, tests, `node_modules`, `.git`, `.env`, credentials, other packages, or application files.

## Commands

```powershell
npm run vscode:package
npm run test:vscode-family
```

For isolated reruns against an already-built artifact:

```powershell
$env:SOTERAI_SKIP_PACKAGE = '1'
node scripts/test-vscode-family.mjs all
```

For release qualification where absence is a failure:

```powershell
$env:SOTERAI_REQUIRE_EDITOR = '1'
npm run test:vscode-family
```

The runner deletes its temporary profiles after each result and does not modify the user's normal extension directory.

## Verdict

**PARTIAL PASS.** Build, minimized packaging, tests, and isolated sideload installation pass for VS Code, Cursor, and Windsurf. VSCodium, registry-origin installs, activation/UI behavior, broker integration, and per-host canary privacy behavior remain required before the broader VS Code family can be called fully supported or publish-ready.

