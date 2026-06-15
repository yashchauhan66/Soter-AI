# CyberRakshak Guard

## Phase 8: Launch Operations

Phase 8 adds the business and operational layer required for beta launch:

- Beta, agency-partner, and enterprise-pilot onboarding with activation timestamps.
- Trial, failed-payment, grace-period, invoice, cancellation, and reactivation workflows.
- Tenant-scoped support tickets, incident operations, and a public-safe status page.
- Detection feedback review, redacted dataset intake, quality trends, and tuning suggestions.
- Customer-success funnel, churn indicators, and sampled production latency/error metrics.
- Public demo, pricing, partner, enterprise, case-study, contact, changelog, trust, and launch assets.
- Production readiness audit, live billing checklist, SLA draft, error budget, runbook, and QA checklist.

CyberRakshak Guard is OWASP LLM Top 10 aligned and supports defense-in-depth risk reduction. It does not guarantee complete protection or replace secure application engineering, access controls, human review, and incident response.

## Phase 9: Business Validation

The [Phase 9 go-to-market package](docs/phase9/README.md) defines the ICPs, founder-led CRM templates, beta onboarding, authorized free audit, agency partner motion, enterprise pilot package, pricing validation, outreach, case-study permissions, public launch plan, investor materials, and admin growth metrics.

Phase 9 intentionally avoids unrelated product development. Roadmap changes should require repeated evidence from qualified beta users, partners, or paying-intent enterprise buyers.

## Phase 10: Founder-Led Growth Execution

The [Phase 10 growth workspace](docs/growth/README.md) contains the 100-account research list, 50-message draft queue, authorization-first audit and demo playbooks, beta and pricing execution, objection learning, launch gates, weekly scorecard, and KPI definitions. Draft activity is never counted as sent outreach or traction.

CyberRakshak Guard is an OWASP LLM Top 10 aligned, defense-in-depth gateway for AI chatbot input and output flows. It detects, blocks, rewrites, redacts, monitors, and reports prompt injection, jailbreaks, system prompt exposure, PII, India-specific PII, secrets, unsafe output, and basic usage abuse.

The product reduces risk. It does not provide complete protection, replace secure model configuration, or represent OWASP certification.

## Phase 1 capabilities (still working)

- Input, output, and public playground analysis APIs.
- Modular detectors with explainable findings.
- Risk scoring and allow / redact / rewrite / review / block decisions.
- Position-safe redaction, basic risky-instruction rewriting.
- Project-scoped API keys with one-time display and peppered hash storage.
- Per-key RPM limits, public playground limits, monthly plan quotas.
- Guard logs, usage counters, project dashboard, monthly reports.
- Security-safe logging that omits raw PII, secrets, and leaked system instructions.

## Phase 2 capabilities (still working)

- `@cyberrakshak/guard` typed SDK + `@cyberrakshak/guard/next` `secureChatHandler`.
- Webhook endpoints with HMAC-SHA256 signatures and delivery logs.
- Agency dashboard, clients, branding, white-label printable report.
- Public security badge endpoint, embed script, public status page.
- Plan + usage system (FREE / STARTER / PRO / AGENCY / ENTERPRISE).
- Beta onboarding checklist + billing-ready page.
- Developer docs v2.

## Phase 3 capabilities (new)

- **Real authentication.** NextAuth v5 + credentials + bcrypt. Sign-up, sign-in, sign-out, JWT sessions.
- **Organizations + members + roles.** OWNER / ADMIN / DEVELOPER / SECURITY_ANALYST / BILLING / VIEWER with a central permission map.
- **Tenant isolation.** Every private query goes through `requireUser`, `requireOrganizationAccess`, `requireProjectAccess`, or `requirePermission`. UI hiding is *not* the boundary — APIs enforce.
- **Redis-backed rate limit + monthly metering.** Upstash REST client with in-memory fallback. Atomic counters per minute and per YYYY-MM bucket.
- **Durable webhook queue.** Database-backed with exponential backoff (30s → 2m → 10m → 1h → 6h), idempotency keys, replay endpoint, signature verification documented.
- **Razorpay billing.** Checkout, signed activation, signed webhook receiver, subscription state machine, plan upgrade/downgrade, cancel placeholder. Sandbox mode if credentials absent.
- **Policy engine.** Per-project `ProjectPolicy` with MONITOR / BALANCED / STRICT modes, per-detector toggles, allowlist/denylist, custom topics, custom fallback message.
- **Server-side PDF reports.** `pdfkit`-based monthly report with agency branding, OWASP block, disclaimer; no raw user text.
- **Audit exports.** JSONL (SIEM-ready) + CSV, per-row HMAC signature, manifest signature header, AuditExport audit trail.
- **Admin panel.** `/admin` gated by `User.isAdmin`. Surfaces orgs, plans, failed deliveries, payment events.

