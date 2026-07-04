# DynamoDB Heavy Events Rollback

1. Set `DYNAMODB_EVENTS_ENABLED=false`.
2. Set `DYNAMODB_EVENTS_DUAL_WRITE=false`.
3. Keep `DYNAMODB_EVENTS_READ_FALLBACK_POSTGRES=true`.
4. Restart the app and worker containers.
5. Confirm new guard rows appear in PostgreSQL and the dashboard loads.
6. Do not delete the DynamoDB table until the rollback has remained stable.
7. Do not run PostgreSQL cleanup during rollback.

```bash
docker compose up -d --force-recreate app webhook-worker background-worker siem-worker
docker compose logs -f app
```

With DynamoDB disabled, the existing PostgreSQL guard write transaction is used. Old PostgreSQL log tables and rows are never deleted by deployment or rollback code.

