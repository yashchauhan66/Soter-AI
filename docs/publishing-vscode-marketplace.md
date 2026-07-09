# Publishing SoterAI IDE Guard to the VS Code Marketplace

This runbook packages the existing adapter at `packages/vscode-extension`. Publishing is intentionally separate from packaging and testing; no credential is stored in the repository.

## Prerequisites

- A Marketplace publisher matching `publisher: soterai` in the extension manifest.
- Current `@vscode/vsce` installed by `npm ci`.
- Publisher authentication supplied by the release environment. Follow Microsoft's current authentication guidance; global Azure DevOps PATs are scheduled for retirement on 2026-12-01, so prefer the supported Microsoft Entra-based automated publishing flow when available to the publisher.
- Marketplace-safe PNG product icon/listing assets. The included SVG is an in-product activity-bar icon, not a marketplace icon.
- Completed privacy, limitations, changelog, and clean-profile test reports.

## Reproducible commands

```powershell
npm ci
npm --prefix packages/vscode-extension run typecheck
npm --prefix packages/vscode-extension test
npm run vscode:package
npm run test:vscode-family
```

The artifact is `packages/vscode-extension/soterai-ide-guard-<version>.vsix`. The current package contains only the manifest, license, README, two bundled JavaScript files, and the activity-bar icon. `node_modules`, source, tests, repository files, `.env` files, credentials, and unrelated monorepo content are excluded by `.vscodeignore` and bundling.

Install manually before publishing:

```powershell
code --user-data-dir C:\tmp\soterai-code-clean --extensions-dir C:\tmp\soterai-code-clean-ext --install-extension packages\vscode-extension\soterai-ide-guard-0.1.0.vsix --force
```

Publish only from an approved release environment:

```powershell
npm run vscode:publish
```

`vsce` obtains authentication from the release environment. Never place a token in `package.json`, a command committed to source control, a screenshot, or a test report.

## Marketplace checklist

- [ ] Bump a unique semantic version and update changelog/release notes.
- [ ] Confirm publisher ownership and repository/homepage URLs.
- [ ] Use a permitted raster marketplace icon and HTTPS listing images.
- [ ] Run typecheck, extension tests, package-content review, clean install, activation/UI smoke test, broker integration, wrong-token/offline tests, and privacy canary test.
- [ ] Confirm default cloud, remote escalation, and redacted telemetry settings remain off.
- [ ] Confirm no provider or broker token appears in the VSIX, logs, webviews, reports, or test artifacts.
- [ ] State that SoterAI controls context routed through SoterAI and cannot transparently intercept every third-party AI extension or terminal command.
- [ ] Verify restricted/untrusted workspaces and the supported remote-extension topology.
- [ ] Publish, install the Marketplace copy into another clean profile, and compare its checksum/version with the release record.
- [ ] Record rollback/unpublish ownership and support contact.

Primary reference: [VS Code's official extension publishing guide](https://code.visualstudio.com/api/working-with-extensions/publishing-extension).

