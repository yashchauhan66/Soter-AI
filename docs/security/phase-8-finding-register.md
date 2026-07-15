# Phase 8 Finding Register

## PH8-SEC-001 - Razorpay Activation Did Not Validate Server-Side Order Metadata

Severity: High

Affected component: `app/api/billing/activate/route.ts`, `lib/billing/razorpay.ts`

Impact: A user with billing permission could submit a valid Razorpay signature for one order/payment pair while requesting activation of a different plan or organization if the server did not independently fetch and validate the Razorpay order/payment metadata.

Exploit path: Create or reuse a valid lower-cost payment, submit its `razorpayOrderId`, `razorpayPaymentId`, and signature to `/api/billing/activate`, and set `plan` to a higher tier or `organizationId` to another accessible org context.

Root cause: Signature verification proved the order/payment pair but did not prove the order amount, currency, organization note, or plan note matched the requested activation.

Fix: Added `validateRazorpayActivationSnapshot` and route enforcement that fetches Razorpay order/payment records, then validates order id, payment id, amount, currency, captured status, organization note, and plan note before subscription changes.

Regression tests: Added PH8-SEC-001 tests in `tests/billing.test.ts` for cheaper-order upgrade, cross-org order, wrong plan note, and valid captured payment.

Retest proof: `npx tsx --test tests/billing.test.ts` passed 19/19. `npm run typecheck` passed.

Status: Closed.

## Dependency Findings

PH8-DEP-001: High dev dependency vulnerability in `linkify-it` via `@vscode/vsce@2.32.0`. Fixed by upgrading `@vscode/vsce` to `^3.9.2`. Retest: `npm audit` passed.

PH8-DEP-002: Moderate dev dependency vulnerability in nested `esbuild@0.24.2`. Fixed by upgrading to `^0.28.1`, removing stale nested lock entries, and reinstalling. Retest: `npm ls esbuild @vscode/vsce` and `npm audit` passed.

## Open Findings

Critical open: 0
High open: 0
Medium open: 0 confirmed
Review candidates: static API auth/validation review candidates remain in `reports/phase-8-api-self-pentest-results.json`; not confirmed vulnerabilities.
