# Phase 7 Okta SAML Live Test Report

Status: OKTA SAML LIVE EVIDENCE REQUIRED.

No Okta tenant credentials, metadata, or assigned test user were available in the workspace. No live SAML assertion was posted to this app.

## Required Checklist

1. Create Okta SAML app.
2. Configure ACS URL: `/api/sso/saml/acs`.
3. Configure Entity ID: `/api/sso/saml/metadata` or configured `SAML_SP_ENTITY_ID`.
4. Import metadata or enter issuer/SSO/certificate.
5. Assign test user.
6. Run SAML login.
7. Verify user, org membership, role mapping, session, and audit event.
8. Test invalid signature, wrong audience, removed user, session expiry, and logout if supported.

