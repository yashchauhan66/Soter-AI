# Phase 1 Release Hygiene Work Log

Branch: `phase-1-release-hygiene-fix`

## Actions

| Task | Command run | Result | Files changed | Why changed | Retest result | Remaining risk |
| --- | --- | --- | --- | --- | --- | --- |
| Baseline status | `git status`; `git branch --show-current` | Dirty tree on `vscode-world-best-ai-security-guard` | None | Establish starting point | N/A | Existing dirty work required classification |
| Safe branch | `git checkout -b phase-1-release-hygiene-fix` | PASS | Git branch metadata | Isolate release hygiene work | `git branch --show-current` reported new branch | None |
| Worktree inventory | `git status --short`; `git status`; `git diff --stat`; `git diff --name-only`; `git ls-files --deleted`; `git ls-files --others --exclude-standard` | PASS after cache cleanup | Report docs | Classify dirty tree | Deleted-file scan returns empty after cache cleanup | Git global ignore warning from unreadable user config remains local-only |
| Restore deleted release assets | `git restore -- docs/extension-store/edge-assets/... final/...` | PASS | Edge screenshots/promo assets and n8n final demo assets restored | Required marketplace/demo assets were deleted from worktree | `git ls-files --deleted` no longer lists these assets | None |
| Permission validation fix | `npm run validate:extension-permissions` | FAIL before doc fix, PASS after | `docs/extension-store/permission-justification.md`, `apps/extension/manifest.json` already narrowed | Store docs did not exactly document current production host permissions | PASS: manifest permissions and store docs match | None |
| Retired domain cleanup | `rg "soterai\.publicvm\.com|publicvm\.com"` | PASS after edits | `dist/credentials/SoterApi.credentials.js`, Edge store docs | Remove old production/listing host references | No matches after excluding Windows `nul` artifact | Historical docs now use neutral retired-host wording |
| Ignore hygiene | Edited `.gitignore`; `git rm -r --cached -- packages/integrations/n8n/.npm-cache` | PASS | `.gitignore`, 905 npm cache files removed from index | Tracked npm cache caused long-path errors and is non-reproducible | `git ls-files packages/integrations/n8n/.npm-cache` count is 0 | Local cache remains on disk but ignored |
| Local noise restore | `git restore -- .soterai/local-ledger.jsonl extensions/jetbrains/.gradle/8.9/fileHashes/fileHashes.lock` | PASS | Local ledger and Gradle lock removed from diff | Machine-local/private state is not a release artifact | Status no longer lists these as modified | None |
| Typecheck | `npm run typecheck` | PASS | None | Required release gate | `tsc --noEmit` exit 0 | None |
| Lint | `npm run lint` | PASS with warnings | None | Required release gate | Exit 0; 72 warnings, 0 errors | Existing warnings remain non-blocking |
| Tests | `npm test` | PASS | None | Required release gate | 679 pass, 0 fail | None |
| Audit | `npm audit --omit=dev` | PASS after approved network/cache run | None | Required production vulnerability gate | 0 vulnerabilities | Initial sandboxed audit failed due registry/cache access |
| Build | `npm run build` | PASS | Generated ignored `.next` output | Required release gate | Next.js build generated 194 static pages | Local `.env` and `.env.local` were loaded but remain ignored |
| Package | `npm run package` | PASS | `apps/extension/dist/soter-extension-v0.1.2.zip` regenerated | Verify store package reproducibility | Store manifest validation passed, zip generated | Zip is ignored generated output unless intentionally distributed |
| Package-local checks | `npm run test:sdk:js`; package typechecks/lint | PASS | SDK dist updated by SDK test/build | Verify workspace package gates | SDK tests 18 pass, typechecks/lint pass | None |
