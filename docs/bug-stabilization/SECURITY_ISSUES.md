# SECURITY ISSUES
## CyberRakshak Guard — Security Audit

**Date:** 2026-06-16  
**Branch:** bug-stabilization-final

---

## Summary

| Issue ID | Severity | Title | Status |
|----------|----------|-------|--------|
| SEC-001 | HIGH | Real DB password in `.env.example` | FIXED (CRG-002) |
| SEC-002 | HIGH | Unverified users can log in | FIXED (CRG-005) |
| SEC-003 | MEDIUM | Signup email failure leaves user unverifiable | FIXED (CRG-003) |
| SEC-004 | LOW | Open redirect check needed for `callbackUrl` | VERIFIED SAFE |
| SEC-005 | LOW | SAML RelayState redirect | VERIFIED SAFE |
| SEC-006 | LOW | Badge API leaks project data | VERIFIED SAFE |
| SEC-007 | BLOCKED | Real provider tests (Razorpay, email, Redis) | BLOCKED_NEEDS_USER_PERMISSION |

---

## SEC-001: Real Database Password in `.env.example`

**Severity:** HIGH  
**Status:** FIXED

**Finding:** `.env.example` line 1 contained a real local database password: `Hanuman%40123`

**Risk:** If this file was ever committed to a public repository or shared, the database credentials would be compromised.

**Fix applied:** Replaced with placeholder `[YOUR_DB_PASSWORD]`. Port changed from 5433 to standard 5432. Database name genericized.

**Recommendation:** If the credentials were ever in any public commit history, rotate the PostgreSQL password immediately. Check git log for the original commit and consider a history rewrite if public.

---

## SEC-002: Unverified Users Can Log In

**Severity:** HIGH  
**Status:** FIXED (CRG-005)

**Finding:** `auth.ts` `authorize()` function checked only password hash — never checked `emailVerifiedAt`. This meant users who registered but never verified their email could log in with their password.

**Risk:**
- Account takeover if an attacker registered an email before the real owner verified it
- Violates the security promise of email-based identity verification
- Bypasses any business logic gating on email-verified accounts

**Fix applied:** Added `if (!user.emailVerifiedAt) return null;` after password verification in `auth.ts`. bcrypt.compare still runs on all paths to prevent timing-based user enumeration.

**Test added:** `tests/auth.test.ts` — 11 tests covering verification state logic.

---

## SEC-003: Signup Email Failure Leaves User in Unverifiable State

**Severity:** MEDIUM  
**Status:** FIXED (CRG-003)

**Finding:** If `sendTemplateEmail` threw an exception, the outer `try/catch` returned a 500 error but the user record already existed in the DB (created in the committed transaction). The user could not log in (due to SEC-002 fix) and had no way to get a new verification email.

**Risk:**
- Inconsistent state: user exists but cannot verify or log in
- No graceful recovery path for users

**Fix applied:**
- `sendTemplateEmail` call is now wrapped in its own try/catch
- Failures are logged server-side (no details in response)
- Response always returns 201 with `verificationEmailFailed: true` flag so the client can prompt the user to request a new verification email
- User state is NOT corrupted (account and org are fully created)

---

## SEC-004: Open Redirect via `callbackUrl` Parameter — VERIFIED SAFE

**Severity:** LOW (checked)  
**Status:** VERIFIED SAFE

**Finding checked:** The `/signin?callbackUrl=/admin` pattern in admin layout.

**Analysis:** NextAuth v5 handles `callbackUrl` and restricts it to same-origin redirects internally. The auth config uses `trustHost: true` which limits redirects to the configured host. No open redirect vector found in the current implementation.

---

## SEC-005: SAML RelayState Redirect — VERIFIED SAFE

**Severity:** LOW (checked)  
**Status:** VERIFIED SAFE

**Finding checked:** SAML ACS route handling of RelayState parameter.

**Analysis:** The SAML implementation validates the assertion before using RelayState. The SSO schema enforces HTTPS metadata URLs. RelayState is used only for post-authentication redirect within the application — not as an arbitrary URL.

---

## SEC-006: Badge API Privacy

**Severity:** LOW (checked)  
**Status:** VERIFIED SAFE

**Finding checked:** `/api/badge/[slug]/route.ts` returns public badge status.

**Analysis:**
- `publicProjectName()` uses `publicName` field — falls back to `"Protected AI application"` (not the internal project name)
- Badge returns: slug, publicName, agencyName, status, counts — no internal IDs, API keys, or PII
- `badgeEnabled: false` projects return INACTIVE status only
- `lib/badge.ts` `publicProjectName()` tested in phase5.test.ts

---

## SEC-007: Production Provider Tests Blocked

**Severity:** BLOCKED  
**Status:** BLOCKED_NEEDS_USER_PERMISSION

**Providers requiring real credentials for full verification:**

| Provider | Environment Variables Needed | Risk If Untested |
|----------|------------------------------|------------------|
| Razorpay | `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET` | Payment flow uncertified |
| Email (Resend) | `RESEND_API_KEY` | Verification email reliability unknown |
| Email (SES) | `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` | Verification email reliability unknown |
| Redis (Upstash) | `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` | Rate limits not verified in production |
| SAML IdP | `SAML_SP_ENTITY_ID`, `SAML_SP_PRIVATE_KEY` etc. | SSO integration uncertified |
| SCIM IdP | Real IdP required | Directory sync uncertified |
| Vector DB | `QDRANT_URL` or `PGVECTOR_DATABASE_URL` | RAG search quality uncertified |
| AWS/GCP KMS | KMS credentials | Webhook secret encryption uncertified |

---

## Security Controls Verified

| Control | Verification Method | Result |
|---------|---------------------|--------|
| API key never stored raw | Code review + tests | ✅ PASS |
| API key hash is peppered SHA-256 | Tests in security.test.ts | ✅ PASS |
| Webhook secret never stored raw | Code review + tests | ✅ PASS |
| HMAC signature timing-safe | Code review + tests | ✅ PASS |
| Secrets never echo in API response | Tests in security.test.ts | ✅ PASS |
| PII never stored raw in logs | Tests in security.test.ts | ✅ PASS |
| System prompt never persisted verbatim | Tests in security.test.ts | ✅ PASS |
| Cross-tenant project access blocked | Code review + tests | ✅ PASS |
| Admin route requires DB isAdmin check | Code review + tests | ✅ PASS |
| SSRF protection on webhook URLs | Tests in phase5.test.ts | ✅ PASS |
| Empty vector ACL denies access | Tests in phase5.test.ts | ✅ PASS |
| Production refuses memory vectors | Tests in phase5.test.ts | ✅ PASS |
| SCIM tokens hashed, one-time | Tests in phase6.test.ts | ✅ PASS |
| Email verification token one-time | Tests in auth.test.ts + phase4.test.ts | ✅ PASS |
| Unverified user login blocked | Tests in auth.test.ts | ✅ PASS (after CRG-005 fix) |
| WordPress plugin no API key in JS | Tests in phase11.test.ts | ✅ PASS |
| Public badge no internal data leak | Code review + phase5.test.ts | ✅ PASS |
| Metadata sanitizer drops sensitive keys | Tests in security.test.ts | ✅ PASS |
| Rate limiter enforces RPM limits | Tests in security.test.ts | ✅ PASS |
