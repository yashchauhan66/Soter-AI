# Phase 9 Benchmark and Claims Inventory

## Existing Benchmark Scripts

- `scripts/guard-benchmark/run-honest-benchmark.ts`
- `lib/benchmarks/honestBenchmark.ts`
- `scripts/phase-8-ai-security-redteam.js`
- `scripts/final-guard-novel-benchmark.js`
- `tests/benchmarks/honest-benchmark.test.ts`
- `tests/guard-redteam-benchmark.test.ts`

## Existing Datasets and Reports

- `lib/classifiers/datasets/*`
- `datasets/security-dataset/*.jsonl`
- `docs/testing/benchmark/*`
- `scripts/guard-benchmark/honest-results.json`

## Current Claimed Metrics Found

- Older public copy claimed 84% recall at 1% FPR and 0.54% false-positive rate.
- Phase 8 report disclosed 100% attack recall and 20% false-positive rate for an internal self-redteam harness.
- Phase 9 generated result: 100% recall, 0.00% FPR, 0.00% FNR, p50 7.99 ms, p95 10.92 ms, p99 15.92 ms on the synthetic public dataset.

## Risky Claims Found

- Stale benchmark numbers in `app/page.tsx`, `app/trust/page.tsx`, `components/marketing/Hero.tsx`, and `components/marketing/DemoVideo.tsx`.
- Historical docs mention forbidden claims such as "100% secure", "SOC2 compliant", and "best in world" mostly as examples of disallowed wording.
- `app/comparison/page.tsx` contains competitor comparison numbers that should not be used for public superiority claims without like-for-like evidence.

## Claims Allowed Today

- SoterAI helps detect prompt injection, jailbreaks, secrets, PII, and unsafe AI instructions.
- SoterAI protects AI workflows across browser, IDE, API, and n8n environments where those integrations have implementation evidence.
- Benchmark results are published with methodology and limitations.
- Local-first AI security controls are available for developer workflows.

## Claims Needing Rewrite

- Any unqualified 0% false-positive or 100% recall wording must be scoped to the Phase 9 synthetic public dataset.
- Any "production ready" wording must specify the integration or release gate evidence.
- Any enterprise readiness claim must distinguish controls available from external certification.

## Claims Forbidden Until External Evidence

- 100 percent secure.
- Zero false positives without dataset scope.
- SOC2 compliant.
- Best in world or highest detection accuracy.
- External pentest verified.
- All integrations production ready.
