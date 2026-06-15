# Local Load Testing

Run `npm run test:load` to execute the checked-in local load harness.

The harness is intentionally non-production:

- It uses redacted synthetic fixtures only.
- It exercises the guard engine in process rather than sending traffic to a deployed app.
- It verifies the dashboard overview still uses bounded database aggregation for top-risk chart data.
- It enforces explicit latency and error thresholds so regressions fail locally and in CI.

Default thresholds:

- `LOAD_TEST_ITERATIONS=400`
- `LOAD_TEST_CONCURRENCY=16`
- `LOAD_TEST_GUARD_P95_MS=25`
- `LOAD_TEST_MAX_ERROR_RATE=0`

Example:

```powershell
$env:LOAD_TEST_ITERATIONS="1000"
$env:LOAD_TEST_CONCURRENCY="32"
npm run test:load
```

This does not replace deployment load testing. Real production or staging load tests require explicit authorization, representative traffic, provider credentials, alert-routing review, and rollback planning.
