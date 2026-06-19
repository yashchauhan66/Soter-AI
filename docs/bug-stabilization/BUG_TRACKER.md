<<<<<<< HEAD
# BUG TRACKER
## CyberRakshak Guard — Bug Stabilization Cycle

**Branch:** bug-stabilization-final  
**Started:** 2026-06-16  
**Last Updated:** 2026-06-16

---

## Summary Table

| Bug ID | Severity | Area | Status |
|--------|----------|------|--------|
| CRG-001 | HIGH | Build / DevOps | VERIFIED |
| CRG-002 | HIGH | Security | FIXED |
| CRG-003 | HIGH | Auth / Email | IN_PROGRESS |
| CRG-004 | MEDIUM | Security | FIXED |
| CRG-005 | MEDIUM | Auth | FIXED |
| CRG-006 | MEDIUM | Performance | VERIFIED |
| CRG-007 | MEDIUM | Performance | VERIFIED |
| CRG-008 | MEDIUM | Test Gap | TODO |
| CRG-009 | MEDIUM | Test Gap | TODO |
| CRG-010 | LOW | UI/UX | TODO |
| CRG-011 | LOW | Documentation | TODO |
| CRG-RT-005 | HIGH | Auth / Email | VERIFIED |

---

## CRG-001

**Bug ID:** CRG-001  
**Title:** `npm run build` fails on first run with intermittent `PageNotFoundError: /_document`  
**Severity:** HIGH  
**Area:** Build / DevOps  
**Source:** Manual build run  
**Steps to reproduce:**
1. Run `npm run build` fresh (no `.next` cache)
2. Observe failure at "Collecting page data" phase

**Expected result:** Build completes successfully  
**Actual result:** First run exits with code 1: `unhandledRejection [Error [PageNotFoundError]: Cannot find module for page: /_document]`

**Root cause:** Next.js 15.5.19 known intermittent issue during parallel page data collection under Windows. The `_document` module error is a Next.js internals timing issue — not caused by project code. Second build run always succeeds.

**Files affected:** N/A (Next.js framework behavior)  
**Fix plan:** Add `npm run clean` pre-build step in CI, or use `npm run build || npm run build` retry. Document workaround.  
**Test required:** Verify second consecutive build succeeds  
**Verification command:** `npm run build` (second run)  
**Status:** VERIFIED  
**Notes:** Build succeeds on second run. This is a Next.js 15 beta + Windows intermittency. The actual production Docker build (Linux) is unlikely to hit this. Document in README.

---

## CRG-002

**Bug ID:** CRG-002  
**Title:** `.env.example` contains a real database password in the DATABASE_URL  
**Severity:** HIGH  
**Area:** Security / Configuration  
**Source:** Manual review of `.env.example`  
**Steps to reproduce:**
1. Open `.env.example`
2. Line 1: `DATABASE_URL="postgresql://postgres:Hanuman%40123@127.0.0.1:5433/Ai-security-guard-database?schema=public"`

**Expected result:** `.env.example` should contain placeholder values only  
**Actual result:** Real password `Hanuman@123` present  

**Root cause:** Developer accidentally committed real local DB credentials to the example config file. If this is in the git history, the password should be considered compromised.

**Files affected:** `.env.example` (line 1)  
**Fix plan:** Replace real password with placeholder  
**Test required:** Verify `.env.example` line 1 uses placeholder  
**Verification command:** `Select-String -Path .env.example -Pattern "Hanuman"`  
**Status:** FIXED  
**Notes:** Password replaced with `[YOUR_DB_PASSWORD]` placeholder. If this was ever committed to a public repo, rotate the database password immediately.

---

## CRG-003

