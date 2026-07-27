# Security 99 Evidence Gates

Generated: 2026-07-22T11:58:44.136Z

- Evidence-gated score: **95/100**
- 99+ claim allowed: **no**

| Gate | Status | Evidence | Reason |
| --- | --- | --- | --- |
| Independent third-party pentest | BLOCKED | `reports/external-pentest-attestation.json` | Missing vendor attestation JSON. |
| Live deployed runtime security battery | BLOCKED | `reports/live-agent-firewall-battery.json` | Missing live runtime battery JSON. |
| 100/500/1000 concurrency live load matrix | BLOCKED | `reports/live-load-matrix.json` | Missing live load matrix JSON. |
| JailbreakBench/HarmBench/PINT-style external benchmark | PARTIAL | `reports/independent-benchmark-validation.json` | Benchmark report exists, but one or more datasets are representative samples or below thresholds. |

## Next Actions

- Independent third-party pentest: Missing vendor attestation JSON.
- Live deployed runtime security battery: Missing live runtime battery JSON.
- 100/500/1000 concurrency live load matrix: Missing live load matrix JSON.
- JailbreakBench/HarmBench/PINT-style external benchmark: Benchmark report exists, but one or more datasets are representative samples or below thresholds.
