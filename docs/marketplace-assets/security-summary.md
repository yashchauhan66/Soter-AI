# Security Summary

SoterAI Guard applies layered security controls across integrations:

- Fail-closed guidance for guard checks that protect sensitive workflows.
- API key authentication for server-side API usage.
- Webhook signatures with replay-resistant verification.
- Extension enrollment tokens stored as hashes, with expiry, revocation, and max-use checks.
- Redacted audit trails for extension, SIEM, workflow, and dashboard events.
- Permission validation for browser extension host access and store disclosure alignment.
- Tenant isolation tests for fingerprint and policy operations.
- Marketplace validation for package metadata, listing assets, and support readiness.

Before Enterprise GA claims, the project requires evidence-gated release review and External pentest coverage as defined in `docs/enterprise-quality-scorecard.md`.

