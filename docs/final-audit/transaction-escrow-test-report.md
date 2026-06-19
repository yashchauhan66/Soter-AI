# Agent Transaction Escrow Feature 4 Test Report

Date: 2026-06-19

Root build status: `npm run build` was not run per user instruction.

## Commands Run

- `node_modules\.bin\tsx.cmd --test tests\escrow.test.ts`
  - Passed: 12/12.
- `npx prisma validate`
  - Passed.
- `npm --prefix packages/sdk run typecheck`
  - Passed.
- `npm run typecheck`
  - Initial run found one Zod schema composition issue.
  - Passed after fix.
- `npx prisma generate`
  - Passed after rerun outside sandbox; sandboxed run hit Windows `spawn EPERM`.
- `npm run lint`
  - Passed with 26 existing warnings.
- `npm test`
  - Initial sandboxed run failed with Windows `spawn EPERM`.
  - Passed outside sandbox: 474/474.
- `git diff --check -- <Feature 4 paths>`
  - Passed.

## Feature 4 Tests Passed

- Create escrow for email send.
- Create escrow for form submit.
- Critical secret exfiltration blocks instead of escrow.
- Approval token is hashed and raw token is not embedded in the hash.
- Approved escrow allows execution.
- Denied escrow blocks execution.
- Edit-and-approve rescans payload.
- Expired escrow cannot approve or execute.
- Escrow cannot execute twice.
- Cross-project access is denied by project-scoped SQL.
- Dashboard and API route files exist.
- Metadata sanitizer strips raw secrets and existing guard APIs remain present.

## Existing Regression Tests

- Full package suite passed: 474/474.
- Feature 4 test file is included in the root `npm test` script.
- Existing API route audit passed inside the full suite, confirming the new routes follow the expected auth/validation pattern.

## Tests Failed

- No final Feature 4 verification failures.
- Initial `npm run typecheck` failed because `escrowResolveSchema` was refined before attempting `.extend()`. Fixed by splitting a base schema from refined variants.
- Initial sandboxed `npm test` failed with Windows `spawn EPERM` for Node test child processes; rerun outside sandbox passed.
- Initial sandboxed `npx prisma generate` failed with Windows `spawn EPERM`; rerun outside sandbox passed.

## Skipped Tests

- Root `npm run build`: skipped by user instruction.
- Playwright E2E: skipped because `playwright.config.ts` starts `npm run start`, which requires a production build. Running it without the skipped root build would test stale or unavailable build output.

## Bugs Found And Fixes Applied

- Fixed Zod `.refine().extend()` type error by introducing `escrowResolveBaseSchema`.
- Added `tests/escrow.test.ts` to the root package test script.

## Remaining Blockers

- None for Feature 4 non-build verification.
- Repository-wide diff hygiene is still blocked by unrelated conflict markers and unmerged/index-conflict entries that predate this Feature 4 work.

## Final Readiness Status

Ready for the user to run root `npm run build` and then E2E when desired. Feature 5 was not started in this verification slice.
