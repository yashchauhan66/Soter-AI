# Okta SAML Setup Guide

Prerequisites: Soter organization owner/admin access, Okta admin access, HTTPS app URL.

1. In Okta, create a SAML 2.0 app.
2. Set Single sign-on URL to `https://<your-app>/api/sso/saml/acs`.
3. Set Audience URI / Entity ID to `https://<your-app>/api/sso/saml/metadata` unless `SAML_SP_ENTITY_ID` is configured.
4. Map email to `email` or NameID.
5. Optional: map display name to `name` and groups to `groups`.
6. Copy Okta metadata XML.
7. In Soter enterprise settings, paste metadata XML and enable SAML.
8. Assign a test user and run a test login.
9. Verify organization membership, role, session, and audit event.

Security notes: use HTTPS only, rotate certificates through metadata update, do not share raw assertions or private keys in support tickets.

Screenshot placeholders: Okta app settings, Soter SAML settings, successful audit event.

Support contact: security@soterai.local

