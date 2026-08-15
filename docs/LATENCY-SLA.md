# Guard Latency — Measured, Not Claimed

**Last measured: 2026-08-06** with `scripts/dev/measure-guard-latency.ts`.

Every number on this page came out of that harness. Nothing here is a target, a
projection, or a round number chosen because it sounds good. Re-run the harness
and you should get the same shape; if you don't, this page is wrong and should be
corrected rather than defended.

## Why two numbers, not one

A guard has two latencies and they differ by two orders of magnitude:

| | What it is | What it depends on |
|---|---|---|
| **Engine time** | Running the detectors over the text | CPU, text length, detection tier |
| **End-to-end time** | What your caller's stopwatch sees | Engine time **+** TLS + network RTT + auth + rate-limit lookup + persistence scheduling |

Quoting engine time as if it were end-to-end is the standard way this metric gets
inflated in marketing. We report them apart.

## Engine time (measured)

`analyzeText(text, "INPUT")` — the full rule + semantic pipeline, no network, no
database.

| Percentile | Latency |
|---|---|
| p50 | **3 ms** |
| p90 | **6 ms** |
| p99 | **24 ms** |
| mean | 8 ms |

**Method.** 500 iterations over a 23-message corpus of realistic support traffic
(short questions, long multi-paragraph ones, all benign so the pipeline runs to
completion rather than short-circuiting on a hard block). Single Node process,
warm. Measured with `Date.now()` at 1 ms resolution — which is why p50 reads as a
whole 3 and not 3.4; at this scale the clock granularity is a real part of the
error bar.

**Caveats, stated because they matter:**

- Measured on a developer workstation under normal desktop load, not on isolated
  server hardware. Treat these as the right order of magnitude, not as a
  certified figure.
- `SOTERAI_DETECTION_TIER=semantic` is slower than the `hybrid` default, because
  the semantic sweep then runs even when rules already fired.
- The p99 of 24 ms is dominated by the longest corpus messages plus GC. It is not
  a tail risk that grows with traffic.

## End-to-end API time

Run the harness against a live deployment to get this for your own region:

```bash
node scripts/dev/measure-guard-latency.ts 500 <your-api-key>
# or against a non-production base:
SOTERAI_API_BASE=https://staging.example.com/api node scripts/dev/measure-guard-latency.ts 500 <key>
```

The harness prints deployed p50/p90/p99 alongside the local numbers and the
difference between them, which *is* your network + infrastructure overhead.

We deliberately do not publish a single end-to-end figure here. It is dominated
by the caller's distance from the server, and a number measured from one office
in one region would be marketing, not measurement. The engine number above is the
part that is ours to be accountable for.

## Reading it per-request

Every `/api/guard/input` and `/api/guard/output` response carries:

```
X-Soter-Latency-Ms: 4
```

Server-side handling time for that specific request — engine plus auth plus rate
limiting, excluding network transit. Subtract it from your own wall-clock
measurement and the remainder is transit. This is the honest way to find out
whether the guard or the network is your bottleneck, and it needs no cooperation
from us.

## What this means for a per-item cost

n8n's Universal Guard operation issues up to 6 sequential calls per item. At the
engine numbers above that is ~18–36 ms of guard work per item; the rest of the
observed per-item time is network round trips, which is why batching and regional
deployment move that number far more than any detector optimisation would.

## Re-measuring

```bash
node scripts/dev/measure-guard-latency.ts [iterations] [apiKey]
```

If you update the numbers on this page, update the date on the first line in the
same commit. A measurement without a date is a claim.
