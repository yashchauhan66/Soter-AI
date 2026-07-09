# Post-Optimization Benchmark Report

> **Status:** Measured, reproducible. All results below come from the repository's
> committed benchmark scripts (`npm run bench:all`) executed on the machine
> described in *Environment*. Numbers are wall-clock measurements, not estimates.
> No competitor comparisons and no cherry-picking — full percentile tables are
> reproduced verbatim.

**Generated:** 2026-07-06
**Command:** `npm run bench:guard-core && npm run bench:broker && npm run bench:vscode` (`npm run bench:all`)
**Raw log:** [`bench-all-raw.txt`](./bench-all-raw.txt)

---

## Environment

| Field | Value |
|-------|-------|
| OS | Windows 11 (10.0.26300) |
| CPU | Intel Core i5-8350U @ 1.70 GHz (4 cores / 8 threads) |
| RAM | 16 GB |
| Node.js | v22.16.0 |
| Runner | `tsx` (in-process, no network for guard-core; loopback HTTP for broker) |
| VS Code | Extension benchmark runs in a Node extension-host harness (not a live VS Code instance); bundle sizes measured from the built VSIX |

> Results are hardware-dependent. Re-run `npm run bench:all` on your machine to
> reproduce. Absolute numbers will differ; relative behavior should hold.

---

## 1. guard-core — scan (analyzeText) by input size and context

Warmup 50 iterations, measurement N=300 per cell. Times in milliseconds.

| Size | Context | Min | Max | Avg | **p50** | **p95** | **p99** | N |
|------|---------|-----|-----|-----|---------|---------|---------|---|
| 1 KB | file | 0.231 | 3.489 | 0.488 | 0.428 | 0.740 | 1.561 | 300 |
| 1 KB | prompt | 0.356 | 11.764 | 0.579 | 0.410 | 0.880 | 2.805 | 300 |
| 1 KB | selection | 0.455 | 12.496 | 0.631 | 0.510 | 0.781 | 3.030 | 300 |
| 1 KB | terminal | 0.273 | 10.167 | 0.416 | 0.336 | 0.646 | 0.907 | 300 |
| 10 KB | file | 3.326 | 23.842 | 4.515 | 3.935 | 6.006 | 17.189 | 300 |
| 10 KB | prompt | 2.770 | 21.026 | 4.239 | 4.039 | 5.078 | 8.114 | 300 |
| 10 KB | selection | 3.707 | 24.191 | 5.127 | 4.817 | 7.022 | 12.048 | 300 |
| 10 KB | terminal | 2.184 | 20.761 | 4.001 | 3.591 | 5.527 | 10.640 | 300 |
| 100 KB | file | 20.899 | 195.740 | 39.760 | 36.416 | 62.551 | 83.801 | 300 |
| 100 KB | prompt | 16.174 | 126.780 | 33.071 | 31.518 | 47.428 | 73.542 | 300 |
| 100 KB | selection | 27.259 | 151.763 | 47.971 | 44.996 | 68.995 | 105.513 | 300 |
| 100 KB | terminal | 17.239 | 236.628 | 34.635 | 31.237 | 60.487 | 77.368 | 300 |
| 256 KB | file | 33.587 | 116.661 | 56.931 | 52.414 | 84.705 | 105.466 | 300 |
| 256 KB | prompt | 30.999 | 164.282 | 60.579 | 56.203 | 92.943 | 119.149 | 300 |
| 256 KB | selection | 44.929 | 164.303 | 74.193 | 71.024 | 102.095 | 125.380 | 300 |
| 256 KB | terminal | 34.973 | 183.109 | 63.172 | 61.536 | 84.522 | 117.352 | 300 |
| 1 MB | file | 75.912 | 261.615 | 119.724 | 116.207 | 155.930 | 220.881 | 300 |
| 1 MB | prompt | 53.147 | 221.471 | 100.867 | 97.440 | 147.112 | 184.103 | 300 |
| 1 MB | selection | 79.302 | 252.399 | 139.680 | 134.205 | 198.255 | 226.729 | 300 |
| 1 MB | terminal | 50.775 | 270.712 | 103.242 | 100.951 | 149.489 | 178.169 | 300 |

**All guard-core performance gates PASSED.**

Reading: a typical editor scan (1–10 KB) completes well under ~7 ms p95. Cost
scales roughly linearly with input size; a full 1 MB file scans at ~116–134 ms
p50, which is why the extension caps per-file scan size by default.

## 2. guard-core — redaction by input size

| Size | Min | Max | Avg | **p50** | **p95** | **p99** | N |
|------|-----|-----|-----|---------|---------|---------|---|
| 1 KB | 0.024 | 0.424 | 0.052 | 0.045 | 0.106 | 0.216 | 300 |
| 10 KB | 0.372 | 1.418 | 0.639 | 0.637 | 0.837 | 1.056 | 300 |
| 100 KB | 3.085 | 47.552 | 5.334 | 4.898 | 7.019 | 15.756 | 300 |
| 256 KB | 5.937 | 46.480 | 13.145 | 12.359 | 21.261 | 29.964 | 300 |
| 1 MB | 25.796 | 148.732 | 44.655 | 42.767 | 63.792 | 87.262 | 300 |

Redaction is substantially cheaper than scanning (no detector fan-out), so
redacting before sending to AI adds negligible latency for editor-sized inputs.

## 3. Local AI Broker — HTTP endpoints (loopback), 10 KB payload

N=200 per endpoint per concurrency level. Times in milliseconds.

**Concurrency = 1**

