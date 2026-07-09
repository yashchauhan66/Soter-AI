# Publishing SoterAI IDE Guard to the Visual Studio Marketplace

Status: PLANNED. The Visual Studio adapter (`extensions/visual-studio`) source is complete but has not been compiled. This runbook describes the publish path once the adapter passes its acceptance gate.

## Prerequisites

- Visual Studio 2022 (or 2026 when stable) with the Visual Studio SDK workload installed.
- A Visual Studio Marketplace publisher account and a PAT (or Microsoft Entra automated-publishing identity). **Never commit the token.**
- `VsixPublisher.exe` available from the VS SDK installation.
- Completed `docs/visual-studio-test-report.md` with PASS results for: VSIX build, clean experimental-instance install, broker scan, canary privacy test.

## Build

```powershell
# From extensions/visual-studio/
msbuild SoterAIGuard.csproj /p:Configuration=Release /p:DeployExtension=false
# Produces SoterAIGuard.vsix in the output directory.
```

## Package content review

Before publishing, confirm the VSIX contains only:
- Extension manifest (`source.extension.vsixmanifest`)
- Compiled assembly (`SoterAIGuard.dll`)
- Command table (`SoterAIGuardPackage.vsct` compiled output)
- README, LICENSE, icon

It must NOT contain: source files, `.env` files, credentials, test artifacts, or unrelated monorepo content.

## Publish

```powershell
# Inject the PAT from the release environment — never hardcode it.
$env:VS_MARKETPLACE_PAT = '<injected by secret store>'

VsixPublisher.exe publish `
  -payload SoterAIGuard.vsix `
  -publishManifest publishManifest.json `
  -personalAccessToken $env:VS_MARKETPLACE_PAT
```

`publishManifest.json` must include: `publisher`, `identity.internalName`, `overview` (markdown), `categories`, `tags`, `links.getStarted`, `links.support`, `links.privacyPolicy`.

## Marketplace checklist

- [ ] Unique semantic version bumped; changelog updated.
- [ ] Raster marketplace icon (PNG, 128×128 minimum).
- [ ] HTTPS listing screenshots showing redacted output only — no raw secrets.
- [ ] Privacy and limitations links in the manifest.
- [ ] Listing copy states: local-first, loopback broker, no raw source/secrets to cloud by default, cannot intercept every AI extension or terminal command.
- [ ] Typecheck, build, clean experimental-instance install, broker integration, wrong-token, offline, and canary privacy tests all PASS.
- [ ] No credential in the VSIX, manifest, screenshots, or test artifacts.
- [ ] Post-publish: install the Marketplace copy into a fresh VS instance and compare checksum/version with the release record.
- [ ] Record rollback/unpublish ownership and support contact.

## Limitations to state in the listing

- Windows-only (Visual Studio is Windows-only).
- Terminal and AI-extension interception is limited; SoterAI mediates only context explicitly scanned or routed through SoterAI.
- The adapter uses the classic in-process VS SDK; the newer out-of-process VisualStudio.Extensibility API is not used in this version.

Primary reference: [Visual Studio extensibility overview](https://learn.microsoft.com/en-us/visualstudio/extensibility/visualstudio.extensibility/visualstudio-extensibility?view=vs-2022).
