# Phase 1 Clean Clone Verification

## Status

Result: PASS for staged-index clean-copy verification.

The staged release candidate was exported to a temporary clean directory and verified outside the working tree. A true post-commit worktree verification can still be repeated after the user approves a commit, but the exact staged index passed the release gates.

## Clean Path

Clean verification path: `C:\tmp\soterai-clean-release-test-20260714`.

## What Was Verified

The exported staged candidate passed:

- `npm install`
- `npm run typecheck`
- `npm run lint`
- `npm test`
- `npm audit --omit=dev`
- `npm run build`
- `npm run validate:extension-permissions`
- `npm run package`

Evidence:

- Typecheck: PASS
- Lint: PASS with 72 warnings, 0 errors
- Tests: PASS, 679 pass / 0 fail
- Audit: PASS, 0 vulnerabilities with `--omit=dev`
- Build: PASS, 194 static pages generated
- Browser permission validation: PASS, 20 HTTPS host permissions
- Extension package: PASS, `soter-extension-v0.1.2.zip` generated

The local working tree also passed package-local SDK, VS Code, browser extension, and n8n checks before the clean-copy export.

## Missing Files Found

- Deleted Edge store screenshots/promo assets were restored.
- Deleted final n8n demo/submission assets were restored.
- Tracked `packages/integrations/n8n/.npm-cache` caused long-path Git errors and was removed from the index.

## Optional Post-Commit Repeat

After the user approves the prepared commit, the verification can be repeated from a Git worktree:

```powershell
git worktree add C:\tmp\soterai-clean-release-test phase-1-release-hygiene-fix
cd C:\tmp\soterai-clean-release-test
npm install
npm run typecheck
npm run lint
npm test
npm run build
npm run validate:extension-permissions
```

Remaining risk: this Phase 1 pass intentionally does not create a commit. The clean-copy verification covers the staged release candidate, while a Git worktree verification covers the eventual commit object after user approval.
