<<<<<<< HEAD
# PROJECT DEEP ANALYSIS
## CyberRakshak Guard / AI Agent Security Guard

**Analysis Date:** 2026-06-16  
**Branch:** bug-stabilization-final  
**Analyst:** Antigravity (Senior Full-Stack Architect + Security Reviewer)

---

## 1. Project Architecture

### Technology Stack
| Component | Technology | Version |
|-----------|-----------|---------|
| Framework | Next.js (App Router) | 15.5.19 |
| Language | TypeScript (strict mode) | 5.7.2 |
| ORM | Prisma | 5.22.0 |
| Database | PostgreSQL | (external) |
| Auth | next-auth v5 (beta) + Credentials | ^5.0.0-beta.25 |
| Rate Limiting | Upstash Redis / ioredis / MemoryFallback | ^1.34.3 |
| Email | mock / Resend / AWS SES / SMTP | — |
| PDF | pdfkit | ^0.15.1 |
| OCR | tesseract.js | ^6.0.1 |
| Billing | Razorpay | ^2.9.5 |
| Validation | Zod | 3.24.1 |
| UI Styling | Tailwind CSS | 3.4.17 |

### Architecture Overview
```
Browser → Next.js App Router (Edge Middleware for auth)
        → API Routes (/app/api/**) → lib/* business logic
        → Prisma → PostgreSQL

Guard API (/api/guard/{input,output,analyze}) → x-api-key auth
Dashboard API → Session JWT auth (NextAuth)
Admin API → Session JWT + isAdmin flag
Public API → /api/badge, /api/billing/webhook
```

### Worker Processes
- `webhookWorker.ts` — Polls DB for pending/retrying webhook deliveries
- `siemWorker.ts` — SIEM event export
- `backgroundWorker.ts` — Monthly reports, PDF generation, audit exports
- `threatIntelWorker.ts` — Threat rule pack validation

---

## 2. Existing Features (Fully Implemented)

### Guard API
- **Input Guard** (`/api/guard/input`) — Detects & blocks: prompt injection, jailbreak, system prompt leak attempts, PII, India PII (Aadhaar, PAN, GSTIN, UPI, IFSC), secrets (OpenAI, GCP, GitHub, AWS, JWT, DB URLs, Stripe, Razorpay, private keys), token abuse
- **Output Guard** (`/api/guard/output`) — Detects: system prompt leakage, unsafe output claims, PII/secrets in responses
- **Analyze** (`/api/guard/analyze`) — Public analyze endpoint (rate-limited, no auth required)
- **Grounding Guard** (`lib/guard/groundingGuard.ts`) — RAG source citation, private chunk leakage, no-source fallback

### Security & Auth
- NextAuth v5 JWT sessions (24h TTL)
- bcrypt cost-12 password hashing
- Constant-time user lookup (prevents user enumeration)
- Email verification (tokenHash SHA-256, 24h TTL, one-time use)
- Password reset (tokenHash SHA-256, 1h TTL, one-time use)
- API key generation (random 32-byte base64url, peppered SHA-256 hash)
- Webhook secret generation (whsec_ prefixed, peppered SHA-256 hash)
- HMAC-SHA256 webhook payload signing with timestamp
- Timing-safe HMAC verification
- Admin-only routes with server-side `isAdmin` DB check

### RBAC
- 6 roles: OWNER, ADMIN, DEVELOPER, SECURITY_ANALYST, BILLING, VIEWER
- 22 permissions defined
- Permission checks in every route handler via `requirePermission()` / `requireProjectAccess()`

### Rate Limiting
- Per-API-key RPM (Redis/in-memory fallback)
- Monthly plan quota enforcement (Redis/in-memory fallback)
- Public endpoint rate limiting (auth/signup, auth/verify-email, analyze)

### Data Safety
- `prepareSafeLogContent()` — Never persists raw secrets, PII, or system prompt leaks
- `sanitizeMetadata()` — Drops token/secret/password/apiKey keys, redacts strings with findings
- `toPublicGuardResult()` — Never echoes originalText in API responses
- Log redaction of secrets, PII, system prompts before DB write

### RAG Security
- Document sandbox with OCR scanning
- PDF structure inspection (embedded JS, OpenAction detection)
- Chunk-level ACL with allowed roles + sensitivity labels
- Cross-tenant namespace isolation
- Retrieval audit logs (no raw query text stored)
- Private chunk leakage detection in grounding guard

### Billing
- Razorpay integration (signature verification, webhook HMAC)
- Plan limits enforced via Redis
- Trial subscription on signup
- Usage limit webhooks and email alerts

### Enterprise
- SAML 2.0 SSO (metadata URL or manual config)
- SCIM v2 (users, groups, token auth with hashed tokens)
- IP allowlist
- Session revocation
- Data retention + deletion
- Audit export (JSONL, CSV, PDF) with row-level HMAC signatures
- SIEM export (Splunk, Datadog, Elastic, generic HTTP)

### Monitoring & Observability
- Background job tracking
- Production metrics
- Classifier benchmarks
- ML model registry, evaluation, deployment tracking
- Red-team suite (requires authorization and confirmed flag)
- System health API

