# Agent Intent Verification Feature 2 Test Report

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
- `node_modules\.bin\tsx.cmd --test tests\agent-intent.test.ts`
  - Final result passed: 12/12.
- `npm run lint`
  - Final result passed with 26 existing warnings.
- `npm test`
  - Initial sandboxed run failed with Windows `spawn EPERM`.
  - Passed outside sandbox before package test-script update: 438/438.
  - Passed outside sandbox after adding Feature 2 tests to `npm test`: 450/450.
- `git diff --check`
  - Failed due unrelated pre-existing conflict markers/trailing whitespace outside Feature 2 files.

## Feature 2 Tests Passed

- Summarize intent plus summarize action returns `ALLOW`.
- Summarize intent plus send email returns `BLOCK`.
- Read intent plus delete file returns `BLOCK`.
- Draft email intent plus send email returns `ASK_APPROVAL`.
- Purchase action without explicit purchase intent returns `BLOCK`.
- Explicit payment intent requires `ASK_APPROVAL`.
- Prompt injection that changes intent returns `BLOCK`.
- Low-confidence intent returns `REVIEW`.
- Cross-project access is denied by project-scoped SQL.
- Dashboard and API route files exist.
- Prompt hash and redaction safety checks pass.
- Existing guard API route files remain present.

## Existing Regression Tests

- Full package suite passed: 450/450.
- Feature 2 test file is now included in the root `npm test` script.
- Existing API route audit passed inside the full suite, confirming the new intent routes follow the expected auth/validation pattern.

## Bugs Found And Fixes Applied

- Intent classifier initially treated bare "email" as `SEND_MESSAGE`, which made "Summarize this email" too broad. The intent-side send rule was narrowed to require send/forward/message style verbs or external-recipient language.
- Action classifier then treated "summarize the email" as `SEND_MESSAGE`. The action-side send rule was also narrowed while preserving explicit `send`, `forward`, `gmail.send`, and external-recipient action detection.
- Dashboard copy used apostrophes that violated `react/no-unescaped-entities`. Reworded the sentence without changing behavior.
- Added `tests/agent-intent.test.ts` to `npm test` so the Feature 2 suite stays part of future package-level regression.

## Skipped Tests

- Root `npm run build`: skipped by user instruction.
- Playwright E2E: skipped because `playwright.config.ts` starts `npm run start`, which requires a production build. Running it without the skipped root build would test stale or unavailable build output.

## Remaining Blockers

- None for Feature 2 non-build verification.
- Repository-wide diff hygiene is still blocked by unrelated conflict markers and unmerged/index-conflict entries that predate this Feature 2 work.

## Final Readiness Status

Ready for the user to run root `npm run build` and then E2E when desired. Feature 3 was not started.