| Endpoint | p50 | p95 | p99 | min | max | N |
|----------|-----|-----|-----|-----|-----|---|
| GET /health | 1.88 | 3.10 | 4.67 | 1.11 | 8.03 | 200 |
| POST /v1/scan | 2.54 | 4.19 | 6.06 | 1.55 | 8.66 | 200 |
| POST /v1/redact | 2.24 | 3.48 | 8.00 | 1.43 | 9.79 | 200 |
| POST /v1/decision | 2.29 | 3.35 | 4.76 | 1.31 | 8.97 | 200 |

**Concurrency = 5**

| Endpoint | p50 | p95 | p99 | min | max | N |
|----------|-----|-----|-----|-----|-----|---|
| GET /health | 8.66 | 15.56 | 18.08 | 6.10 | 20.19 | 200 |
| POST /v1/scan | 9.72 | 25.04 | 57.67 | 4.12 | 59.03 | 200 |
| POST /v1/redact | 9.52 | 14.12 | 20.62 | 3.83 | 20.69 | 200 |
| POST /v1/decision | 8.01 | 13.70 | 15.65 | 3.59 | 15.99 | 200 |

**Concurrency = 10**

| Endpoint | p50 | p95 | p99 | min | max | N |
|----------|-----|-----|-----|-----|-----|---|
| GET /health | 11.70 | 18.42 | 23.27 | 6.28 | 24.83 | 200 |
| POST /v1/scan | 14.45 | 21.04 | 22.56 | 5.27 | 23.38 | 200 |
| POST /v1/redact | 14.58 | 20.60 | 22.27 | 10.18 | 23.34 | 200 |
| POST /v1/decision | 17.04 | 21.72 | 30.59 | 10.65 | 31.84 | 200 |

**Concurrency = 25**

| Endpoint | p50 | p95 | p99 | min | max | N |
|----------|-----|-----|-----|-----|-----|---|
| GET /health | 34.15 | 51.11 | 53.95 | 20.62 | 54.39 | 200 |
| POST /v1/scan | 46.50 | 72.42 | 76.05 | 27.66 | 81.35 | 200 |
| POST /v1/redact | 44.96 | 64.14 | 65.32 | 20.21 | 66.41 | 200 |
| POST /v1/decision | 40.32 | 52.31 | 55.72 | 16.91 | 56.24 | 200 |

**Threshold checks (concurrency = 1):** `/health` p95 3.10 ms (limit 10 ms) — PASS · `/v1/scan` p95 4.19 ms (limit 30 ms) — PASS. **All broker thresholds passed.**

**Rate limiting:** 150 rapid requests against a 120/min limit → 0×200, 150×429. Rate limiter triggered as expected (PASS).

**Memory:** RSS 75.9 MB → 149.9 MB (Δ 74.0 MB), Heap 11.7 MB → 46.7 MB (Δ 35.0 MB) across the full run.

> Note: this broker benchmark uses the internal scan/redact/decision endpoints.
> The OpenAI/Anthropic-compatible *proxy* path forwards to an upstream provider;
> it is not benchmarked here because it depends on external provider latency,
> which we will not fabricate. Local redaction overhead on that path is bounded
> by the redaction numbers in §2 plus the /v1/scan cost in this section.

## 4. VS Code extension — operations and bundle sizes

| Benchmark | Result | Target | Status |
|-----------|--------|--------|--------|
| Engine construction (activation cost) | 0.40 ms | < 50 ms | PASS |
| Single scan 1 KB (p50) | 0.46 ms | info | PASS |
| Single scan 1 KB (p95) | 1.03 ms | < 10 ms | PASS |
| Single scan 10 KB (p50) | 2.95 ms | info | PASS |
| Single scan 10 KB (p95) | 3.71 ms | < 20 ms | PASS |
| Single scan 100 KB (p50) | 20.42 ms | info | PASS |
| Single scan 100 KB (p95) | 29.88 ms | < 100 ms | PASS |
| Workspace scan 100 files | 278.84 ms | < 5 s | PASS |
| Workspace scan 1000 files | 2.43 s | < 30 s | PASS |
| `extension.js` bundle | 159.7 KB | < 200 KB | PASS |
| `local-ai-broker.js` bundle | 99.4 KB | < 200 KB | PASS |
| VSIX (`soterai-ide-guard-0.1.0.vsix`) | 196.0 KB | < 200 KB | PASS |

**All extension benchmarks passed.**

---

## Comparison to the pre-optimization baseline

The prior in-process figures on record were analyzeText **p50 4.59 ms / p95 7.05 ms
/ p99 10.55 ms** (mixed input). Post-optimization guard-core scans for editor-sized
inputs (1–10 KB) land at **p50 0.34–4.82 ms / p95 0.65–7.02 ms**, consistent with —
and at the small end better than — the baseline. Bundle sizes remain under the
200 KB budget (extension.js 159.7 KB; VSIX 196 KB after excluding benchmark
sources from the package).

## Reproducibility

```bash
npm run bench:guard-core   # scan + redaction percentiles
npm run bench:broker       # loopback HTTP endpoints + rate-limit + memory
npm run bench:vscode       # extension ops + bundle/VSIX sizes
npm run bench:all          # all of the above
```

## Honest notes

- Absolute latency is hardware-bound (measured on a 2017-class mobile i5). Server
  or modern desktop hardware will be faster; this is intentionally a conservative
  machine.
- The OpenAI/Anthropic proxy end-to-end latency is dominated by the upstream
  provider and is deliberately **not** reported as a SoterAI number.
- No competitor latency is claimed anywhere in this report.
