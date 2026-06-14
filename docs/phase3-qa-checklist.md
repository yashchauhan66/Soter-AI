# Phase 3 manual QA checklist

Run after `npm install`, `npm run db:deploy`, `npm run db:seed`, and `npm run dev`.

The seed prints the demo email + password and a one-time API key.

## Phase 1 regression (must still pass)

- [ ] Landing page, hero, features, pricing, FAQ render.
- [ ] Playground accepts text, returns guard result, no persistence.
- [ ] Demo chatbot side-by-side renders before/after.
- [ ] Dashboard overview loads with seed metrics.
- [ ] Logs page lists seeded entries; redacted/safe text shown only.
- [ ] Reports page renders monthly summary, top risk types, recommendations.
- [ ] Projects, API keys pages work; raw key shown once.
- [ ] `npm run typecheck` clean. `npm test` 46/46. `npm run build` clean.

## Phase 2 regression

- [ ] Webhooks: create, list, test, rotate, deliveries log.
- [ ] Agency: overview, clients, branding, white-label print report.
- [ ] Security badge: dashboard, public status page, badge.js embed.
- [ ] Onboarding checklist updates as actions complete.
- [ ] Plan/usage card renders with warning + exceeded banners.
- [ ] SDK builds: `npx tsc -p packages/sdk/tsconfig.json`.

## Phase 3 features

### Auth required on dashboard
- [ ] `/dashboard` redirects to `/signin` when signed out.
- [ ] All `/dashboard/*` routes require sign-in (open one in an incognito window).
- [ ] `/admin` redirects to sign-in then a 403 unless `User.isAdmin = true`.
- [ ] `/api/projects`, `/api/logs`, `/api/api-keys`, `/api/webhooks`, `/api/agency*`, `/api/exports`, `/api/reports/pdf` return 401/403 without a session cookie.
- [ ] Sign in with the seeded demo account → redirected to `/dashboard`.
- [ ] Sign up `/signup` creates user + organization + OWNER membership + trial subscription.
- [ ] Sign-out from header returns to `/`.

### Public pages still public
- [ ] `/`, `/docs`, `/playground`, `/security-status/<slug>`, `/badge.js`, `/api/guard/analyze`, `/api/badge/<slug>`, `/api/billing/webhook` accessible without auth.
- [ ] `/api/guard/input` and `/api/guard/output` continue to authenticate via `x-api-key`, not the session cookie.

### Tenant isolation
- [ ] As user A: create a project; sign out; sign in as user B; cannot see A's project, logs, API keys, webhooks, or reports through any URL or direct API call.
- [ ] User B trying `/api/projects/policy?projectId=<A_project>` returns 403 / 404.
- [ ] `/dashboard/agency/clients/<A_client>` 404s for user B.

### RBAC
- [ ] Add a second user to org A as VIEWER; they can read logs/reports but cannot create projects, API keys, or webhooks.
- [ ] Promote them to DEVELOPER → can create API keys + webhooks but cannot manage billing or agency.
- [ ] BILLING role can read billing + reports, cannot create projects.
- [ ] ADMIN role has every project/api/webhook/policy permission but billing remains owner-only.

### Redis rate limiting
- [ ] With `UPSTASH_REDIS_REST_URL` set, send 70 input-guard requests in <1 minute → 11th onward returns HTTP 429 with `X-RateLimit-Remaining: 0` and `RATE_LIMIT` risk type.
- [ ] Without Upstash configured, console prints the in-memory fallback warning once per process.

### Monthly metering
- [ ] Send enough requests to cross 80% of your plan limit → dashboard banner appears, `usage.limit.warning` webhook delivered.
- [ ] Cross 100% → `/api/guard/input` returns 429 with `RATE_LIMIT`, `usage.limit.exceeded` webhook delivered.
- [ ] Both warning + exceeded events also reach configured endpoints with valid HMAC signatures.

### Durable webhook queue
- [ ] Create a webhook with an unreachable URL.
- [ ] Send a request that triggers an event → `WebhookDelivery` row appears with status `RETRYING`, `nextAttemptAt` set ~30s out.
- [ ] Call `POST /api/admin/webhooks/process` with `Authorization: Bearer <WEBHOOK_WORKER_TOKEN>` → row processed (still RETRYING with longer backoff).
- [ ] After max attempts (5 retries by default), status flips to `FAILED`.
- [ ] Replay via `POST /api/webhooks/replay` resets attempts and re-tries.
- [ ] Successful delivery flips status to `DELIVERED` with `deliveredAt` set.

