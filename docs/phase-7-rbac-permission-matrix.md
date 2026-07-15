# Phase 7 RBAC Permission Matrix

Source of truth: `lib/auth/permissions.ts`.

| Role | Can do | Cannot do / notes |
|---|---|---|
| OWNER | All 35 permissions | None in current matrix |
| ADMIN | Projects, API keys, logs, reports/export, webhooks, member management, policy, badge, RAG, shadow AI read, credentials read, cost read, forensics read, redteam read, evaluations | Cannot update billing or manage cost settings |
| DEVELOPER | Project read/update, API keys, logs, webhooks, policy, badge, RAG, feedback, shadow AI read/scan, credentials read, cost read, redteam/evaluation run | Cannot delete projects, manage billing, manage members |
| SECURITY_ANALYST | Project read, logs, reports/export, policy, RAG, feedback, scheduled reports, shadow AI read, forensics manage, redteam read | Cannot manage members, billing, API keys, webhooks |
| BILLING | Project read, billing read/update, reports read, RAG read, cost read/manage | Cannot read logs, manage members, API keys, projects |
| VIEWER | Project read, logs read, reports read, RAG read, feedback create, evaluation read | Cannot create/update/delete projects, API keys, billing, members, SAML/SCIM config |

Dedicated `saml:manage`, `scim:manage`, and `audit:read` permissions are not present. SAML/SCIM admin routes currently use `member:manage`.

