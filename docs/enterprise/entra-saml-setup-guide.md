# Microsoft Entra SAML Setup Guide

Prerequisites: Soter organization owner/admin access, Microsoft Entra admin access, HTTPS app URL.

1. Create an Enterprise Application.
2. Enable SAML single sign-on.
3. Set Identifier / Entity ID to `https://<your-app>/api/sso/saml/metadata` unless overridden.
4. Set Reply URL / ACS to `https://<your-app>/api/sso/saml/acs`.
5. Configure claims: email, name, and optional group/role claims.
6. Download Federation Metadata XML.
7. Paste metadata XML into Soter enterprise settings and enable SAML.
8. Assign a test user and run test login.
9. Verify organization membership, role/group mapping, session, and audit event.

Security notes: use certificate rotation, keep metadata current, do not send raw assertions in support channels.

Screenshot placeholders: Entra SAML configuration, Soter SAML settings, audit event.

Support contact: security@soterai.local

