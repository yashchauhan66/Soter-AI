# EC2 Docker DynamoDB Deployment

## 1. Create The Table

```bash
npm ci
npm run dynamodb:events:create
npm run dynamodb:events:ttl
npm run dynamodb:events:verify
```

## 2. Configure `.env.production`

```dotenv
AWS_REGION=ap-south-1
AWS_ACCESS_KEY_ID=<fill-or-leave-blank-for-iam-role>
AWS_SECRET_ACCESS_KEY=<fill-or-leave-blank-for-iam-role>
DYNAMODB_EVENTS_ENABLED=true
DYNAMODB_EVENTS_TABLE=soterai_events
DYNAMODB_EVENTS_DUAL_WRITE=true
DYNAMODB_EVENTS_READ_FALLBACK_POSTGRES=true
```

Also copy the TTL and preview-size values from `.env.production.example`.

## 3. Rebuild And Restart

```bash
docker compose down
docker compose build --no-cache
docker compose up -d
```

For `docker-compose.prod.yml`:

```bash
docker compose -f docker-compose.prod.yml down
docker compose -f docker-compose.prod.yml build --no-cache
docker compose -f docker-compose.prod.yml up -d
```

## 4. Check Logs

```bash
docker compose logs -f app
docker compose logs -f webhook-worker background-worker siem-worker
```

## 5. Verify A Guard Request

1. Send an authenticated request to `/api/guard/input` or `/api/guard/output`.
2. Confirm the API response is unchanged.
3. Confirm a DynamoDB item appears under `pk=PROJECT#<projectId>`.
4. Confirm the item contains redacted previews or non-content markers only.
5. Open `/dashboard/logs` and verify pagination and filters.
6. Trigger a webhook test and inspect the delivery history.

## 6. End Dual-Write

After the dashboard, exports, reports, workers, and alerting have remained stable through the chosen observation period:

```dotenv
DYNAMODB_EVENTS_DUAL_WRITE=false
```

Restart the app and workers:

```bash
docker compose up -d --force-recreate app webhook-worker background-worker siem-worker
```

## 7. Optional Backfill And Cleanup

Backfill is dry-run unless `--execute` is present:

```bash
npm run logs:backfill:dynamodb -- --dry-run --type guard_logs
npm run logs:backfill:dynamodb -- --type guard_logs --from 2026-01-01 --to 2026-07-01 --batch-size 100
npm run logs:backfill:dynamodb -- --execute --type guard_logs --from 2026-01-01 --to 2026-07-01 --batch-size 100
```

Cleanup is also dry-run unless `--execute` is present and requires an exact confirmation string:

```bash
npm run logs:cleanup:postgres -- --type guard_logs --before 2026-01-01 --confirm "DELETE guard_logs BEFORE 2026-01-01"
npm run logs:cleanup:postgres -- --execute --type guard_logs --before 2026-01-01 --confirm "DELETE guard_logs BEFORE 2026-01-01"
```

Take and verify a PostgreSQL backup before executing cleanup. Cleanup never runs automatically.

