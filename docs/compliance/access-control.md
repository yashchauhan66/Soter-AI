# Access Control

Private APIs must enforce authorization server-side through `requireUser`, `requirePermission`, `requireProjectPermission`, or `requireAdmin`.

- Organization roles: OWNER, ADMIN, DEVELOPER, SECURITY_ANALYST, BILLING, VIEWER.
- Enterprise retention and security settings require OWNER or ADMIN.
- Organization deletion requires OWNER.
- Platform admin pages require `User.isAdmin`.
- SCIM requests authenticate with tenant-scoped bearer tokens stored as hashes only.

