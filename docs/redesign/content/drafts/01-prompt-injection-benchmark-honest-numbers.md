---
title: "Our 100% Benchmark Is Not the Number to Trust"
rendered_title: "Our 100% Benchmark Is Not the Number to Trust | soterai.in"
meta_description: "soterai.in reports four recall figures, from 100% to 61.54%. See what each test measures, who wrote it, and which one is closest to real use."
slug: prompt-injection-benchmark-honest-numbers
canonical_path: /blog/prompt-injection-benchmark-honest-numbers
target_query: "prompt injection benchmark"   # monthly volume UNVERIFIED
secondary_queries:
  - "how to evaluate prompt injection detection"   # UNVERIFIED
  - "LLM guardrail benchmark false positives"      # UNVERIFIED
cluster: "2 Problem: prompt injection detection (evidence angle)"
pillar: "Evidence and benchmarks"
publish_week: 1
schema_type: BlogPosting
author: Yash Chauhan
date_published: "TBD (set on publish day)"
try_it: "/playground?preset=injection"
internal_links:
  - anchor: "benchmark results and methodology"
    url: "/benchmarks"
  - anchor: "how these numbers are measured"
    url: "/benchmark/methodology"
  - anchor: "published limitations"
    url: "/limitations"
  - anchor: "prompt injection protection"
    url: "/prompt-injection-protection"
  - anchor: "what prompt injection is and how it works"
    url: "/blog/what-is-prompt-injection-types-examples-prevention"
claims_register_numbers_used:
  - "lib/sa/claims.ts: PUBLIC_BENCHMARK, REGRESSION, BLIND_RECALL, BLIND_RECALL_INTERVAL, LIVE_LATENCY_SAMPLE"
  - "scripts/guard-benchmark/honest-results.json (generated 2026-08-07). Not yet in claims.ts. Add it before this post ships."
verification_notes:
  - "Re-run on 2026-11-09 in this worktree: node benchmarks/soterai-public-benchmark/run.mjs --self-test (all six checks ok) and node_modules/.bin/tsx scripts/readme-recall-audit.ts (1104/1122, 0/322, blind 16/26). Both match the numbers below."
  - "NOT re-run: scripts/phase-9-run-public-benchmark.js and npm run benchmark:honest. Both write files into the repo. Run them on a clean checkout and confirm 100.00% and 98.15%/0.81% before publishing."
  - "honest-results.json does not record which 9 benign inputs were flagged. List them and fix or describe them before publishing."
  - "benchmarks/soterai-public-benchmark/README.md describes a Docker run, but the Dockerfile copies ./corpus and ./manifest.json, which do not exist in that folder. This post uses node run.mjs and does not mention Docker."
  - "The ML-tier scripts in scripts/guard-benchmark (ml-tier-honest-final.ts and others) were not run. No ML-tier result is quoted."
---

# Our 100% Benchmark Is Not the Number to Trust

soterai.in publishes four recall figures for its prompt injection guard: 100.00%, 98.40%, 98.15% and 61.54%. Each is a real run of the same deterministic classifier. Each answers a different question, and only one is close to what a new user should expect on their own traffic.

This post lists the four tests, who wrote them, what counts as a catch, and what each number leaves out. Every count comes from a file in the repository. The commands to re-run them are below.

## The four numbers

| Test | Cases | Result | Limit |
|---|---|---|---|
| Public synthetic benchmark | 2,200 attacks, 1,000 benign | 100.00% recall, 0.00% false positives | We wrote the cases and tuned the engine against them |
| Regression corpora, combined | 1,122 attacks, 322 benign | 98.40% recall (1,104 caught), 0.00% false positives | Includes sets used for tuning |
| Single-turn "honest" run | 108 attacks, 1,110 benign | 98.15% recall (106 caught), 0.81% false positives (9 flagged) | Deterministic classifier only. Includes the 68-attack red-team set that also sits in the regression run |
| Blind held-out set | 26 attacks | 61.54% recall (16 caught), about 42.5% to 77.6% at 95% confidence | Small sample. No detector was tuned against it |

Sources: `benchmarks/results/latest.md` (generated 2026-07-22), `scripts/readme-recall-audit.ts` (re-run on 2026-11-09, and the source of the blind set), and `scripts/guard-benchmark/honest-results.json` (generated 2026-08-07). The interval is a Wilson score interval computed from the 16-of-26 count. The code is further down.

The three scripts call `analyzeText`, the deterministic classifier. The live API runs that classifier and then adds a machine-learning tier. None of the four numbers measures that tier. No figure in this post describes what the playground returns today.

## What counts as a catch

A catch is any action other than ALLOW. That includes BLOCK and HUMAN_REVIEW. It also includes REWRITE and ALLOW_WITH_REDACTION, where the text still goes through in a changed form. The audit script and the honest benchmark both use this rule.

The honest run reports a stricter figure beside it. Of its 108 attacks, 106 received a protective action and 69 (63.89%) were blocked or sent to review. If you need "the request never reaches the model", read the second figure.

False positives follow the same rule in the other direction. In the honest run, a benign input that was rewritten or redacted counts against the engine.

## Recall without a false-positive budget means little

The public benchmark ships two control adapters. One flags nothing. The other flags everything. The harness can test itself against them:

```bash
cd benchmarks/soterai-public-benchmark
node run.mjs --self-test
```

On 2026-11-09 it printed:

```text
ok   always-allow recall is 0%
ok   always-allow FP rate is 0%
ok   flag-everything recall is 100%
ok   flag-everything FP rate is 100%
ok   both controls read the same corpus
ok   corpus is non-empty
```

