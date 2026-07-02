# Performance Under Realistic Usage

## Status: ENV_BLOCKED

- Small prompt under 100ms: NOT VERIFIED
- 10 KB under 300ms: NOT VERIFIED
- 100 KB under 1s: NOT VERIFIED
- No browser freeze: NOT VERIFIED
- No duplicate logs: NOT VERIFIED
- No service worker crash: NOT VERIFIED

**Reason:** Docker daemon is not running on the environment, meaning the backend PostgreSQL and API server cannot start. The performance of the extension relies on successfully fetching policies, evaluating prompts, and sending audit events to the backend. Without the backend, end-to-end performance cannot be verified.
