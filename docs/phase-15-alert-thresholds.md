# Phase 15 Alert Thresholds

| Signal | Warning | Critical |
| --- | --- | --- |
| Uptime | < 99.5% daily | < 99% daily |
| 5xx rate | > 1% for 10 min | > 5% for 5 min |
| p95 API latency | > 750 ms | > 1500 ms |
| Guard latency | > 150 ms | > 500 ms |
| Payment failures | > 3 in 30 min | > 10 in 30 min |
| Webhook failures | > 5% | > 20% |
| Auth failures | 3x baseline | 6x baseline |
| DB errors | any sustained | outage |
