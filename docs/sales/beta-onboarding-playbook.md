# Beta Customer Onboarding Playbook

## Goal

Move a qualified beta customer from outreach to a paid decision using the existing product. Do not add features unless repeated customer evidence proves the need.

## Twelve-Step Flow

1. Identify a qualified chatbot, RAG builder, SaaS company, or agency.
2. Send a short, segment-specific outreach message.
3. Offer a free AI chatbot security audit with written authorization.
4. Run a defensive demo using synthetic or redacted examples.
5. Create the beta workspace and name technical/business owners.
6. Integrate the Guard API or SDK.
7. Enable both input and output guard paths.
8. Enable reporting and the badge when the claim is appropriate.
9. Monitor approved traffic for seven days.
10. Deliver the security report and review findings.
11. Ask for product, accuracy, and operational feedback.
12. Ask for paid conversion or a permissioned testimonial; record the rejection reason when declined.

## Timeline

### Before Kickoff

- Confirm the customer owns or is authorized to test the chatbot.
- Record architecture, data classes, expected volume, and current controls.
- Agree to keep credentials, raw secrets, and unredacted customer data out of email, CRM, analytics, and support.
- Define success criteria and a day-14 decision meeting.

### Days 1-2: Integration

- Create organization/project and API key.
- Send the first guarded request.
- Confirm fallback behavior and latency expectations.

### Days 3-4: Coverage

- Enable input and output guard.
- Configure policy, signed alert, report, and teammate access.
- Use only approved test cases.

### Days 5-11: Seven-Day Observation

- Reach at least 100 scanned messages.
- Review blocked/redacted risks and any false-positive or false-negative reports.
- Generate at least one report.
- Do not change thresholds without recording why and rerunning the same evaluation set.

### Days 12-14: Review and Decision

- Deliver report, top risks, recommended fixes, and limitations.
- Ask what value was created and which plan fits.
- Request paid continuation, a defined extension, or a clear rejection reason.
- Request a testimonial only after value is demonstrated and written publication permission is available.

## Beta Success Criteria

- First guarded request sent.
- At least 100 messages scanned.
- Input and output guard enabled.
- At least one report generated.
- Customer understands blocked/redacted risks.
- Customer provides detection or workflow feedback.
- Customer agrees to continue or gives a specific rejection reason.

## Stuck Customer Triggers

- No technical owner or test permission.
- No first request within 48 hours.
- Fewer than 100 messages by day 11 without a valid reason.
- Output guard not integrated.
- Buyer skips the decision meeting.
- Repeated feature requests unrelated to the agreed outcome.

## Weekly Record

- Requests scanned and risks blocked/redacted.
- Time to first request and first report.
- Open integration blocker and owner.
- False-positive/false-negative feedback.
- Report and alert usefulness.
- Price/plan reaction.
- Next action and date.

## Completion Outcomes

- **PAID:** verified payment and continuation plan.
- **ACTIVE_BETA:** clear remaining evaluation work with an expiry date.
- **FOLLOW_UP_LATER:** valid future trigger and follow-up date.
- **LOST:** reason recorded without inventing product scope.
