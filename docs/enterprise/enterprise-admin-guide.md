# Enterprise Admin Guide

## SAML

Owners/admins with member-management permission can configure SAML metadata, enable/disable SAML, and set default role/domain restrictions.

## SCIM

Owners/admins can create and revoke SCIM tokens. Tokens are displayed once and stored only as hashes.

## Role Mapping

SCIM group display names map to roles: `owner`, `admin`, `developer`, `security analyst`, `billing`, `viewer`.

## Audit

SAML config changes, SAML provisioning, SCIM token changes, SCIM users, and SCIM groups write organization audit logs.

## Security Notes

- Do not paste raw SAML assertions into tickets.
- Do not store SCIM tokens outside a vault.
- Use test users before enabling broad assignment.
- Confirm deprovisioning removes access.