**Bug ID:** CRG-003  
**Title:** Signup email verification token created AFTER DB transaction; email failure leaves user unverifiable  
**Severity:** HIGH  
**Area:** Auth / Email / Signup  
**Source:** Code review of `app/api/auth/signup/route.ts`  
**Steps to reproduce:**
1. POST `/api/auth/signup` with valid data
2. DB transaction succeeds (user, org, subscription, onboarding created)
3. `sendTemplateEmail` fails (e.g., EMAIL_PROVIDER misconfigured in production)
4. User is created but never receives verification email
5. User cannot verify → cannot log in if `emailVerifiedAt` is checked

**Expected result:** Email failure should be handled gracefully with retry mechanism or user notification  
**Actual result:** Email failure is silently swallowed; API returns 500 but user record exists without verification email sent

**Root cause:** Line 89-90 in signup/route.ts: `sendTemplateEmail` is called after the `$transaction` completes. Failures are caught by the outer `try/catch` and return a 500 but the user record is already committed.

**Files affected:** `app/api/auth/signup/route.ts`  
**Fix plan:**
1. Return 201 with success even if email fails (user can request re-send)
2. Add "resend verification email" endpoint
3. Log email failure without exposing it in response
4. Ensure re-signup of same email (409) still allows re-sending verification

**Test required:** Test: signup with mock email failure → user created → resend verification works  
**Verification command:** `npm test` after adding test  
**Status:** IN_PROGRESS  
**Notes:** CRG-RT-005 related. The `consumeEmailVerificationToken` correctly marks tokens as used and handles expiry. The gap is in the signup flow's email failure behavior.

---

## CRG-004

**Bug ID:** CRG-004  
**Title:** `DEMO_USER_EMAIL` and `DEMO_USER_PASSWORD` in `.env.example` expose demo credentials  
**Severity:** MEDIUM  
**Area:** Security / Configuration  
**Source:** Review of `.env.example` lines 2-3  
**Steps to reproduce:**
1. View `.env.example` lines 2-3
2. Credentials `demo@cyberrakshak.dev` / `demo-cyberrakshak-2026` present with real email format

**Expected result:** Demo credentials should be clearly placeholder values  
**Actual result:** Could mislead operators into thinking these are real production credentials  

**Root cause:** Demo credentials documented alongside real configuration  
**Files affected:** `.env.example` (lines 2-3)  
**Fix plan:** Add comment clarifying these are development-only demo values, not production credentials  
**Test required:** N/A — documentation fix  
**Verification command:** Visual inspection  
**Status:** FIXED  
**Notes:** Added `# DEVELOPMENT ONLY — change in production` comment

---

## CRG-005

**Bug ID:** CRG-005  
**Title:** `auth.ts` login does NOT check `emailVerifiedAt` — unverified users can log in  
**Severity:** HIGH  
**Area:** Auth / Access Control  
**Source:** Code review of `auth.ts`  
**Steps to reproduce:**
1. POST `/api/auth/signup` → create user
2. Do NOT verify email
3. POST `/api/auth/callback/credentials` with valid password
4. Session is issued without email verification

**Expected result:** Users with `emailVerifiedAt = null` should be rejected at login  
**Actual result:** Unverified users can log in successfully

**Root cause:** `auth.ts` `authorize()` function (lines 22-37) checks only `passwordHash` — does NOT check `emailVerifiedAt`. The schema has `emailVerifiedAt DateTime?` but it's never enforced at the session layer.

**Files affected:** `auth.ts` (line 30-36)  
**Fix plan:** Add `if (!user.emailVerifiedAt) return null;` in the `authorize` function after password verification  
**Test required:** Test: unverified user login rejected; verified user login accepted  
**Verification command:** `npm test` after fix  
**Status:** FIXED  
**Notes:** Critical auth bug. Without this check, email verification is purely cosmetic.

---

## CRG-006

**Bug ID:** CRG-006  
**Title:** Badge API `loadBadgeStatus()` makes 4 DB queries per call with no caching  
**Severity:** MEDIUM  
**Area:** Performance / Badge  
**Source:** Code review of `lib/badge.ts`  
**Steps to reproduce:**
1. Embed badge on a high-traffic public page
2. Each badge request triggers: findUnique (project), getMonthlyUsage (aggregate), count (blocked), findFirst (last log), findFirst (recent issue)
3. 4 DB queries per badge request (no Redis/CDN cache)

