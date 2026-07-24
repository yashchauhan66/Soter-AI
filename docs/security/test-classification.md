# Test Classification Report — SoterAI IDE Guard Security Evidence

**Date:** 2026-07-23  
**Scope:** `packages/vscode-extension/src/__tests__/`, `packages/guard-core/src/__tests__/`, `apps/local-ai-broker/src/__tests__/`, `tests/extension/`

## Summary

| Category | Approx % | Approx count | Counts as enforcement evidence? |
|---|---:|---:|---|
| Runtime behavioral | 65% | ~265 | **Yes** |
| Static source inspection | 17% | ~70 | **No** (contract only) |
| Integration behavioral | 7% | ~27 | **Yes** |
| Contract | 5% | ~22 | Partial (honesty gates) |
| Benchmark | 2% | ~8 | Performance only |
| Mock-only | 2% | ~8 | No |
| Extension-host behavioral | 0% | 0 | N/A — **missing** |
| Snapshot | 0% | 0 | — |
| Manual | 0% | 0 | — |

**Total sampled:** ~409 `it`/`test` cases across ~42 files.

## Flagged: static source inspection used as “enforcement”

Primary offender: `packages/vscode-extension/src/__tests__/extension.test.ts`

Examples of non-behavioral checks:

- `assert.match(liveScannerSrc, /engine\.scan\(doc\.getText\(\),\s*\{\s*context:\s*"file"\s*\}\)/)`
- Command registration via reading source strings
- CSP / console.log presence via regex on source

These are useful **contracts** but must not be presented as proof that an attack was blocked.

## Strong behavioral suites (keep / expand)

| Suite | Why it counts |
|---|---|
| `packages/vscode-extension/src/__tests__/enforced-capability.test.ts` | Capability fail-closed paths |
| `packages/vscode-extension/src/__tests__/secret-broker.test.ts` | Secret reference / no raw leak |
| `apps/local-ai-broker/src/__tests__/broker.test.ts` | HTTP broker decisions |
| `packages/guard-core/src/__tests__/decision.test.ts` | DecisionEngine outcomes |
| `packages/guard-core/src/__tests__/redaction.test.ts` | No raw canary survival |
| `packages/guard-core/src/__tests__/live-scan-parity.test.ts` | **New** — file-context PI/JB parity |
| `packages/guard-core/src/__tests__/controlled-terminal.test.ts` | Pre-exec deny |
| `packages/guard-core/src/__tests__/phase-controls.test.ts` | Engine unit behavior (not runtime wiring) |

## Required additions (Phase 2)

1. Side-effect assertions (marker files, mock HTTP bodies without raw secrets).
2. Real VS Code extension-host tests for LiveScanner diagnostics.
3. Streaming broker attack corpus (when streaming lands).
4. DepGuard OSV integration tests (when OSV lands).
