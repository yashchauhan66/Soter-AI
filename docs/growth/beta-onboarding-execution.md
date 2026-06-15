# Beta Onboarding Execution

## Entry Criteria

- Qualified use case and named technical owner.
- Written authorization for any security testing.
- Success criteria and paid decision date agreed before setup.
- No production secrets or raw customer conversations shared through support.

## Per-Customer Runbook

1. Create the account and organization.
2. Create one project for the authorized workflow.
3. Generate an API key and store it in the customer's secret manager.
4. Integrate the input guard.
5. Integrate the output guard.
6. Enable the agreed policy mode and exclusions.
7. Enable the badge only after its publication criteria are met.
8. Configure a signed webhook and test delivery.
9. Scan at least 100 approved messages.
10. Generate and review one report.
11. Record feedback, false positives, false negatives, latency, and blockers.
12. Ask for an explicit paid, extend, or stop decision.

## Success Checklist

- First guarded request completed within 48 hours.
- Input and output coverage enabled.
- At least 100 messages scanned.
- At least one report generated.
- Customer can explain the operational value in their own words.
- Feedback and objections recorded verbatim.
- Paid-plan decision recorded as yes, no, or dated follow-up.

## Customer Cadence

- Day 0: kickoff, access boundaries, and success criteria.
- Day 2: first-request check.
- Day 5: integration and policy review.
- Day 10: usage, false-positive, and report review.
- Day 14: outcome review and commercial decision.

## Evidence and Status

Use `IDENTIFIED`, `INVITED`, `ONBOARDING`, `ACTIVE_BETA`, `DECISION_DUE`, `CONVERTED`, or `STOPPED`. Do not mark a beta active until a real guarded request is recorded.

## Testimonial Request

Ask only after value is demonstrated. Obtain written approval for the exact quote, company identity, logo, and metrics. An anonymized result still requires approval if it could identify the customer.