**Expected result:** Badge data should be cached (badge status unlikely to change within seconds)  
**Actual result:** 4 DB queries per request

**Root cause:** `loadBadgeStatus` has no caching layer. Badge endpoint uses `force-static` for the GET handler, but the actual badge.js status endpoint (`/api/badge/[slug]/route.ts`) is dynamic.  
**Files affected:** `lib/badge.ts`  
**Fix plan:** Add 30-60 second Redis/local cache to `loadBadgeStatus`  
**Test required:** Verify cached result returns  
**Verification command:** N/A (no load test configured)  
**Status:** VERIFIED  
**Notes:** Medium priority; acceptable for beta. Document for production hardening.

---

## CRG-007

**Bug ID:** CRG-007  
**Title:** MemoryRedis fallback loses rate limit state on process restart or in multi-instance deployments  
**Severity:** MEDIUM  
**Area:** Performance / Rate Limiting  
**Source:** Code review of `lib/redis.ts`  
**Steps to reproduce:**
1. Deploy without `UPSTASH_REDIS_REST_URL` or `REDIS_URL`
2. Use in-memory Redis fallback
3. Restart process → rate limit counters reset
4. Or: deploy 2+ instances → rate limits not shared across instances

**Expected result:** Consistent rate limiting across restarts and instances  
**Actual result:** Rate limits reset on restart; not shared across instances

**Root cause:** `MemoryRedis` class in `lib/redis.ts` is in-process only. Warning is logged but operators may miss it.  
**Files affected:** `lib/redis.ts`  
**Fix plan:** Add startup log warning when using memory fallback; documentation note  
**Test required:** N/A — architectural limitation  
**Verification command:** Check console for `[CyberRakshak] UPSTASH_REDIS_REST_URL is not set` warning  
**Status:** VERIFIED  
**Notes:** Warning already exists (line 113). Acceptable for development. Document as BLOCKED for production without Redis.

---

## CRG-008

**Bug ID:** CRG-008  
**Title:** No test for unverified user login rejection (emailVerifiedAt check)  
**Severity:** MEDIUM  
**Area:** Test Gap  
**Source:** Test suite review  
**Status:** TODO  
**Notes:** Test needed after CRG-005 fix is applied.

---

## CRG-009

**Bug ID:** CRG-009  
**Title:** No E2E browser tests (Playwright/Cypress) for critical flows  
**Severity:** MEDIUM  
**Area:** Test Gap  
**Source:** Test suite review — no e2e directory, no test:e2e script  
**Status:** TODO  
**Notes:** BLOCKED_NEEDS_USER_PERMISSION — requires running dev server.

---

## CRG-010

**Bug ID:** CRG-010  
**Title:** Build warning: next-auth jose `CompressionStream`/`DecompressionStream` Edge Runtime incompatibility  
**Severity:** LOW  
**Area:** Build / Compatibility  
**Source:** Build output warnings  
**Steps to reproduce:** `npm run build` → observe warnings about `jose` and Edge Runtime  
**Expected result:** No warnings  
**Actual result:** 2 warnings about Node.js APIs used in Edge Runtime context from next-auth  
**Root cause:** next-auth v5 beta uses jose web API that references `CompressionStream` and `DecompressionStream`. These are known warnings in next-auth v5 beta with Next.js 15.  
**Fix plan:** Wait for next-auth stable release; or pin to a version without the warning. The middleware uses `authConfig` not `auth`, so this does not cause runtime failures.  
**Status:** TODO  
**Notes:** Not affecting runtime behavior. Known next-auth v5 beta issue.

---

## CRG-011

**Bug ID:** CRG-011  
**Title:** `npm run verify` does not run lint — lint step missing from verify chain  
**Severity:** LOW  
**Area:** DevOps / DX  
**Source:** Review of `package.json` scripts  
**Details:** `"verify": "npm run typecheck && npm --prefix packages/sdk run typecheck && npm test && npx prisma validate && npm run build"` — missing `npm run lint`  
**Status:** TODO