### Webhook signature
- [ ] Receive a delivery → verify the signature on your side using the snippet in `/docs#webhooks`.
- [ ] `x-cyberrakshak-idempotency-key` header is present and unique per delivery.
- [ ] Replay attempts use the same `idempotencyKey` so receivers can dedupe.

### Razorpay
- [ ] Without credentials: clicking "Upgrade" hits `/api/billing/checkout`, receives a `mock: true` order, then `/api/billing/activate` flips the org plan and creates a `MOCK_PAID` invoice.
- [ ] With credentials: checkout opens Razorpay; on success the handler posts to `/api/billing/activate` and the server verifies `razorpay_signature` before activating.
- [ ] `/api/billing/webhook` rejects payloads with bad signatures (recorded as `signatureValid: false`).
- [ ] On `subscription.activated` event with valid signature, `Subscription.status` flips to `ACTIVE` and `Organization.plan` matches the event's plan id.
- [ ] `/api/billing/cancel` updates `Subscription.status = CANCELLED` and writes a `PlanChangeLog` row.

### Policy engine
- [ ] `/dashboard/policy` saves mode, toggles, custom topics, denylist regex, fallback message.
- [ ] Switching to MONITOR: a known prompt-injection input → `HUMAN_REVIEW` instead of `BLOCK`.
- [ ] Switching to STRICT: an email-only input → `BLOCK` instead of `ALLOW_WITH_REDACTION`.
- [ ] Adding a custom topic ("project alpha") → message containing it returns `BLOCK` with the custom fallback message.
- [ ] Adding a denylist regex (`EMP-\d{6}`) → matching message blocked.
- [ ] Disabling redactPII: PII findings disappear from the log; SafeText equals input.

### PDF reports
- [ ] `GET /api/reports/pdf?projectId=<id>` returns a valid PDF (Content-Type: application/pdf).
- [ ] PDF includes agency branding when set, project name, month, all metrics, top risk types, recommendations, OWASP block, disclaimer.
- [ ] No raw user text appears in the PDF; only counts and risk-type names.
- [ ] Calling without `reports:export` permission returns 403.

### Audit exports
- [ ] `/dashboard/exports` lists download links + recent exports.
- [ ] Downloading guard logs JSONL: each line is JSON with a 64-char `signature` field.
- [ ] Downloading guard logs CSV: header is the union of columns; commas inside values are quoted.
- [ ] `X-Manifest-Signature` header on the response matches `signManifest` for the row count + kind + org + timestamp.
- [ ] Webhook delivery exports include `idempotencyKey`, `payloadHash`, `status`, no raw secrets.
- [ ] An `AuditExport` row is created on every download with row count + signature.

### Admin panel
- [ ] `/admin` accessible only when `User.isAdmin = true`.
- [ ] Tiles show users, organizations, projects, blocks (24h), failed webhook deliveries, active subscriptions.
- [ ] Recent organizations table renders with member + project counts.
- [ ] Recent payment events table shows signature validity per event.
- [ ] No raw guard-log text or webhook payloads surface here.

### Public badge still safe
- [ ] `/security-status/<slug>` exposes only `projectName`, `agencyName`, status string, monthly counts, and last activity timestamp.
- [ ] No log text, no API keys, no member emails are visible.
- [ ] `GET /api/badge/<slug>` returns the same shape with `Cache-Control: public`.

### Build / type / test
- [ ] `npm run typecheck` exits 0.
- [ ] `npm test` shows ≥ 46 tests pass.
- [ ] `npm run build` produces all 50+ routes successfully.

### Security spot checks
- [ ] Open the database: no row in `User.passwordHash` is plain text; bcrypt hashes start with `$2`.
- [ ] No row in `WebhookEndpoint.secretHash` is the raw secret.
- [ ] No row in `GuardLog` for a SECRET_DETECTED event has the raw secret in any column or in metadata.
- [ ] `PaymentEvent.payload` only contains values Razorpay sent, signed via `signatureValid`.
- [ ] Auth cookies are HttpOnly + SameSite=Lax (browser dev tools).
