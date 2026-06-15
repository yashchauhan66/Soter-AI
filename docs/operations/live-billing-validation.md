# Live Billing Verification Checklist

- [ ] Live Razorpay key ID and secret are paired.
- [ ] Starter, Pro, and Agency plan IDs match the live account.
- [ ] Webhook secret is distinct and stored in the production secret manager.
- [ ] `subscription.activated` updates the plan only after valid signature verification.
- [ ] `subscription.charged` clears failed-payment state.
- [ ] `payment.failed`, `subscription.pending`, and `subscription.halted` create visible operational state.
- [ ] Grace-period expiry downgrades access according to policy.
- [ ] Cancellation preserves paid access until period end.
- [ ] Reactivation before period end is audited.
- [ ] Expired subscriptions require a new verified checkout.
- [ ] Invoice links render only from verified provider events.
- [ ] Duplicate webhook delivery is idempotent.
- [ ] Failed processing is alerted and replayed.
- [ ] No client-supplied payment status activates a plan.
