# Phase 1 Commit Plan

Suggested commit message:

```text
release: fix phase 1 release hygiene and marketplace assets
```

## Files To Add

- `.gitignore`
- Source/API/component/lib/package files already modified in the working tree and verified by the required gates.
- Browser extension release files: `apps/extension/manifest.json`, `apps/extension/manifest.dev.json`, `apps/extension/package.json`, `apps/extension/README.md`, `apps/extension/scripts/validate-store-manifest.mjs`.
- Store docs: `docs/extension-store/permission-justification.md`, `docs/extension-store/edge-*.md`.
- Marketplace/readiness docs under `docs/`.
- SDK source/dist updates under `packages/sdk`.
- `dist/credentials/SoterApi.credentials.js`.
- Phase 1 reports: `docs/phase-1-*.md`, `docs/PHASE-1-RELEASE-HYGIENE-COMPLETE.md`.

## Files Restored

- `docs/extension-store/edge-assets/*.png`
- `final/n8n-soterai-*`
- `final/README_SUBMISSION.md`

## Files Removed From Git Tracking

- `packages/integrations/n8n/.npm-cache/**` (905 tracked cache files)

## Files Ignored

- `.claude/`
- `**/.npm-cache/`
- Existing ignored secret/local/build outputs including `.env`, `.env.*`, `.next`, `node_modules`, coverage, and test output.

## Do Not Add

- `.env`
- `.env.local`
- Any API keys, payment keys, tokens, or private local files.

## Human Review Before Commit

- Confirm whether `packages/vscode-extension/soterai-ide-guard-0.2.0.vsix` should be included as the exact marketplace artifact.
- Review broad pre-existing source/doc changes that were present before this release hygiene pass.