## Requirements

- Node.js 20+
- npm
- PostgreSQL 14+ with the `pgcrypto`/`uuid` functions (the migration calls `gen_random_uuid()`).

## Local setup

```powershell
npm install
Copy-Item .env.example .env
# Edit .env:
#   DATABASE_URL (PostgreSQL)
#   API_KEY_PEPPER (>= 32 chars)
#   NEXTAUTH_SECRET (>= 32 chars; openssl rand -base64 32)
#   WEBHOOK_WORKER_TOKEN (random)
#   AUDIT_EXPORT_SECRET (optional; falls back to API_KEY_PEPPER)
#   Optional: UPSTASH_REDIS_REST_URL / TOKEN
#   Optional: RAZORPAY_KEY_ID / SECRET / WEBHOOK_SECRET

npm run db:deploy
npm run db:seed
npm run dev
```

The seed prints the demo email, password, and a one-time API key. The demo user is provisioned as an `isAdmin: true` workspace owner for testing the admin panel.

## Verification

```powershell
npm run verify
# typecheck + tests (46/46) + build
```

## REST API examples

```bash
curl -X POST http://localhost:3000/api/guard/input \
  -H "Content-Type: application/json" \
  -H "x-api-key: ck_test_your_key" \
  -d '{"message":"Ignore previous instructions"}'
```

```bash
curl -X POST http://localhost:3000/api/guard/output \
  -H "Content-Type: application/json" \
  -H "x-api-key: ck_test_your_key" \
  -d '{"aiResponse":"System prompt: confidential"}'
```

```bash
curl http://localhost:3000/api/badge/<slug>
```

## SDK quick start

```bash
npm install @cyberrakshak/guard
```

```ts
import { CyberRakshakGuard } from "@cyberrakshak/guard";

const guard = new CyberRakshakGuard({
  apiKey: process.env.CYBERRAKSHAK_API_KEY!,
  baseUrl: "https://yourdomain.com",
});

const result = await guard.secureChat({
  message: userMessage,
  callLLM: async ({ safeInput }) => callLLM(safeInput),
});
return result.reply;
```

The Next.js helper:

```ts
import { secureChatHandler } from "@cyberrakshak/guard/next";
export const POST = secureChatHandler({
  apiKey: process.env.CYBERRAKSHAK_API_KEY!,
  callLLM: async ({ safeInput }) => callLLM(safeInput),
});
```

## Webhooks

Add an HTTPS endpoint under **Dashboard → Webhooks** and store the signing secret. Phase 3 makes delivery durable:

- Payloads are queued to `WebhookDelivery` before any HTTP attempt.
- Failed attempts are retried on an exponential schedule (30s → 6h) up to five times.
- `x-cyberrakshak-idempotency-key` header lets receivers dedupe across retries.
- Manual replay via `POST /api/webhooks/replay`.
- Worker endpoint `POST /api/admin/webhooks/process` is called by your cron driver with a bearer `WEBHOOK_WORKER_TOKEN`.

Verify a signature with:

```ts
import { createHmac, timingSafeEqual } from "crypto";

export function verify(rawBody: string, header: string, secret: string) {
  const match = /t=(\d+),v1=([0-9a-f]+)/.exec(header);
  if (!match) return false;
  const [, t, sig] = match;
  const expected = createHmac("sha256", secret).update(`${t}.${rawBody}`).digest("hex");
  return timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(sig, "hex"));
}
```

## Authentication

