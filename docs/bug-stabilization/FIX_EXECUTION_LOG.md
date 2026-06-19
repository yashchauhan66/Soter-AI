<<<<<<< HEAD
# Fix Execution Log
> Status: TODO  
> Owner: BLACKBOXAI

## Entries
- TODO

## Entry template
- Bug ID:
- Start time:
- Root cause:
- Files changed:
- Fix applied:
- Tests added/updated:
- Verification command(s):
- Result:
- End time:
- Remaining risk:
=======
# Fix Execution Log — CyberRakshak Guard

Date: 2026-06-16 · Branch: `final-project-audit`

Process: each bug fixed in isolation, test added, relevant suite run, then full regression at the end. Fix order: HIGH → MEDIUM → LOW.

---

## CRG-RT-009 (HIGH) — Policy denylist BLOCK downgraded by unsafeOutputMode
- **Root cause:** In `applyPolicy`, the OUTPUT unsafe-output override ran unconditionally after `customMatched` set `action = "BLOCK"`. Denylist/topic synthetic findings use `type: "UNSAFE_OUTPUT"` on OUTPUT, so `unsafeOutputMode: WARN/REDACT` reset the action to ALLOW/ALLOW_WITH_REDACTION, defeating the explicit denylist.
- **Files changed:** `lib/guard/policy.ts` (added `&& !customMatched` to the override guard + comment).
- **Tests added:** `tests/phase3.test.ts` — 3 cases (WARN no-downgrade, REDACT no-downgrade, and a guard that genuine non-denylist UNSAFE_OUTPUT still honors WARN to prevent over-correction).
- **Commands:** `npx tsx --test tests/phase3.test.ts` → 24/24 pass.
- **Result:** FIXED + VERIFIED. **Remaining risk:** none for this path; denylist now wins over softer output modes while normal unsafe-output behavior is unchanged.

## CRG-RT-010 (HIGH) — Billing webhook persists/dedupes before signature check
- **Root cause:** `db.paymentEvent.create` (dedup gate) ran before the `if (!valid)` check. An attacker could pre-seed a row under a guessable `eventId` with an invalid signature; the genuine event then hit the unique-constraint catch and was acked 200 without processing (subscription never activated). Invalid-signature events were also persisted+acked before validation.
- **Files changed:** `app/api/billing/webhook/route.ts` (moved the `if (!valid) return 400` ahead of `paymentEvent.create`; only validated events occupy the dedup key).
- **Tests added:** `tests/billing.test.ts` — source-ordering invariant (signature rejection index < persistence index), matching the file's existing source-level test style.
- **Commands:** `npx tsx --test tests/billing.test.ts` → 14/14 pass.
- **Result:** FIXED + VERIFIED. **Remaining risk:** live Razorpay lifecycle still unverified (provider-blocked), but the ordering correctness is now enforced and tested.

## CRG-RT-011 (MEDIUM) — GET /api/logs missing logs:read RBAC
- **Root cause:** Route enforced membership via `getActiveOrganization()` but never checked `logs:read`. The BILLING role is not granted `logs:read` in the permission matrix, so it could read guard logs (data was tenant-scoped, so no cross-tenant leak — but the role boundary was unenforced).
- **Files changed:** `app/api/logs/route.ts` (added `requireUser()` admin check + `hasPermission(active.membership.role, "logs:read")` gate returning 403; `requireUser` is React-cached so no extra DB round-trip).
- **Tests added:** `tests/logs-filters.test.ts` — asserts the route gates on `hasPermission(...,"logs:read")` + 403, and pins the matrix (BILLING false, VIEWER/OWNER true).
- **Commands:** `npx tsx --test tests/logs-filters.test.ts` → 15/15 pass; `npm run typecheck` clean.
- **Result:** FIXED + VERIFIED. **Remaining risk:** none; consistent with sibling read routes.

## CRG-RT-012 (MEDIUM) — Webhook replay never resets attempts
- **Root cause:** Replay set status PENDING but left `attempts` at its prior value. A DEAD_LETTER delivery (`attempts = MAX_ATTEMPTS = 6`) produced `attemptNumber = 7 >= MAX_ATTEMPTS` on the first replay → immediate re-dead-letter, no real send. The code comment claimed it reset the count.
- **Files changed:** `app/api/webhooks/replay/route.ts` (added `attempts: 0` to the update + clarifying comment).
- **Tests added:** `tests/webhooks.test.ts` — source invariant that the replay update sets `status: "PENDING"` … `attempts: 0` and clears `deadLetteredAt`.
- **Commands:** included in full `npm test` run.
- **Result:** FIXED + VERIFIED. **Remaining risk:** none; backoff schedule unchanged for normal deliveries.

## CRG-RT-013 (LOW) — Redis rate-limit TTL leak (permanent lockout)
- **Root cause:** `incrBy` + `expire` are two commands; `expire` was only issued when `count === 1`. A lost `expire` (crash/partial failure) left the key with no TTL (`ttl === -1`), so the counter never reset and that identifier was locked out forever.
- **Files changed:** `lib/rateLimit.ts` (self-heal: re-apply `expire` when `count === 1 || ttl === -1`, in both `checkRedisRateLimit` and `checkRedisFixedWindowRateLimit`; safe `resetAt` fallback).
- **Tests added:** `tests/security.test.ts` — seeds a no-TTL key (raw `incrBy`), confirms the precondition (`ttl === -1`), then asserts the next call re-applies a positive TTL. Uses a unique identifier + `del` so it is deterministic against the real Redis loaded from `.env`.
- **Commands:** `npx tsx --test tests/security.test.ts` → 13/13 pass; full `npm test` → 211/211.
- **Result:** FIXED + VERIFIED. **Remaining risk:** none in the happy path (behavior unchanged); strictly adds resilience.

## CRG-RT-014 (LOW) — Dead branch in requireProjectPermission
- **Root cause:** `if (!access.org.id) return access` was dead code — `requireProjectAccess` always resolves a concrete org (legacy projects fall back to the active org), so `org.id` is always truthy and the permission check below always ran. The branch only obscured intent.
- **Files changed:** `lib/auth/guards.ts` (removed the dead branch; permission check is now unconditional with an explanatory comment).
- **Tests:** existing RBAC suite (`phase3.test.ts`, `security.test.ts`) continues to pass — behavior-preserving.
- **Commands:** full `npm test` → 211/211; `npm run typecheck` clean.
- **Result:** FIXED + VERIFIED. **Remaining risk:** none; no behavior change, clearer code.

---

## Final regression (2026-06-16)
- `npx prisma validate` → valid
- `npm run typecheck` → clean
- `npm test` → **211/211 pass**, 0 fail
- `npm run lint` → clean
- `npm run build` → compiled successfully, 82/82 pages
- `npm audit` → 0 vulnerabilities

All temporary state cleaned up (test keys deleted in-test). No schema migrations, no destructive operations, no provider credentials used.
>>>>>>> main
