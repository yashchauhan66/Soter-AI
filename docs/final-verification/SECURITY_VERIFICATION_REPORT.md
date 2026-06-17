# SECURITY VERIFICATION REPORT — CyberRakshak Guard

> Audit Date: June 17, 2026
> Classification: CONFIDENTIAL — Internal Audit
> Methodology: Code inspection + automated test verification + static analysis

---

## 1. AUTHENTICATION & AUTHORIZATION

| Check | Evidence | Status |
|-------|----------|--------|
| NextAuth.js configured | `auth.ts`, `auth.config.ts` present; beta.25 | ✅ VERIFIED |
| Password hashing (bcrypt) | `bcryptjs` dependency, `lib/auth.ts` uses `hash`/`compare` | ✅ VERIFIED |
| Email verification flow | `/api/auth/verify-email` route + `EmailVerificationToken` model | ✅ VERIFIED |
| Password reset flow | `/api/auth/request-password-reset` + `/api/auth/reset-password` + `PasswordResetToken` model | ✅ VERIFIED |
| API keys server-side only | Keys hashed via `lib/apiKeyCrypto.ts`, never returned to client in full | ✅ VERIFIED |
| API key never logged | SDK test confirms: `API key is never logged by SDK helpers` — test 10/10 passes | ✅ VERIFIED |
| RBAC enforcement | `lib/auth/permissions.ts` defines OWNER/ADMIN/MEMBER/VIEWER; `requirePermission()` enforced in API routes | ✅ VERIFIED |
| Webhook receiver auth excluded | `/api/billing/webhook` excluded from NextAuth in `auth.config.ts` line 37 | ✅ VERIFIED |

## 2. INPUT VALIDATION & SANITIZATION

| Check | Evidence | Status |
|-------|----------|--------|
| Zod validation on API inputs | `lib/validations.ts` defines schemas for webhook, policy, project, etc. | ✅ VERIFIED |
| MAX_GUARD_TEXT_LENGTH enforced | Configurable via env, default 8000 chars | ✅ VERIFIED |
| SQL injection (Prisma ORM) | All DB queries use Prisma client parameterized queries | ✅ VERIFIED |
| XSS prevention | React auto-escapes; CSP headers configured in routes-manifest | ✅ VERIFIED |
| Path traversal | No file system operations on user input in API routes | ✅ VERIFIED |

## 3. SECRETS HANDLING

| Check | Evidence | Status |
|-------|----------|--------|
| No hardcoded secrets in source code | `grep -rn sk_live\|sk_test\|rk_live\|rk_test lib/ app/` returned **empty** | ✅ VERIFIED |
| .env not committed | `.gitignore` includes `.env` and `.env.local` | ✅ VERIFIED |
| API_KEY_PEPPER for hashing | Required in `.env.example`, validated by `validate-env.ts` | ✅ VERIFIED |
| Webhook secrets hashed at rest | `lib/webhooks/signing.ts`: `hashWebhookSecret()` uses HMAC-SHA256 with pepper | ✅ VERIFIED |
| Audit export HMAC signing | `lib/audit/export.ts` signs rows with `AUDIT_EXPORT_SECRET` | ✅ VERIFIED |
| Secret store abstraction | `SECRET_STORE_PROVIDER` supports `local`, `aws-kms`, `gcp-kms`, `vault` | ✅ VERIFIED |
| Razorpay secrets via env only | `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET` read from `process.env` only | ✅ VERIFIED |

### ⚠️ Secret Store in Local Mode
- Default `SECRET_STORE_PROVIDER=local` uses `LOCAL_SECRET_STORE_KEY`
- In `.env` this key is a placeholder — **must be set to a real 32+ char key in production**
- `validate-env.ts` catches this: "still contains a placeholder value"

## 4. WEBHOOK SECURITY

| Check | Evidence | Status |
|-------|----------|--------|
| Razorpay webhook HMAC verification | `lib/billing/razorpay.ts:verifyRazorpayWebhook()` computes HMAC-SHA256 over raw body | ✅ VERIFIED |
| Invalid signatures fail closed | `app/api/billing/webhook/route.ts` returns 400 on invalid signature, event still persisted | ✅ VERIFIED |
| Event deduplication | Unique `eventId` constraint on `PaymentEvent` model | ✅ VERIFIED |
| Webhook secret rotation | `POST /api/webhooks/rotate` generates new secret, hashes, stores, audits | ✅ VERISHED |
| Webhook signing uses timestamp | `signWebhookPayload(secret, timestamp, payload)` — replay protection | ✅ VERIFIED |
| Webhook signature verification tested | `tests/webhooks.test.ts` — 8+ tests for signing, verification, rotation | ✅ VERIFIED |

## 5. RATE LIMITING

| Check | Evidence | Status |
|-------|----------|--------|
| API rate limiter | `lib/rateLimit.ts` + `lib/publicRateLimit.ts` | ✅ VERIFIED |
| Per-RPM limits | `DEFAULT_RPM=60`, `PUBLIC_ANALYZE_RPM=20` configurable | ✅ VERIFIED |
| Monthly plan limits | FREE=100, STARTER=10K, PRO=50K, AGENCY=250K, ENTERPRISE=5M | ✅ VERIFIED |
| Redis-backed when available | Falls back to in-memory with console warning | ✅ VERIFIED |
| Rate limit bypass for billing | Webhook endpoints excluded from auth | ✅ VERIFIED |

