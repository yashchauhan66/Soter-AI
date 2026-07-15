# VS Code Extension Final Marketplace Package Report

Date: 2026-07-13

## Package Command

`npm run package`

Result: Passed.

Generated VSIX:

`packages/vscode-extension/soterai-ide-guard-0.1.0.vsix`

Size: 213.17 KB

## VSIX Contents Reported by `vsce`

- `extension/package.json`
- `extension/README.md`
- `extension/CHANGELOG.md`
- `extension/LICENSE.md`
- `extension/LICENSE.txt`
- `extension/dist/extension.js`
- `extension/dist/local-ai-broker.js`
- `extension/media/icon.png`
- `extension/media/icon.svg`

## Inspection

- Source files excluded.
- Tests excluded.
- `node_modules` excluded.
- `.env` excluded by packaging scope/ignore.
- Existing `.vscodeignore` excludes source, tests, maps, node_modules, VSIX files, screenshots, scripts, and common repo/tooling noise.

## Package Decision

Package is small and structurally publishable. Marketplace publish should wait for full interactive VS Code runtime validation because CLI install alone is not sufficient evidence for final GA.
