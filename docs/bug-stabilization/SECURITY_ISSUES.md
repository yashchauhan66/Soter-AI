<<<<<<< HEAD
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
=======
# Security Issues — CyberRakshak Guard

Date: 2026-06-16 · Branch: `final-project-audit`

Method: 4 parallel code-audit subagents (auth/RBAC/secrets, API routes, billing/webhooks/RAG, guard/logs/UI), every finding then verified by reading the cited code. Only verified issues are listed.

## Fixed this session

| ID | Issue | Severity | Status |
|----|-------|----------|--------|
| CRG-RT-009 | Custom denylist BLOCK downgraded to ALLOW/REDACT by `unsafeOutputMode` override on the OUTPUT path (`lib/guard/policy.ts`). Explicit user denylist could be bypassed. | HIGH | FIXED + tested |
| CRG-RT-010 | Razorpay webhook persisted/deduped the event before checking the signature, enabling dedup poisoning and acking invalid signatures (`app/api/billing/webhook/route.ts`). | HIGH | FIXED + tested |
| CRG-RT-011 | `GET /api/logs` enforced membership but not `logs:read`; BILLING role (no `logs:read` in the matrix) could read guard logs. | MEDIUM | FIXED + tested |

## Verified-correct controls (no change needed)

- Email-verification & password-reset tokens: SHA-256 + domain prefix, hashed at rest, expiring, one-time, prior tokens invalidated on resend (`lib/auth/tokens.ts`).
- Passwords: bcrypt cost 12, dummy-hash timing defense, never logged.
- Open redirect / callback URL: `safeCallbackUrl` rejects non-leading-slash, `//`, `\`, control chars; SAML RelayState routed through it (`lib/auth/callback.ts`).
- Secret store fail-closed in production; no raw secret/token logging in any provider (`lib/secrets/*`).
- SAML session exchange: 2-min TTL, hashed, one-time, IP+UA bound, optimistic-lock delete.
- SCIM token auth: peppered SHA-256, constant-time compare, expiry + revocation checked.
- `AUTH_SECRET` validated at production startup (`auth.config.ts`).
- Webhook delivery payloads carry redacted/safe text only; SSRF guarded via `assertPublicOutboundUrl` (`lib/webhooks/delivery.ts`).
- Tenant isolation on API-key, project, webhook, export, SCIM, SAML routes via `requirePermission` / `requireProjectPermission`.
- `toPublicGuardResult` strips `originalText` from all guard responses.

## Hardening suggestions — NOT changed (out of "do not weaken / do not add features" scope; documented for the operator)

1. **SAML replay store is in-process** (`lib/enterprise/samlReplayStore.ts`). Fine for single-instance; before any multi-instance/serverless production deploy it must be Redis-backed. The file comment already notes this. Recommend a production startup guard. (No code change now — enterprise SAML is a provider-blocked feature pending IdP setup; changing replay storage without a real IdP test risks unverifiable behavior.)
2. **SAML signature canonicalisation is simplified** (`lib/enterprise/saml.ts`). Recommend `xml-crypto`/`samlify` for full XML-DSIG Exclusive C14N before real-IdP production use. Provider-blocked; logged for the SAML hardening milestone.
3. **Platform admins get synthesised `OWNER` role over foreign orgs** (`lib/auth/guards.ts:85`). Functionally intended for support, but a distinct `isPlatformAdmin` flag + audit event would improve traceability.
4. **`quota_override` reachable by ADMIN** (`app/api/enterprise/security/route.ts`); `disable_organization` is OWNER-only. Consider tightening `quota_override`/`force_api_key_rotation` to OWNER.
5. **Invite token hashed with bare SHA-256, no pepper** (`app/api/members/invite/route.ts`). Recommend the same domain-prefix/pepper pattern used by auth/SCIM tokens.
6. **Billing `mock` activation gated only by `NODE_ENV`** (`app/api/billing/activate/route.ts`). Requires `billing:update`; consider a dedicated `RAZORPAY_SANDBOX_ALLOWED` flag so staging can't free-activate plans by accident.
7. **`logSafety` retains prompt-injection/jailbreak payloads verbatim** (PII/secrets/system-leak ARE redacted). This is deliberate forensic retention; flagged only so the operator can decide on a retention/redaction policy for attack payloads.

None of these are exploitable in the current single-instance, provider-gated configuration; they are pre-production hardening items tied to features that need real provider credentials to verify.
>>>>>>> main