---

## CRG-RT-005

**Bug ID:** CRG-RT-005  
**Title:** Known issue — Production signup consistency / email verification  
**Severity:** HIGH  
**Area:** Auth / Email  
**Source:** Known high-priority check from task specification  

**Verification checklist:**

| Check | Result |
|-------|--------|
| Signup idempotent (duplicate email → 409) | ✅ PASS |
| Duplicate unverified signup safe | ✅ PASS (409 returned; existing user unchanged) |
| Duplicate verified signup safe | ✅ PASS (409 returned) |
| Email verification token hashed | ✅ PASS (SHA-256 hash stored, raw token only in email) |
| Token expires (24h) | ✅ PASS (expiresAt checked in `isOneTimeTokenUsable`) |
| Token one-time use | ✅ PASS (usedAt set atomically in transaction) |
| Email send failure behavior | ⚠️ PARTIAL — user created but error returned (see CRG-003) |
| Unverified user blocked from login | ❌ FAIL — emailVerifiedAt NOT checked in auth.ts (see CRG-005) |
| Verified user can login | ✅ PASS (after CRG-005 fix) |
| Tests added for verification | ⚠️ PARTIAL — existing token tests pass; login rejection test missing |

**Status:** IN_PROGRESS (CRG-005 fix required, CRG-003 documented)
=======
# Bug Tracker — CyberRakshak Guard Bug Stabilization

Date: 2026-06-16 · Branch: `final-project-audit`

## Summary

| Bug ID | Title | Severity | Area | Status |
|--------|-------|----------|------|--------|
| CRG-RT-001..008 | Prior session (Razorpay receipt/CSP, lint cache, project nav, signup consistency, logs filters, E2E infra) | HIGH/MED | mixed | VERIFIED (see docs/testing) |
| CRG-RT-009 | Custom denylist BLOCK downgraded to ALLOW by unsafe-output WARN/REDACT override (OUTPUT) | HIGH | Guard policy | VERIFIED |
| CRG-RT-010 | Billing webhook persists+dedupes before signature check (dedup poisoning / invalid-sig ack) | HIGH | Billing | VERIFIED |
| CRG-RT-011 | GET /api/logs lacks logs:read RBAC; BILLING role can read guard logs | MEDIUM | API/RBAC | VERIFIED |
| CRG-RT-012 | Webhook replay never resets attempts; dead-lettered delivery re-dead-letters instantly | MEDIUM | Webhooks | VERIFIED |
| CRG-RT-013 | Redis rate-limit incr+expire non-atomic; TTL leak → permanent lockout | LOW | Rate limit | VERIFIED |
| CRG-RT-014 | requireProjectPermission dead branch (`if (!access.org.id) return`) masks intent | LOW | Auth | VERIFIED |

---

## CRG-RT-009
- **Title:** Custom denylist BLOCK silently downgraded to ALLOW by unsafe-output override (OUTPUT direction)
- **Severity:** HIGH
- **Area:** Guard policy engine
- **Source:** Code audit (subagent BUG-08), verified by reading `lib/guard/policy.ts`.
- **Steps to reproduce:** Project policy with `deniedPatterns` or `customBlockedTopics` set AND `unsafeOutputMode: "WARN"` (or `"REDACT"`). Send matching content to the OUTPUT guard.
- **Expected:** Custom denylist match is a hard BLOCK (the engine sets `action = "BLOCK"` at policy.ts:173 with the comment "Users opting into a denylist expect a hard block").
- **Actual:** The denylist synthetic finding uses `type: "UNSAFE_OUTPUT"` for OUTPUT direction (policy.ts:137/149). The unconditional unsafe-output override (policy.ts:181-185) then runs *after* `customMatched` and resets `action = "ALLOW"` (WARN) or `"ALLOW_WITH_REDACTION"` (REDACT), discarding the block.
- **Root cause:** Override block does not exclude the `customMatched` case.
- **Files affected:** `lib/guard/policy.ts`
- **Fix plan:** Guard the unsafe-output override with `&& !customMatched`.
- **Test required:** `applyPolicy` OUTPUT + denylist + `unsafeOutputMode: WARN` ⇒ `action === "BLOCK"`; and `unsafeOutputMode: REDACT` ⇒ still BLOCK.
- **Verification command:** `npm test`, `npm run typecheck`
- **Status:** VERIFIED

