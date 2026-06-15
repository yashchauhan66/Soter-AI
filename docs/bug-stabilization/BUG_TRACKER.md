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
