<<<<<<< HEAD
# API Route Issues
> Status: TODO  
> Owner: BLACKBOXAI

## Checklist (to be validated)
1. Missing API auth / auth bypass
2. Missing RBAC checks
3. Missing Zod validation / weak input validation
4. IDOR (tenant/project access)
5. Rate limiting issues
6. Incorrect method handling (GET/POST mismatch)
7. CSRF / unsafe state-changing requests
8. Unsafe redirects / callback URL issues
9. SSRF via webhook/SIEM/report URLs
10. Sensitive data exposure (secrets/tokens/PII)
11. Error stack leakage
12. Pagination/filtering bugs
13. Webhook signature verification bugs
14. N+1 or heavy include causing timeouts
15. Non-deterministic behavior / flakiness

## Findings
- TODO
=======
# API Route Issues — CyberRakshak Guard

Date: 2026-06-16 · Branch: `final-project-audit`

Scope: 85+ route handlers under `app/api/**`. Audited for missing validation, missing auth/RBAC, error/secret leakage, SSRF, unbounded queries, and raw-content exposure.

## Fixed this session

| ID | Route | Issue | Status |
|----|-------|-------|--------|
| CRG-RT-010 | `POST /api/billing/webhook` | Signature checked after persistence/dedup → dedup poisoning + invalid-sig ack | FIXED + tested |
| CRG-RT-011 | `GET /api/logs` | No `logs:read` RBAC; BILLING role could read logs | FIXED + tested |
| CRG-RT-012 | `POST /api/webhooks/replay` | `attempts` not reset → dead-lettered deliveries never re-send | FIXED + tested |

## Verified-correct

- `/api/guard/analyze` public route: `checkRedisRateLimit` + Zod `analyzeSchema.parse`; public result omits `originalText`.
- `/api/guard/input` & `/api/guard/output`: API-key authenticated, Zod-validated, rate-limited, metered; original text never returned.
- `/api/projects`, `/api/projects/policy`, `/api/api-keys*`, `/api/webhooks*`, `/api/exports`, `/api/reports*`: `requirePermission`/`requireProjectPermission` before mutations.
- `/api/auth/*` public routes: `enforcePublicRateLimit` + Zod (covered by `api-route-audit.test.ts`).
- SSRF: outbound webhook/SIEM URLs pass through `assertPublicOutboundUrl` (`lib/network/outboundUrl.ts`), blocking private/loopback/link-local destinations.
- Error handling: routes funnel through `apiError`, which returns safe messages and does not echo stack traces or secrets.
- `api-route-audit.test.ts` enforces auth/validation presence across the route tree as a standing invariant.

## Noted, NOT changed (low impact / by design)

- **`planForPriceId` → `"STARTER"` fallback** in `app/api/billing/webhook/route.ts` (lines 88/102). When `RAZORPAY_PLAN_*` env vars are unset, an unmapped plan id defaults the *subscription row* to STARTER. However the **organization plan is only elevated when `targetPlan` is truthy AND status is ACTIVE** (line 110), so an unmapped/forged plan id does NOT actually upgrade the org. Severity LOW; left unchanged to avoid altering billing behavior without authorized Razorpay sandbox testing. Recommend: early-return when `targetPlan` is null once plan env mapping is configured in staging.
- **Bulk `take:` audit**: dashboard aggregates use bounded SQL (`LIMIT $\{boundedLimit\}`); logs use keyset pagination with `take: limit+1` (clamped 10–100). No unbounded `take: 2000/10000` remain in request-path list queries (the prior `take: 2_000` dashboard query was already replaced — see `performance.test.ts`).
>>>>>>> main