### Integrations
- JS/TS SDK (`packages/sdk`)
- Python SDK (`packages/cyberrakshak-python`)
- LangChain middleware (`packages/langchain-middleware`)
- LlamaIndex middleware (`packages/llamaindex-middleware`)
- Vercel AI SDK middleware (`packages/vercel-ai-sdk-middleware`)
- WordPress plugin (`integrations/wordpress-plugin`)
- Next.js example app
- FastAPI example
- WhatsApp chatbot docs

---

## 3. Partial/Scaffold-Only Modules

| Module | Status | Notes |
|--------|--------|-------|
| SAML SSO | Partial | Schema present, UI present, real IdP test requires credentials |
| SCIM v2 | Partial | Schema + routes present, real IdP sync untested |
| Semantic detectors | Feature-flagged | `ENABLE_SEMANTIC_DETECTORS=false` default |
| Multilingual detectors | Feature-flagged | `ENABLE_MULTILINGUAL_DETECTORS=false` default |
| Phase11 multilingual | Feature-flagged | `ENABLE_PHASE11_MULTILINGUAL_DETECTORS=false` default |
| Real vector DB | Config-only | Memory provider default; Qdrant/pgvector require setup |
| Red-team | Defensive stub | Requires `authorizedProjectId` match + `confirmed: true` |
| Report PDF download | Implemented | pdfkit — tested in build |
| Agent firewall | Implemented | Stub decision engine with tool categories |
| ML registry | Schema + UI | Training and deployment logic not wired |
| Abuse detection | Implemented | Hard quota + spike detection |
| Supply chain | Implemented | AI Bill of Materials snapshot |
| Threat intel | Implemented | Rule pack validation with shadow mode |

---

## 4. Risky Modules (Require Careful Attention)

1. **Signup route** — Transaction creates user + org + subscription + onboarding in one DB transaction; email send happens AFTER transaction. If email fails, user is still created but verification not sent.
2. **`lib/auth.ts` getCurrentProject()** — Auto-creates a "Demo Chatbot" project. This is a legacy compatibility shim that can create unexpected projects.
3. **Webhook worker** — Runs in a separate process; shared Redis state with app; health port not monitored by default.
4. **Background worker** — All job types queued inline; no dead-letter queue for failed background jobs.
5. **Razorpay billing webhook** — Idempotency key stored as `eventId`; plan activation is correct but NOT verified because Razorpay credentials are not present.
6. **Redis fallback** — In-memory Redis is per-process; multi-instance deployment without Redis means rate limits don't work across pods.
7. **build intermittent `_document` error** — First `npm run build` run fails with `PageNotFoundError: Cannot find module for page: /_document`. Second run succeeds. This is a Next.js 15 known intermittent issue during "Collecting page data" phase under Windows.

---

## 5. Most Fragile Parts

1. **Build reproducibility** — First build run fails intermittently (PERF-001)
2. **Email verification after signup** — Token created after transaction; if email fails, user can't verify (SEC-001)
3. **Signup idempotency** — Duplicate email returns 409 correctly; but race condition between findUnique and create could theoretically create duplicates if not for the `@unique` constraint (MEDIUM)
4. **Redis cold-start** — Rate limits and usage metering depend on Redis; fallback is per-process memory only
5. **`.env.example` real credentials** — Contains actual DB password (SEC-002)
6. **ADMIN billing:update permission** — ADMIN role does NOT have billing:update; this is intentional but may confuse operators
7. **Log text length** — `MAX_TEXT_LENGTH` = 8000 chars stored in `originalText` / `redactedText` as `@db.Text`; very large logs could stress DB

---

## 6. Missing Verification Areas

- Real Razorpay payment lifecycle (BLOCKED_NEEDS_USER_PERMISSION)
- Real email provider (Resend/SES/SMTP) (BLOCKED_NEEDS_USER_PERMISSION)
- Real Upstash Redis/Redis instance (BLOCKED_NEEDS_USER_PERMISSION)
- Real SAML IdP integration (BLOCKED_NEEDS_USER_PERMISSION)
- Real SCIM IdP integration (BLOCKED_NEEDS_USER_PERMISSION)
- Real Qdrant/pgvector setup (BLOCKED_NEEDS_USER_PERMISSION)
- Real SIEM endpoint (BLOCKED_NEEDS_USER_PERMISSION)
- Real AWS/GCP KMS (BLOCKED_NEEDS_USER_PERMISSION)
- E2E browser flow testing (No Playwright/Cypress configured — TEST_GAP)
- Load/performance testing (no test:performance script — TEST_GAP)

---

## 7. Test Suite Summary

- **Total test files:** 11
- **Total tests:** 114
- **All passing:** YES (as of 2026-06-16)
- **Test runner:** Node.js built-in test runner via `tsx`
- **No E2E framework configured** (Playwright/Cypress not present)
- **No performance test script**
- **Database-dependent tests:** None (all tests mock DB calls)

---

## 8. Build Summary

