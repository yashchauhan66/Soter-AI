# Shared Responsibility Model

## SoterAI responsibilities

- Enforce authentication, tenant isolation, RBAC, API-key hashing, and server-side quotas.
- Minimize and redact sensitive payloads in storage, logs, diagnostics, and exports.
- Validate signed webhooks and SAML assertions, protect against replay, and hash SCIM bearer tokens.
- Patch supported software, monitor service health, preserve auditable security events, and maintain incident and recovery procedures.
- Publish accurate feature maturity and limitations; preparation for SOC 2 or ISO 27001 is not certification.

## Customer responsibilities

- Control users, roles, IdP configuration, API keys, webhook destinations, and integration credentials.
- Apply least privilege to agents and tools, require human approval for consequential actions, and review flagged content.
- Choose retention settings and provide lawful basis, notices, and consent where required.
- Secure endpoints, browsers, IDEs, vector stores, cloud accounts, networks, and downstream models under customer control.
- Test policies with customer-specific data and maintain an independent incident contact and recovery plan.

## Shared responsibilities

Both parties coordinate vulnerability response, key rotation, incident notification, tenant-specific retention, integration upgrades, and evidence collection. Guard findings reduce risk but do not guarantee that prompts, models, tools, or retrieved documents are safe.

## Third parties

Payment providers, hosting providers, email providers, identity providers, and model/vector-store vendors retain responsibility for their platforms. Their availability or certification does not transfer automatically to SoterAI.