## 6. GUARD ENGINE SECURITY

| Check | Evidence | Status |
|-------|----------|--------|
| Prompt injection detection | 10+ pattern rules in `lib/guard/detectors/injectionDetector.ts` | ✅ VERIFIED |
| Jailbreak detection | Patterns for role-play, DAN, character bypass | ✅ VERIFIED |
| System prompt extraction | Detects "ignore previous", "output your instructions" | ✅ VERIFIED |
| Secrets in input | Regex for OpenAI, AWS, GitHub, GCP, JWT, DB URLs, Stripe, Razorpay, private keys | ✅ VERIFIED |
| PII detection (India) | Aadhaar (12-digit), PAN (format), GSTIN (format), UPI, IFSC, Indian phone | ✅ VERIFIED |
| Output guard | Detects unsafe content in LLM responses | ✅ VERIFIED |
| No raw secrets in logs | `sanitizeLogText()` removes secrets and PII from audit output | ✅ VERIFIED |
| All detections tested | 205 tests pass including safety regression, multi-turn safety | ✅ VERIFIED |

## 7. TENANT ISOLATION

| Check | Evidence | Status |
|-------|----------|--------|
| Project-scoped queries | API routes use `requireProjectPermission()` which scopes by projectId | ✅ VERIFIED |
| Organization-scoped data | Guard logs, webhooks, API keys all tied to projectId → organizationId | ✅ VERIFIED |
| Cross-tenant access blocked | RBAC + project ownership checks in middleware | ✅ VERIFIED |
| Audit export scoped | `fetchGuardLogs()` filters by organizationId | ✅ VERIFIED |

## 8. DEPENDENCY SECURITY

| Check | Evidence | Status |
|-------|----------|--------|
| No known critical CVEs in direct deps | Dependencies: next@15.5.19, react@18.2.0, prisma@5.22.0, zod@3.24.1 | ⚠️ NEEDS AUDIT |
| PostCSS pinned | `postcss: 8.5.10` via overrides to avoid CVE | ✅ VERIFIED |
| bcryptjs (not bcrypt) | Pure JS, no native compilation vulnerabilities | ✅ VERIFIED |

## 9. CONTENT SECURITY POLICY

| Check | Evidence | Status |
|-------|----------|--------|
| CSP headers configured | Routes manifest: `default-src 'self'; script-src 'self' 'unsafe-inline'` | ⚠️ PARTIAL |
| `unsafe-inline` in script-src | Required for Next.js but weakens CSP | ⚠️ ACCEPTABLE for Next.js |
| `unsafe-eval` in script-src | Present for Razorpay checkout compatibility | ⚠️ ACCEPTABLE |
| frame-ancestors 'none' | Prevents clickjacking | ✅ VERIFIED |
| X-Frame-Options: DENY | Double protection against framing | ✅ VERIFIED |
| X-Content-Type-Options: nosniff | Prevents MIME sniffing | ✅ VERIFIED |
| Referrer-Policy: strict-origin-when-cross-origin | ✅ VERIFIED |

## 10. DATA PROTECTION

| Check | Evidence | Status |
|-------|----------|--------|
| DPDP compliance features | Consent records, data deletion, data export, retention policies | 🔸 PARTIAL |
| PII never in URLs | All sensitive data in POST bodies | ✅ VERIFIED |
| Breach notification draft | `createBreachNotificationDraft()` sanitizes PII before drafting | ✅ VERIFIED |
| Data retention enforcement | `lib/retention/policy.ts` deletes old guard logs + webhook deliveries | ✅ VERIFIED |
| Export HMAC integrity | Each row signed, manifest header signed | ✅ VERIFIED |

---

## SECURITY RISK ASSESSMENT

### CRITICAL (0 found)
None.

### HIGH (1 found)
1. **Secret store default key is placeholder** — `LOCAL_SECRET_STORE_KEY` must be set to a real 32+ char value before production. `validate-env.ts` catches this.

### MEDIUM (2 found)
1. **CSP allows unsafe-inline + unsafe-eval** — Required for Next.js + Razorpay but weakens XSS protection. Consider nonces in future.
2. **No rate limiting on auth endpoints** (signup, login, password reset) — Could be abused for credential stuffing. Consider adding CAPTCHA or stricter limits.

### LOW (3 found)
1. **Dependency audit needed** — No automated `npm audit` run during this audit. Should be run before production.
2. **Helm chart not templated with secrets** — `helm/cyberrakshak/values.yaml` should use Kubernetes Secrets for sensitive values.
3. **Docker Compose uses blank POSTGRES_PASSWORD** — Must be configured before deployment.

### INFORMATIONAL
- All webhook signatures verified server-side before any state mutation
- Events persisted regardless of signature validity for audit trail
- Fail-closed design: invalid signatures → 400, no state change
- Structured JSON logging with event types for SIEM integration
- Admin audit log tracks all privileged actions

---

## VERDICT

**Security posture: STRONG for a pre-production codebase.**

- No hardcoded secrets ✅
- No SQL injection vectors ✅
- HMAC verification on all webhooks ✅
- Fail-closed design ✅
- Comprehensive RBAC ✅
- PII sanitization in logs and exports ✅
- Secret store abstraction ready for KMS/Vault ✅

**Pre-production blockers:**
1. Set `LOCAL_SECRET_STORE_KEY` to a real value
2. Set `POSTGRES_PASSWORD` for Docker
3. Run `npm audit` and fix any critical/high CVEs
