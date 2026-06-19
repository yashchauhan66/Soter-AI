# Tool Chain Attack Detector Feature 3 Test Report

Date: 2026-06-19

Root build status: `npm run build` was not run per user instruction.

## Commands Run

- `node_modules\.bin\tsx.cmd --test tests\tool-chain.test.ts`
  - Passed: 12/12.
- `npx prisma validate`
  - Passed.
- `npm run typecheck`
  - Passed.
- `npm --prefix packages/sdk run typecheck`
  - Passed.
- `npx prisma generate`
  - Passed after rerun outside sandbox; sandboxed run hit Windows `spawn EPERM`.
- `npm run lint`
  - Passed with 26 existing warnings.
- `npm test`
  - Initial sandboxed run failed with Windows `spawn EPERM`.
  - Passed outside sandbox: 462/462.
- `git diff --check -- <Feature 3 paths>`
  - Passed.
- `git diff --check`
  - Failed due unrelated pre-existing conflict markers/trailing whitespace outside Feature 3 files.

## Feature 3 Tests Passed

- Safe read-only chain returns `ALLOW`.
- Private data read plus external email returns `BLOCK`.
- Confidential RAG plus unknown MCP tool returns `BLOCK`.
- Memory read plus external post returns `BLOCK`.
- File read plus email send returns `ASK_APPROVAL` or `BLOCK`.
- Terminal plus network post returns `CRITICAL` `BLOCK`.
- System prompt to output returns `BLOCK`.
- Untrusted browser page to tool call creates a finding and returns `REVIEW`.
- Cross-project access is denied by project-scoped SQL.
- Dashboard and API route files exist.
- Metadata sanitizer strips raw secrets.
- Existing guard API route files remain present.

## Existing Regression Tests

- Full package suite passed: 462/462.
- Feature 3 test file is included in the root `npm test` script.
- Existing API route audit passed inside the full suite, confirming the new routes follow the expected auth/validation pattern.

## Tests Failed

- No final Feature 3 verification failures.
- Initial sandboxed `npm test` failed with Windows `spawn EPERM` for Node test child processes; rerun outside sandbox passed.
- Initial sandboxed `npx prisma generate` failed with Windows `spawn EPERM`; rerun outside sandbox passed.
- Repository-wide `git diff --check` failed due unrelated pre-existing conflict markers.

## Skipped Tests

- Root `npm run build`: skipped by user instruction.
- Playwright E2E: skipped because `playwright.config.ts` starts `npm run start`, which requires a production build. Running it without the skipped root build would test stale or unavailable build output.

## Bugs Found And Fixes Applied

- No post-implementation behavior bugs were found in Feature 3 during focused or full test runs.
- The package `test` script was updated so `tests/tool-chain.test.ts` runs in future full regressions.

## Remaining Blockers

- None for Feature 3 non-build verification.
- Repository-wide diff hygiene is still blocked by unrelated conflict markers and unmerged/index-conflict entries that predate this Feature 3 work.

## Final Readiness Status

Ready for the user to run root `npm run build` and then E2E when desired. Feature 4 was not started.
