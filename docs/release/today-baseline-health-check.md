# Today Baseline Health Check

Date: 2026-07-02

## Commands
| Command | Result | Notes |
| --- | --- | --- |
| `npm install` | FAIL | npm rejected `workspace:*` with `EUNSUPPORTEDPROTOCOL`; existing `node_modules` was used for checks. |
| `npm run typecheck` | PASS | Root TypeScript passed. |
| `npm run lint` | PASS_WITH_WARNINGS | 0 errors, 59 warnings. |
| `npm test` | PASS | 626/626 tests passed after test harness fix. |
| `npm run build` | PASS | Next.js production build completed. |
| `npm run typecheck:extension` | PASS | Extension TypeScript passed. |
| `npm run validate:extension-permissions` | PASS | Manifest permissions match store docs. |
| `npm run test:extension` | PASS | 120/120 tests passed after privacy docs fix. |
| `npm run build:extension` | PASS | Required unsandboxed rerun because esbuild hit workspace access restrictions in sandbox. |
| `npm run package` | PASS | Created `apps/extension/dist/soter-extension-v0.1.0.zip`. |

## Fixes Applied
- Updated extension privacy policy and permission justification to document response scanning scope, admin enable/disable control, redacted preview storage, and unrelated browsing non-monitoring.
- Updated `tests/phase4.test.ts` so the local-development secret-store test temporarily runs under `NODE_ENV=test` and restores the original environment.

## Final Status
PASS for technical build/test readiness. Dependency installation remains an environment/tooling blocker.
