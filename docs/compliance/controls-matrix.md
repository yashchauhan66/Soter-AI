# Compliance Controls Matrix

CyberRakshak Guard supports enterprise readiness through defense-in-depth controls. This matrix is readiness evidence, not a certification claim.

| Area | Implemented controls |
| --- | --- |
| Access control | NextAuth, organizations, RBAC, platform admin gate, SAML SSO, SCIM v2 provisioning |
| Tenant isolation | Organization-scoped APIs, project scoping, vector namespaces, RAG ACL post-filtering |
| Secrets | Hashed API keys, hashed SCIM tokens, KMS abstraction, no raw token storage |
| AI risk reduction | OWASP LLM Top 10 aligned guardrails to detect, block, redact, monitor, and report |
| Auditability | Organization audit logs, admin audit logs, audit exports, SIEM exports |
| Retention | Per-organization retention policy and deletion request workflow |
| Availability | Health endpoint, self-hosted runbooks, backup/restore scripts |

