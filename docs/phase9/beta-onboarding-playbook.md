# Beta Customer Onboarding Playbook

## Objective

Move a qualified beta customer from kickoff to sustained guarded traffic within 14 days, while collecting evidence about activation, detection quality, operational value, and willingness to pay.

## Entry Criteria

- Qualified ICP score of 12+ or an explicit strategic exception.
- Live or near-live owned AI project.
- Named technical owner and business owner.
- Agreement to use redacted or synthetic data during onboarding.
- Permission to collect product metadata, not raw sensitive content.

## Roles

- Customer technical owner: integration and testing.
- Customer security/business owner: policy and success approval.
- CyberRakshak onboarding owner: schedule, unblock, and document.
- CyberRakshak product owner: review feedback and pricing signal.

## Pre-Kickoff

Send 24 hours before kickoff:

- Architecture questionnaire.
- Data-classification checklist.
- SDK/REST integration guide.
- Known limitations statement.
- Success criteria worksheet.
- Support and escalation channel.

Do not request API keys, production secrets, raw logs, or customer conversations by email or chat.

## 14-Day Plan

### Day 0: Kickoff

- Confirm use case, architecture, owner, timeline, and decision process.
- Define one production-like project and one safe test environment.
- Agree on latency, detection, reporting, and operations success criteria.
- Record the baseline: current controls, incidents, review effort, and buyer concern.

### Days 1-2: Setup

- Create organization and project.
- Generate the first API key and store it in the customer's secret manager.
- Select SDK or REST integration.
- Configure monitor/balanced policy before strict enforcement.
- Confirm that no raw sensitive content enters analytics or support.

Exit gate: authenticated request reaches the Guard API.

### Days 3-4: First Guarded Flow

- Integrate the input guard.
- Integrate the output guard.
- Send safe, synthetic, and redacted test cases.
- Review actions, latency, and application fallback behavior.

Exit gate: first successful guarded request and first expected defensive action.

### Days 5-7: Operations

- Configure signed webhook or Slack delivery.
- Enable badge only if appropriate for the customer's public claims.
- Generate the first report.
- Invite a second team member.
- Confirm support escalation and incident ownership.

Exit gate: customer can review logs, receive an alert, and produce evidence without assistance.

### Days 8-10: Accuracy Review

- Review false positives, false negatives, and correct decisions.
- Store only redacted examples.
- Separate product defects from project-specific policy preferences.
- Agree on threshold or policy changes and rerun the same evaluation set.

Exit gate: customer accepts the current operating policy or records explicit blockers.

### Days 11-14: Value and Conversion

- Review guarded volume, blocked events, redactions, alert usefulness, and team usage.
- Compare results with the kickoff baseline.
- Ask the buyer what plan and price feels justified.
- Agree on paid conversion, extended evaluation, or a documented no-go.

Exit gate: commercial decision and next action have an owner and date.

## Activation Metrics

- Time to first API key.
- Time to first guarded request.
- Time to output guard enabled.
- Time to first expected block/redaction.
- Time to first alert and report.
- Number of active team members.
- Weekly guarded request volume.
- Feedback count and accepted feedback count.
- Day-14 paid-conversion intent.

## Stuck-Customer Triggers

- No technical owner after kickoff.
- No API request within 48 hours.
- Input-only integration after day 4.
- No operational alert/report by day 7.
- More than three unresolved high-impact false positives.
- Buyer absent from the day-10 or day-14 review.

For each trigger, open a success action with owner, blocker, next step, and deadline. Do not respond by adding unvalidated product features.

## Weekly Review Template

- Progress since last review.
- Current blocker and owner.
- Guarded volume and latency.
- Top risk category.
- Detection feedback and policy changes.
- Operational evidence generated.
- Commercial signal: stronger, unchanged, or weaker.
- Next milestone and date.

## Completion Outcomes

- **Activated:** production-like traffic, input/output coverage, alerts, report, and buyer value confirmed.
- **Extended:** clear blocker with owner and a maximum 14-day extension.
- **Not qualified:** no owner, use case, urgency, or willingness to pay.
- **Product gap:** repeated need across ICP accounts; send to evidence-based roadmap review.
