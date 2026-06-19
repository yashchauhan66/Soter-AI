# SIEM Worker

Run `npm run worker:siem` as a separate long-lived process. It polls due SIEM deliveries, applies the existing retry policy, and exports redacted security events through configured SIEM integrations.

## Configuration

- `SIEM_WORKER_INTERVAL_MS` controls polling and is bounded between 1000 ms and 60000 ms (default 5000 ms).
- `SIEM_WORKER_HEALTH_PORT` controls the localhost heartbeat server (default 3097).

The health endpoint listens on `127.0.0.1` and returns JSON with `ok`, `lastHeartbeat`, and `stopping`.

The worker skips overlapping ticks, writes structured JSON logs, handles `SIGINT` and `SIGTERM`, stops polling, closes its health server, and disconnects Prisma before exit.
