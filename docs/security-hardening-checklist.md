# Security hardening checklist

- [ ] TLS 1.2+ and HSTS enabled at the edge.
- [ ] Production KMS configured; local provider rejected.
- [ ] Cloud credentials use workload identity and least privilege.
- [ ] Database and vector services are on private networks.
- [ ] Admin accounts use MFA through the identity provider.
- [ ] SAML certificate and metadata changes require approval.
- [ ] SCIM and SIEM tokens are rotated and revocable.
- [ ] OCR page, size, and timeout limits are set.
- [ ] Uploaded documents are never executed.
- [ ] Only redacted OCR/chunk text is persisted.
- [ ] Vector namespaces include organization and project IDs.
- [ ] Provider results pass the application post-filter.
- [ ] Red-team runs are restricted to owned projects and explicit confirmation.
- [ ] OTLP/SIEM endpoints use TLS and egress allowlists.
- [ ] Worker dead letters and KMS failures are alerted.
- [ ] Database backups and restore drills are tested.
- [ ] `npm run verify` passes before release.
