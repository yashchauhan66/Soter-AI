# Agent Sandbox Dry-Run Feature 5 Test Report

Date: 2026-06-19

Root build status: `npm run build` was not run per user instruction.

## Commands Run

- `node_modules\.bin\tsx.cmd --test tests\dry-run.test.ts`
  - Initial sandboxed run hit Windows `spawn EPERM`.
  - Passed outside sandbox: 12/12.
- `npx prisma validate`
  - Passed.
- `npm run typecheck`
  - Initial run found one dry-run effects type inference issue.
  - Passed after fix.
- `npm --prefix packages/sdk run typecheck`
  - Passed.
- `npx prisma generate`
  - Initial sandboxed run hit Windows `spawn EPERM`.
  - Passed outside sandbox.
- `npm run lint`
  - Passed with 26 existing warnings.
- `npm test`
  - Passed outside sandbox: 486/486.
- `git diff --check -- <Feature 5 paths>`
  - Passed.

## Feature 5 Tests Passed

- Safe email draft dry-run is held or allowed by policy.
- Email with API key blocks.
- Form submit with sensitive token blocks or requires approval.
- `rm -rf` command blocks.
- `curl | bash` command blocks.
- File write inside workspace is safe or approval-held.
- File delete outside workspace blocks.
- External API with private data blocks.
- Dry-run never creates the real file side effect.
- Cross-project access is denied by project-scoped SQL.
- Dashboard, API routes, SDK, and existing guard APIs remain present.
- Metadata sanitizer strips raw secrets.

## Existing Regression Tests

- Full package suite passed: 486/486.
- Feature 5 test file is included in the root `npm test` script.
- Existing guard, agent intent, tool chain, and escrow regression tests continued to pass.

## Tests Failed

- No final Feature 5 verification failures.
- Initial `npm run typecheck` failed because `baseEffects` inferred a narrow object type. Fixed by annotating it as `Record<string, unknown>`.
- Initial sandboxed focused test failed with Windows `spawn EPERM`; rerun outside sandbox passed.
- Initial sandboxed `npx prisma generate` failed with Windows `spawn EPERM`; rerun outside sandbox passed.

## Skipped Tests

- Root `npm run build`: skipped by user instruction.
- Playwright E2E: skipped because the configured server uses `npm run start`, which requires a production build. Running it without the skipped root build would test stale or unavailable build output.

## Bugs Found And Fixes Applied

- Added fail-closed rule for external API calls carrying private, confidential, secret, regulated, system-prompt, or PII-classified data.
- Fixed dry-run effects object typing for TypeScript.
- Added `tests/dry-run.test.ts` to the root package test script.

## Remaining Blockers

- None for Feature 5 non-build verification.
- Repository-wide diff hygiene is still blocked by unrelated conflict markers and unmerged/index-conflict entries that predate this Feature 5 work.

## Final Readiness Status

Ready for the user to run root `npm run build` and then E2E when desired. Feature 6 can start next.
