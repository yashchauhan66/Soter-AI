# Security controls matrix

| Control | Implementation | Evidence |
| --- | --- | --- |
| Encryption | KMS/Vault secret envelopes | KMS health and admin audit logs |
| Tenant isolation | Auth guards, vector namespace and post-filter | Retrieval audit log |
| Data minimization | Redacted guard/OCR/SIEM metadata | Security tests |
| Monitoring | Security events, OTLP spans, SIEM queue | Event stream and delivery records |
| Access governance | RBAC, SAML/SCIM scaffolds | Membership and identity records |
| Secure testing | Authorized non-destructive red-team suite | Red-team run/report records |
| Change evidence | Classifier version runs and regression metrics | ClassifierRun records |
