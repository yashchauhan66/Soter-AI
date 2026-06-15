# Phase 9 QA Checklist

## Sales Foundation

- [ ] ICP covers agencies, RAG builders, SaaS, WordPress/WooCommerce, and enterprise pilots.
- [ ] Beta customer list contains no raw customer secrets or logs.
- [ ] CRM has required lead, company, contact, segment, source, status, follow-up, demo, pilot, plan, and value fields.
- [ ] Status values cover NEW, CONTACTED, REPLIED, DEMO_BOOKED, TRIAL_STARTED, ACTIVE_BETA, PAID, LOST, and FOLLOW_UP_LATER.

## Customer Workflows

- [ ] Beta onboarding includes audit, demo, workspace, Guard API/SDK, input/output coverage, seven-day monitoring, report, feedback, and conversion.
- [ ] Audit requires explicit owner authorization.
- [ ] Audit/report templates use redacted or synthetic evidence.
- [ ] Partner and pilot offers include honest limitations.
- [ ] Pricing conversations record acceptance, rejection, reason, and willingness to pay.

## Launch and Evidence

- [ ] Outreach includes LinkedIn, email, WhatsApp, enterprise, follow-ups, demo, onboarding, testimonial, and paid conversion.
- [ ] Case studies and testimonials require written publication permission.
- [ ] Launch plan covers Product Hunt, LinkedIn, Twitter/X, optional communities, assets, and follow-up.
- [ ] Investor materials label unverified traction as target traction.
- [ ] No fake customers, testimonials, logos, certifications, or benchmark claims.
- [ ] No claim of complete or perfect protection.

## Product and Regression

- [ ] `/admin/growth/metrics` is protected by the admin layout.
- [ ] Existing Phase 1-7 routes and security tests remain unchanged except for required integration links.
- [ ] TypeScript passes.
- [ ] Full test suite passes.
- [ ] Production build succeeds.
- [ ] Prisma validates.
- [ ] `npm audit` reports no unresolved production vulnerability.
- [ ] `npm run verify` passes.

## External Validation Still Required

- [ ] Real beta customer outreach and interviews.
- [ ] Agency partner conversations and client proposals.
- [ ] Enterprise pilot pricing acceptance.
- [ ] First verified revenue and invoice.
- [ ] Written customer permission for any case study/testimonial.
