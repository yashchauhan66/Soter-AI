import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { CodeBlock } from '@/components/sa/CodeBlock';
import { Faq, faqJsonLd, type FaqItem } from '@/components/sa/Faq';
import { PricingPlans } from '@/components/sa/PricingPlans';
import { Playground } from '@/components/sa/Playground';
import {
  Callout,
  DataTable,
  Metric,
  SaButton,
  SaLinkButton,
  Stamp,
  StatusBadge,
} from '@/components/sa/primitives';
import { ReviewDocument, ReviewNotes, VerdictLegend, AfterView } from '@/components/sa/ReviewView';
import { SaRoot } from '@/components/sa/SaRoot';
import { Tabs } from '@/components/sa/Tabs';
import { BILLING_NOTE, PLANS, PLANS_STATEMENT } from '@/lib/sa/pricing';
import { NUMBERS_WITH_LIMITS } from '@/lib/sa/claims';
import { buildReview, type AnalyzeResult } from '@/lib/sa/review';

/**
 * Design system preview. Not a product page.
 *  - Never indexed.
 *  - Returns 404 in production unless NEXT_PUBLIC_SA_PREVIEW=1 is set at build.
 *  - Not in the sitemap.
 */
export const metadata: Metadata = {
  title: 'Design system preview',
  robots: { index: false, follow: false },
};

// History: this route used to serve the not-found screen with HTTP 200 because the
// root app/loading.tsx sent the status line before a page could call notFound().
// That file was removed in Phase 6 (it also pushed every page's H1 into a hidden
// streamed block). Unknown URLs now return a real 404.

// A fixed example so the static components can be shown without calling the engine.
// It is the response recorded on 2026-11-09 for the "personal data" sample.
const SAMPLE_TEXT = 'Contact jane.doe@example.com or +1 415 555 0132.';
const SAMPLE_RESULT: AnalyzeResult = {
  allowed: true,
  action: 'ALLOW_WITH_REDACTION',
  riskScore: 33,
  reason: 'Allowed after sensitive values were redacted: Email address, Phone number.',
  latencyMs: 14,
  redactedText: 'Contact [REDACTED_EMAIL] or [REDACTED_PHONE].',
  findings: [
    { label: 'Email address', severity: 'MEDIUM', score: 25, start: 8, end: 28, redactionToken: '[REDACTED_EMAIL]', message: 'An email address was detected.' },
    { label: 'Phone number', severity: 'MEDIUM', score: 25, start: 32, end: 47, redactionToken: '[REDACTED_PHONE]', message: 'A phone number was detected.' },
  ],
};

const FAQ_SAMPLE: FaqItem[] = [
  { q: 'What is a command layer?', a: 'A command layer decides, for every prompt, reply and agent action, whether to allow, redact, block or hold it for approval, and keeps the record.' },
  { q: 'Does it guarantee security?', a: 'No. It lowers risk and it misses things. On 26 blind test cases it caught 16.' },
];

const SNIPPET = `curl -X POST https://soterai.in/api/guard/analyze \\
  -H "Content-Type: application/json" \\
  -d '{"text":"Contact jane.doe@example.com","direction":"INPUT"}'`;

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section aria-labelledby={id} style={{ padding: 'var(--sa-space-7) 0', borderTop: '1px solid rgb(var(--sa-hairline))' }}>
      <h2 className="sa-h2" id={id} style={{ marginBottom: 'var(--sa-space-5)' }}>
        {title}
      </h2>
      {children}
    </section>
  );
}

