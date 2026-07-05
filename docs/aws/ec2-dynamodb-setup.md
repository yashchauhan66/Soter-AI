# EC2 DynamoDB Setup

## Option A: EC2 IAM Role

This is the preferred production setup.

1. Replace `<ACCOUNT_ID>` in `docs/aws/dynamodb-events-iam-policy.json`.
2. Create or update an IAM policy using that document.
3. Attach the policy to an IAM role trusted by EC2.
4. Attach the role to the application EC2 instance.
5. Do not set `AWS_ACCESS_KEY_ID` or `AWS_SECRET_ACCESS_KEY` in `.env.production`.
6. Set `AWS_REGION=ap-south-1`.

The application uses the AWS SDK default credential provider chain, so no credential-specific code is required.

For Docker on EC2, make sure instance metadata is reachable from containers. If the role is attached but the SDK still reports missing credentials, set the instance metadata option `HttpPutResponseHopLimit` to `2` and keep `AWS_EC2_METADATA_DISABLED=false`.

## Option B: Environment Credentials

If an instance role is unavailable, set these only in the EC2 host's protected `.env.production`:

```dotenv
AWS_REGION=ap-south-1
AWS_ACCESS_KEY_ID=<fill>
AWS_SECRET_ACCESS_KEY=<fill>
```

Do not commit `.env.production`, print credentials in logs, or pass credentials as Docker build arguments.

## Docker Compose

Both Compose files load `${APP_ENV_FILE:-.env.production}` through `env_file`, including the app and worker containers. The DynamoDB variables therefore reach the processes without image rebuild arguments.

```bash
docker compose down
docker compose build --no-cache
docker compose up -d
docker compose logs -f app
```

For the production Compose file:

```bash
docker compose -f docker-compose.prod.yml down
docker compose -f docker-compose.prod.yml build --no-cache
docker compose -f docker-compose.prod.yml up -d
docker compose -f docker-compose.prod.yml logs -f app webhook-worker background-worker siem-worker
```

## Table Setup

Run from a host/container with AWS credentials that can create and configure the table:

```bash
npm run dynamodb:events:create
npm run dynamodb:events:ttl
npm run dynamodb:events:verify
npm run dynamodb:events:iam-policy
```

The application role itself needs only the data-plane policy in `docs/aws/dynamodb-events-iam-policy.json`. Table creation and TTL configuration should normally use a separate administrative identity.

## Verification

1. Confirm `npm run dynamodb:events:verify` reports the table, four active GSIs, and TTL on `expiresAt`.
2. Deploy with `DYNAMODB_EVENTS_ENABLED=true` and `DYNAMODB_EVENTS_DUAL_WRITE=true`.
3. Call an authenticated input or output guard endpoint.
4. Query the project partition in DynamoDB and confirm a `guard_event`.
5. Confirm no raw API key, Authorization header, cookie, prompt, or response is present.
6. Open the guard logs dashboard and webhook delivery history.
7. Review app and worker logs for `DynamoDB ... failed` messages.
