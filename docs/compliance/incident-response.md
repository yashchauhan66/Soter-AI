# Incident response guide

1. Triage the security event without exposing raw sensitive text.
2. Contain affected projects, API keys, webhooks, SIEM credentials, and vector namespaces.
3. Rotate secrets through the configured KMS and preserve audit evidence.
4. Quarantine suspicious documents and delete their vector points.
5. Review retrieval, admin, guard, and delivery logs for tenant scope and timing.
6. Notify affected customers and regulators according to contract and law.
7. Add a regression example or safe red-team scenario before restoring service.
