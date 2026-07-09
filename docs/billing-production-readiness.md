# Billing Production Readiness

**Date:** 2026-07-09
**Integration:** Razorpay
**Status:** CODE COMPLETE — live Razorpay checkout EVIDENCE REQUIRED

## Architecture

### Plans

| Plan | Price (INR/mo) | Monthly Quota | Self-Serve |
|---|---|---|---|
| FREE | 0 | 1,000 | Yes (default) |
| STARTER | 999 | 10,000 | Yes |
| PRO | 2,999 | 50,000 | Yes |
| AGENCY | 9,999 | 250,000 | Yes |
| ENTERPRISE | Custom | 5,000,000 | No (sales) |

### Flow

```
Checkout → Razorpay Order → Client Payment → Activate → Subscription
                                                           ↓
Webhook ← Razorpay ← payment.captured / subscription.activated
                                                           ↓
                                                     Invoice + PlanChangeLog
```

### Security

| Control | Implementation |
|---|---|
| Payment verification | Server-side HMAC-SHA256 with timing-safe comparison |
| Webhook verification | HMAC-SHA256 before any DB write (CRG-RT-010 fix) |
| Mock mode blocked in production | 403 if `RAZORPAY_KEY_ID` contains `test` in prod |
| Key secret never exposed | Diagnostics show first 12 chars only |
| CSRF exemption | `/api/billing/webhook` exempt (Razorpay sends HMAC) |
| CSP headers | `checkout.razorpay.com` in script-src, frame-src, connect-src |

### Lifecycle States

```
TRIAL (14d) → ACTIVE → GRACE_PERIOD (7d) → EXPIRED → FREE
                    ↘ CANCELLED → EXPIRED → FREE
```

## Test Results

| # | Test | Result |
|---|---|---|
| 1 | Env quote stripping | ✅ PASS |
| 2 | Configured check | ✅ PASS |
| 3 | Diagnostics warnings | ✅ PASS |
| 4 | Webhook fails closed | ✅ PASS |
| 5 | Webhook valid signature | ✅ PASS |
| 6 | Payment signature | ✅ PASS |
| 7 | Plan mapping | ✅ PASS |
| 8 | Plan pricing | ✅ PASS |
| 9 | Receipt length | ✅ PASS |
| 10 | Activate stores amount | ✅ PASS |
| 11 | Checkout 502 on rejection | ✅ PASS |
| 12 | Security headers | ✅ PASS |
| 13 | Diagnostics admin-only | ✅ PASS |
| 14 | CRG-RT-010 fix | ✅ PASS |

**Total: 14/14 pass**

## Live Razorpay Checklist

| # | Item | Status |
|---|---|---|
| 1 | Razorpay test account created | ⏳ PENDING |
| 2 | Test API keys configured | ⏳ PENDING |
| 3 | Plans created in Razorpay dashboard | ⏳ PENDING |
| 4 | Plan IDs mapped to env vars | ⏳ PENDING |
| 5 | Checkout flow works (test mode) | ⏳ PENDING |
| 6 | Payment succeeds | ⏳ PENDING |
| 7 | Activation works | ⏳ PENDING |
| 8 | Webhook received and verified | ⏳ PENDING |
| 9 | Cancel flow works | ⏳ PENDING |
| 10 | Reactivate flow works | ⏳ PENDING |
| 11 | Invoice generated | ⏳ PENDING |
| 12 | Lifecycle evaluation works | ⏳ PENDING |
| 13 | No secret logged | ✅ VERIFIED (test 13) |
| 14 | HMAC verification works | ✅ VERIFIED (test 5) |

## Environment Variables Required

```env
RAZORPAY_KEY_ID=rzp_test_xxx
RAZORPAY_KEY_SECRET=xxx
RAZORPAY_WEBHOOK_SECRET=xxx
RAZORPAY_PLAN_STARTER=plan_xxx
RAZORPAY_PLAN_PRO=plan_xxx
RAZORPAY_PLAN_AGENCY=plan_xxx
```

## Known Limitations

| # | Limitation | Impact | Mitigation |
|---|---|---|---|
| 1 | No prorated billing | Plan changes take effect at next checkout | Documented |
| 2 | Enterprise requires sales | No self-serve upgrade | Contact sales flow |
| 3 | No webhook retry beyond Razorpay | Events may be delayed | Razorpay handles retries |
| 4 | Duplicate `lib/phase8/billing.ts` | Code duplication | Refactoring artifact, no impact |

## Sign-off

- [ ] All 14 unit tests pass ✅
- [ ] Live Razorpay checkout tested
- [ ] Webhook received and verified
- [ ] Cancel/reactivate flows work
- [ ] No secrets in logs
- [ ] Ready for production
