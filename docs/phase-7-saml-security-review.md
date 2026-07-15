# Phase 7 SAML Security Review

## Result

Local SAML security review: PASS with live IdP evidence required.

## Confirmed

- SP entity ID and ACS URL are generated from environment/base URL.
- IdP metadata parsing supports entity ID, SSO URL, and X.509 certificate.
- Issuer validation exists.
- Audience validation exists.
- Assertion time validation exists for `NotBefore` and `NotOnOrAfter`.
- Replay hook exists through `markAndCheckReplay`.
- Tenant-specific `SamlProvider` row exists.
- JIT provisioning creates/matches users and organization memberships.
- SCIM group mappings can map SAML groups to org roles.
- SAML login attempts are recorded.
- Full SAML assertions are not logged.

## Fixed In Phase 7

- Added decoded/base64 SAML size limits.
- Added Response `Destination` validation against ACS URL.
- Added SubjectConfirmationData `Recipient` validation against ACS URL.
- Added regression tests in `tests/phase6.test.ts`.

## Remaining Risks

- XML signature verification is lightweight and should be replaced with a mature XMLDSig/SAML library before GA.
- Replay store is in-memory and should move to Redis/durable storage for multi-instance deployments.
- Logout behavior was not proven.
- Live Okta and Entra assertion handling is not proven.

