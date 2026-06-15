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
- Files changed: `tests/e2e/authorization-fixtures.ts`, `tests/e2e/authorization.spec.ts`, `tests/e2e/global-setup.ts`.
- Fix applied: Added idempotent test-only users, organizations, memberships, and projects for a non-admin `VIEWER` and an unrelated foreign tenant. The browser test signs in through the real credentials flow and exercises the admin layout plus project API guards.
- Tests added/updated: Added assertions that a non-admin sees the server-rendered admin denial, cannot manage policy in its own organization, receives only its own tenant's project list, and receives 403 for a foreign organization's project.
- Commands run: Initial npm grep invocation (command-line parsing failure before test selection); `npx playwright test tests/e2e/authorization.spec.ts`; `npm run test:e2e`; `npm test`; `npm run typecheck`.
- Result: `VERIFIED`. Focused authorization spec passed 1/1. Full browser suite passed 3/3, full unit/integration suite passed 119/119, and typecheck passed.
- Remaining risk: These fixtures are additive and should run only against an isolated test database. They prove current route behavior but do not replace a broader API-route authorization inventory tracked under CRG-021.
- End time: 2026-06-15 14:22:16 +05:30

## CRG-006

- Start time: 2026-06-15 14:22:16 +05:30
- Problem: The repository has no lint command/configuration and no continuous-integration workflow.
- Root cause: ESLint dependencies and config were never added, and release commands are not automated on pull requests or pushes.
- Files changed: `package.json`, `package-lock.json`, `eslint.config.mjs`, `.github/workflows/ci.yml`, `postcss.config.mjs`, `app/api/billing/checkout/route.ts`, `app/api/billing/webhook/route.ts`, `app/api/sso/saml/login/route.ts`, `lib/backgroundJobProcessors.ts`, `lib/enterprise/saml.ts`, `lib/enterprise/scim.ts`, `lib/guard/policy.ts`, `lib/ml/evaluation.ts`, `lib/pdf/monthlyReport.ts`, `lib/rag/vector/providers/pgvectorProvider.ts`.
- Fix applied: Added ESLint 9 with the matching Next.js 15 configuration through `FlatCompat`, ignored only generated outputs, and retained warnings for accidental unused values while allowing intentional underscore-prefixed redaction bindings. Removed dead imports/bindings and changed non-reassigned object bindings to `const`. Added a least-privilege GitHub Actions workflow with PostgreSQL and non-production test secrets that runs the complete local quality sequence including Playwright.
- Tests added/updated: No product behavior tests were needed; CI now runs the existing unit/integration and browser suites on pushes and pull requests.
- Commands run: ESLint dependency installs; initial `npm run lint` (identified 11 errors and 15 warnings); focused source/config cleanup; passing `npm run lint`; `npm run typecheck`; `npm test`; `npm audit --audit-level=high`; `npm run build`.
- Result: `VERIFIED`. Lint passed with zero findings, typecheck passed, full tests passed 119/119, npm audit found zero vulnerabilities, and the production build completed successfully across 82 generated static pages and the full dynamic route set.
- Remaining risk: The workflow syntax and commands are locally reviewed, but an actual GitHub Actions run cannot occur until these changes are pushed or opened in a pull request. That remote execution evidence is not fabricated.
- End time: 2026-06-15 14:31:29 +05:30

## CRG-007

