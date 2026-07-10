# Razorpay Test-Mode Checklist

Status: EVIDENCE REQUIRED until executed with a Razorpay test account.

This checklist is the release gate for billing. Use test keys and test plan IDs only. Never paste keys, webhook secrets, payment payloads, or customer PII into this document.

## Preconditions

- [ ] `RAZORPAY_KEY_ID` starts with `rzp_test_` and the matching secret is configured in the runtime secret store.
- [ ] Starter, Pro, and Agency test plan IDs belong to the same Razorpay test account.
- [ ] A unique test webhook secret is configured at both Razorpay and SoterAI.
- [ ] The callback and webhook URLs use HTTPS on a non-production test deployment.
- [ ] Logs are being captured with secret and payment-field redaction enabled.

## Test cases

| ID | Scenario | Expected result | Evidence |
|---|---|---|---|
| RZP-01 | Create an order for each paid plan | Amount, currency, receipt, and plan match the server-side catalog | Pending |
| RZP-02 | Complete a test payment | Signature verifies and subscription becomes active exactly once | Pending |
| RZP-03 | Cancel or fail checkout | No entitlement is granted; retry is available | Pending |
| RZP-04 | Send a valid webhook | HTTP 2xx; event is idempotently applied | Pending |
| RZP-05 | Send an invalid signature | HTTP 4xx; no billing state changes | Pending |
| RZP-06 | Replay the valid webhook | No duplicate entitlement, invoice, or audit event | Pending |
| RZP-07 | Cancel a subscription | Access remains consistent with the configured cancellation policy | Pending |
| RZP-08 | Reactivate a subscription | Entitlement returns once; renewal metadata is correct | Pending |
| RZP-09 | Exceed the free-plan quota | API blocks overage and presents the upgrade path | Pending |
| RZP-10 | Retrieve invoice/receipt | Correct tenant can access it; another tenant cannot | Pending |
| RZP-11 | Mix test key with live plan ID | Configuration or provider request fails closed | Pending |
| RZP-12 | Inspect application/provider logs | No key secret, webhook secret, signature, or full payment payload appears | Pending |

## Sign-off

Record deployment commit, tester, UTC timestamp, Razorpay test event IDs, screenshots with sensitive fields redacted, and the final pass/fail decision in `docs/billing-test-report.md`.
