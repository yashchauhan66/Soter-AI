# Security Claims

Last updated: 2026-07-15

## Security Claims We Can Support

| Claim | Status | Evidence | Last updated |
| --- | --- | --- | --- |
| Helps detect prompt injection and jailbreak attempts | Supported with scope | `benchmarks/results/latest.json`, detector tests | 2026-07-15 |
| Helps detect secrets, PII, and India-specific PII | Supported with scope | Phase 9 benchmark, PII/secret detectors | 2026-07-15 |
| Publishes benchmark methodology and limitations | Supported | `/benchmark`, dataset docs | 2026-07-15 |
| Provides browser, IDE, API, and n8n workflow controls | Partial | Phase 2-4 reports | 2026-07-15 |
| Provides local-first developer workflow controls | Supported with scope | Product docs and extension reports | 2026-07-15 |

## Claims We Do Not Make

- SoterAI is 100 percent secure.
- SoterAI has zero false positives without a dataset qualifier.
- SoterAI is SOC2 compliant.
- SoterAI is best in world.
- SoterAI is external-pentest verified.
- All integrations are production ready.

## Benchmark Methodology

The Phase 9 benchmark loads JSONL rows from `benchmarks/soterai-public-benchmark` and runs the production detector in `lib/guard/analyze.ts`. Metrics include confusion matrix, precision, recall, F1, FPR, FNR, per-category recall, per-language recall, and latency.

## External Validation Status

External penetration testing and independent benchmark validation are not complete. Self-authored benchmark results must not be described as independent.

## Marketplace Status

Marketplace readiness is tracked in phase-specific reports. Do not claim marketplace approval unless the live marketplace listing or approval evidence exists.

## Compliance Status

SOC2 readiness materials exist, but no SOC2 report is present in this repository. Do not claim SOC2 compliance.

## Vulnerability Disclosure

See `docs/security/vulnerability-disclosure-policy.md`.

## Data Handling

SoterAI is designed to redact or hash sensitive values where practical and to avoid raw secret storage in normal redaction paths. Deployment configuration still matters.

## Privacy and Logging

Logging behavior depends on the integration and policy path. Sensitive payload handling should be validated for each deployment.

## Contact

Security contact: security@soterai.in.

