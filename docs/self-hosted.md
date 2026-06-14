# Self-hosted Enterprise Deployment

CyberRakshak Guard can run as a self-hosted Next.js app with workers, Postgres, Redis, and an optional vector service.

## Required Environment

- `DATABASE_URL`
- `NEXTAUTH_SECRET`
- `NEXTAUTH_URL`
- `API_KEY_PEPPER`
- `SCIM_TOKEN_PEPPER`
- `WEBHOOK_SECRET_PEPPER`
- `REPORT_SIGNING_SECRET`
- `LOCAL_SECRET_STORE_KEY` only for development
- Production KMS settings for Vault, AWS KMS, or GCP KMS

Production deployments must not use local development secret providers.

## Docker Compose

1. Create `.env.production` from `.env.example`.
2. Set strong secrets and `POSTGRES_PASSWORD`.
3. Run `docker compose -f docker-compose.prod.yml up -d postgres redis qdrant`.
4. Run migrations with `docker compose -f docker-compose.prod.yml run --rm app npm run db:deploy`.
5. Start the stack with `docker compose -f docker-compose.prod.yml up -d`.

Health: `/api/health`
Readiness: `/api/ready`

