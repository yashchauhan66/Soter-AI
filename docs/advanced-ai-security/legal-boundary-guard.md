# Agent Legal Boundary Guard

## What it does
Stops computer-use and browser agents from crossing legal, compliance, or user-consent boundaries before they act: logins, payments/purchases, terms acceptance, scraping, account changes, and personal-data uploads. It returns a decision (`ALLOW` / `ASK_APPROVAL` / `TAKEOVER_REQUIRED` / `BLOCK` / `REVIEW`), a risk level, a user-facing message, and the evidence behind the call via `POST /api/legal-boundary/check`.

**This is not legal advice.** It is risk control and consent enforcement — a guardrail that keeps the agent from taking actions a human should own.

## Why it matters
A capable browser agent will happily click "Place order", accept a terms-of-service checkbox, log into an account, or scrape a site at scale — all of which carry legal, financial, or consent consequences the user never explicitly authorized. The Legal Boundary Guard forces a human into the loop exactly where the law and good sense require it.

## API example
```http
POST /api/legal-boundary/check
x-api-key: cybsg_live_...

{
  "agentName": "openclaw",
  "websiteUrl": "https://example.com/checkout",
  "domain": "example.com",
  "action": "submit_order",
  "actionCategory": "PURCHASE",
  "userConsentProvided": false,
  "metadata": { "loggedIn": true, "paymentInvolved": true, "personalDataInvolved": true }
}
```
Response:
```json
{
  "decision": "TAKEOVER_REQUIRED",
  "riskLevel": "HIGH",
  "reason": "A payment or purchase requires explicit human authorization.",
  "requiredUserMessage": "Please confirm and complete the payment yourself.",
  "evidence": ["payment_action"],
  "auditId": "..."
}
```

## SDK example
```ts
import { createCybersecurityGuardClient } from "@cybersecurityguard/guard";
const guard = createCybersecurityGuardClient({ apiKey: process.env.CYBERSECURITYGUARD_API_KEY! });

const verdict = await guard.checkLegalBoundary({
  agentName: "openclaw", domain: "example.com", action: "submit_order",
  actionCategory: "PURCHASE", userConsentProvided: false, metadata: { paymentInvolved: true },
});
if (verdict.decision === "TAKEOVER_REQUIRED") return handOffToHuman(verdict.requiredUserMessage);
if (verdict.decision === "BLOCK") throw new Error(verdict.reason);
```

## Dashboard usage
`/dashboard/legal-boundary` shows recent checks with decision/risk badges, action category, domain, whether consent was provided, and counts of blocked + takeover-required actions. Use it to audit which risky actions agents attempted and how they were gated.

## Security decisions
Resolved in order (first match wins):
1. Blocked domain (policy) → BLOCK.
2. Bypass of login/paywall/access control → BLOCK.
3. Credential/OTP/password/CVV entry → TAKEOVER_REQUIRED.
4. Payment/purchase → TAKEOVER_REQUIRED (policy can soften to ASK_APPROVAL).
5. Terms/legal acceptance → TAKEOVER_REQUIRED (policy-softenable).
6. Login → TAKEOVER_REQUIRED (ASK_APPROVAL if consented + policy allows).
7. Personal data to untrusted domain → ASK_APPROVAL (BLOCK with `blockDataUploadToUnknown`).
8. Account change → ASK_APPROVAL (logged in) / TAKEOVER_REQUIRED.
9. Booking/cancellation/refund → ASK_APPROVAL.
10. Message/email/post → ASK_APPROVAL.
11. Scraping → REVIEW, or BLOCK above the policy volume limit.
12. Generic form submit → ASK_APPROVAL.
13. Read-only public page → ALLOW.
14. Unknown → REVIEW.

Policy (`LegalBoundaryPolicy.rulesJson`) supports `blockedDomains`, `takeoverDomains`, `paymentAlwaysTakeover`, `termsAlwaysTakeover`, `loginAlwaysTakeover`, `scrapingLimit`, `blockDataUploadToUnknown`. Every check is logged (redacted action/URL) and project-scoped.

## Common mistakes
- Treating `TAKEOVER_REQUIRED` like `ASK_APPROVAL` — takeover means the human must perform the step (e.g. type the password), not just click approve.
- Not passing `metadata` flags (`paymentInvolved`, `personalDataInvolved`, `domainTrusted`) — they sharpen the decision.
- Relying on this for legal compliance guarantees — it reduces risk and enforces consent; it is not a substitute for counsel.

## Test examples
- Public read-only browsing → ALLOW.
- Login without consent → TAKEOVER_REQUIRED.
- Password/OTP entry → TAKEOVER_REQUIRED.
- Purchase/payment → TAKEOVER_REQUIRED.
- Send message/email → ASK_APPROVAL.
- Personal data to unknown domain → ASK_APPROVAL/BLOCK.
- Accept terms → TAKEOVER_REQUIRED.
- Bypass paywall/access control → BLOCK.
- Blocked domain → BLOCK.
- Scraping over the limit → BLOCK.
