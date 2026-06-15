# Phase 8 QA Checklist

## Onboarding and Activation

- [ ] Beta, agency, and enterprise onboarding records are tenant scoped.
- [ ] Complete and skip events are idempotent.
- [ ] First guarded request, first blocked event, and first report timestamps are recorded.
- [ ] Product analytics contain no raw prompt, secret, or PII content.

## Revenue

- [ ] Trial expiry, grace period, cancellation, and reactivation tests pass.
- [ ] Razorpay signature failures fail closed.
- [ ] Plan changes and customer-impacting actions are audited.

## Support and Accuracy

- [ ] Tickets and messages enforce organization access.
- [ ] Stored context and feedback examples are redacted.
- [ ] Public incidents expose no internal details.
- [ ] Accepted feedback is added only to an explicit dataset version.

## Launch and Operations

- [ ] Public routes render with honest claims.
- [ ] Admin production monitoring is protected.
- [ ] Background worker runs in production compose.
- [ ] Typecheck, tests, build, Prisma validation, npm audit, and verify pass.
