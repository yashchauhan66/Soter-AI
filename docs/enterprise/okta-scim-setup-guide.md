# Okta SCIM Setup Guide

Prerequisites: Soter organization owner/admin access, Okta admin access, SCIM token generated in Soter.

1. Generate a SCIM bearer token in Soter enterprise settings.
2. In Okta provisioning settings, set Base URL to `https://<your-app>/api/scim/v2`.
3. Set authorization to HTTP Bearer and paste the token.
4. Test connection.
5. Enable create, update, and deactivate users.
6. Optional: enable group push.
7. Push one test user.
8. Update the user profile.
9. Deactivate and reactivate the user.
10. Push a group named `admin`, `developer`, `billing`, `security analyst`, or `viewer` to test role mapping.
11. Verify Soter membership and audit logs.

Security notes: tokens are shown once, hashed at rest, and should be rotated if exposed.

Screenshot placeholders: Okta provisioning settings, token screen with token hidden, audit event.

Support contact: security@soterai.local

