# Phase 1 Release Hygiene Complete

## 1. Summary

Phase 1 release hygiene fixes were executed on `phase-1-release-hygiene-fix`. Browser permission validation now passes, deleted marketplace/demo assets were restored, old public VM production references were removed, tracked npm cache files were removed from the repository index, and the main release gates passed locally and from an exported staged-index clean copy.

## 2. Problems Found

- Browser permission docs did not match production manifest host permissions.
- Edge store screenshots and promo assets were deleted from the worktree.
- Final n8n demo/submission assets were deleted from the worktree.
- `packages/integrations/n8n/.npm-cache` had 905 tracked cache files and caused Git long-path errors.
- Local `.env` and `.env.local` contain live secrets and must remain ignored.
- Old public VM production/listing strings existed in docs and generated n8n credential output.

## 3. Files Restored

- `docs/extension-store/edge-assets/*.png`
- `final/README_SUBMISSION.md`
- `final/n8n-soterai-*`

## 4. Files Removed

- Removed from Git tracking only: `packages/integrations/n8n/.npm-cache/**`
- No local files were deleted from disk.

## 5. Files Changed

Key Phase 1 files changed:

- `.gitignore`
- `apps/extension/manifest.json`
- `apps/extension/manifest.dev.json`
- `apps/extension/scripts/validate-store-manifest.mjs`
- `docs/extension-store/permission-justification.md`
- `docs/extension-store/edge-*.md`
- `dist/credentials/SoterApi.credentials.js`
- Phase 1 report docs

Additional pre-existing source/doc/package changes remain in the worktree and passed verification.

## 6. Browser Permission Validation

PASS.

`npm run validate:extension-permissions` output:

```text
Manifest permissions: contextMenus, sidePanel, storage, alarms
Optional permissions: none
Host permissions: 20
Optional host permissions: none
PASS: manifest permissions and store docs match.
```

## 7. Marketplace Assets Status

Marketplace assets are present. Deleted Edge screenshots/promo images and n8n final demo assets were restored. Browser extension package was regenerated and store manifest validation passed.

## 8. Clean Worktree Status

Not clean yet. The worktree intentionally contains staged cache removals, source/doc changes, generated package updates, and new Phase 1 reports for user review. Local secret files remain ignored.

## 9. Clean Clone Verification

PASS for staged-index clean-copy verification. The staged release candidate was exported to `C:\tmp\soterai-clean-release-test-20260714`, dependencies were installed, and the release gates passed there. See `docs/phase-1-clean-clone-verification.md`.

## 10. Commands Run

- `git status`
- `git branch --show-current`
- `git checkout -b phase-1-release-hygiene-fix`
- `git status --short`
- `git diff --stat`
- `git diff --name-only`
- `git ls-files --deleted`
- `git ls-files --others --exclude-standard`
- `git restore -- ...`
- `git rm -r --cached -- packages/integrations/n8n/.npm-cache`
- `rg "soterai\.publicvm\.com|publicvm\.com"`
- `npm run validate:extension-permissions`
- `npm run typecheck`
- `npm run lint`
- `npm test`
- `npm audit --omit=dev`
- `npm run build`
- `npm run package`
- `npm run test:sdk:js`
- `npm --prefix packages/sdk run typecheck`
- `npm --prefix packages/vscode-extension run typecheck`
- `npm --prefix apps/extension run typecheck`
- `npm --prefix packages/integrations/n8n run lint`
- `git checkout-index -a -f --prefix=C:/tmp/soterai-clean-release-test-20260714/`
- clean-copy `npm install`
- clean-copy `npm run typecheck`
- clean-copy `npm run lint`
- clean-copy `npm test`
- clean-copy `npm audit --omit=dev`
- clean-copy `npm run build`
- clean-copy `npm run validate:extension-permissions`
- clean-copy `npm run package`

## 11. Final Pass/Fail Table

| Gate | Result |
| --- | --- |
| typecheck | PASS |
| lint | PASS with 72 warnings, 0 errors |
| tests | PASS, 679 pass / 0 fail |
| audit | PASS, 0 vulnerabilities |
| build | PASS |
| extension permission validation | PASS |
| clean clone verification | PASS for staged-index clean copy |

## 12. Remaining Blockers

- Optional post-commit Git worktree verification should run after the user approves a commit.
- Human review should decide whether to keep the modified VS Code `.vsix` binary.
- Existing broad source/doc modifications that predated this pass should be reviewed before final release commit.

## 13. Ready for Phase 2?

NO. The verification gates pass locally and in the staged-index clean copy, but Phase 2 should wait until the user reviews the prepared commit plan, approves the final commit, and decides whether the modified VS Code `.vsix` binary belongs in the release.
