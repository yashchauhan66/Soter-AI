# Phase 5 production readiness report

## Implemented and locally testable

- Fail-closed secret-store selection with AWS KMS, GCP KMS, Vault Transit, and development-local adapters.
- Redacted document sandbox, OCR provider boundary, PDF checks, vector tenant controls, retrieval audits, and grounding quality metrics.
- Classifier benchmark/regression metrics, authorized red-team scenarios, structured events, SIEM retries, and enterprise identity persistence scaffolds.
- Docker packaging, health checks, migration, tests, and compliance evidence templates.
- Authoritative stored-source grounding, vector indexing/query routes, deny-by-default chunk ACLs, outbound private-network blocking, and required security-event emission.

## Limitations

- SAML assertion validation and complete SCIM `/Users` and `/Groups` protocol endpoints require an identity-provider integration.
- Local Tesseract supports images; scanned PDFs require an injected cloud/PDF OCR provider.
- GCP REST KMS currently accepts a short-lived OAuth token; production should supply it through workload identity/token refresh.
- Deterministic local embeddings are for testing. Production semantic retrieval should configure an embedding endpoint.
- pgvector migration uses 64 dimensions; change the migration and `VECTOR_DIMENSIONS` together for another model.
- OpenTelemetry export is a lightweight OTLP hook, not a full vendor SDK deployment.
- PDF inspection covers visible and Flate-compressed structures but is not a malware-analysis substitute.
- The bundled classifier corpus is intentionally small and must not be treated as production accuracy evidence.

Production approval still requires environment-specific threat modeling, authorized penetration testing, restore drills, alert routing, data-retention approval, and identity-provider validation. No system provides complete protection.