| Run | Result | Notes |
|-----|--------|-------|
| First | FAIL | Intermittent `PageNotFoundError: /_document` in data collection phase |
| Second | SUCCESS | 82/82 pages generated, 87.5 kB middleware |
| Warnings | 2 | next-auth jose `CompressionStream`/`DecompressionStream` Edge Runtime warnings (known issue in next-auth v5 beta) |

---

## 9. Security Architecture Summary

| Control | Implementation | Status |
|---------|---------------|--------|
| Auth | NextAuth JWT, bcrypt-12, constant-time | GOOD |
| API key auth | Peppered SHA-256, timing-safe compare | GOOD |
| Webhook signing | HMAC-SHA256 with timestamp | GOOD |
| Log redaction | prepareSafeLogContent, sanitizeMetadata | GOOD |
| Tenant isolation | requireProjectAccess, requireOrganizationAccess | GOOD |
| Admin check | Server-side DB lookup, not JWT-only | GOOD |
| SSRF prevention | parsePublicHttpsUrl, DNS validation | GOOD |
| File upload | Max size, MIME check, sandboxed scan | GOOD |
| Rate limiting | Redis + in-memory fallback | GOOD |
| Token security | One-time use, hash stored, TTL enforced | GOOD |
| PII/secret logging | Never logs raw values | GOOD |
| Env credentials in .env.example | REAL DB PASSWORD PRESENT | ⚠ HIGH |
=======
# Project Deep Analysis — CyberRakshak Guard

Date: 2026-06-16
Branch: `final-project-audit`

## 1. What this product is

CyberRakshak Guard (AI Agent Security Guard) is an OWASP LLM Top 10 aligned AI
security gateway for chatbots, RAG apps, and AI agents. It is **defensive only**.
The core value is a guard engine that inspects model input/output for prompt
injection, jailbreaks, system-prompt leakage, PII (incl. India-specific), and
secrets, then ALLOW / REDACT / REWRITE / HUMAN_REVIEW / BLOCK according to a
per-project policy. Around that core sit: auth + multi-tenant orgs, API keys,
dashboard, logs, webhooks (signed, durable), reports (PDF), RAG security
(scanner, vector ACL), billing (Razorpay), and enterprise features (SAML, SCIM,
SIEM, retention/deletion).

## 2. Architecture

- **Framework**: Next.js 15.5.19 (App Router), React 18, TypeScript 5.7 strict.
- **DB**: PostgreSQL via Prisma 5.22. `prisma/schema.prisma` is the single schema.
- **Auth**: NextAuth v5 beta (credentials + SSO), bcrypt password hashing.
- **Rate limit / metering**: Upstash or node-redis, with an in-memory fallback
  that throws in production (`lib/redis.ts`).
- **Secrets**: pluggable secret store (local dev / AWS KMS / GCP KMS / Vault);
  local provider throws in production (fail-closed).
- **Workers**: webhook, SIEM, background, threat-intel (`workers/*`).
- **Packages**: JS SDK (`packages/sdk`), Python SDK (`packages/cyberrakshak-python`),
  WordPress plugin packaging script. Examples: node-express, fastapi, langchain, nextjs.

## 3. Module maturity

| Maturity | Modules |
| --- | --- |
| Implemented + tested | Guard engine + detectors, policy engine, redaction, API-key auth, RBAC/permission matrix, tenant isolation guards, logs (filters/pagination/keyset), webhook signing + durable delivery, audit export, billing signature/receipt logic, RAG scanner + vector ACL (local), SAML/SCIM logic (local), retention/deletion logic, signup/email-verification policy. |
| Implemented, provider-blocked | Real email send, KMS/Vault, Razorpay live payment lifecycle, real vector DB, SIEM collector, SAML/SCIM IdP interop. Logic is unit-tested; real external verification needs user credentials (see PROVIDER report). |
| Infra-sensitive | E2E suite (OneDrive/Turbopack manifest instability — mitigated by production-build E2E). |

## 4. Most fragile parts

1. **Policy decision ordering** (`lib/guard/policy.ts`) — multiple override
   layers (custom denylist, mode, unsafe-output) applied sequentially; ordering
   bugs can silently downgrade a block. (Found CRG-RT-009.)
2. **Billing webhook** (`app/api/billing/webhook/route.ts`) — dedup vs
   signature-check ordering. (Found CRG-RT-010.)
3. **RBAC call-site discipline** — the permission matrix is correct, but routes
   must each call `requirePermission`; one route relied on membership only.
   (Found CRG-RT-011.)
4. **Redis non-atomic incr+expire** — TTL can leak on partial failure
   (CRG-RT-013).
5. **Provider fail-closed paths** — correct by design, but mean many features
   cannot be runtime-verified locally.

## 5. Verification baseline (2026-06-16, this session)

`npx prisma validate` valid · `npm run typecheck` clean · `npm test` 204/204 ·
`npm run lint` clean · `npm audit` 0 vulnerabilities · `npm run build` succeeds.
This confirms the prior session's fixes (CRG-RT-001..008) still hold before new
work begins.
>>>>>>> main