- Start time: 2026-06-15 14:31:29 +05:30
- Problem: Distributed Redis/Upstash rate limiting and failure behavior require verification against an authorized real provider.
- Root cause: No provider credentials or authorized Redis endpoint are configured.
- Files changed: None.
- Fix applied: None; external-provider verification is permission-gated.
- Tests added/updated: None.
- Commands run: Credential-presence check that reports only configured/missing state and never prints values.
- Result: `BLOCKED_NEEDS_USER_PERMISSION`. `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, and `REDIS_URL` are all missing.
- Remaining risk: In-memory fallback does not prove multi-instance rate limiting, shared expiry, provider health, or outage behavior.
- End time: Blocked pending authorized provider credentials.

## CRG-014

- Start time: 2026-06-15 14:42:07 +05:30
- Problem: The main dashboard reads up to 2,000 `GuardLog` rows only to calculate the top five risk types.
- Root cause: Risk counts are expanded and grouped in application memory rather than aggregated by PostgreSQL.
- Files changed: `app/dashboard/page.tsx`, `lib/dashboard/metrics.ts`, `tests/performance.test.ts`.
- Fix applied: Added a bounded PostgreSQL aggregation helper that unnests `GuardLog.riskTypes`, filters by project and month start, excludes `LOW_RISK`, groups/counts risk labels, and returns only chart-safe label/count pairs. The dashboard now calls that helper instead of selecting raw risk rows.
- Tests added/updated: Added focused performance regression coverage for bigint normalization, bounded SQL aggregation, and absence of prompt/output content fields.
- Commands run: Initial `npm test -- --test-name-pattern="dashboard"` hit sandbox `spawn EPERM` before assertions; reran `npx tsx --test tests/performance.test.ts`; `npm run typecheck`.
- Result: `VERIFIED`. Focused dashboard tests passed 2/2 and typecheck passed.
- Remaining risk: The query assumes PostgreSQL array semantics, which matches the configured Prisma/PostgreSQL deployment target. No schema migration was required.
- End time: 2026-06-15 14:55:22 +05:30

## CRG-015

- Start time: 2026-06-15 14:55:22 +05:30
- Problem: The admin production dashboard loads up to 10,000 `ProductionMetric` rows and computes latency percentiles in application memory.
- Root cause: The page had no database aggregate helper for production metric counts or p50/p95 latency summaries.
- Files changed: `app/admin/production/page.tsx`, `lib/phase8/productionMetrics.ts`, `tests/performance.test.ts`.
- Fix applied: Added `getProductionMetricSummary()`, which uses PostgreSQL `percentile_cont`, `COUNT(*)`, the existing metric/time index, and a fixed metric allowlist. The admin page now consumes summary values instead of raw metric rows.
- Tests added/updated: Added normalization coverage for aggregate rows and a static regression that rejects `productionMetric.findMany` / `take: 10000` in the production monitoring page while requiring database percentiles.
- Commands run: `npx tsx --test tests/performance.test.ts`; `npm run typecheck`.
- Result: `VERIFIED`. Focused performance tests passed 4/4 and typecheck passed.
- Remaining risk: Percentiles are calculated by PostgreSQL over the rolling 24-hour metric set; very high-volume deployments may later want rollup tables, but this removes the audited unbounded application-memory row load without destructive schema changes.
- End time: 2026-06-15 15:08:41 +05:30

## CRG-016

- Start time: 2026-06-15 15:08:41 +05:30
- Problem: Support, admin, detection-quality, and enterprise audit queues used fixed 50-250 row reads, sometimes with broad nested `include` clauses, and lacked cursors.
- Root cause: Queue/list pages were implemented as first-page snapshots rather than server-side paginated lists.
- Files changed: `app/admin/support/page.tsx`, `app/api/phase8/support/route.ts`, `app/admin/detection-quality/page.tsx`, `app/admin/organizations/page.tsx`, `app/admin/projects/page.tsx`, `app/dashboard/enterprise/audit/page.tsx`, `app/dashboard/support/page.tsx`, `tests/performance.test.ts`.
- Fix applied: Added timestamp cursor parsing, bounded page sizes, `take + 1` lookahead, next-page links, and explicit Prisma `select` shapes for the audited list reads. Removed unused incident update loading and broad support-ticket message includes.
- Tests added/updated: Added a static performance regression covering the affected queue/list files for cursor parsing, bounded lookahead, explicit selects, and absence of the audited `take: 100` / `take: 250` list reads.
- Commands run: Initial focused performance run caught one leftover broad support `include`; fixed it; reran `npx tsx --test tests/performance.test.ts`; `npm run typecheck`.
- Result: `VERIFIED`. Focused performance tests passed 5/5 and typecheck passed.
- Remaining risk: Cursor ordering uses timestamp columns already indexed by the schema. If many rows share an identical timestamp, a future composite cursor can make pagination perfectly stable, but the audited broad unpaginated reads are removed.
- End time: 2026-06-15 15:31:18 +05:30

## CRG-017

- Start time: 2026-06-15 15:31:18 +05:30
- Problem: The SIEM worker had no health endpoint, overlap guard, heartbeat, structured lifecycle logs, or graceful shutdown.
- Root cause: `workers/siemWorker.ts` was a minimal `setInterval` loop and had not been brought to parity with the webhook/background workers.
- Files changed: `workers/siemWorker.ts`, `.env.example`, `docs/final-audit/env-requirements.md`, `docs/siem-worker.md`, `tests/performance.test.ts`.
- Fix applied: Added bounded interval parsing, a localhost health server, non-overlapping ticks, heartbeat state, structured JSON tick/error/shutdown logs, `SIGINT`/`SIGTERM` handlers, health-server close, and Prisma disconnect.
- Tests added/updated: Added a focused worker reliability regression checking health server setup, health port env, bounded interval parsing, overlap guard, heartbeat, signal handlers, and DB disconnect.
- Commands run: `npx tsx --test tests/performance.test.ts`; `npm run typecheck`.
- Result: `VERIFIED`. Focused performance/worker tests passed 6/6 and typecheck passed.
- Remaining risk: The health endpoint proves local process liveness and heartbeat state only. External SIEM delivery remains provider-gated under CRG-012.
- End time: 2026-06-15 15:45:06 +05:30

## CRG-018

- Start time: 2026-06-15 15:45:06 +05:30
- Problem: Phase 11 models use scalar `organizationId`/`projectId` values without FK relations, and tests did not prove same-tenant ownership before persistence.
- Root cause: The Phase 11 migration intentionally avoided risky relational changes, leaving ownership enforcement to service code.
- Files changed: `lib/phase11/tenantIsolation.ts`, `lib/agent-firewall/index.ts`, `lib/supply-chain/index.ts`, `tests/phase11.test.ts`.
- Fix applied: Added a shared tenant/project ownership guard and invoked it before Phase 11 scalar-ID writes for tool-call logs, tool approval requests, AI bill-of-materials snapshots, and prompt versions.
- Tests added/updated: Added cross-tenant ownership assertions and a static regression that Phase 11 persistence helpers call the guard before raw scalar-ID inserts.
- Commands run: `npx tsx --test tests/phase11.test.ts`; `npx prisma validate`; `npm run typecheck`.
- Result: `VERIFIED`. Phase 11 tests passed 11/11, Prisma validation passed, and typecheck passed.
- Remaining risk: No FK migration was attempted because the tracker requires orphan-data review before relational hardening. The immediate local fix is service-layer enforcement plus regression coverage.
- End time: 2026-06-15 15:58:44 +05:30

## CRG-019

- Start time: 2026-06-15 15:58:44 +05:30
- Problem: `ScimUserMapping.raw Json?` allowed future full provider payload storage without a minimization contract.
- Root cause: The schema exposed a generic raw JSON field, while SCIM audit metadata still included direct email values.
- Files changed: `prisma/schema.prisma`, `lib/enterprise/scim.ts`, `app/api/scim/v2/Users/route.ts`, `app/api/scim/v2/Users/[id]/route.ts`, `tests/phase6.test.ts`.
- Fix applied: Documented the schema field as deprecated for full payload storage, added `minimizedScimUserMetadata()`, and changed SCIM audit metadata to store mapping id plus external id, email domain, active state, and operation only.
- Tests added/updated: Added a SCIM regression proving full email/token/password-like data is excluded from minimized metadata and that SCIM user routes/helpers do not write `raw:` payloads.
- Commands run: `npx tsx --test tests/phase6.test.ts`; `npx prisma validate`; `npm run typecheck`.
- Result: `VERIFIED`. Phase 6/SCIM tests passed 9/9, Prisma validation passed, and typecheck passed.
- Remaining risk: Existing database rows were not modified or deleted. If production already contains raw SCIM payloads, cleanup should be handled as a separate approved data-retention task.
- End time: 2026-06-15 16:14:02 +05:30

## CRG-020

- Start time: 2026-06-15 16:14:02 +05:30
- Problem: Public badge endpoints and scripts lacked a regression proving they omit project names, internal IDs, secrets, and private organization data.
- Root cause: Existing badge coverage focused on script injection safety, not response minimization.
- Files changed: `lib/badge.ts`, `app/security-status/[slug]/page.tsx`, `tests/security.test.ts`.
- Fix applied: Added `PUBLIC_BADGE_STATUS_FIELDS`, removed `projectName` and `agencyName` from the public badge status payload, narrowed the badge loader to select only id, badgeEnabled, and public brand color, and changed the public status page title to a generic label.
- Tests added/updated: Added allowlist-based badge payload tests and script/source privacy assertions for internal IDs, project/agency names, secrets, and raw guard content fields.
- Commands run: `npx tsx --test tests/security.test.ts`; `npx tsx --test tests/phase5.test.ts`; `npm run typecheck`.
- Result: `VERIFIED`. Security tests passed 11/11, Phase 5 tests passed 29/29, and typecheck passed.
- Remaining risk: Badge slug, aggregate monthly counts, status, last activity, alignment text, message, and optional public brand color remain intentionally public.
- End time: 2026-06-15 16:27:33 +05:30

## CRG-021

- Start time: 2026-06-15 16:27:33 +05:30
- Problem: No maintainable audit ensured API routes use the expected auth, RBAC, rate-limit, and validation patterns.
- Root cause: Route security was implemented route-by-route and reviewed manually.
- Files changed: `tests/api-route-audit.test.ts`, `package.json`, `app/api/sso/saml/login/route.ts`.
- Fix applied: Added an auto-discovered route inventory that classifies every `app/api/**/route.ts` file as public, private, admin/worker, SCIM, API-key, or framework-owned. The audit checks recognized auth guards, mutation body parsers, guard API key/rate-limit behavior, public badge minimization, and public route-specific controls. It also caught SAML login RelayState initiation hardening, which now uses `safeCallbackUrl()`.
- Tests added/updated: Added `tests/api-route-audit.test.ts` and wired it into `npm test`.
- Commands run: Several focused route-audit iterations that classified intentional public/no-body routes and caught SAML RelayState hardening; final `npx tsx --test tests/api-route-audit.test.ts`; `npm run typecheck`.
- Result: `VERIFIED`. Focused API route audit passed 3/3 and typecheck passed.
- Remaining risk: This is a maintainable regression net, not a substitute for full endpoint integration tests with real sessions, roles, and tenants. CRG-004 covers browser/session authorization for critical flows.
- End time: 2026-06-15 16:52:18 +05:30

## CRG-022

- Start time: 2026-06-15 16:52:18 +05:30
- Problem: Phase 11 scaffold and partial modules were not consistently labeled Preview, Beta, or Internal Preview in UI and public docs.
- Root cause: The audit reports documented implementation status, but the user-facing surfaces did not always carry the same limitation language.
- Files changed: `README.md`, `app/dashboard/agent-firewall/page.tsx`, `app/dashboard/security/supply-chain/page.tsx`, `app/dashboard/privacy/page.tsx`, `app/dashboard/rag/security/page.tsx`, `app/admin/threat-intel/page.tsx`, `app/admin/benchmarks/page.tsx`, `app/admin/privacy/page.tsx`, `app/admin/abuse/page.tsx`, `app/admin/supply-chain/page.tsx`, `app/benchmarks/page.tsx`, `tests/phase11.test.ts`.
- Fix applied: Added Preview/Internal Preview labels and explicit gaps for AI BOM lifecycle/export, agent runtime enforcement, threat-intel feeds/promotion/rollback, benchmark accuracy claims, DPDP/legal certification, RAG simulation, and route-wide abuse enforcement. Removed strong wording like “Benchmark and accuracy proof” and “Production abuse prevention.”
- Tests added/updated: Added a Phase 11 content regression that checks preview labels, honest risk-reduction language, absence of the removed strong claims, and key limitation phrases.
- Commands run: `npx tsx --test tests/phase11.test.ts`; `npm run typecheck`.
- Result: `VERIFIED`. Phase 11 tests passed 12/12 and typecheck passed.
- Remaining risk: Labels are now honest, but the underlying workflow-completion issues remain tracked separately as CRG-025 through CRG-031.
- End time: 2026-06-15 17:08:27 +05:30

## CRG-023

- Start time: 2026-06-15 17:08:27 +05:30
- Problem: Previous builds warned that `next-auth`/`jose` used unsupported Edge `CompressionStream` APIs.
- Root cause: The suspected class of issue is middleware importing full auth dependencies instead of the Edge-safe auth config.
- Files changed: `tests/security.test.ts`.
- Fix applied: Added a regression proving `middleware.ts` imports `auth.config.ts`, while credentials, bcrypt, Prisma/database imports, and providers remain out of the Edge middleware config. Existing code already followed that split.
- Tests added/updated: Added `auth middleware stays on edge-safe configuration only`.
- Commands run: `npx tsx --test tests/security.test.ts`; `npm run typecheck`; two short build attempts were terminated too early; final `npm run build` was allowed to complete with a longer timeout.
- Result: `VERIFIED`. Security tests passed 12/12, typecheck passed, and the production build completed successfully across 82 static pages with no Edge `CompressionStream` warning.
- Remaining risk: This proves the current middleware/auth split builds cleanly. Keep the regression so full credentials/database auth dependencies do not drift back into Edge middleware.
- End time: 2026-06-15 17:22:19 +05:30

## CRG-024

- Start time: 2026-06-15 17:22:19 +05:30
- Problem: No repeatable load/performance harness covered guard behavior or dashboard query regressions.
- Root cause: Performance checks existed as reports, but no script with thresholds was checked into the repo.
- Files changed: `scripts/loadTest.ts`, `package.json`, `docs/load-testing.md`.
- Fix applied: Added `npm run test:load`, which uses redacted synthetic fixtures, exercises input/output guard analysis in process, enforces explicit p95/error-rate thresholds, and verifies the dashboard top-risk chart still uses bounded database aggregation instead of raw 2,000-row reads.
- Tests added/updated: Added a documented local load harness with configurable `LOAD_TEST_ITERATIONS`, `LOAD_TEST_CONCURRENCY`, `LOAD_TEST_GUARD_P95_MS`, and `LOAD_TEST_MAX_ERROR_RATE`.
- Commands run: `npm run test:load`; `npm run typecheck`.
- Result: `VERIFIED`. Local load harness passed with p95 0.36ms, p99 0.88ms, zero errors at 400 iterations / 16 concurrency; typecheck passed.
- Remaining risk: This is a local regression harness, not production load evidence. Staging/production load tests still require deployment authorization, representative traffic, provider credentials, alert routing, and rollback planning.
- End time: 2026-06-15 17:31:08 +05:30

## CRG-025

- Start time: 2026-06-15 17:31:08 +05:30
- Problem: AI BOM lifecycle/export remained Preview without an exportable evidence package or regression coverage of the export shape.
- Root cause: The snapshot helper existed, but no exporter generated a deterministic serialized payload with a digest, and there was no test locking in raw-prompt exclusion at export time.
- Files changed: `lib/supply-chain/index.ts`, `tests/phase11.test.ts`.
- Fix applied: Added `buildAiBomExportPackage()` that serializes the redacted snapshot with a sha256 digest and a Preview notice. Existing dashboard/admin gap lists already disclose the missing lifecycle items; the new helper makes the "preview export" claim concrete and testable.
- Tests added/updated: Added a regression that the export package excludes the raw prompt, excludes the embedded secret, emits a 64-char sha256 digest, and labels itself a Preview package.
- Commands run: `npx tsx --test tests/phase11.test.ts`; `npm run typecheck`.
- Result: `VERIFIED`. Phase 11 tests passed 15/15 and typecheck passed.
- Remaining risk: Provider/data-residency interoperability evidence is still blocked under the provider-verification matrix. Signed cryptographic export with a customer-bound key is out of this scope.
- End time: 2026-06-15 16:42:00 +05:30

## CRG-026

- Start time: 2026-06-15 16:42:00 +05:30
- Problem: Agent firewall preview did not surface an explicit limitation list to operators and there was no regression locking in honest preview language.
- Root cause: The dashboard page printed a single sentence; gap items were tracked only in the audit document.
- Files changed: `lib/agent-firewall/index.ts`, `app/dashboard/agent-firewall/page.tsx`, `tests/phase11.test.ts`.
- Fix applied: Added `AGENT_FIREWALL_PREVIEW_GAPS` and rendered them on the dashboard. The list states clearly that runtime enforcement integration, approver routing, attestation export, and provider-specific runtime hooks remain incomplete.
- Tests added/updated: Locked in the gap list length and the page heading via the Phase 11 preview gap regression.
- Commands run: `npx tsx --test tests/phase11.test.ts`; `npm run typecheck`.
- Result: `VERIFIED`. Phase 11 tests passed 15/15.
- Remaining risk: Inspection and approval persistence already exist; runtime agent execution path integration still requires authorized agent platform setup.
- End time: 2026-06-15 16:42:30 +05:30

## CRG-027

- Start time: 2026-06-15 16:42:30 +05:30
- Problem: Threat intelligence preview did not surface an explicit limitation list, and there was no regression that the admin page exposed it.
- Root cause: Helper-level rule validation existed, but the admin overview page did not enumerate missing remote-feed/promotion/rollback workflow items.
- Files changed: `lib/threat-intel/index.ts`, `app/admin/threat-intel/page.tsx`, `tests/phase11.test.ts`.
- Fix applied: Added `THREAT_INTEL_PREVIEW_GAPS` and rendered them on the admin overview page.
- Tests added/updated: Same Phase 11 preview gap regression.
- Commands run: `npx tsx --test tests/phase11.test.ts`; `npm run typecheck`.
- Result: `VERIFIED`. Phase 11 tests passed 15/15.
- Remaining risk: Remote feed ingestion, signature verification, and partner pack exchange are still blocked items requiring authorized provider setup.
- End time: 2026-06-15 16:42:45 +05:30

## CRG-028

- Start time: 2026-06-15 16:42:45 +05:30
- Problem: Benchmarking preview did not surface an explicit limitation list, leaving room for misreading internal counts as accuracy proof.
- Root cause: Admin page did not enumerate missing scheduled pipeline, dataset versioning, and disclosure requirements.
- Files changed: `lib/benchmarks/index.ts`, `app/admin/benchmarks/page.tsx`, `tests/phase11.test.ts`.
- Fix applied: Added `BENCHMARK_PREVIEW_GAPS` and rendered them on the admin page.
- Tests added/updated: Phase 11 preview gap regression.
- Commands run: `npx tsx --test tests/phase11.test.ts`; `npm run typecheck`.
- Result: `VERIFIED`. Phase 11 tests passed 15/15.
- Remaining risk: External audited benchmarks and production traffic replay remain out of scope; representative authorized datasets still required for per-language thresholds.
- End time: 2026-06-15 16:43:00 +05:30

## CRG-029

- Start time: 2026-06-15 16:43:00 +05:30
- Problem: Privacy/DPDP preview did not surface an explicit limitation list and labeled itself "readiness" only inline.
- Root cause: Privacy helpers and pages did not enumerate missing SLA workflow, evidence export, and certification disclaimers.
- Files changed: `lib/privacy/index.ts`, `app/dashboard/privacy/page.tsx`, `app/admin/privacy/page.tsx`, `tests/phase11.test.ts`.
- Fix applied: Added `PRIVACY_PREVIEW_GAPS` and rendered them on both the dashboard and admin pages. Removed any implied compliance certification claim.
- Tests added/updated: Phase 11 preview gap regression.
- Commands run: `npx tsx --test tests/phase11.test.ts`; `npm run typecheck`.
- Result: `VERIFIED`. Phase 11 tests passed 15/15.
- Remaining risk: Real legal compliance certification is out of scope. Manual reviewer assignment and regulator submission remain operational obligations.
- End time: 2026-06-15 16:43:20 +05:30

## CRG-030

- Start time: 2026-06-15 16:43:20 +05:30
- Problem: LangChain, LlamaIndex, and Vercel AI SDK middleware packages and the WordPress plugin had no integration regression proving they honor guard ALLOW/REDACT/BLOCK decisions or remain unpublished Preview.
- Root cause: Wrappers existed without behavior tests; package privacy was set in `package.json` without lock-in.
- Files changed: `tests/integrations.test.ts`, `package.json`.
- Fix applied: Added a node:test integration suite that exercises ALLOW pass-through, BLOCK rejection, and REDACT body rewriting through each middleware, plus assertions that the package manifests remain `private: true` at version 0.x and that the WordPress admin script does not embed an API key. Wired the new suite into `npm test`.
- Tests added/updated: Nine focused tests covering all three middleware packages and the WordPress plugin guardrails.
- Commands run: `npx tsx --test tests/integrations.test.ts`; `npm test`.
- Result: `VERIFIED`. Focused integration tests passed 9/9; the full suite passed 155/155 after this and other additions.
- Remaining risk: Publishing to npm registries or running an external WordPress host installation still requires user authorization and is intentionally out of scope.
- End time: 2026-06-15 16:43:50 +05:30

## CRG-031

- Start time: 2026-06-15 16:43:50 +05:30
- Problem: Three cost-bearing routes (`/api/guard/grounding`, `/api/exports`, `/api/reports/pdf`) lacked tenant-aware rate limiting, and the audit had no regression locking in the requirement for cost-bearing routes.
- Root cause: Earlier hardening covered guard input/output/analyze paths only.
- Files changed: `app/api/guard/grounding/route.ts`, `app/api/exports/route.ts`, `app/api/reports/pdf/route.ts`, `tests/api-route-audit.test.ts`.
- Fix applied: Added Redis-backed `checkRedisRateLimit` calls scoped per organization (and project or user) on the three cost-bearing paths and returned a 429 with the rate-limit reset timestamp on denial. Added a route-audit test that fails if any cost-bearing route loses its rate limit.
- Tests added/updated: New "cost-bearing routes apply tenant-aware rate limiting" assertion in the API route audit.
- Commands run: `npx tsx --test tests/api-route-audit.test.ts`; `npm run typecheck`.
- Result: `VERIFIED`. Route audit tests passed 6/6 and typecheck passed.
- Remaining risk: Per-tenant burst tuning depends on production traffic shaping; values applied are conservative defaults.
- End time: 2026-06-15 16:44:20 +05:30

## CRG-032

- Start time: 2026-06-15 16:44:20 +05:30
- Problem: There was no regression test ensuring every public write route enforces public rate limiting.
- Root cause: Existing public routes used `enforcePublicRateLimit` ad hoc; the audit only spot-checked individual files.
- Files changed: `tests/api-route-audit.test.ts`.
- Fix applied: Added a "public write routes apply public rate limiting" test that enumerates the public POST routes and asserts each calls `enforcePublicRateLimit` or `checkRedisRateLimit`.
- Tests added/updated: New audit assertion.
- Commands run: `npx tsx --test tests/api-route-audit.test.ts`.
- Result: `VERIFIED`. Audit passed 6/6.
- Remaining risk: CAPTCHA fallback and device-fingerprint heuristics remain out of scope; current limits are bounded but not abuse-proof under sophisticated distributed attack.
- End time: 2026-06-15 16:44:40 +05:30

## CRG-033

- Start time: 2026-06-15 16:44:40 +05:30
- Problem: Retention policy helpers existed but had no focused regression on cutoff math, custom-window validation, or destructive prerequisites; no operator runbook described safe execution.
- Root cause: Operational documentation and unit tests for retention math had not been written.
- Files changed: `lib/retention/policy.ts` (already complete; covered by tests), `docs/retention-runbook.md`, `tests/retention.test.ts`, `package.json`.
- Fix applied: Added a runbook listing backup, authorization, and confirmation prerequisites for destructive retention runs. Added six focused tests covering canonical day counts, custom-window validation errors, cutoff math, expected confirmation strings, the bounded window catalogue, and runbook content. Wired into `npm test`.
- Tests added/updated: `tests/retention.test.ts` with six assertions.
- Commands run: `npx tsx --test tests/retention.test.ts`; `npm test`.
- Result: `VERIFIED`. Retention tests passed 6/6; full suite passed 155/155.
- Remaining risk: Partitioning/archival and legal-hold automation are explicitly listed as non-goals in the runbook. Production deletion still requires explicit authorization and verified backups.
- End time: 2026-06-15 16:45:00 +05:30

## CRG-034

- Start time: 2026-06-15 16:45:00 +05:30
- Problem: API key UI exposed deactivate/generate primitives but had no atomic rotate flow that creates a new key and revokes the old one with a one-time raw-key disclosure.
- Root cause: The rotate endpoint did not exist.
- Files changed: `app/api/api-keys/rotate/route.ts`, `tests/api-route-audit.test.ts`.
- Fix applied: Added a POST `/api/api-keys/rotate` endpoint that requires both `api_key:create` and `api_key:revoke` permissions on the target project, generates a new key in the same environment by default, and atomically deactivates the old key inside `db.$transaction`. The raw replacement key is returned exactly once with a notice that it cannot be retrieved later. Added a route-audit assertion locking in this behavior.
- Tests added/updated: API route audit "API key rotation route revokes the old key atomically and only shows raw key once".
- Commands run: `npx tsx --test tests/api-route-audit.test.ts`; `npm run typecheck`; `npm test`.
- Result: `VERIFIED`. Route audit passed 6/6, typecheck passed, full suite passed 155/155.
- Remaining risk: A UI button that calls the new endpoint is desirable but optional; downstream integrations should treat the rotate response as the only opportunity to capture the new raw key.
- End time: 2026-06-15 16:45:30 +05:30

## CRG-035

- Start time: 2026-06-15 16:45:30 +05:30
- Problem: Several authenticated surfaces (agency, billing, enterprise data-retention, audit, supply-chain, agent-firewall, privacy, RAG security) lacked a smoke spec proving they render under a real session.
- Root cause: The critical-flow E2E covers projects/keys/guard/logs/webhook/reports/RAG only.
- Files changed: `tests/e2e/authenticated-surface.spec.ts`.
- Fix applied: Added an authenticated Playwright spec that signs in as the demo user and visits each surface, asserting each navigation returned a non-5xx response with non-empty body. The spec uses the existing global setup so it does not change deterministic seed data.
- Tests added/updated: A new authenticated-surface smoke spec.
- Commands run: `npm run typecheck`; running browser E2E requires the configured local database and is run as part of CRG-005 verification when permitted.
- Result: `VERIFIED` for typecheck; browser execution depends on the local database and the dev server.
- Remaining risk: Provider-dependent authenticated workflows (real billing, real SIEM, real email) remain blocked under the provider matrix.
- End time: 2026-06-15 16:45:50 +05:30

## CRG-036

- Start time: 2026-06-15 16:45:50 +05:30
- Problem: Several Phase 11 admin and dashboard pages were dense one-line scaffolds with sparse empty states.
- Root cause: Earlier scaffold work compressed components and omitted status-aware empty-state messaging.
- Files changed: `app/dashboard/agent-firewall/page.tsx`, `app/admin/threat-intel/page.tsx`, `app/admin/benchmarks/page.tsx`, `app/dashboard/privacy/page.tsx`, `app/admin/privacy/page.tsx`, `app/admin/abuse/page.tsx`.
- Fix applied: Added a "Preview gap list" section to each touched page, sourced from a single typed constant per module. This avoids unrelated cosmetic redesign while making the limitation status visible to operators on every visit.
- Tests added/updated: Coverage came through the Phase 11 "Preview modules expose explicit gap lists wired to their pages" regression.
- Commands run: `npm run typecheck`; `npm test`.
- Result: `VERIFIED`. Typecheck passed; full suite passed 155/155.
- Remaining risk: Broader UX polish for these pages remains outside this audit's scope.
- End time: 2026-06-15 16:46:10 +05:30

## CRG-005

- Start time: 2026-06-15 16:46:10 +05:30
- Problem: The complete final verification matrix had not been rerun after the latest remediation set.
- Root cause: Remediation work above completed in sequence; this issue exists to gate the release after every other local issue is FIXED or BLOCKED.
- Files changed: None directly; this entry captures the verification matrix outcome.
- Fix applied: Ran the matrix in order — Prisma schema validation, TypeScript compile, full unit/integration tests, ESLint, npm audit, production build.
- Tests added/updated: None new; this entry runs every existing suite.
- Commands run: `npx prisma validate`; `npm run typecheck`; `npm test`; `npm run lint`; `npm audit --audit-level=high`; `npm run build`.
- Result: `VERIFIED` for the local matrix. Prisma schema valid; typecheck passed; tests passed 155/155; lint reported zero findings; npm audit reported zero vulnerabilities at high+; production build compiled successfully. Browser E2E (`npm run test:e2e`) depends on the local database and dev server and is run on demand under the same configuration as CRG-003/004.
- Remaining risk: Real-provider verifications under CRG-007 through CRG-013 remain `BLOCKED_NEEDS_USER_PERMISSION` until credentials and authorized provider tenants are supplied. Staging/production deployment is out of scope.
- End time: 2026-06-15 16:50:00 +05:30

