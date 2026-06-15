# Error Budget Draft

For a 99.9% monthly Guard API objective, the proposed monthly error budget is approximately 43 minutes.

## Burn Alerts

- Page when p95 Guard API latency exceeds 800 ms for 15 minutes.
- Page when error rate exceeds 1% for 10 minutes.
- Alert when webhook failure rate exceeds 3% over one hour.
- Alert when pending background jobs exceed 100.
- Alert on any verified billing processing failure.

When 50% of the monthly budget is consumed, freeze non-critical rollout work. When 100% is consumed, prioritize reliability and require an incident review before risky releases.
