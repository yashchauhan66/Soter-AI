# Test Execution Log

Date: 2026-06-15

| Command / activity | Result | Evidence / note |
| --- | --- | --- |
| `npm install` | PASS after environment fix | First run failed because the running dev server locked Prisma's Windows DLL. Identified workspace processes were stopped; Prisma Client then generated successfully. |
| `npx prisma validate` | PASS | Schema valid; 10 migrations present. |
| `npm run typecheck` | PASS | Repeated after fixes. |
| `npm run lint` | PASS | Python cache traversal crash fixed; stale example suppression removed. |
| `npm test` | PASS | 168/168 before project regression addition; focused project regression also passed. Final full rerun recorded separately below. |
| `npm audit --json` | PASS | 0 known vulnerabilities across the audited dependency graph. |
| `npm run build` | PASS | Production build generated 82 static pages; repeated after application fixes. Local total 106-145 seconds. |
| Initial Playwright suite | PASS | 4/4 in development mode, 155 seconds. |
| Expanded production Playwright | PARTIAL | 6 passed, 2 failed: signup blocked by production mock-email policy; project UI navigation bug found. |
| Project flow focused rerun | VERIFIED | After fix, journey reached key creation, guard input/output, logs, and production KMS webhook boundary. |
| Guard/API E2E | PASS | Health, public analyze, validation, missing API key, private projects, and admin denial. |
| Public badge E2E | PASS | Exact allowlist verified; no private identifiers/content fields. |
| Navigation timing E2E | PASS | 294-548 ms measured for key public/dashboard/admin pages. |
| `npm run verify:integrations` | PASS | JS SDK typecheck, 15 tests, and build. |
| `npm run test:sdk:python` | PASS | 15/15; pytest cache write warning only. |
| `npm run package:wordpress` | PASS | ZIP created; PHP syntax not run because PHP is unavailable. |
| Guard load 1/10/50/100 | PASS | 0% errors; component-level p95 0.22-0.61 ms. |
| Razorpay payment | NOT RUN | Test keys exist, but payment requires explicit authorization. |
| Real email/KMS/vector/SIEM/SAML/SCIM | NOT RUN | Authorized providers/configuration unavailable. |

## Environment-Only Failures

- Sandbox child-process `spawn EPERM` required approved out-of-sandbox execution for Node test workers and Chromium.
- Turbopack development E2E became unstable on OneDrive (`.next` manifest ENOENT). E2E now builds and uses `next start`.
- Full single critical rerun later stalled in harness startup/shutdown; segmented production tests and focused flow evidence are retained instead of claiming a green full run.