`/signin` and `/signup` are public. Everything under `/dashboard`, `/admin`, and private API surfaces enforce session presence via `auth()` and the new tenant guards. Session cookies are HttpOnly, JWT-encoded, 24h lifetime.

Roles and permissions are defined in `lib/auth/permissions.ts`. To check a permission from a route:

```ts
import { requireProjectPermission } from "@/lib/auth/guards";

const access = await requireProjectPermission(projectId, "webhook:create");
// access.user, access.org, access.role, access.project
```

## Razorpay billing

- `/api/billing/checkout` → server-side order creation.
- Client opens Razorpay checkout; on success the handler calls `/api/billing/activate` which verifies `razorpay_signature` against `RAZORPAY_KEY_SECRET` server-side before flipping the plan.
- `/api/billing/webhook` accepts Razorpay events, verifies `x-razorpay-signature` with `RAZORPAY_WEBHOOK_SECRET`, persists each event to `PaymentEvent` (with `signatureValid`), and updates the `Subscription` only when the signature is valid.
- Without credentials, checkout returns a sandbox order id so the UI flow stays exercisable in dev.

## Policy engine

Per-project settings live at `/dashboard/policy`. Modes:

- **MONITOR** — logs everything, demotes BLOCK to HUMAN_REVIEW unless secrets are present.
- **BALANCED** — default. Matches Phase 1/2 behaviour.
- **STRICT** — promotes ALLOW_WITH_REDACTION / REWRITE to BLOCK when score ≥ 50.

Per-detector toggles, custom blocked topics, custom denylist regex, allowlisted domains, and a custom fallback message are all stored on `ProjectPolicy`. The guard input and output routes load the policy on every call.

## Server-side PDF + audit exports

- `GET /api/reports/pdf?projectId=<id>&month=<n>&year=<n>` returns a PDF. The PDF mirrors the white-label web report and never includes raw user text.
- `GET /api/exports?organizationId=<id>&kind=GUARD_LOGS&format=JSONL` returns a SIEM-ready JSONL with one signed row per line. Each export creates an `AuditExport` row with a manifest signature for downstream verification.

## Admin panel

- `/admin` accessible to users with `isAdmin = true`. Surfaces orgs, projects, blocks, webhook failures, payment events, recent subscription states.

## Security behaviour

- Raw API keys are returned once and never stored.
- `API_KEY_PEPPER` is required and must be at least 32 characters.
- Raw PII, secrets, and leaked system instructions are not stored in guard logs.
- Webhook payloads are HMAC-SHA256 signed and never contain raw secrets.
- Razorpay webhooks are signature-verified before any subscription mutation.
- Audit exports HMAC every row and the response manifest.
- React renders all user-controlled text without `dangerouslySetInnerHTML`.
- API and dashboard responses use `Cache-Control: no-store`.
- Baseline CSP, frame, MIME-sniffing, referrer, permissions, HSTS headers configured.
- React renders all user-controlled text without `dangerouslySetInnerHTML`.

## Phase 1, 2, 3 manual QA

- [`docs/phase2-qa-checklist.md`](docs/phase2-qa-checklist.md)
- [`docs/phase3-qa-checklist.md`](docs/phase3-qa-checklist.md)

## Known Phase 3 limitations

- Webhook signing secrets are persisted server-side using an XOR-obfuscated in-process map plus DB hash. A process restart invalidates the cache; rotate to issue a new secret. Phase 4 should move this to a KMS or envelope-encrypted column.
- PDF generation runs in the Node runtime via `pdfkit`. Headless Chromium / Puppeteer would offer richer typography but adds infrastructure weight.
- Razorpay UPI / subscription auto-renewal flows are wired but not exhaustively exercised. Webhook receivers should be tested against the Razorpay sandbox before going live.
- Email-based invites are scaffolded (DB tables + token hashing); transactional email delivery is intentionally not bundled. Phase 4 should integrate Resend / SES / Postmark.
- Detection remains deterministic pattern matching; false positives and negatives are possible. The policy engine reduces but does not eliminate this.
- The admin panel is read-only; impersonation, plan overrides, and quota bumps are Phase 4.

## Phase 4 direction

