# Self-hosted deployment

1. Copy `.env.example` to `.env.production` and replace every placeholder.
2. Set `POSTGRES_PASSWORD`, `NEXTAUTH_SECRET`, signing secrets, email, billing, and worker tokens.
3. Configure `SECRET_STORE_PROVIDER` as `aws-kms`, `gcp-kms`, or `vault`. Local secret storage is rejected in production.
4. Choose `VECTOR_PROVIDER=qdrant` for the bundled service or `pgvector` for PostgreSQL vector storage.
5. Run `docker compose -f docker-compose.prod.yml run --rm app npm run db:deploy`.
6. Start with `docker compose -f docker-compose.prod.yml up -d --build`.
7. Verify `/api/health`, `/admin/kms`, and `/admin/system-health` before routing traffic.

For configuration-only validation before creating `.env.production`, run `APP_ENV_FILE=.env.example docker compose -f docker-compose.prod.yml config`. The production default remains `.env.production`.

Terminate TLS at a trusted reverse proxy, keep database/vector ports private, use workload identity where possible, and back up Postgres and Qdrant volumes. Scanned PDF OCR requires a PDF-capable injected OCR provider; local Tesseract handles PNG/JPEG.
