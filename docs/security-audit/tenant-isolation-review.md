# Tenant Isolation Review

Tenant isolation is enforced through organization and project scoped queries. New Phase 11 tables carry `organizationId` and optional `projectId`; route handlers must verify access before reads or writes.

Review focus:

- No cross-organization queries.
- No unscoped raw SQL.
- API keys scoped to verified project.
- Vector namespace and ACL filters.