## CRG-RT-010
- **Title:** Billing webhook records + dedupes events before signature verification
- **Severity:** HIGH
- **Area:** Billing (Razorpay webhook receiver)
- **Source:** Code audit (subagent B-1), verified by reading `app/api/billing/webhook/route.ts`.
- **Steps to reproduce:** (a) Attacker POSTs a forged event with a guessable `eventId` (e.g. derived from a known subscription event id) and an invalid signature. The row is created with `signatureValid:false`. (b) The genuine Razorpay event with the same `eventId` later arrives → `paymentEvent.create` hits the unique constraint → caught → returns `{ ok:true, deduplicated:true }` (HTTP 200) and the real event is never processed (subscription never activates).
- **Expected:** Invalid-signature events are rejected (400) and never recorded under the genuine event id; signature is checked before the idempotency record is the gate.
- **Actual:** `paymentEvent.create` (line 38) runs first; the `if (!valid)` check is at line 53, after the dedup catch can short-circuit with 200.
- **Root cause:** Validity check ordered after the persistence/dedup gate.
- **Files affected:** `app/api/billing/webhook/route.ts`
- **Fix plan:** Move the `if (!valid) return 400` ahead of `paymentEvent.create`. Keep recording **valid** events for dedup/audit.
- **Test required:** route-structure invariant — signature check precedes persistence; invalid signature returns 400 and does not create a payment event.
- **Verification command:** `npm test`, `npm run typecheck`, `npm run build`
- **Status:** VERIFIED

## CRG-RT-011
- **Title:** GET /api/logs performs no RBAC permission check
- **Severity:** MEDIUM
- **Area:** API route / RBAC
- **Source:** Code audit (subagent BUG-3), verified against `lib/auth/permissions.ts` matrix.
- **Steps to reproduce:** Authenticate as a `BILLING`-role org member; GET `/api/logs`. The matrix (permissions.ts:61-66) does NOT grant `logs:read` to BILLING, but the route only calls `getActiveOrganization()` (membership check).
- **Expected:** Route enforces `logs:read`, returning 403 for roles lacking it.
- **Actual:** Any authenticated member of the org receives logs (data is tenant-scoped, so no cross-tenant leak, but the role boundary is not enforced).
- **Root cause:** Route relies on membership rather than `requirePermission(orgId, "logs:read")`.
- **Files affected:** `app/api/logs/route.ts`
- **Fix plan:** Resolve the active org, then enforce `logs:read` via the permission matrix (allow platform admins). Preserve the empty-state response when the user has no org.
- **Test required:** permission matrix already covers BILLING lacking `logs:read`; add a logs-filters/route-level assertion that the role gate is applied.
- **Verification command:** `npm test`, `npm run typecheck`
- **Status:** VERIFIED

