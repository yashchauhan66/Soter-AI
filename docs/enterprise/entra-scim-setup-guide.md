# Microsoft Entra SCIM Setup Guide

Prerequisites: Soter organization owner/admin access, Entra admin access, SCIM token generated in Soter.

1. Generate a SCIM bearer token in Soter enterprise settings.
2. In Entra provisioning, set Tenant URL to `https://<your-app>/api/scim/v2`.
3. Paste the secret bearer token.
4. Test connection.
5. Configure attribute mappings for `userName`, `active`, `name`, and `emails`.
6. Enable provisioning.
7. Provision one test user.
8. Update and deactivate the user.
9. Test group assignment and role mapping if group provisioning is enabled.
10. Verify Soter membership and audit logs.

Security notes: keep tokens masked, rotate on exposure, and validate deprovisioning removes organization membership.

Screenshot placeholders: Entra provisioning settings, Soter SCIM token list, audit event.

Support contact: security@soterai.local

