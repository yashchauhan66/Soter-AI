# AI Compliance Evidence Vault Feature 9 Test Report

Date: 2026-06-19

Root build status: `npm run build` was not run per user instruction.

## Commands Run

- `node_modules\.bin\tsx.cmd --test tests\evidence-vault.test.ts`
  - Passed: 11/11.
- `npx prisma validate`
  - Passed.
- `npm --prefix packages/sdk run typecheck`
  - Passed.
- `npm run typecheck`
  - Initial run found evidence sanitizer TypeScript union issues.
  - Passed after fix.
- `npx prisma generate`
  - Failed with Windows `EPERM` while renaming Prisma's query engine DLL; active Next dev server was holding the file.
- `npx prisma generate --no-engine`
  - Passed.
- `npm run lint`
  - Initial run found one new unused type warning.
  - Passed after fix.
- `node_modules\.bin\tsx.cmd --test tests\api-route-audit.test.ts`
  - Passed after export route validation fix: 6/6.
- `npm test`
  - Initial run failed because `/api/evidence/reports/[id]/export` had no recognized request-body validation.
  - Passed after fix: 507/507.
- `git diff --check -- <Feature 9 paths>`
  - Passed.

## Feature 9 Tests Passed

- Collect policy evidence.
- Collect guard decision evidence.
- Collect redaction evidence without raw secret persistence.
- Collect approval evidence.
- Collect incident evidence.
- Generate security posture report.
- Report and export do not include raw secrets.
- Cross-project access is denied by project-scoped SQL.
- Export API and dashboard routes exist.
- Existing guard APIs still pass.
- Recursive evidence sanitizer redacts secret-like keys.

## Existing Regression Tests

- Full package suite passed: 507/507.
- API route audit passed: 6/6.
- Feature 9 test file is included in the root `npm test` script.

## Tests Failed

- No final Feature 9 test failures.
- Initial root typecheck failed on evidence sanitizer return types. Fixed with explicit `sanitizeEvidenceRecord`, typed `countBy`, and typed `stableStringify`.
- Initial API route audit failed because the report export POST route did not parse a request body. Fixed with `evidenceReportExportSchema`.
- Normal `npx prisma generate` failed due Windows `EPERM` file lock on Prisma query engine while the active dev server was running.

## Skipped Tests

- Root `npm run build`: skipped by user instruction.
- Playwright E2E: skipped because the configured server uses `npm run start`, which requires a production build. Running it without the skipped root build would test stale or unavailable build output.

## Bugs Found And Fixes Applied

- Added explicit export-route request validation for API audit compliance.
- Tightened sanitizer typing so only object records are stored in `evidenceJson`.
- Removed an unused SDK/server type import flagged by lint.
- Added `tests/evidence-vault.test.ts` to the root package test script.

## Remaining Blockers

- None for Feature 9 non-build verification.
- Normal Prisma engine replacement remains blocked until the local process holding `node_modules/.prisma/client/query_engine-windows.dll.node` is stopped.
- Repository-wide diff hygiene is still blocked by unrelated conflict markers and unmerged/index-conflict entries that predate this Feature 9 work.

## Final Readiness Status

Ready for the user to stop the active dev server if needed, rerun normal `npx prisma generate`, then run root `npm run build` and E2E when desired.
