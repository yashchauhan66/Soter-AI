# Market & Competitive Strength (Phase 15)

**Last reviewed:** 2026-07-10
**Governing policy:** [`../marketing-claims-policy.md`](../marketing-claims-policy.md) — every quantitative or comparative claim in this folder must comply.

## Positioning in one line

SoterAI leads with **surface breadth** (browser + IDE + API + RAG + agent, one platform), **India/Hinglish**, **self-hosting / no lock-in**, and **published honesty** — **not** "best detection," which we cannot claim without independent validation.

## Documents

| Doc | Purpose |
|---|---|
| [`positioning.md`](positioning.md) | One-liner, positioning statement, key messages, "what we are NOT" |
| [`why-soterai.md`](why-soterai.md) | Problem, gap, differentiation, measured proof points |
| [`competitor-comparison.md`](competitor-comparison.md) | Breadth matrices vs 14 tools + honest efficacy table |
| [`pricing-strategy.md`](pricing-strategy.md) | INR plan tiers, philosophy, competitive pricing (verify before publishing) |
| [`target-customers.md`](target-customers.md) | Segments, geographic focus, channels |
| [`use-cases.md`](use-cases.md) | Five buyer scenarios (capabilities, not guarantees) |
| [`beta-launch-plan.md`](beta-launch-plan.md) | 30-day beta plan and goals |
| [`enterprise-pilot-plan.md`](enterprise-pilot-plan.md) | 90-day enterprise pilot structure |

## Honesty gate (do not regress)

These are the load-bearing honest facts. If a marketing surface contradicts one, the surface is wrong:

- **Detection:** 100% recall on the **tuned** 1,218-case corpus at 0.81% FPR; **~64%** recall on **untuned** novel attacks (regex ceiling). Precision generalizes (0–0.81% FPR). Path to 95% is the ML/semantic tier, not more regex. Source: [`../detection-honest-generalization.md`](../detection-honest-generalization.md).
- **Latency:** analyzer CPU ~4.6 ms p50 / ~7 ms p95 (in-process, excludes transport); guard HTTP p95 225 ms @ c=1 locally, single process. Source: [`../performance-production-benchmark.md`](../performance-production-benchmark.md).
- **External validation:** none yet. Do not present internal benchmarks as independent audits or pentests.
- **Competitor cells:** "public docs did not identify …" — never assert absence; date the observation; give the vendor a correction path before publishing a named matrix.
- **No forbidden words:** no "100% secure," "unhackable," "world's best," "market leader," "SOC 2 certified," etc. (full list in the claims policy).

## Pre-publish checklist (per external asset)

1. Every number has a boundary + reproduction link adjacent.
2. Competitor claims cite a dated primary source and use "did not identify" phrasing.
3. Efficacy vs breadth vs price are not conflated.
4. Internal ≠ independent is unmistakable.
5. Residual risk (false positives/negatives) acknowledged.
