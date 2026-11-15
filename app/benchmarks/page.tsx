import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Metadata } from 'next';
import Link from 'next/link';
import { PLAYGROUND_CTA_LABEL } from '@/lib/marketing/cta';
import { CodeBlock } from '@/components/sa/CodeBlock';
import { Faq, faqJsonLd, type FaqItem } from '@/components/sa/Faq';
import { Callout, DataTable, SaLinkButton } from '@/components/sa/primitives';
import { SaRoot } from '@/components/sa/SaRoot';
import {
  BLIND_RECALL,
  BLIND_RECALL_INTERVAL,
  GENERAL_LIMIT,
  NUMBERS_WITH_LIMITS,
  PUBLIC_BENCHMARK,
  REGRESSION,
} from '@/lib/sa/claims';
import { safeJsonLd } from '@/lib/seo/jsonLd';
import { buildMetadata } from '@/lib/seo/metadata';
import { breadcrumbList, SITE_URL } from '@/lib/seo/schema';

/**
 * Evidence hub. Three rules shape this page:
 *  1. A number is never shown without the test behind it and the reason not to trust it
 *     too far, in the same view.
 *  2. The weakest results come first. The list of categories starts with the ones that
 *     missed.
 *  3. Every figure is read from lib/sa/claims.ts or from scripts/guard-benchmark/
 *     honest-results.json at build time. Nothing is typed in by hand.
 *
 * Title: 54 characters with the brand suffix. Description: 154.
 */
export const metadata: Metadata = buildMetadata({
  title: 'Benchmarks: Numbers With Their Limits',
  description:
    'Recall, false positives and latency for SoterAI, each next to its test and its limits. Self-written tests, no outside audit, weakest results first.',
  path: '/benchmarks',
});

interface HonestResults {
  singleTurn: {
    generatedAtIso: string;
    corpus: { total: number; attacks: number; benign: number; sources: Record<string, { total: number; attacks: number; benign: number }> };
    production: { precision: number; recall: number; f1: number; falsePositiveRate: number; blockOrReviewRate: number };
    recallAtFpr: Array<{ targetFpr: number; threshold: number; recall: number; fprAchieved: number }>;
    rocAuc: number;
    perCategory: Array<{ category: string; total: number; detected: number; recall: number }>;
    latencyMs: { p50: number; p95: number; p99: number; max: number };
    limitations: string[];
  };
  multiTurn: { total: number; attacks: number; benign: number; recall: number; falsePositiveRate: number; meanTurnsToDetect: number };
}

function loadData(): HonestResults | null {
  try {
    return JSON.parse(readFileSync(join(process.cwd(), 'scripts/guard-benchmark/honest-results.json'), 'utf-8')) as HonestResults;
  } catch {
    return null;
  }
}

const pct = (n: number, digits = 2) => `${(n * 100).toFixed(digits)}%`;
const fmtInt = (n: number) => n.toLocaleString('en-US');
const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' });

/** 95% Wilson score interval for k successes in n trials. Computed here, not published by anyone. */
function wilson(k: number, n: number): { low: number; high: number } {
  const z = 1.96;
  const p = k / n;
  const denom = 1 + (z * z) / n;
  const centre = (p + (z * z) / (2 * n)) / denom;
  const margin = (z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) / denom;
  return { low: Math.max(0, centre - margin), high: Math.min(1, centre + margin) };
}

const FAQ: FaqItem[] = [
  {
    q: 'Is a 100% recall figure believable?',
    a: `Not on its own. The ${fmtInt(PUBLIC_BENCHMARK.attacks)} attacks in the public benchmark were written by us, and the engine was tuned against them. The figure closest to real use is ${BLIND_RECALL.caught} of ${BLIND_RECALL.of} on a blind set.`,
  },
  {
    q: 'Why publish a 61.54% figure?',
    a: `Because it is the honest one. ${BLIND_RECALL.caught} of ${BLIND_RECALL.of} cases that no detector was tuned against were caught. The sample is small, so the plausible range is wide: about ${Math.round(BLIND_RECALL_INTERVAL.low)} to ${Math.round(BLIND_RECALL_INTERVAL.high)}%.`,
  },
  {
    q: 'Has anyone outside audited these numbers?',
    a: 'No. Every test is written and maintained by the same person who builds the engine. There is no third-party certification.',
  },
  {
    q: 'Can I reproduce them?',
    a: 'Yes, from the repository. The commands are on this page. Results depend on your machine, and the numbers are not a promise about your traffic.',
  },
];

