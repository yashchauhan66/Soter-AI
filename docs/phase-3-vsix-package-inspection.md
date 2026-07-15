# Phase 3 VSIX Package Inspection

## Artifact

`packages/vscode-extension/soterai-ide-guard-0.2.0.vsix`

Size: 227,520 bytes.

## Build Command

`npm run package`

Result: PASS. `vsce` packaged 16 files.

## Archive Contents

```text
extension.vsixmanifest
[Content_Types].xml
extension/CHANGELOG.md
extension/dist/extension.js
extension/dist/local-ai-broker.js
extension/LICENSE.txt
extension/LICENSE.md
extension/media/icon.png
extension/media/icon.svg
extension/media/walkthrough/demo.md
extension/media/walkthrough/explore.md
extension/media/walkthrough/policy.md
extension/media/walkthrough/privacy.md
extension/media/walkthrough/scan.md
extension/package.json
extension/README.md
```

## Hygiene Search

Command:

`tar -tf packages/vscode-extension/soterai-ide-guard-0.2.0.vsix | Select-String -Pattern '\.env|secret|token|test|coverage|node_modules|\.map|src/'`

Result: PASS, no matches.

## Decision

VSIX inspection is clean for marketplace upload packaging. It contains bundled runtime output, package metadata, README, changelog, license, icon, and walkthrough assets only.