- Email and SMS notifications (invites, payment failures, exceeded-quota alerts).
- KMS-backed webhook secret storage.
- RAG security: retrieval poisoning detection, source attribution checks, document-level guardrails.
- Semantic + multilingual classifiers behind feature flags; English, Hindi, Tamil to start.
- Admin actions: impersonation, plan overrides, quota bumps, manual replays at scale.
- Scheduled reports + email delivery; rolling 7/30/90-day PDF cohort views.
- Headless-Chromium PDF rendering for richer typography.
- SCIM provisioning and SAML SSO for enterprise.
# Phase 4

Phase 4 adds RAG document scanning and quarantine, tenant-bound vector access controls, grounding and citation policies, optional semantic and Hindi/Hinglish classifiers, detection feedback, email verification/password reset/invites, encrypted webhook secrets, an always-on delivery worker with a dead-letter queue, scheduled signed PDF reports, and audited admin actions.

CyberRakshak Guard is **OWASP LLM Top 10 aligned**. It reduces risk but does not provide complete protection.

## Phase 4 setup

1. Configure the Phase 4 variables in `.env.example`.
2. Apply migrations with `npm run db:deploy` (production) or `npm run db:migrate` (development).
3. Start the app with `npm run dev`.
4. Run the durable webhook worker separately with `npm run worker:webhooks`. Its health endpoint defaults to `http://127.0.0.1:3099`.
5. Trigger scheduled reports from `POST /api/admin/reports/process` using `Authorization: Bearer $REPORT_WORKER_TOKEN`, or use the dashboard's **Send now** action.

When `EMAIL_PROVIDER=mock`, verification/reset/invite URLs are returned only in development API responses and the email metadata is logged without prompt content. Production providers are `resend`, `aws-ses`, and `smtp`.

## Phase 4 testing

- Email verification: create an account, open the mock verification URL (or email), then `POST /api/auth/verify-email` with its token.
- Password reset: `POST /api/auth/request-password-reset`, then `POST /api/auth/reset-password` with the one-time token and a new password.
- RAG scanner: open `/dashboard/rag`, create a collection, and upload TXT, Markdown, or a text-extractable PDF. Risky files are quarantined; stored chunks contain redacted text only.
- Vector access: run `npm test`; the Phase 4 suite checks organization/project namespace and role/status post-filtering.
- Grounding: enable citation requirements on `/dashboard/policy`; answers without enough authorized sources receive the configured safe fallback.
- Semantic/Hinglish: set the three detector feature flags to `true`; rule-based detection remains active if optional classifiers fail.
- Secret rotation: rotate a webhook from `/dashboard/webhooks`; the raw secret is displayed once and encrypted ciphertext is persisted.
- Scheduled reports: configure recipients on `/dashboard/reports`, then use **Send now** or the worker route.
- Admin actions: use `/admin`; every plan, quota, replay, retry, disable, and enable action requires a reason and creates an `AdminAuditLog`.

Detailed manual checks are in `docs/phase4-qa-checklist.md`.
CyberRakshak Guard is an **OWASP LLM Top 10 aligned** defensive AI security gateway. Alignment is not certification and does not imply complete protection.

## Phase 5

Phase 5 adds production-oriented KMS adapters (AWS KMS, GCP KMS, Vault Transit), OCR/document sandboxing, Qdrant and pgvector adapters, source attribution scoring, classifier evaluation, authorized red-team suites, structured security events, SIEM delivery, SAML/SCIM scaffolds, and self-hosted deployment assets.

### Phase 5 environment

- Secret storage: `SECRET_STORE_PROVIDER`, AWS KMS variables, GCP KMS variables, or `VAULT_ADDR`, `VAULT_TOKEN`, and `VAULT_TRANSIT_KEY`. Local encryption is rejected in production.
- OCR: `RAG_MAX_FILE_BYTES`, `RAG_MAX_PAGES`, `OCR_TIMEOUT_MS`, and `OCR_LANGUAGES`. Local Tesseract supports PNG/JPEG; scanned PDFs require an injected PDF-capable provider.
- Vectors: `VECTOR_PROVIDER=qdrant|pgvector`, provider connection variables, `VECTOR_DIMENSIONS`, and a production `EMBEDDING_API_URL`. Memory vectors and deterministic local embeddings fail closed in production.
- Observability: `OTEL_EXPORTER_OTLP_ENDPOINT`, `OTEL_EXPORTER_OTLP_HEADERS`, and SIEM worker settings.
- Enterprise: `SCIM_TOKEN_PEPPER`; SAML settings are tenant-scoped through the enterprise API.