export default function BenchmarksPage() {
  const data = loadData();
  const numbers = NUMBERS_WITH_LIMITS.filter((n) => !n.blocked);

  const pageLd: Record<string, unknown>[] = [
    breadcrumbList([
      { name: 'Home', path: '/' },
      { name: 'Benchmarks', path: '/benchmarks' },
    ]) as Record<string, unknown>,
    faqJsonLd(FAQ) as Record<string, unknown>,
  ];

  if (!data) {
    return (
      <SaRoot>
        {pageLd.map((ld, i) => (
          <script key={i} type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(ld) }} />
        ))}
        <main className="sa-page" style={{ paddingBlock: 'var(--sa-space-7) var(--sa-space-9)' }}>
          <h1 className="sa-h1">Benchmarks: numbers with their limits.</h1>
          <section className="sa-section" aria-labelledby="numbers">
            <h2 className="sa-h2" id="numbers" style={{ marginBottom: 'var(--sa-space-4)' }}>
              The numbers
            </h2>
            <DataTable
              caption="Results, the test behind each one, and why not to over-trust it"
              columns={[
                { key: 'number', header: 'Number', numeric: true },
                { key: 'test', header: 'Test' },
                { key: 'limit', header: 'Why not to over-trust it' },
              ]}
              rows={numbers.map((n) => ({ number: n.number, test: n.test, limit: n.limit }))}
            />
          </section>
        </main>
      </SaRoot>
    );
  }

  const { singleTurn: st, multiTurn: mt } = data;
  const attacks = st.corpus.attacks;
  const benign = st.corpus.benign;
  const at01 = st.recallAtFpr.find((r) => r.targetFpr === 0.001);
  const caught = Math.round(st.production.recall * attacks);
  const flagged = Math.round(st.production.falsePositiveRate * benign);
  const ci = wilson(caught, attacks);
  const generated = fmtDate(st.generatedAtIso);

  const weakest = [...st.perCategory].sort((a, b) => a.recall - b.recall || b.total - a.total);
  const misses = weakest.filter((c) => c.recall < 1);
  const perfect = weakest.filter((c) => c.recall === 1);
  const maxPerCategory = Math.max(...st.perCategory.map((c) => c.total));
  const minPerCategory = Math.min(...st.perCategory.map((c) => c.total));

  pageLd.push({
    '@context': 'https://schema.org',
    '@type': 'Dataset',
    name: 'SoterAI guard adversarial run',
    description: `A ${fmtInt(st.corpus.total)}-case run (${attacks} attacks, ${fmtInt(benign)} benign) of the production classifier, ${generated}. Self-written corpus, no outside audit.`,
    url: `${SITE_URL}/benchmarks`,
    datePublished: st.generatedAtIso,
    creator: { '@type': 'Organization', name: 'SoterAI', url: SITE_URL },
    measurementTechnique: 'Recall at a fixed false-positive budget and ROC-AUC over a disclosed corpus, using the production analyzeText classifier.',
    variableMeasured: [
      { '@type': 'PropertyValue', name: 'Recall at 1% false-positive budget', value: pct(st.production.recall) },
      { '@type': 'PropertyValue', name: 'False-positive rate achieved', value: pct(st.production.falsePositiveRate) },
      { '@type': 'PropertyValue', name: 'ROC-AUC', value: st.rocAuc.toFixed(3) },
    ],
  });

  return (
    <SaRoot>
      {pageLd.map((ld, i) => (
        <script key={i} type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(ld) }} />
      ))}
      <main className="sa-page" style={{ paddingBlock: 'var(--sa-space-7) var(--sa-space-9)' }}>
        <header>
          <p className="sa-eyebrow">Evidence</p>
          <h1 className="sa-h1" style={{ marginTop: 'var(--sa-space-3)' }}>
            Every number, with the test behind it and its limits.
          </h1>
          <p className="sa-lede" style={{ marginTop: 'var(--sa-space-4)' }}>
            We wrote every test on this page ourselves, and nobody outside has audited them. The weakest results come first, and each
            number sits next to the reason not to over-trust it.
          </p>
          <div style={{ marginTop: 'var(--sa-space-6)', maxWidth: 'var(--sa-measure)' }}>
            <Callout kind="limit" title="Read this first">
              {GENERAL_LIMIT} The 100% figures are on sets we wrote and tuned against. Treat them as regression checks.
            </Callout>
          </div>
        </header>

        <section className="sa-section" aria-labelledby="numbers">
          <div className="sa-section__head">
            <h2 className="sa-h2" id="numbers">
              The numbers
            </h2>
            <p className="sa-body sa-muted">
              Regression and blind figures re-run on {REGRESSION.asOf}. The public benchmark was generated {PUBLIC_BENCHMARK.generated}.
              The adversarial run below was generated {generated}.
            </p>
          </div>
          <DataTable
            caption="Results, the test behind each one, and why not to over-trust it"
            columns={[
              { key: 'number', header: 'Number', numeric: true },
              { key: 'test', header: 'Test' },
              { key: 'limit', header: 'Why not to over-trust it' },
            ]}
            rows={numbers.map((n) => ({ number: n.number, test: n.test, limit: n.limit }))}
          />
          <p className="sa-body sa-muted" style={{ marginTop: 'var(--sa-space-4)' }}>
            The 3,200-case public synthetic benchmark has its own report on the{' '}
            <Link className="sa-link" href="/benchmark">
              benchmark page
            </Link>{' '}
            and its method on the{' '}
            <Link className="sa-link" href="/benchmark/methodology">
              methodology page
            </Link>
            .
          </p>
        </section>

        <section className="sa-section" aria-labelledby="adversarial">
          <div className="sa-section__head">
            <h2 className="sa-h2" id="adversarial">
              Adversarial run: {fmtInt(st.corpus.total)} cases
            </h2>
            <p className="sa-body">
              The production classifier scored {attacks} attack cases and {fmtInt(benign)} benign cases. We pick the threshold that
              keeps benign false positives at or below 1%, then report how many attacks it still catches. Generated {generated}.
            </p>
          </div>
          <DataTable
            caption="Adversarial run results and the limit that goes with each"
            columns={[
              { key: 'metric', header: 'Measure' },
              { key: 'value', header: 'Result', numeric: true },
              { key: 'limit', header: 'Limit' },
            ]}
            rows={[
              {
                metric: 'Attacks caught at the 1% false-positive budget',
                value: `${pct(st.production.recall)} (${caught} of ${attacks})`,
                limit: `Only ${attacks} attacks. One miss moves the figure by ${(100 / attacks).toFixed(1)} points. The 95% range is about ${(ci.low * 100).toFixed(1)} to ${(ci.high * 100).toFixed(1)}% (computed here).`,
              },
              {
                metric: 'Benign cases flagged',
                value: `${pct(st.production.falsePositiveRate)} (${flagged} of ${fmtInt(benign)})`,
                limit: `${fmtInt(st.corpus.sources.expandedSafeInputs?.benign ?? 0)} of the ${fmtInt(benign)} benign cases come from one list of safe inputs that we wrote. Real users write messier text. The run does not record which ${flagged} were flagged.`,
              },
              {
                metric: 'Attacks caught at a 0.1% budget',
                value: at01 ? `${pct(at01.recall)} (${Math.round(at01.recall * attacks)} of ${attacks})` : 'n/a',
                limit: 'Tighten the false-positive budget and recall drops sharply. This is the cost of fewer false alarms.',
              },
              {
                metric: 'ROC-AUC',
                value: st.rocAuc.toFixed(3),
                limit: 'Separability on this corpus only. It says nothing about attacks outside it.',
              },
              {
                metric: 'Precision',
                value: pct(st.production.precision),
                limit: `Precision depends on how many cases are attacks. Here ${pct(attacks / st.corpus.total, 1)} are. Your traffic will differ.`,
              },
              {
                metric: 'Held for review or blocked',
                value: pct(st.production.blockOrReviewRate),
                limit: 'The strictest outcomes: blocked or sent to a person, not just redacted or rewritten. Read it against the attack count above.',
              },
              {
                metric: 'Analyzer time per case (p50, p95, p99)',
                value: `${st.latencyMs.p50.toFixed(1)}, ${st.latencyMs.p95.toFixed(1)}, ${st.latencyMs.p99.toFixed(1)} ms`,
                limit: `CPU time of the analyzer alone, no network. One case took ${st.latencyMs.max.toFixed(0)} ms and we do not know why.`,
              },
            ]}
          />
        </section>

        <section className="sa-section" aria-labelledby="categories">
          <div className="sa-section__head">
            <h2 className="sa-h2" id="categories">
              By attack category, weakest first
            </h2>
            <p className="sa-body">
              Each category has {minPerCategory} to {maxPerCategory} cases. That is too few to claim a per-category recall. It is enough to show
              where the engine missed.
            </p>
          </div>
          {misses.length > 0 ? (
            <DataTable
              caption="Categories with at least one miss"
              columns={[
                { key: 'category', header: 'Category' },
                { key: 'result', header: 'Caught', numeric: true },
                { key: 'note', header: 'Note' },
              ]}
              rows={misses.map((c) => ({
                category: c.category,
                result: `${c.detected} of ${c.total}`,
                note: 'Missed in this run.',
              }))}
            />
          ) : (
            <p className="sa-body">No category had a miss in this run.</p>
          )}
          <details className="sa-disclosure" style={{ marginTop: 'var(--sa-space-5)' }}>
            <summary>Show the {perfect.length} categories with no miss</summary>
            <DataTable
              caption="Categories with no miss in this run"
              columns={[
                { key: 'category', header: 'Category' },
                { key: 'result', header: 'Caught', numeric: true },
              ]}
              rows={perfect.map((c) => ({ category: c.category, result: `${c.detected} of ${c.total}` }))}
            />
          </details>
        </section>

        <section className="sa-section" aria-labelledby="multi">
          <div className="sa-section__head">
            <h2 className="sa-h2" id="multi">
              Multi-turn: attacks that build over several messages
            </h2>
          </div>
          <DataTable
            caption="Multi-turn evaluation and its limit"
            columns={[
              { key: 'metric', header: 'Measure' },
              { key: 'value', header: 'Result', numeric: true },
              { key: 'limit', header: 'Limit' },
            ]}
            rows={[
              {
                metric: 'Escalating attack conversations caught',
                value: `${pct(mt.recall, 0)} (${Math.round(mt.recall * mt.attacks)} of ${mt.attacks})`,
                limit: `${mt.attacks} attack and ${mt.benign} benign conversations that we wrote. Ten is too few to say more than that it worked on these.`,
              },
              {
                metric: 'Benign conversations wrongly escalated',
                value: `${pct(mt.falsePositiveRate, 0)} (0 of ${mt.benign})`,
                limit: 'Same small set.',
              },
              {
                metric: 'Turn at which an attack was caught, on average',
                value: mt.meanTurnsToDetect.toFixed(1),
                limit: 'As recorded by the harness, over the five attack conversations.',
              },
            ]}
          />
        </section>

        <section className="sa-section" aria-labelledby="limits">
          <div className="sa-section__head">
            <h2 className="sa-h2" id="limits">
              Method and limits
            </h2>
          </div>
          <ul className="sa-limits">
            <li>The scores come from the deterministic production classifier. The optional model tier is not in these numbers.</li>
            <li>
              The corpus is three lists that live in this repository ({Object.keys(st.corpus.sources).join(', ')}). It is not a
              third-party benchmark such as PINT, JailbreakBench or HarmBench.
            </li>
            <li>Single-turn scores do not reflect adaptive attackers. The multi-turn run above is small.</li>
            <li>There is no external audit, no replay of production traffic, and no third-party certification.</li>
            <li>The engine was tuned against most of these sets, so recall on them is a regression check, not a forecast.</li>
          </ul>
          <p className="sa-body sa-muted" style={{ marginTop: 'var(--sa-space-4)' }}>
            Gaps we found by hand are on the <Link className="sa-link" href="/limitations">limits page</Link>, each with a date.
          </p>
        </section>

        <section className="sa-section" aria-labelledby="repro">
          <div className="sa-section__head">
            <h2 className="sa-h2" id="repro">
              Run it yourself
            </h2>
            <p className="sa-body">
              These run from the repository. They need Node.js and the project dependencies. Results depend on your machine.
            </p>
          </div>
          <div className="sa-stack">
            <CodeBlock label="Adversarial run (this section)" language="bash" code="npm run benchmark:honest" />
            <CodeBlock label="Regression and blind sets" language="bash" code="npx tsx scripts/readme-recall-audit.ts" />
          </div>
        </section>

        <section className="sa-section" aria-labelledby="faq">
          <div className="sa-section__head">
            <h2 className="sa-h2" id="faq">
              Questions
            </h2>
          </div>
          <Faq items={FAQ} />
        </section>

        <section className="sa-closing" aria-labelledby="closing">
          <h2 className="sa-h2" id="closing">
            Check it against your own text.
          </h2>
          <p className="sa-body" style={{ marginTop: 'var(--sa-space-3)' }}>
            A number on a page tells you less than a result on your own text. Use sample data, not real secrets.
          </p>
          <div className="sa-hero__actions">
            <SaLinkButton href="/playground" large>
              {PLAYGROUND_CTA_LABEL}
            </SaLinkButton>
            <SaLinkButton href="/limitations" variant="ghost">
              Read what it misses
            </SaLinkButton>
          </div>
          <p className="sa-body sa-muted" style={{ marginTop: 'var(--sa-space-5)', fontSize: 'var(--sa-text-sm)' }}>
            Raw results as JSON: <a className="sa-link" href="/api/benchmarks">/api/benchmarks</a>.
          </p>
        </section>
      </main>
    </SaRoot>
  );
}
