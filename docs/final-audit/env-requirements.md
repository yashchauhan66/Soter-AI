# Environment Requirements

## Required for Local Development

- `DATABASE_URL`
- `API_KEY_PEPPER`
- `AUTH_SECRET` or `NEXTAUTH_SECRET`
- `NEXTAUTH_URL`
- `NEXT_PUBLIC_APP_URL`

## Required for Production

- `DATABASE_URL`
- `AUTH_SECRET` or `NEXTAUTH_SECRET` with at least 32 characters
- `API_KEY_PEPPER` with at least 32 characters
- Distributed Redis: `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` or `REDIS_URL`
- Non-local secret store: `SECRET_STORE_PROVIDER=aws-kms|gcp-kms|vault` with provider credentials
- Email provider: `EMAIL_PROVIDER=resend|aws-ses|smtp` plus provider credentials
- Billing if paid checkout is enabled: `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`
- Report signing: `REPORT_SIGNING_SECRET` or explicit signing fallback
- Production vector provider: `VECTOR_PROVIDER=qdrant|pgvector` and corresponding URL/credentials
- Embedding service: `EMBEDDING_API_URL` in production unless explicit local embedding exception is intended
- SCIM: `SCIM_TOKEN_PEPPER`

## Optional / Feature-Specific

- `CYBERRAKSHAK_API_KEY` for SDK examples
- `WEBHOOK_WORKER_INTERVAL_MS`, `WEBHOOK_WORKER_HEALTH_PORT`
- `BACKGROUND_WORKER_INTERVAL_MS`, `BACKGROUND_WORKER_HEALTH_PORT`
- `SIEM_WORKER_INTERVAL_MS`, `SIEM_WORKER_HEALTH_PORT`
- `THREAT_INTEL_WORKER_INTERVAL_MS`, `THREAT_INTEL_WORKER_HEALTH_PORT`
- `ENABLE_SEMANTIC_DETECTORS`, `ENABLE_MULTILINGUAL_DETECTORS`, `ENABLE_PHASE11_MULTILINGUAL_DETECTORS`
- `ML_BACKEND`, `ML_API_URL`, `ML_API_KEY`, `ML_API_TIMEOUT_MS`
- `PERSIST_CLASSIFIER_EVAL`, `PERSIST_RETRIEVAL_AUDIT`
- `OTEL_EXPORTER_OTLP_ENDPOINT`, `OTEL_EXPORTER_OTLP_HEADERS`
- `QDRANT_URL`, `QDRANT_API_KEY`, `PGVECTOR_DATABASE_URL`
- `AWS_KMS_KEY_ID`, `GCP_KMS_*`, `VAULT_*`
- `SAML_SP_ENTITY_ID`, `SAML_SP_ACS_URL`, `SAML_SP_PRIVATE_KEY`, `SAML_SP_CERTIFICATE`

## Notes

- `.env.example` was updated during the audit to avoid real-looking local DB credentials and short auth-secret placeholders.
- Local `.env` was fixed with generated 64-character `AUTH_SECRET`/`NEXTAUTH_SECRET` values to allow production build verification.
