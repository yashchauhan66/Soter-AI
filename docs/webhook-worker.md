# Always-on Webhook Worker

Run `npm run worker:webhooks` as a separate long-lived process. It polls due persisted deliveries, signs payloads using decrypted secret-store values, applies exponential retry, and moves terminal failures to `DEAD_LETTER`.

Environment:

- `WEBHOOK_WORKER_INTERVAL_MS` controls polling (default 5000 ms).
- `WEBHOOK_WORKER_HEALTH_PORT` controls the localhost heartbeat server (default 3099).
- `SECRET_STORE_PROVIDER` selects local, AWS KMS, GCP KMS, or Vault storage. The local AES-GCM provider is implemented for development; external providers deliberately fail closed until deployment credentials/adapters are configured.

The worker handles `SIGINT` and `SIGTERM`, stops polling, closes its health server, and disconnects Prisma. Keep `/api/admin/webhooks/process` configured as a cron fallback.
