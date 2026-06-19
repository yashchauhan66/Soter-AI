# Security Regression Report

Date: 2026-06-15

| Control | Result |
| --- | --- |
| Open redirect sanitization | PASS |
| Public badge injection/privacy | PASS |
| API key hashing and one-time display | PASS |
| Webhook secret hashing/one-time display | PASS in development; production provider blocked |
| Guard result raw-input omission | PASS |
| Secret/PII/system-prompt log redaction | PASS |
| Viewer write denial | PASS |
| Non-admin admin denial | PASS |
| Cross-tenant project/policy denial | PASS |
| SSRF/private destination rejection | PASS in regression suite |
| RAG private ACL/no-source fallback | PASS in regression suite |
| SCIM token hashing/tenant scope | PASS in regression suite |
| SAML callback/session-exchange controls | PASS locally; real IdP not verified |
| Billing signature verification | PASS locally; payment not run |

## Important Finding

RESOLVED (2026-06-15): Production self-service signup is now safe. Provider failure can no longer leave a committed half-created account — production+mock email is blocked before any write, new accounts create user+token atomically, and post-commit send failures are recoverable (idempotent resend). Credentials authentication now requires `emailVerifiedAt` whenever mail is deliverable (real provider/production) or `AUTH_REQUIRE_EMAIL_VERIFICATION=true`; SSO accounts are pre-verified. Covered by `tests/auth-signup.test.ts`. See `CRG-RT-005`.

## No Absolute Claim

These tests reduce known regression risk. They do not prove complete security, absence of unknown vulnerabilities, or production provider correctness.
