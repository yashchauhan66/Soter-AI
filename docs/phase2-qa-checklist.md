# Phase 2 manual QA checklist

Run after `npm run db:deploy && npm run db:seed && npm run dev`.

## Phase 1 regression (must still pass)

- [ ] Landing page renders, hero, features, pricing, FAQ visible.
- [ ] Playground accepts text, returns guard result, examples switch correctly, 8000-char limit honoured.
- [ ] Demo chatbot side-by-side renders before/after with the seed message.
- [ ] Dashboard overview loads with seed metrics; stats are non-zero.
- [ ] Logs page lists seeded entries; redacted/safe text shown, never raw secrets.
- [ ] Reports page renders monthly summary, top risk types, recommendations.
- [ ] Projects page lists `Demo Chatbot`; new project flow creates a project.
- [ ] API keys page generates a key, shows it once, copy works.
- [ ] `npm run typecheck` exits 0.
- [ ] `npm test` shows 20 / 20 passing.
- [ ] `npm run build` exits 0.

## Phase 2 features

### SDK
- [ ] `cd packages/sdk && npm install && npm run build` succeeds (or `npx tsc --noEmit -p packages/sdk/tsconfig.json` is clean).
- [ ] Importing `CyberRakshakGuard` from compiled output works (`require("./packages/sdk/dist")` after build).
- [ ] `guard.guardInput`, `guard.guardOutput`, `guard.analyze`, `guard.secureChat` round-trip against the local API.
- [ ] Errors thrown for 401 / 429 / 400 are typed (`CyberRakshakAuthError`, `CyberRakshakRateLimitError`, `CyberRakshakValidationError`).

### Next.js helper
- [ ] Mounting `secureChatHandler` in a sample app returns `{ reply, blocked, inputResult, outputResult }`.
- [ ] Blocked input returns the safe blocked response and never echoes original text.
- [ ] Withheld output returns the safe withhold response.

### Webhooks
- [ ] `/dashboard/webhooks` lists endpoints and lets you create one.
- [ ] Creating a webhook reveals the signing secret exactly once and copy works.
- [ ] Test button on an active webhook delivers an event and creates a `WebhookDelivery` row.
- [ ] Disabling/enabling toggles `isActive`; deletion removes the row.
- [ ] Triggering a guarded request that matches the endpoint's selected events stores a SUCCESS or FAILED delivery.
- [ ] Webhook payload never contains raw secret values (verified via the receiving endpoint).
- [ ] Signature verifies with the documented HMAC-SHA256 formula.
- [ ] Rotating the secret produces a new value and invalidates the previous one.
- [ ] Reaching 80% of the monthly quota fires `usage.limit.warning`; reaching 100% fires `usage.limit.exceeded`.

### Agency
- [ ] `/dashboard/agency` auto-creates an agency on first visit.
- [ ] `/dashboard/agency/clients/new` adds a client.
- [ ] `/dashboard/agency/clients/[id]` shows client-wise totals (requests, blocked, redacted, avg risk).
- [ ] Adding a project under a client links it (`Project.clientId` populated).
- [ ] Generating an API key while a client-linked project is selected works.
- [ ] White-label settings save and reflect on `/dashboard/reports/white-label`.

### White-label report
- [ ] Branding (name, logo URL, colour, footer) appears on the printable report.
- [ ] `Print / Save PDF` triggers the browser print dialog.
- [ ] Project public name (when set) replaces project name on the report.
- [ ] Metrics include total requests, blocked, PII redactions, secrets prevented, unsafe outputs blocked, avg risk.
- [ ] OWASP LLM Top 10 alignment block renders.

### Security badge
- [ ] `/dashboard/badges` shows each project's slug and embed snippet.
- [ ] Toggling badge enabled/disabled flips the public page status to INACTIVE accordingly.
- [ ] `/security-status/<slug>` renders without exposing raw logs or text.
- [ ] `/api/badge/<slug>` returns JSON, with `Access-Control-Allow-Origin: *`.
- [ ] `/badge.js` returns JavaScript, mounts an anchor that links to the public status page.
- [ ] After a recent BLOCK, badge status flips to `ISSUES_FOUND`.
- [ ] With no traffic, badge status is `MONITORING_ACTIVE`.

### Plans + usage
- [ ] Dashboard overview shows the usage card with progress bar and tone (cyan/amber/red).
- [ ] Crossing 80% renders the amber banner.
- [ ] Exceeding the limit renders the red banner and HTTP 429 from `/api/guard/input`.
- [ ] `/dashboard/billing` lists plans with current plan highlighted.

### Onboarding
- [ ] `/dashboard/onboarding` renders progress and percentage.
- [ ] Creating a project, key, webhook, badge, and report each tick off.
- [ ] "Mark installed" toggles the SDK step.

### Docs
- [ ] `/docs` renders the new Quickstart, REST, SDK, Next.js, Webhooks, Badge, Risk types, Actions, Errors, Best practices, Limitations sections.

### Security & data hygiene
- [ ] No raw API key value appears anywhere except the one-time display.
- [ ] No raw secret string appears in `GuardLog.metadata.findings[]`.
- [ ] `originalText` is `null` on logs that fired secret/PII detectors.
- [ ] Webhook payload `redactedText` only — no `originalText`.
- [ ] Public security status page surfaces only counts and last activity timestamp.
- [ ] Public analyzer is rate-limited per IP and produces no DB writes.

### Responsive UI
- [ ] Sidebar groups stack legibly on mobile (single-column layout under `lg`).
- [ ] White-label report scales to print width and to small screens.
- [ ] Webhook manager wraps cleanly on small screens; deliveries table scrolls horizontally.
- [ ] Public status page renders cleanly on mobile.
