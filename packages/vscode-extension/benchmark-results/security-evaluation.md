# SoterAI IDE Guard security evaluation

Generated: 2026-08-31T12:10:49.690Z

> NOT INDEPENDENT — cases and implementation are maintained in the same repository

Corpus SHA-256: `ac704677dc54996c34358b778b2908b668e0488b5933c54a72b95d7b03fb9e6f`

| Metric | Result |
| --- | ---: |
| Cases | 41 (21 risky / 20 benign) |
| Recall | 100.00% |
| Precision | 100.00% |
| False-positive rate | 0.00% |
| Latency p50 | 0.212 ms |
| Latency p95 | 3.867 ms |

## Per-category recall

| Category | Detected | Recall |
| --- | ---: | ---: |
| jailbreak | 1/1 | 100.00% |
| mcp-config | 2/2 | 100.00% |
| pii | 2/2 | 100.00% |
| prompt-injection | 4/4 | 100.00% |
| repo-instruction | 1/1 | 100.00% |
| secret | 4/4 | 100.00% |
| terminal | 5/5 | 100.00% |
| unsafe-code | 2/2 | 100.00% |

## Misclassified cases

None in this corpus.

## Limitations

- Small readable corpus; not representative of all real-world code or attacks
- Measures detection only, not universal interception or prevention
- No competitor products are executed or compared
- Synthetic credentials only
