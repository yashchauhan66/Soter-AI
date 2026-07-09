# Performance Regression Policy (Phase 6)

## Purpose

Prevent performance regressions from reaching production. Every change to performance-sensitive packages must be benchmarked against a stored baseline before merge. No silent regressions are permitted.

## Benchmark Suites

| Command | Target | Script |
|---------|--------|--------|
| `npm run bench:guard-core` | Guard core detection engine | `packages/guard-core/benchmarks/bench.ts` |
| `npm run bench:broker` | Local AI broker proxy | `apps/local-ai-broker/benchmarks/bench.ts` |
| `npm run bench:vscode` | VS Code extension | `packages/vscode-extension/benchmarks/bench.ts` |
| `npm run bench:all` | All three sequentially | Runs guard-core, broker, and vscode benchmarks in order |

## CI Gates

The build fails if **any** of the following triggers fire:

| # | Gate | Threshold |
|---|------|-----------|
| 1 | p95 scan latency for 10 KB input regresses | > 20% from baseline |
| 2 | p95 scan latency for 100 KB input regresses | > 20% from baseline |
| 3 | Bundle size (`extension.js`) grows | > 20% |
| 4 | VSIX size grows | > 20% |
| 5 | Extension activation time (simulated) exceeds | 250 ms |
| 6 | Memory leak detected (memory growth over 10-minute test) | > 50 MB |
| 7 | Raw canary/secret appears in any log output | Any occurrence |
| 8 | Any existing latency test (`tests/guard/latency.test.ts`) fails | Any failure |

## Baseline Values (as of 2026-07-06)

These values were captured using the `honest-benchmark` harness on a clean run with no other processes competing for CPU.

| Metric | Value |
|--------|-------|
| `analyzeText` p50 | 4.59 ms |
| `analyzeText` p95 | 7.05 ms |
| `analyzeText` p99 | 10.55 ms |
| `extension.js` bundle | 163 KB |
| `local-ai-broker.js` bundle | 100 KB |
| VSIX package | 85 KB |
| Guard-core runtime dependencies | 0 (zero) |

## Regression Detection Process

1. **Trigger**: Every PR that touches `packages/guard-core`, `apps/local-ai-broker`, or `packages/vscode-extension` must run the corresponding benchmark suite.
2. **Comparison**: Results are compared against the stored baseline values listed above.
3. **Failure**: Regressions exceeding 20% trigger a build failure with a detailed report showing the metric, baseline value, measured value, and percentage change.
4. **Legitimate regressions**: When a new security feature intentionally increases latency or bundle size, the regression must be explicitly documented in the PR description and the baseline must be updated before merge.

## Baseline Update Process

1. When a regression is intentional (new detector, new feature, additional security layer), update the baseline values in this document and in the benchmark configuration.
2. Document the reason for the regression in the PR description with a clear explanation of what changed and why.
3. Set new performance targets if the change fundamentally alters the performance profile.
4. Never silently accept a regression. Every baseline change must be reviewed and approved.

## Monitoring in Production

- **Dashboard metrics**: The guard API dashboard tracks p50 and p95 latency for all scan operations.
- **Production monitoring page**: Shows bounded database aggregations to prevent monitoring queries from becoming a performance problem themselves.
- **SIEM worker**: Has a dedicated health endpoint and operates on bounded intervals to avoid unbounded resource consumption.
- **Alerting**: Production latency exceeding 2x the baseline p95 triggers an alert for investigation.
