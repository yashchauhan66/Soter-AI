# Billing Test Report

Date: 2026-07-10  
Provider: Razorpay  
Overall status: AUTOMATED CONTROLS VERIFIED; LIVE TEST-MODE EVIDENCE REQUIRED

## Verified locally

The automated billing suite covers configuration normalization, missing configuration diagnostics, fail-closed webhook verification, valid HMAC verification, payment signature verification, receipt generation, server-side price mapping, and plan-ID lookup. The authoritative command is:

```bash
npx tsx --test tests/billing.test.ts
```

The result from the final Phase 16 run belongs here; do not copy a historic count into this report.

## Not yet proven

No Razorpay credentials or account were supplied for this pass. Consequently, order creation, hosted checkout, success/failure callbacks, provider webhook delivery, cancellation/reactivation, invoice retrieval, and test/live mismatch behavior remain EVIDENCE REQUIRED. These cases are enumerated in `docs/razorpay-test-mode-checklist.md`.

## Release decision

- Local development and code review: GO.
- Production billing enablement: NO-GO until every RZP case has dated evidence and a rollback owner.
- Non-billing product surfaces: unaffected, provided paid entitlements are not represented as live.
