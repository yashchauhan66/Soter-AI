# Business KPI Tracking

The protected dashboard is available at `/admin/growth/metrics`. It reads product, onboarding, billing, and feedback records. The CSV queue remains the source for drafts until outreach events are recorded in `ProductEvent`.

## Reporting Window

Dashboard cards use the current UTC calendar month unless the card explicitly says rolling 14 days. Standard-plan MRR is estimated from active subscriptions; custom enterprise contract revenue is excluded.

## Event Conventions

Record these `ProductEvent.eventType` values after the event occurs:

- `outreach.sent`: one verified message sent to one lead.
- `outreach.replied`: a human reply received, excluding automated responses.
- `demo.booked`: a calendar-confirmed demo.
- `beta.invited`: a qualified beta invitation sent.
- `beta.activated`: first real guarded request for the beta workflow.
- `pricing.presented`: a specific price shown to a qualified lead.
- `partner.signed`: commercial partner terms accepted by both parties.
- `case_study.approved`: final case study text approved in writing.

Do not backfill events from draft files or intentions.

## Metric Definitions

| Metric | Definition |
| --- | --- |
| Leads added | Contact leads created during the reporting window |
| Outreach sent | `outreach.sent` events |
| Replies | `outreach.replied` events |
| Reply rate | Replies divided by outreach sent |
| Demos booked | `demo.booked` events |
| Beta users | Onboardings with a first guarded request and no completion/stop event |
| Paid customers | Organizations with active subscriptions |
| MRR | Sum of standard monthly plan values for active subscriptions |
| Churn risk | Paid organizations with no guarded request in rolling 14 days |
| Active projects | Projects with at least one guarded request in rolling 14 days |
| Requests scanned | Guard logs in the reporting window |
| Risks blocked | Guard logs with action `BLOCK` |
| Reports generated | Reports created in the reporting window |
| Feedback received | Detection feedback records |
| False positives | Feedback marked `FALSE_POSITIVE` |
| False negatives | Feedback marked `FALSE_NEGATIVE` |
| Activation rate | New onboardings reaching first guarded request divided by new onboardings |
| Lead-to-paid conversion | Paid customers divided by leads added; interpret cautiously across cohorts |

## Weekly Founder Review

1. Compare activity, conversion, and product-value metrics.
2. Read every reply and objection before changing copy.
3. Review activation failures and false-negative reports first.
4. Assign one owner and date to every next action.
5. Never convert a target, draft, or verbal interest into a completed metric without evidence.