export default function DesignSystemPage() {
  if (process.env.NODE_ENV === 'production' && process.env.NEXT_PUBLIC_SA_PREVIEW !== '1') notFound();

  const model = buildReview(SAMPLE_TEXT, SAMPLE_RESULT);

  return (
    <SaRoot>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd(FAQ_SAMPLE)) }} />
      <main className="sa-page" style={{ paddingBlock: 'var(--sa-space-7)' }}>
        <p className="sa-eyebrow">SoterAI design system · preview</p>
        <h1 className="sa-h1" style={{ marginTop: 'var(--sa-space-3)' }}>
          Decide what your AI can see, say and do.
        </h1>
        <p className="sa-lede" style={{ marginTop: 'var(--sa-space-4)' }}>
          Every component below, in every state. The live playground at the bottom calls the real engine.
        </p>

        <Section id="buttons" title="Buttons">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--sa-space-3)', alignItems: 'center' }}>
            <SaButton>Primary</SaButton>
            <SaButton variant="secondary">Secondary</SaButton>
            <SaButton variant="ghost">Ghost</SaButton>
            <SaButton disabled>Disabled</SaButton>
            <SaButton loading loadingLabel="Checking">
              Loading
            </SaButton>
            <SaButton large>Large</SaButton>
            <SaLinkButton href="/playground" variant="secondary">
              Link button
            </SaLinkButton>
          </div>
        </Section>

        <Section id="verdicts" title="Verdicts and status">
          <div style={{ display: 'grid', gap: 'var(--sa-space-5)' }}>
            <VerdictLegend />
            <div style={{ display: 'flex', gap: 'var(--sa-space-3)', alignItems: 'center', flexWrap: 'wrap' }}>
              <StatusBadge status="Stable" />
              <StatusBadge status="Beta" />
              <StatusBadge status="Labs" />
            </div>
          </div>
        </Section>

        <Section id="review" title="Review Mode">
          <div className="sa-review sa-review--with-notes">
            <div className="sa-stack">
              <ReviewDocument model={model} idPrefix="demo" />
              <AfterView result={SAMPLE_RESULT} verdict={model.verdict} />
              <Stamp verdict={model.verdict} risk={model.riskScore} />
            </div>
            <ReviewNotes model={model} idPrefix="demo" />
          </div>
          <p className="sa-muted" style={{ marginTop: 'var(--sa-space-4)' }}>
            Static example: a response recorded from the live engine on 2026-11-09.
          </p>
        </Section>

        <Section id="callouts" title="Callouts">
          <div className="sa-stack">
            <Callout kind="note">Plain information the reader may want.</Callout>
            <Callout kind="limit">What a number or a claim does not tell you.</Callout>
            <Callout kind="error">Something failed, and the page says what.</Callout>
          </div>
        </Section>

        <Section id="tables" title="Numbers with their limits">
          <DataTable
            caption="Every number comes with the test it came from"
            columns={[
              { key: 'number', header: 'Number', numeric: true },
              { key: 'test', header: 'Test' },
              { key: 'limit', header: 'Why not to over-trust it' },
            ]}
            rows={NUMBERS_WITH_LIMITS.map((n) => ({
              number: n.blocked ? `${n.number} (not published yet)` : n.number,
              test: n.test,
              limit: n.blocked ?? n.limit,
            }))}
          />
          <div style={{ display: 'flex', gap: 'var(--sa-space-6)', flexWrap: 'wrap', marginTop: 'var(--sa-space-5)' }}>
            <Metric value="20 ms" label="median engine time, 7 live calls" />
            <Metric value="16 of 26" label="blind cases caught" />
          </div>
          <div style={{ marginTop: 'var(--sa-space-5)' }}>
            <DataTable caption="Empty state" columns={[{ key: 'a', header: 'Finding' }]} rows={[]} empty="The engine reported no findings." />
          </div>
        </Section>

        <Section id="tabs" title="Tabs and code">
          <Tabs
            label="Example tabs"
            items={[
              { id: 'one', label: 'curl', content: <CodeBlock label="curl" language="bash" code={SNIPPET} /> },
              { id: 'two', label: 'Notes', content: <p className="sa-body">Arrow keys move between tabs. Home and End jump to the first and last.</p> },
            ]}
          />
        </Section>

        <Section id="faq" title="FAQ">
          <Faq items={FAQ_SAMPLE} />
        </Section>

        <Section id="pricing" title="Plans">
          <p className="sa-lede" style={{ marginBottom: 'var(--sa-space-5)' }}>
            {PLANS_STATEMENT}
          </p>
          <PricingPlans plans={PLANS} />
          <div style={{ marginTop: 'var(--sa-space-5)' }}>
            <Callout kind="note" title="Billing">
              {BILLING_NOTE}
            </Callout>
          </div>
        </Section>

        <Section id="playground" title="Live playground">
          <Playground initialPresetId="personal-data" />
        </Section>
      </main>
    </SaRoot>
  );
}