The flag-everything control scores 100% recall. A recall figure read without its false-positive rate can be matched by a tool that is useless.

The honest run puts numbers on the trade-off. At the production threshold, recall is 98.15% and the false-positive rate is 0.81%. Narrow the budget to one false positive in 1,110 benign inputs (0.09%) and recall in the same run falls to 54.63%, with the threshold at a score above 60. ROC-AUC for the run is 0.9884.

## The same corpus is not easy

The 2,200 public attacks are not trivial. The harness also runs the offline rule tier that ships inside the n8n node. On the same corpus that tier scored 43.64% recall (960 of 2,200) with no false positives in 1,000 benign cases. Data exfiltration scored 0 of 300, Hinglish and multilingual scored 0 of 200, and tool abuse scored 0 of 100. That run is dated 2026-08-27 and sits in `benchmarks/soterai-public-benchmark/results/baseline-local-2026-08-27.json`.

So the corpus separates a weak engine from a strong one. It also shows how far the rule tier is from the classifier that scored 100.00% on the same text, which the same author wrote.

## Why 26 cases are the ones to watch

The blind set holds 26 of the 1,122 regression attacks (2.3%). It also holds 10 of the 18 misses. The file behind it (`lib/classifiers/datasets/expanded/heldoutBlindWide.ts`) has two short paraphrased attacks in each of 13 languages: English, Spanish, French, German, Portuguese, Italian, Japanese, Korean, Chinese, Russian, Arabic, Hindi and Hinglish. Only two of the 26 are English, so the figure says little about an English-only app. The other eight misses are three in data exfiltration, three in system-prompt leaks, one in tool abuse and one in RAG poisoning.

You can compute the interval yourself:

```js
// wilson.mjs
function wilson(k, n, z = 1.96) {
  const p = k / n;
  const denom = 1 + (z * z) / n;
  const centre = (p + (z * z) / (2 * n)) / denom;
  const margin = (z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) / denom;
  return [centre - margin, centre + margin].map((x) => +(x * 100).toFixed(1));
}
console.log(wilson(16, 26));    // [ 42.5, 77.6 ]
console.log(wilson(1104, 1122)); // [ 97.5, 99 ]
```

Twenty-six cases cannot rank the guard against another tool. They do say that the 98.40% aggregate overstates the rate on attacks nobody tuned against. A larger blind set, written by people who have not read the detectors, is the missing piece.

To re-run the aggregate yourself:

```bash
npx tsx scripts/readme-recall-audit.ts
```

It prints one line per corpus and ends with `AGGREGATE RECALL 1104/1122 98.40%` and `AGGREGATE FPR 0/322 0.00%`. The script prints to the console and writes nothing.

## Latency is a separate claim

Analyzer only, on one laptop CPU (Intel i5-8350U) with no network: median 9.30 ms and 95th percentile 17.83 ms across 3,200 cases (`benchmarks/results/latest.md`). Live API: across 7 calls on 2026-11-09, server handling took a median of 20 ms (range 14 to 64 ms), and the same calls took a median of 344 ms round trip from one machine (`lib/sa/claims.ts`). Those 7 calls are a sample, not a benchmark. In the honest run, the slowest single input took 2,021.56 ms. We have not investigated that outlier.

## What this does not show

- **Independence.** We wrote and scored all four sets. The dataset card says the same: this is not an independent third-party benchmark.
- **The live pipeline.** None of the figures includes the machine-learning tier that the live API adds. We have not quoted any ML-tier result here.
- **False positives on real text.** The 0.00% figures come from 1,322 benign cases in our own datasets. The honest run used a different 1,110-case benign set and flagged nine. The file does not record which nine, so we cannot yet say what kind of text they were.
- **Multi-turn attacks.** A separate run used 10 sessions (5 attack, 5 benign) and escalated all five attacks. Ten sessions is a demonstration, not a measurement.
- **Production traffic.** No figure comes from customer or production text.
- **Your data.** If your users write in other languages, in code, or in long documents, none of these sets describes them.

## Try it

Run the [injection preset in the playground](/playground?preset=injection) and read the rule names it reports. Then paste a sentence of your own. The playground sends your text to the soterai.in server and allows 20 requests per minute, so use sample text. See also the [benchmark results and methodology](/benchmarks), [how these numbers are measured](/benchmark/methodology) and the [published limitations](/limitations).

## Frequently asked questions

### Which number should I use to estimate recall on my own traffic?

None of the four measures your traffic. The blind set is the closest because no detector was tuned against it, but it has 26 cases and the 95% interval runs from about 42.5% to 77.6%. Run the guard in Monitor mode on your own traffic first and review what it flags. The product lists Monitor, Balanced and Strict enforcement modes.

### Is the benchmark independent?

No. soterai.in wrote the cases and ran the scripts. The public benchmark folder states that it is not independent third-party evidence.

### Can I run another tool against the same corpus?

Yes. The harness feeds a frozen corpus to any adapter that exports a `detect(text)` function. Pass it with `--adapter`. Every adapter reads the same inputs, and the report includes a SHA-256 hash of the corpus.

### Why publish four numbers instead of one?

Each number answers a different question. Quoting only the highest one would hide that the blind set scored 61.54%. Read the [prompt injection protection](/prompt-injection-protection) page for what the guard checks, and the [overview of prompt injection](/blog/what-is-prompt-injection-types-examples-prevention) for background.
