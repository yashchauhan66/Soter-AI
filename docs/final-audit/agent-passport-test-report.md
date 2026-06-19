# Agent Passport Feature 1 Test Report

Date: 2026-06-19

Root build status: `npm run build` was not run per user instruction.

## Commands Run

- `npx prisma validate`
  - Passed.
- `npx prisma generate`
  - Passed after rerun outside sandbox; sandboxed run hit Windows `spawn EPERM`.
- `npm run typecheck`
  - Passed.
- `npm --prefix packages/sdk run typecheck`
  - Passed.
- `npm run lint`
  - Passed with warnings.
- `node_modules\.bin\tsx.cmd --test tests\agent-passport.test.ts`
  - Passed: 12/12.
- `npm test`
  - Passed: 438/438.
- `node --test test/*.test.js` from `packages/sdk`
  - Passed: 10/10.

## Tests Passed

- Agent identity id and default policy shape.
- Passport issue policy and bounded risk scoring.
- Valid passport allows an allowed tool.
- Expired passport blocks.
- Revoked passport blocks.
- Disabled agent blocks.
- Blocked tool blocks.
- Approval-required tool asks for approval.
- Cross-project passport lookup is project scoped.
- Dashboard and API route presence.
- Raw passport token/hash safety.
- Existing Guard API route preservation.
- Full existing non-build unit/regression suite.
- SDK direct tests.

## Tests Failed

- No final verification failures.
- Initial sandboxed Node/tsx test runs failed with Windows `spawn EPERM`; reruns outside sandbox passed.
- `npm --prefix packages/sdk run test` invokes the SDK package-local build before `node --test`; the build portion completed, then the sandboxed Node test runner hit `spawn EPERM`. Direct SDK tests were rerun without another build and passed.

## Skipped Tests

- Root `npm run build`: skipped by user instruction.
- Playwright E2E: skipped because `playwright.config.ts` starts `npm run start`, which requires a production build. Running it without the skipped root build would test stale or unavailable build output.

## Bugs Found And Fixes Applied

- ESLint config used `FlatCompat` around `eslint-config-next`, causing a circular config error. Switched to the package's flat config export and explicitly scoped local rule plugins.
- Lint then exposed `no-var` errors in the WordPress admin asset. Converted those declarations to `const`/`let`.
- Removed an unused Feature 1 import in `lib/agent-passport/server.ts`.

## Remaining Blockers

- None for Feature 1 non-build verification.
- Repository has unrelated unmerged/index-conflict entries outside Feature 1 that still need separate cleanup before a clean commit/merge.

## Final Readiness Status

Ready for the user to run root `npm run build` and then E2E when desired. Feature 2 was not started.
