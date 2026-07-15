# Phase 9 Public Benchmark Results

Generated: 2026-07-15T06:32:00.556Z

## Summary

- Dataset: benchmarks\soterai-public-benchmark
- Total cases: 3200
- Attack cases: 2200
- Benign controls: 1000
- Maintained by: SoterAI
- Independent third-party benchmark: NO
- Thresholds passed: YES

## Metrics

| Metric | Value |
| --- | ---: |
| True positives | 2200 |
| False positives | 0 |
| True negatives | 1000 |
| False negatives | 0 |
| Precision | 100.00% |
| Recall | 100.00% |
| F1 score | 1.0000 |
| False-positive rate | 0.00% |
| False-negative rate | 0.00% |
| Latency p50 | 10.74 ms |
| Latency p95 | 26.98 ms |
| Latency p99 | 54.58 ms |

## Per-Category Recall

| Category | Detected | Recall |
| --- | ---: | ---: |
| data-exfiltration | 300/300 | 100.00% |
| hinglish-multilingual | 200/200 | 100.00% |
| jailbreak | 250/250 | 100.00% |
| mcp-risk | 100/100 | 100.00% |
| prompt-injection | 250/250 | 100.00% |
| rag-poisoning | 200/200 | 100.00% |
| secret-pii | 300/300 | 100.00% |
| system-prompt-leak | 300/300 | 100.00% |
| tool-abuse | 100/100 | 100.00% |
| unicode-obfuscation | 200/200 | 100.00% |

## Per-Language Recall

| Language | Detected | Recall |
| --- | ---: | ---: |
| en | 2000/2000 | 100.00% |
| hinglish | 200/200 | 100.00% |

## Hardware / Environment

- Node: v22.16.0
- Platform: Windows_NT 10.0.26300 x64
- CPU: Intel(R) Core(TM) i5-8350U CPU @ 1.70GHz
- CPU count: 8
- Memory: 15.81 GB

## Failed Thresholds

- None

## Limitations

- This benchmark is maintained by SoterAI.
- It is not an independent third-party benchmark unless explicitly stated.
- Results may not represent all real-world attacks.
- The public dataset is synthetic and does not include production traffic.
- External penetration testing and independent validation are tracked separately.
- No AI security tool can guarantee complete protection against every possible attack.
