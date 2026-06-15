# Fix Execution Log

Created: 2026-06-15 13:14:02 +05:30

This log is append-only by issue. An issue is entered when work starts and completed only after its focused verification has run.

## Entry Template

### Issue ID

- Start time:
- Problem:
- Root cause:
- Files changed:
- Fix applied:
- Tests added/updated:
- Commands run:
- Result:
- Remaining risk:
- End time:

## CRG-001

- Start time: 2026-06-15 13:14:02 +05:30
- Problem: Valid SAML assertions provision a user and membership but do not create a real application session.
- Root cause: The ACS redirects to `/signin` with identity hints; NextAuth authorizes only email/password credentials and has no one-time SAML exchange.
- Files changed: `app/api/sso/saml/acs/route.ts`, `auth.ts`, `lib/enterprise/samlSessionExchange.ts`, `prisma/schema.prisma`, `prisma/migrations/20260615150000_saml_session_exchange/migration.sql`, `tests/phase5.test.ts`.
- Fix applied: Added a random two-minute SAML exchange token stored only as a SHA-256 hash, bound it to request IP/user-agent context, claimed it atomically once, and passed the resolved user through a dedicated `saml-exchange` Auth.js credentials provider. ACS now invokes the real Auth.js server-side sign-in path and no longer puts SAML email/organization identity hints in the URL.
- Tests added/updated: Added token hashing, expiry, context-binding, one-time-state, ACS wiring, and Auth.js provider regression tests.
- Commands run: `npx prisma format`; `npx prisma generate`; `npx prisma validate`; focused SAML tests; `npm run typecheck`; `npm run db:deploy`; `npm test`; `npm run build`; second migration status check.
- Result: `VERIFIED`. Focused SAML tests passed 3/3. Full tests passed 119/119. Typecheck passed. Prisma schema validated. The additive migration applied successfully and a second deploy check reported no pending work. Production build passed.
- Remaining risk: A real SAML IdP login is not claimed as verified and remains blocked under CRG-013. RelayState is deliberately handled as CRG-002; CRG-001 currently redirects successful SAML sessions to `/dashboard`.
- End time: 2026-06-15 13:27:32 +05:30

## CRG-002

- Start time: 2026-06-15 13:27:32 +05:30
- Problem: SAML RelayState is untrusted redirect input and was not validated with the application callback policy.
- Root cause: ACS read RelayState but did not pass it through `safeCallbackUrl()`.
- Files changed: `app/api/sso/saml/acs/route.ts`, `lib/auth/callback.ts`, `tests/security.test.ts`, `tests/phase5.test.ts`.
- Fix applied: Sanitized RelayState before it reaches Auth.js or `NextResponse.redirect`. Hardened the shared sanitizer against literal and percent-encoded backslash paths that URL parsers can normalize into external-host redirects.
- Tests added/updated: Added external, protocol-relative, literal-backslash, encoded-backslash, and ACS-wiring regression assertions.
- Commands run: Focused SAML/callback test run; `npm run typecheck`; full `npm test`.
- Result: `VERIFIED`. Focused tests passed 4/4, typecheck passed, and the full suite passed 119/119.
- Remaining risk: Real IdP interoperability remains CRG-013.
- End time: 2026-06-15 13:29:36 +05:30

## CRG-003

- Start time: 2026-06-15 13:29:36 +05:30
- Problem: No browser E2E suite covers the critical local product workflow.
- Root cause: Playwright/Cypress, deterministic browser fixtures, scripts, and setup documentation are absent.
- Files changed: `package.json`, `package-lock.json`, `.gitignore`, `playwright.config.ts`, `tests/e2e/global-setup.ts`, `tests/e2e/public.spec.ts`, `tests/e2e/critical-flow.spec.ts`, `tests/e2e/fixtures/safe-document.txt`, `README.md`, `components/auth/SignInForm.tsx`.
- Fix applied: Installed and configured Playwright Chromium with a deterministic local database migration/seed setup, single-worker isolation, retained failure diagnostics, and an application dev server on a dedicated test port. Added a complete authenticated workflow from demo sign-in through project and key creation, guard input/output inspection, logs, webhook creation, reports, and RAG upload. Changed successful credentials sign-in to a full browser navigation so the newly issued session cookie is reliably observed before protected pages load.
- Tests added/updated: Added public landing/sign-in smoke coverage and an authenticated critical-flow browser spec. The workflow creates uniquely named local test records and does not delete existing data.
- Commands run: `npm install --save-dev @playwright/test`; `npx playwright install chromium`; focused Playwright retries while fixing setup/navigation; `npx playwright test tests/e2e/critical-flow.spec.ts`; `npm run test:e2e`; `npm test`; `npm run typecheck`; `npx prisma validate`; `npm run build`.
- Result: `VERIFIED`. Playwright passed 2/2 specs. The full unit/integration suite passed 119/119, typecheck passed, Prisma validated, and the production build passed.
- Remaining risk: Browser setup uses the configured database and should therefore run against an isolated local/test database. Real webhook delivery, email, billing, vector, SIEM, and identity-provider interoperability remain blocked provider checks and are not represented as production verification.
- End time: 2026-06-15 13:49:10 +05:30

## CRG-004

- Start time: 2026-06-15 13:49:10 +05:30
- Problem: Browser/session coverage does not prove admin denial, role-based permission denial, or cross-tenant isolation.
- Root cause: Existing authorization tests are primarily helper-level and the browser suite has only an administrator demo account.
- Files changed: In progress.
- Fix applied: In progress.
- Tests added/updated: In progress.
- Commands run: In progress.
- Result: `IN_PROGRESS`.
- Remaining risk: In progress.
- End time: In progress.