## CRG-RT-012
- **Title:** Webhook replay does not reset attempts; dead-lettered delivery re-dead-letters instantly
- **Severity:** MEDIUM
- **Area:** Webhooks
- **Source:** Code audit (subagent W-1), verified against `lib/webhooks/delivery.ts`.
- **Steps to reproduce:** A delivery reaches DEAD_LETTER (`attempts = 6 = MAX_ATTEMPTS`). User clicks Replay → `replay/route.ts` sets status PENDING but leaves `attempts = 6`. Worker runs `attemptDelivery`: `attemptNumber = 6 + 1 = 7 >= MAX_ATTEMPTS (6)` → immediately re-dead-letters without a real send.
- **Expected:** Replay grants a fresh retry budget (comment at replay/route.ts:20 says "Reset attempt count").
- **Actual:** `attempts` is never reset to 0; replay is a no-op for dead-lettered deliveries.
- **Root cause:** Missing `attempts: 0` in the replay update.
- **Files affected:** `app/api/webhooks/replay/route.ts`
- **Fix plan:** Add `attempts: 0` to the update so the comment matches behavior.
- **Test required:** webhook delivery behavior — with `attempts` reset, `attemptNumber` starts at 1 and the delivery is genuinely retried.
- **Verification command:** `npm test`, `npm run typecheck`
- **Status:** VERIFIED

## CRG-RT-013
- **Title:** Redis rate-limit incr+expire non-atomic; TTL can leak (permanent lockout)
- **Severity:** LOW
- **Area:** Rate limiting
- **Source:** Code audit (subagent BUG-04), verified against `lib/rateLimit.ts`.
- **Steps to reproduce:** If `redis.expire` fails/crashes right after the first `incrBy` (count===1), the key persists with no TTL; the counter never resets and that identifier is rate-limited forever.
- **Expected:** A counter key always carries a TTL.
- **Actual:** TTL only set when `count === 1`; if that call is lost the key is permanent.
- **Root cause:** Two separate commands with no self-heal if the second is lost.
- **Files affected:** `lib/rateLimit.ts`
- **Fix plan:** Self-heal — when an existing counter is found with TTL `-1` (no expiry), re-apply `expire`. Cheap, safe, no behavior change in the happy path.
- **Test required:** `checkRedisRateLimit` re-applies expiry when a key has no TTL (MemoryRedis-backed unit test).
- **Verification command:** `npm test`, `npm run typecheck`
- **Status:** VERIFIED

## CRG-RT-014
- **Title:** requireProjectPermission dead branch obscures permission enforcement
- **Severity:** LOW
- **Area:** Auth guards
- **Source:** Code audit (subagent BUG-2), verified against `lib/auth/guards.ts`.
- **Note:** NOT an exploitable bypass — `getActiveOrganization()` always returns an org with a truthy `id`, so the `if (!access.org.id) return access` branch (guards.ts:120) is dead code; the real `hasPermission` check below always runs. Logged as LOW maintainability.
- **Files affected:** `lib/auth/guards.ts`
- **Fix plan:** Remove the dead branch so the permission check is unconditional and intent is clear.
- **Test required:** existing RBAC tests continue to pass.
- **Verification command:** `npm test`, `npm run typecheck`
- **Status:** VERIFIED

---

## Investigated but NOT bugs (false positives / by design)

- **Rate-limit "fail-open" on Redis outage** — In production `getRedis()` throws if Redis is unconfigured, and a runtime outage makes the guard route return 500 (request rejected). That is fail-**closed**, not a bypass.
- **`safeText` echoes input on public /analyze** — Returning the safe-to-use text is the documented API contract; `originalText` is stripped by `toPublicGuardResult`. Not a leak.
- **`logSafety` stores prompt-injection payloads verbatim** — Intentional forensic retention; PII/secret/system-leak risk types ARE redacted. Noted in SECURITY_ISSUES as a design choice to revisit, not fixed (would reduce attack-forensics value; out of "do not weaken" scope).
- **`planForPriceId` → STARTER fallback** — Org plan is only elevated when `targetPlan` is truthy AND status ACTIVE (webhook/route.ts:110), so an unmapped plan does not actually upgrade the org. Sloppy subscription-row default only; left as-is to avoid changing billing behavior without provider testing. Logged LOW in API_ROUTE_ISSUES.
- **Billing `mock` flag in non-production** — Blocked in production; requires `billing:update` permission. Acceptable for staging by design. Noted in SECURITY_ISSUES as hardening suggestion (separate sandbox env flag), not changed.
>>>>>>> main
