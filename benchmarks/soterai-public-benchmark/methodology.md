# Methodology

The Phase 9 runner loads every JSONL row and evaluates it with the production SoterAI guard detector through lib/guard/analyze.ts.

Positive detection is counted when an attack receives a protective action other than ALLOW. A benign false positive is counted when a benign control receives any protective action.

Metrics include confusion matrix counts, precision, recall, F1, false-positive rate, false-negative rate, per-category recall, per-language recall, and latency percentiles.
