/**
 * Claims register, as constants.
 *
 * Every number the redesigned pages show lives here, with where it came from.
 * Change a figure here and every page that uses it changes with it. If a source
 * moves, update the figure and the "asOf" date together. Do not type these into
 * page copy by hand.
 *
 * Sources checked 2026-11-09.
 */

/**
 * Regression corpora: 1,122 attacks, 98.40% mitigated. Reproduced on 2026-11-09
 * with `npx tsx scripts/readme-recall-audit.ts` (1,104 of 1,122 attacks and 0 of
 * 322 benign controls mitigated). Published at https://soterai.in/llms.txt.
 */
export const REGRESSION = {
  attacksCaught: 1104,
  attacks: 1122,
  benignFlagged: 0,
  benign: 322,
  asOf: '2026-11-09',
} as const;

/** Blind held-out recall: 61.54% over 26 cases. Reproduced 2026-11-09 with the same script. */
export const BLIND_RECALL = { caught: 16, of: 26, asOf: '2026-11-09' } as const;

/** 95% Wilson interval for 16/26, computed (not published by the vendor). */
export const BLIND_RECALL_INTERVAL = { low: 42.5, high: 77.6 } as const;

/**
 * Public synthetic benchmark: a separate, self-written corpus of 3,200 cases
 * (2,200 attacks and 1,000 benign controls). Source: benchmarks/results/latest.md,
 * generated 2026-07-22. This is NOT the 322-control regression set above; the two
 * are different test sets and both showed 0.00% false positives.
 */
export const PUBLIC_BENCHMARK = {
  cases: 3200,
  attacks: 2200,
  benign: 1000,
  recallPct: '100.00%',
  falsePositivePct: '0.00%',
  generated: '2026-07-22',
  analyzerP50Ms: '9.30',
  analyzerP95Ms: '17.83',
  analyzerP99Ms: '31.31',
} as const;

/**
 * Live API sample, taken 2026-11-09 against https://soterai.in/api/guard/analyze:
 * seven calls, synthetic text, one machine. Server handling time came from the
 * response's `latencyMs`; round trip was timed by the client.
 */
export const LIVE_LATENCY_SAMPLE = {
  calls: 7,
  serverMedianMs: 20,
  serverMinMs: 14,
  serverMaxMs: 64,
  roundTripMedianMs: 344,
  asOf: '2026-11-09',
} as const;

/** One sentence for any page that needs to say how fast a check is. */
export const LATENCY_SENTENCE =
  `In ${LIVE_LATENCY_SAMPLE.calls} live calls on ${LIVE_LATENCY_SAMPLE.asOf}, the server took a median of ` +
  `${LIVE_LATENCY_SAMPLE.serverMedianMs} ms (range ${LIVE_LATENCY_SAMPLE.serverMinMs} to ${LIVE_LATENCY_SAMPLE.serverMaxMs} ms), ` +
  `and the same calls took a median of ${LIVE_LATENCY_SAMPLE.roundTripMedianMs} ms round trip from one machine.`;

/** The same fact for the local analyzer, which runs without the API or network. */
export const ANALYZER_LATENCY_SENTENCE =
  `In one local CPU run over ${PUBLIC_BENCHMARK.cases.toLocaleString('en-US')} cases, the analyzer alone had a median of ` +
  `${PUBLIC_BENCHMARK.analyzerP50Ms} ms and a 95th percentile of ${PUBLIC_BENCHMARK.analyzerP95Ms} ms. ` +
  `That excludes the API, the network and authentication, and it was not run under load.`;

/** The line shown under every live result. */
export const GENERAL_LIMIT =
  `A verdict is one engine's opinion on one text, and it misses things. ` +
  `On ${BLIND_RECALL.of} blind test cases it caught ${BLIND_RECALL.caught}.`;

/** Shown where the playground sends text to the soterai.in server. */
export const PRIVACY_NOTE =
  'The public playground sends your text to the soterai.in server and is rate limited. ' +
  'Use sample data, not real secrets.';

export interface NumberWithLimit {
  number: string;
  test: string;
  limit: string;
}

/**
 * "Numbers with their limits". Latency is quoted from measured runs, never as a
 * promise. Two different benign sets are shown with their own names: the 322
 * controls in the regression run and the 1,000 controls in the public synthetic
 * benchmark. They were once presented as one figure with two different counts.
 */
export const NUMBERS_WITH_LIMITS: Array<NumberWithLimit & { blocked?: string }> = [
  {
    number: `${PUBLIC_BENCHMARK.recallPct} recall`,
    test: `${PUBLIC_BENCHMARK.attacks.toLocaleString('en-US')} synthetic attacks in the public benchmark`,
    limit: 'We wrote the tests and tuned the engine against them.',
  },
  {
    number: '98.40% recall',
    test: `${REGRESSION.attacks.toLocaleString('en-US')} attacks, all regression test sets combined`,
    limit: 'Includes sets used for tuning.',
  },
  {
    number: `${((BLIND_RECALL.caught / BLIND_RECALL.of) * 100).toFixed(2)}% recall (about ${Math.round(BLIND_RECALL_INTERVAL.low)} to ${Math.round(BLIND_RECALL_INTERVAL.high)}%)`,
    test: `${BLIND_RECALL.of} blind held-out cases`,
    limit: 'A small sample, and the figure closest to real use.',
  },
  {
    number: `${PUBLIC_BENCHMARK.falsePositivePct} false positives`,
    test: `${PUBLIC_BENCHMARK.benign.toLocaleString('en-US')} benign controls in the public benchmark`,
    limit: 'Synthetic text written by us. Real users write messier text.',
  },
  {
    number: `${REGRESSION.benignFlagged}.00% false positives`,
    test: `${REGRESSION.benign} benign controls in the regression run`,
    limit: 'A different, smaller set than the row above. Same limit: synthetic or hand-written text.',
  },
  {
    number: `p50 ${PUBLIC_BENCHMARK.analyzerP50Ms} ms, p95 ${PUBLIC_BENCHMARK.analyzerP95Ms} ms`,
    test: `Analyzer only, ${PUBLIC_BENCHMARK.cases.toLocaleString('en-US')} cases, one local CPU run (${PUBLIC_BENCHMARK.generated})`,
    limit: 'Excludes the API, network and authentication. Not run under load.',
  },
  {
    number: `Median ${LIVE_LATENCY_SAMPLE.serverMedianMs} ms`,
    test: `Server handling time, ${LIVE_LATENCY_SAMPLE.calls} live API calls on ${LIVE_LATENCY_SAMPLE.asOf} (range ${LIVE_LATENCY_SAMPLE.serverMinMs} to ${LIVE_LATENCY_SAMPLE.serverMaxMs} ms)`,
    limit: `A sample, not a benchmark. The same calls took a median ${LIVE_LATENCY_SAMPLE.roundTripMedianMs} ms round trip from one machine.`,
  },
];