### Phase 5 workflows

1. Apply migrations with `npm run db:deploy` and verify with `npx prisma migrate status`.
2. Upload documents through `/api/rag/documents`, approve them, then use the `INDEX` review action to write redacted chunks to the configured vector provider.
3. Manage chunk roles, source URL, and sensitivity through `PUT /api/rag/chunks/acl`; retrieve with `POST /api/rag/query`.
4. Ground answers with stored chunk IDs through `POST /api/guard/grounding`. Caller-provided source contents and authorization flags are ignored.
5. Run classifier regression checks with `npm run eval:classifiers`.
6. Run the defensive red-team suite only for an authenticated, owned project with explicit confirmation.
7. Configure SIEM destinations through `/api/siem`. HTTPS and public-network resolution are required.
8. Start self-hosted services with `docker compose -f docker-compose.prod.yml up --build` after setting `POSTGRES_PASSWORD` and production secrets.

### Provider verification

External provider tests do not use real credentials in the unit suite. In a staging environment, verify KMS round trips and rotation, OCR timeout/cancellation, Qdrant or pgvector indexing/query/deletion, SIEM delivery/retry, and workload identity or short-lived credentials. Mark unconfigured providers as **Not verified locally - requires external provider configuration**.

### Phase 5 limitations

The bundled classifier dataset is regression coverage, not a production accuracy claim. PDF inspection is defensive structural validation, not full malware analysis. External SAML IdP and marketplace provider behavior must be verified in staging with real provider metadata and credentials. OpenTelemetry support is a lightweight OTLP exporter. CyberRakshak Guard remains **OWASP LLM Top 10 aligned**; alignment is not certification and does not imply complete protection.

## Phase 6

Phase 6 adds enterprise launch readiness:

- Full SCIM v2 Users and Groups routes with bearer-token authentication, hashed tokens, tenant scoping, deprovisioning, group-to-role mapping, and audit logs.
- Full SAML SSO workflow with metadata, ACS, test route, JIT provisioning, issuer/audience/timing validation, and replay protection.
- Enterprise data retention and deletion controls with audit logging.
- Enterprise security controls for IP allowlist, session revocation, API key rotation, project/organization disable, quota overrides, and audit review.
- Public trust, security, privacy, responsible disclosure, subprocessors, data retention, OWASP LLM Top 10, SOC 2 readiness, and ISO 27001 readiness pages.
- Self-hosted Docker Compose, worker image, backup/restore/health scripts, Kubernetes/Helm scaffold, and deployment docs.
- Marketplace integration scaffold for Slack, Microsoft Teams, Jira, and GitHub with redacted payload storage.

### Phase 6 workflows

1. Apply migrations with `npm run db:deploy`.
2. Configure enterprise identity and secret env vars from `.env.example`.
3. Generate SCIM tokens with `POST /api/enterprise/scim-tokens`; the raw token is returned once.
4. Configure IdP SCIM base URL at `/api/scim/v2` and SAML metadata at `/api/sso/saml/metadata`.
5. Review enterprise controls at `/dashboard/enterprise`, `/dashboard/enterprise/scim`, `/dashboard/enterprise/data-retention`, `/dashboard/enterprise/security`, and `/dashboard/enterprise/audit`.
6. For self-hosting, follow `docs/self-hosted.md`, `docs/kubernetes.md`, and `docs/backup-restore.md`.

Known limitations: external providers are not verified locally without customer-managed IdP, KMS, SIEM, OCR, vector, and marketplace credentials. Mark those checks as **Not verified locally - requires external provider configuration**.

Key commands:

```bash
npm run typecheck
npm test
npm run eval:classifiers
npm run build
docker compose -f docker-compose.prod.yml up --build
```

See [Phase 5 QA](docs/phase5-qa-checklist.md), [self-hosted deployment](docs/self-hosted-deployment.md), and the [production readiness report](docs/production-readiness-phase5.md).
