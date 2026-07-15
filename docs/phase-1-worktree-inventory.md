# Phase 1 Worktree Inventory

## Summary

- Branch: `phase-1-release-hygiene-fix`
- Deleted tracked release assets at start: Edge screenshots/promo images and final n8n demo assets.
- Deleted tracked release assets after restore: none.
- Tracked npm cache removed from index: `packages/integrations/n8n/.npm-cache` (905 files).
- Local secret files detected: `.env`, `.env.local`; both are ignored and not staged.

## Classification

### Keep and commit

- Browser extension permission/package files: `apps/extension/manifest.json`, `apps/extension/manifest.dev.json`, `apps/extension/package.json`, `apps/extension/README.md`, `apps/extension/scripts/validate-store-manifest.mjs`.
- Permission and Edge listing docs: `docs/extension-store/permission-justification.md`, `docs/extension-store/edge-*.md`.
- Production domain fix: `dist/credentials/SoterApi.credentials.js`.
- Ignore hygiene: `.gitignore`.
- Existing modified app/API/component/lib/package files shown by `git status --short`; these are non-secret source changes already present in the working tree and validated by typecheck, lint, tests, and build.
- SDK generated/source updates from `npm run test:sdk:js`: `packages/sdk/src/client.ts`, `packages/sdk/dist/client.js`, `packages/sdk/dist/client.d.ts.map`.
- Marketplace/readiness docs and scripts currently untracked: `docs/FINAL-100-PRODUCTION-READINESS-REPORT.md`, `docs/vscode-extension-*.md`, `scripts/final-*.js`, `scripts/test-email-otp-delivery.ts`.
- Phase 1 reports created in this pass.

### Restore from git

- Restored Edge store assets: `docs/extension-store/edge-assets/*.png`.
- Restored n8n final demo/submission assets: `final/n8n-soterai-*`, `final/README_SUBMISSION.md`.
- Restored machine-local tracked noise out of the diff: `.soterai/local-ledger.jsonl`, `extensions/jetbrains/.gradle/8.9/fileHashes/fileHashes.lock`.

### Remove temporary file

- No working-tree file was deleted from disk. The npm cache was removed from Git tracking only.

### Move to docs/assets

- No move needed. Required marketplace screenshots and promo images already live under `docs/extension-store`.

### Ignore via `.gitignore`

- `.claude/`
- `**/.npm-cache/`
- Existing ignored: `.env`, `.env.*`, `node_modules`, `.next`, `dist` except explicit n8n credential/package exceptions, coverage and test output.

### Needs human review

- `packages/vscode-extension/soterai-ide-guard-0.2.0.vsix` is a binary marketplace artifact and remains modified with no text diff. Keep only if this exact VSIX is intended for the next marketplace submission.
- Existing broad app/API/component/docs modifications predated this pass. They passed verification but should be reviewed as product changes before release commit if they are outside Phase 1 scope.

## Asset-Sensitive Files

- Marketplace screenshots: restored and present.
- Extension icons: present under `apps/extension/assets`.
- Edge/Chrome listing docs: present under `docs/extension-store`.
- VS Code README/CHANGELOG/LICENSE/icon/screenshots/demo GIF: present under `packages/vscode-extension`.
- n8n README/package metadata/example final workflow/demo assets: present.
- Generated ZIP/VSIX/tgz artifacts: browser extension ZIP regenerated; VSIX/tgz exist and should be committed only intentionally.
- Secret files: `.env` and `.env.local` contain live secrets locally, are ignored, and must not be committed.
