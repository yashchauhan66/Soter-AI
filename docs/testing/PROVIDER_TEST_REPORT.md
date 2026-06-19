# Provider Test Report

Date: 2026-06-15

## Status legend

- `VERIFIED_REAL` — exercised against a real external provider.
- `VERIFIED_MOCK` — exercised only against the local mock/dev implementation.
- `BLOCKED_NEEDS_USER_PERMISSION` — needs credentials/keys/endpoint the user must supply and authorize.
- `NOT_CONFIGURED` — no configuration present.
- `FAILED` — configured and tested but failing.

## Provider matrix

| Provider | Status | Evidence / blocker |
| --- | --- | --- |
| PostgreSQL | VERIFIED_REAL | Local PostgreSQL: migrations, seed, health, runtime CRUD, and E2E all passed. `npx prisma validate` valid; `npx prisma db execute "SELECT 1"` reachable on 2026-06-15. |
| Email | VERIFIED_MOCK | Mock provider exercised in dev; production correctly rejects mock (`getEmailClient` throws) AND the signup route now fails fast in production+mock before any write (CRG-RT-005). Real send is BLOCKED_NEEDS_USER_PERMISSION — needs Resend/SES/SMTP keys (see "Email — needed to verify real" below). |
| KMS/Vault | BLOCKED_NEEDS_USER_PERMISSION | Local crypto tests pass; production webhook-secret creation fails closed without a real provider. Needs AWS KMS / GCP KMS / Vault. |
| Razorpay | BLOCKED_NEEDS_USER_PERMISSION | Test key/secret/webhook-secret present; local signature/receipt/CSP tests pass. Live payment/webhook/failure lifecycle NOT RUN — requires explicit user authorization and sandbox keys. |
| Redis/Upstash | VERIFIED_MOCK | Credentials present and guard paths ran, but the provider was not independently probed. Treat as mock-verified until a direct connectivity/latency probe is authorized. |
| Vector DB | BLOCKED_NEEDS_USER_PERMISSION | Local scanner/vector-ACL/grounding tests pass. No authorized production vector provider. Needs Qdrant / pgvector / embedding setup. |
| SIEM | BLOCKED_NEEDS_USER_PERMISSION | Redaction/URL/retry logic tested locally. Needs an authorized HTTPS collector endpoint + token. |
| SAML IdP | BLOCKED_NEEDS_USER_PERMISSION | Assertion/session logic tested locally. Needs IdP metadata, signing cert, callback registration, and a test account. |
| SCIM IdP | BLOCKED_NEEDS_USER_PERMISSION | Token/routes/tenant logic tested locally. Needs an IdP SCIM app and test identities. |
| WordPress/PHP | NOT_CONFIGURED | Plugin ZIP packaging passed; PHP unavailable locally so `php -l` syntax/runtime NOT verified. |

## Authentication / signup workflow (CRG-RT-005)

The self-service signup + email-verification workflow is now consistent and
idempotent regardless of provider:
- Production with `EMAIL_PROVIDER=mock` is a hard-blocked delivery mode; signup
  returns 503 and writes nothing (no partial-record bug).
- Development mock mode (`VERIFIED_MOCK`) returns a `developmentVerificationUrl`
  so the verification round-trip can be exercised locally without a real inbox.
- Verified email is enforced for credentials login whenever mail is deliverable
  (real provider / production) or `AUTH_REQUIRE_EMAIL_VERIFICATION=true`.

### Email — what is needed to verify the REAL provider

To move Email from `VERIFIED_MOCK` to `VERIFIED_REAL`, the user must supply ONE
of the following provider configurations and authorize a live test send:

- Resend: `EMAIL_PROVIDER=resend`, `RESEND_API_KEY=...`, `EMAIL_FROM="Name <verified@yourdomain>"` (sender domain verified in Resend).
- AWS SES: `EMAIL_PROVIDER=aws-ses`, `AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `EMAIL_FROM` (verified identity; account out of the SES sandbox or recipient verified).
- SMTP: `EMAIL_PROVIDER=smtp`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_TLS`, `EMAIL_FROM`.

Where to get them: Resend dashboard API keys + domain verification; AWS IAM
user scoped to `ses:SendEmail` + verified SES identity; or your transactional
SMTP provider's credentials.

Test that will be run once provided: a staging signup that delivers a real
verification email, followed by consuming the link and confirming the account
transitions to verified and can then log in. Until provided, real deliverability,
bounce handling, and inbox placement CANNOT be verified.

